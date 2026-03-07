"""Training script for the latent diffusion model."""

import copy
import csv
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset, random_split
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.autoencoder import KickVAE
from models.diffusion import LatentUNet, NoiseScheduler
from models.text_encoder import KeywordEncoder, build_vocab
from training.config import DiffusionConfig


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class LatentDataset(Dataset):
    """Dataset of pre-encoded VAE latents with keyword token IDs."""

    def __init__(
        self,
        latents_dir: Path,
        metadata_csv: Path,
        vocab: list[str],
    ) -> None:
        self.latent_files = sorted(
            f for f in latents_dir.glob("*.pt") if not f.name.startswith("._")
        )
        if not self.latent_files:
            raise FileNotFoundError(f"No .pt files in {latents_dir}")

        # Build keyword lookup: filename_stem -> list of keyword strings
        self.kw_to_idx = {kw: i for i, kw in enumerate(vocab)}
        self.keywords: dict[str, list[int]] = {}
        with open(metadata_csv) as f:
            reader = csv.DictReader(f)
            for row in reader:
                stem = Path(row["filename"]).stem
                ids = []
                for kw in row["keywords"].split(","):
                    kw = kw.strip().lower()
                    if kw in self.kw_to_idx:
                        ids.append(self.kw_to_idx[kw])
                self.keywords[stem] = ids

    def __len__(self) -> int:
        return len(self.latent_files)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, list[int]]:
        path = self.latent_files[idx]
        latent = torch.load(path, weights_only=False)
        # latent filename matches mel filename stem
        stem = path.stem
        token_ids = self.keywords.get(stem, [])
        return latent, token_ids


def collate_fn(
    batch: list[tuple[torch.Tensor, list[int]]],
) -> tuple[torch.Tensor, list[list[int]]]:
    """Custom collate to handle variable-length keyword lists."""
    latents = torch.stack([b[0] for b in batch])
    token_ids = [b[1] for b in batch]
    return latents, token_ids


# ---------------------------------------------------------------------------
# Pre-encode latents
# ---------------------------------------------------------------------------

def pre_encode_latents(cfg: DiffusionConfig) -> None:
    """Encode all mel spectrograms to latents using frozen VAE."""
    cfg.latents_dir.mkdir(parents=True, exist_ok=True)

    # Check if already done
    existing = list(cfg.latents_dir.glob("*.pt"))
    if len(existing) > 100:
        print(f"Latents dir already has {len(existing)} files, skipping encoding.")
        return

    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )

    # Load VAE
    checkpoint = torch.load(cfg.vae_checkpoint, weights_only=False)
    vae = KickVAE(latent_dim=cfg.latent_dim).to(device)
    vae.load_state_dict(checkpoint["model_state_dict"])
    vae.eval()

    mel_files = sorted(
        f for f in cfg.data_dir.glob("*.pt") if not f.name.startswith("._")
    )
    print(f"Encoding {len(mel_files)} mel spectrograms to latents...")

    with torch.no_grad():
        for f in tqdm(mel_files):
            out_path = cfg.latents_dir / f.name
            if out_path.exists():
                continue
            mel = torch.load(f, weights_only=False).unsqueeze(0).to(device)
            latent = vae.encode(mel).squeeze(0).cpu()
            torch.save(latent, out_path)

    print("Latent encoding complete.")


# ---------------------------------------------------------------------------
# EMA
# ---------------------------------------------------------------------------

class EMA:
    """Exponential moving average of model parameters."""

    def __init__(self, model: torch.nn.Module, decay: float = 0.9999) -> None:
        self.decay = decay
        self.shadow = copy.deepcopy(model)
        self.shadow.eval()
        for p in self.shadow.parameters():
            p.requires_grad_(False)

    @torch.no_grad()
    def update(self, model: torch.nn.Module) -> None:
        for s, p in zip(self.shadow.parameters(), model.parameters()):
            s.data.mul_(self.decay).add_(p.data, alpha=1 - self.decay)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(cfg: DiffusionConfig | None = None) -> None:
    if cfg is None:
        cfg = DiffusionConfig()

    # Pre-encode latents
    pre_encode_latents(cfg)

    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"Using device: {device}")

    # Build vocab and dataset
    vocab = build_vocab(cfg.metadata_csv)
    print(f"Vocabulary size: {len(vocab)}")

    dataset = LatentDataset(cfg.latents_dir, cfg.metadata_csv, vocab)
    val_size = int(len(dataset) * cfg.val_split)
    train_size = len(dataset) - val_size
    train_set, val_set = random_split(
        dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )

    train_loader = DataLoader(
        train_set,
        batch_size=cfg.batch_size,
        shuffle=True,
        num_workers=cfg.num_workers,
        pin_memory=True,
        collate_fn=collate_fn,
    )
    val_loader = DataLoader(
        val_set,
        batch_size=cfg.batch_size,
        shuffle=False,
        num_workers=cfg.num_workers,
        pin_memory=True,
        collate_fn=collate_fn,
    )
    print(f"Train: {train_size}, Val: {val_size}")

    # Model
    model = LatentUNet(
        latent_dim=cfg.latent_dim,
        base_channels=cfg.base_channels,
        cond_dim=cfg.cond_dim,
    ).to(device)
    text_enc = KeywordEncoder(
        vocab_size=len(vocab),
        embed_dim=cfg.text_embed_dim,
        cond_dim=cfg.cond_dim,
    ).to(device)

    scheduler = NoiseScheduler(cfg.timesteps, cfg.beta_start, cfg.beta_end).to(device)
    ema = EMA(model, cfg.ema_decay)

    optimizer = torch.optim.AdamW(
        list(model.parameters()) + list(text_enc.parameters()),
        lr=cfg.learning_rate,
    )
    scaler = torch.amp.GradScaler(enabled=cfg.use_amp and device.type == "cuda")

    # Logging
    cfg.log_dir.mkdir(parents=True, exist_ok=True)
    cfg.checkpoint_dir.mkdir(parents=True, exist_ok=True)
    writer = SummaryWriter(cfg.log_dir)

    # Training loop (iteration-based)
    global_step = 0
    model.train()
    text_enc.train()

    print(f"Training for {cfg.iterations} iterations...")

    while global_step < cfg.iterations:
        for latents, token_ids in train_loader:
            if global_step >= cfg.iterations:
                break

            latents = latents.to(device)
            batch_size = latents.shape[0]

            # Classifier-free guidance dropout: replace keywords with empty list
            dropped_ids = []
            for ids in token_ids:
                if torch.rand(1).item() < cfg.cfg_dropout:
                    dropped_ids.append([])
                else:
                    dropped_ids.append(ids)

            # Sample timesteps and noise
            t = torch.randint(0, cfg.timesteps, (batch_size,), device=device)
            noise = torch.randn_like(latents)
            noisy = scheduler.add_noise(latents, noise, t)

            with torch.amp.autocast(
                device_type=device.type,
                enabled=cfg.use_amp and device.type == "cuda",
            ):
                cond = text_enc(dropped_ids, device)
                pred_noise = model(noisy, t, cond)
                loss = torch.nn.functional.mse_loss(pred_noise, noise)
                loss = loss / cfg.gradient_accumulation

            scaler.scale(loss).backward()

            if (global_step + 1) % cfg.gradient_accumulation == 0:
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()
                ema.update(model)

            # Logging
            if global_step % 50 == 0:
                writer.add_scalar(
                    "train/loss", loss.item() * cfg.gradient_accumulation, global_step
                )

            if global_step % 500 == 0:
                print(
                    f"Step {global_step}/{cfg.iterations} "
                    f"loss={loss.item() * cfg.gradient_accumulation:.6f}"
                )

            # Validation
            if global_step % 1000 == 0 and global_step > 0:
                model.eval()
                text_enc.eval()
                val_loss_sum = 0.0
                val_count = 0
                with torch.no_grad():
                    for vl, vt in val_loader:
                        vl = vl.to(device)
                        vt_step = torch.randint(
                            0, cfg.timesteps, (vl.shape[0],), device=device
                        )
                        vn = torch.randn_like(vl)
                        vnoisy = scheduler.add_noise(vl, vn, vt_step)
                        vcond = text_enc(vt, device)
                        vpred = model(vnoisy, vt_step, vcond)
                        val_loss_sum += torch.nn.functional.mse_loss(vpred, vn).item()
                        val_count += 1
                avg_val = val_loss_sum / max(val_count, 1)
                writer.add_scalar("val/loss", avg_val, global_step)
                print(f"  val_loss={avg_val:.6f}")
                model.train()
                text_enc.train()

            # Checkpoint
            if (global_step + 1) % cfg.checkpoint_every == 0:
                path = cfg.checkpoint_dir / f"diffusion_step_{global_step+1}.pt"
                torch.save({
                    "step": global_step + 1,
                    "model_state_dict": model.state_dict(),
                    "ema_state_dict": ema.shadow.state_dict(),
                    "text_enc_state_dict": text_enc.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "vocab": vocab,
                    "config": cfg,
                }, path)
                print(f"Saved checkpoint: {path}")

            global_step += 1

    writer.close()
    print("Diffusion training complete.")


if __name__ == "__main__":
    train()
