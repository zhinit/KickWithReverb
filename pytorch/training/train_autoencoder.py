"""Training script for the kick drum VAE."""

import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset, random_split
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.autoencoder import KickVAE
from training.config import AutoencoderConfig
from training.losses import vae_loss


class MelDataset(Dataset):
    """Dataset of preprocessed mel spectrogram tensors."""

    def __init__(self, data_dir: Path) -> None:
        self.files = sorted(
            f for f in data_dir.glob("*.pt") if not f.name.startswith("._")
        )
        if not self.files:
            raise FileNotFoundError(
                f"No .pt files found in {data_dir}"
            )

    def __len__(self) -> int:
        return len(self.files)

    def __getitem__(self, idx: int) -> torch.Tensor:
        return torch.load(self.files[idx], weights_only=False)


def train(cfg: AutoencoderConfig | None = None) -> None:
    """Run VAE training."""
    if cfg is None:
        cfg = AutoencoderConfig()

    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"Using device: {device}")

    # Data
    dataset = MelDataset(cfg.data_dir)
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
    )
    val_loader = DataLoader(
        val_set,
        batch_size=cfg.batch_size,
        shuffle=False,
        num_workers=cfg.num_workers,
        pin_memory=True,
    )

    print(f"Train: {train_size}, Val: {val_size}")

    # Model
    model = KickVAE(latent_dim=cfg.latent_dim).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.learning_rate)
    scaler = torch.amp.GradScaler(enabled=cfg.use_amp and device.type == "cuda")

    # Logging
    cfg.log_dir.mkdir(parents=True, exist_ok=True)
    cfg.checkpoint_dir.mkdir(parents=True, exist_ok=True)
    writer = SummaryWriter(cfg.log_dir)

    global_step = 0

    for epoch in range(cfg.epochs):
        model.train()
        kl_weight = cfg.kl_weight_at_epoch(epoch)

        epoch_metrics: dict[str, float] = {}
        epoch_count = 0

        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{cfg.epochs}")
        for batch in pbar:
            batch = batch.to(device)

            with torch.amp.autocast(
                device_type=device.type,
                enabled=cfg.use_amp and device.type == "cuda",
            ):
                recon, mu, logvar = model(batch)
                loss, metrics = vae_loss(
                    recon, batch, mu, logvar, kl_weight
                )

            optimizer.zero_grad()
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            # Accumulate metrics
            for k, v in metrics.items():
                epoch_metrics[k] = epoch_metrics.get(k, 0.0) + v
            epoch_count += 1
            global_step += 1

            pbar.set_postfix(loss=f"{metrics['total']:.4f}")

        # Log epoch averages
        for k, v in epoch_metrics.items():
            writer.add_scalar(f"train/{k}", v / epoch_count, epoch)
        writer.add_scalar("train/kl_weight", kl_weight, epoch)

        # Validation
        model.eval()
        val_metrics: dict[str, float] = {}
        val_count = 0

        with torch.no_grad():
            for batch in val_loader:
                batch = batch.to(device)
                recon, mu, logvar = model(batch)
                _, metrics = vae_loss(
                    recon, batch, mu, logvar, kl_weight
                )
                for k, v in metrics.items():
                    val_metrics[k] = val_metrics.get(k, 0.0) + v
                val_count += 1

        avg_val_loss = val_metrics.get("total", 0.0) / max(val_count, 1)
        for k, v in val_metrics.items():
            writer.add_scalar(f"val/{k}", v / val_count, epoch)

        print(
            f"Epoch {epoch+1}: "
            f"train={epoch_metrics['total']/epoch_count:.4f} "
            f"val={avg_val_loss:.4f} "
            f"kl_w={kl_weight:.6f}"
        )

        # Checkpoint
        if (epoch + 1) % cfg.checkpoint_every == 0:
            path = cfg.checkpoint_dir / f"vae_epoch_{epoch+1}.pt"
            torch.save({
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "config": cfg,
            }, path)
            print(f"Saved checkpoint: {path}")

    writer.close()
    print("Training complete.")


if __name__ == "__main__":
    train()
