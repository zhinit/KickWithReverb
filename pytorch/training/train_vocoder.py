"""
HiFi-GAN vocoder training.

Trains a mel-to-waveform generator with multi-period and multi-scale discriminators.
Designed for 6GB VRAM: lazy-loads audio, uses random 8192-sample segments, small batch size.

Usage:
    uv run training/train_vocoder.py
    uv run training/train_vocoder.py --batch-size 4 --segment-size 8192
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.vocoder import HiFiGANGenerator, MultiPeriodDiscriminator, MultiScaleDiscriminator

# Audio params (must match preprocess.py)
SAMPLE_RATE = 44100
N_FFT = 2048
HOP_LENGTH = 512
N_MELS = 128
DURATION_SECONDS = 2.0
TARGET_SAMPLES = int(SAMPLE_RATE * DURATION_SECONDS)


# ---------------------------------------------------------------------------
# Dataset - lazy loads audio, pairs with pre-computed mel
# ---------------------------------------------------------------------------

class VocoderDataset(Dataset):
    """Lazy-loading dataset that pairs raw audio with processed mel spectrograms.

    Only stores file paths in memory. Loads audio on-the-fly per __getitem__.
    Returns random segments of `segment_size` samples for memory efficiency.
    """

    def __init__(self, raw_dir: Path, processed_dir: Path, segment_size: int = 8192) -> None:
        self.segment_size = segment_size
        self.raw_dir = raw_dir
        self.processed_dir = processed_dir

        # Build list of (raw_path, mel_path) pairs
        self.pairs: list[tuple[Path, Path]] = []
        mel_stems = {p.stem for p in processed_dir.glob("*.pt")}
        for raw_path in sorted(raw_dir.iterdir()):
            if raw_path.suffix.lower() not in (".wav", ".aif", ".aiff", ".mp3", ".flac"):
                continue
            stem = raw_path.stem
            if stem in mel_stems:
                self.pairs.append((raw_path, processed_dir / f"{stem}.pt"))

        print(f"VocoderDataset: {len(self.pairs)} paired samples found")

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        raw_path, mel_path = self.pairs[idx]

        # Load raw audio
        audio, sr = sf.read(raw_path, dtype="float32", always_2d=True)
        audio = audio[:, 0]  # mono
        if sr != SAMPLE_RATE:
            # Simple resample via linear interpolation
            audio = np.interp(
                np.linspace(0, len(audio) - 1, int(len(audio) * SAMPLE_RATE / sr)),
                np.arange(len(audio)),
                audio,
            ).astype(np.float32)

        # Pad/trim to target length
        if len(audio) < TARGET_SAMPLES:
            audio = np.pad(audio, (0, TARGET_SAMPLES - len(audio)))
        else:
            audio = audio[:TARGET_SAMPLES]

        # Load pre-computed mel
        mel = torch.load(mel_path, weights_only=True)  # (1, 128, 173)

        # Pick random segment
        # segment_size audio samples = segment_size // HOP_LENGTH mel frames
        mel_frames = self.segment_size // HOP_LENGTH
        max_mel_start = mel.shape[-1] - mel_frames
        if max_mel_start > 0:
            mel_start = torch.randint(0, max_mel_start, (1,)).item()
        else:
            mel_start = 0

        audio_start = mel_start * HOP_LENGTH
        audio_end = audio_start + self.segment_size

        mel_seg = mel[:, :, mel_start:mel_start + mel_frames]  # (1, 128, mel_frames)
        audio_seg = torch.from_numpy(audio[audio_start:audio_end])  # (segment_size,)

        # Pad if needed (edge cases)
        if mel_seg.shape[-1] < mel_frames:
            mel_seg = F.pad(mel_seg, (0, mel_frames - mel_seg.shape[-1]))
        if audio_seg.shape[-1] < self.segment_size:
            audio_seg = F.pad(audio_seg, (0, self.segment_size - audio_seg.shape[-1]))

        return mel_seg.squeeze(0), audio_seg.unsqueeze(0)  # (128, mel_frames), (1, segment_size)


# ---------------------------------------------------------------------------
# Loss functions
# ---------------------------------------------------------------------------

def generator_adversarial_loss(disc_outputs: list[torch.Tensor]) -> torch.Tensor:
    loss = 0.0
    for dg in disc_outputs:
        loss = loss + torch.mean((1 - dg) ** 2)
    return loss


def discriminator_loss(real_outputs: list[torch.Tensor], fake_outputs: list[torch.Tensor]) -> torch.Tensor:
    loss = 0.0
    for dr, dg in zip(real_outputs, fake_outputs):
        loss = loss + torch.mean((1 - dr) ** 2) + torch.mean(dg ** 2)
    return loss


def feature_matching_loss(real_fmaps: list[list[torch.Tensor]], fake_fmaps: list[list[torch.Tensor]]) -> torch.Tensor:
    loss = 0.0
    for rf, ff in zip(real_fmaps, fake_fmaps):
        for r, f in zip(rf, ff):
            loss = loss + F.l1_loss(f, r.detach())
    return loss


def mel_spectrogram_loss(y: torch.Tensor, y_hat: torch.Tensor) -> torch.Tensor:
    """L1 loss on mel spectrograms of real vs generated audio."""
    mel_transform = torch.nn.Sequential(
        torch.nn.Identity(),  # placeholder
    )
    # Compute mel on-the-fly for loss
    # Use torchaudio for consistency
    import torchaudio
    mel_spec = torchaudio.transforms.MelSpectrogram(
        sample_rate=SAMPLE_RATE, n_fft=N_FFT, hop_length=HOP_LENGTH,
        n_mels=N_MELS, power=1.0,
    ).to(y.device)

    mel_real = torch.log(mel_spec(y.squeeze(1)).clamp(min=1e-5))
    mel_fake = torch.log(mel_spec(y_hat.squeeze(1)).clamp(min=1e-5))
    return F.l1_loss(mel_real, mel_fake)


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------

def train(args: argparse.Namespace) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    if device.type == "cuda":
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"GPU VRAM: {vram_gb:.1f} GB")

    # Dataset
    dataset = VocoderDataset(
        raw_dir=Path(args.raw_dir),
        processed_dir=Path(args.processed_dir),
        segment_size=args.segment_size,
    )
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=True,
        drop_last=True,
        persistent_workers=args.num_workers > 0,
    )

    # Models
    generator = HiFiGANGenerator(in_channels=N_MELS).to(device)
    mpd = MultiPeriodDiscriminator().to(device)
    msd = MultiScaleDiscriminator().to(device)

    # Print param counts
    g_params = sum(p.numel() for p in generator.parameters()) / 1e6
    d_params = (sum(p.numel() for p in mpd.parameters()) + sum(p.numel() for p in msd.parameters())) / 1e6
    print(f"Generator: {g_params:.1f}M params | Discriminators: {d_params:.1f}M params")

    # Optimizers
    optim_g = torch.optim.AdamW(generator.parameters(), lr=args.lr, betas=(0.8, 0.99))
    optim_d = torch.optim.AdamW(
        list(mpd.parameters()) + list(msd.parameters()),
        lr=args.lr, betas=(0.8, 0.99),
    )

    # Schedulers
    sched_g = torch.optim.lr_scheduler.ExponentialLR(optim_g, gamma=0.999)
    sched_d = torch.optim.lr_scheduler.ExponentialLR(optim_d, gamma=0.999)

    # Checkpointing - resume if exists
    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    start_epoch = 0

    resume_path = checkpoint_dir / "vocoder_latest.pt"
    if resume_path.exists():
        print(f"Resuming from {resume_path}")
        ckpt = torch.load(resume_path, weights_only=False, map_location=device)
        generator.load_state_dict(ckpt["generator"])
        mpd.load_state_dict(ckpt["mpd"])
        msd.load_state_dict(ckpt["msd"])
        optim_g.load_state_dict(ckpt["optim_g"])
        optim_d.load_state_dict(ckpt["optim_d"])
        sched_g.load_state_dict(ckpt["sched_g"])
        sched_d.load_state_dict(ckpt["sched_d"])
        start_epoch = ckpt["epoch"] + 1
        print(f"Resumed at epoch {start_epoch}")

    # Logging
    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    writer = SummaryWriter(log_dir)

    # Training
    global_step = start_epoch * len(loader)
    for epoch in range(start_epoch, args.epochs):
        generator.train()
        mpd.train()
        msd.train()

        pbar = tqdm(loader, desc=f"Epoch {epoch+1}/{args.epochs}")
        for mel, audio in pbar:
            mel = mel.to(device)       # (B, 128, mel_frames)
            audio = audio.to(device)   # (B, 1, segment_size)

            # ---- Discriminator step ----
            optim_d.zero_grad()
            with torch.no_grad():
                audio_fake = generator(mel)
            # Trim to match lengths
            min_len = min(audio.shape[-1], audio_fake.shape[-1])
            audio_t = audio[..., :min_len]
            audio_f = audio_fake[..., :min_len]

            mpd_real, _ = mpd(audio_t)
            mpd_fake, _ = mpd(audio_f)
            msd_real, _ = msd(audio_t)
            msd_fake, _ = msd(audio_f)

            loss_d = discriminator_loss(mpd_real, mpd_fake) + discriminator_loss(msd_real, msd_fake)

            loss_d.backward()
            optim_d.step()

            # ---- Generator step ----
            optim_g.zero_grad()
            audio_fake = generator(mel)
            min_len = min(audio.shape[-1], audio_fake.shape[-1])
            audio_t = audio[..., :min_len]
            audio_f = audio_fake[..., :min_len]

            mpd_real, mpd_real_fmap = mpd(audio_t)
            mpd_fake, mpd_fake_fmap = mpd(audio_f)
            msd_real, msd_real_fmap = msd(audio_t)
            msd_fake, msd_fake_fmap = msd(audio_f)

            loss_gen = generator_adversarial_loss(mpd_fake) + generator_adversarial_loss(msd_fake)
            loss_fm = feature_matching_loss(mpd_real_fmap, mpd_fake_fmap) + feature_matching_loss(msd_real_fmap, msd_fake_fmap)
            loss_mel = mel_spectrogram_loss(audio_t, audio_f)

            loss_g = loss_gen + 2.0 * loss_fm + 45.0 * loss_mel

            loss_g.backward()
            optim_g.step()

            global_step += 1
            pbar.set_postfix(loss_g=f"{loss_g.item():.3f}", loss_d=f"{loss_d.item():.3f}")

            if global_step % 100 == 0:
                writer.add_scalar("loss/generator", loss_g.item(), global_step)
                writer.add_scalar("loss/discriminator", loss_d.item(), global_step)
                writer.add_scalar("loss/mel", loss_mel.item(), global_step)
                writer.add_scalar("loss/feature_matching", loss_fm.item(), global_step)

        # End of epoch
        sched_g.step()
        sched_d.step()

        # Save checkpoint
        if (epoch + 1) % args.checkpoint_every == 0 or epoch == args.epochs - 1:
            ckpt_path = checkpoint_dir / f"vocoder_epoch_{epoch+1}.pt"
            torch.save({
                "generator": generator.state_dict(),
                "mpd": mpd.state_dict(),
                "msd": msd.state_dict(),
                "optim_g": optim_g.state_dict(),
                "optim_d": optim_d.state_dict(),
                "sched_g": sched_g.state_dict(),
                "sched_d": sched_d.state_dict(),
                "epoch": epoch,
            }, ckpt_path)
            print(f"Saved {ckpt_path}")

        # Always save latest for resume
        torch.save({
            "generator": generator.state_dict(),
            "mpd": mpd.state_dict(),
            "msd": msd.state_dict(),
            "optim_g": optim_g.state_dict(),
            "optim_d": optim_d.state_dict(),
            "sched_g": sched_g.state_dict(),
            "sched_d": sched_d.state_dict(),
            "epoch": epoch,
        }, checkpoint_dir / "vocoder_latest.pt")

    writer.close()
    print("Training complete.")

    # Save inference-ready checkpoint
    torch.save({
        "generator_state_dict": generator.state_dict(),
    }, checkpoint_dir / "vocoder.pt")
    print(f"Saved inference checkpoint: {checkpoint_dir / 'vocoder.pt'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train HiFi-GAN vocoder")
    parser.add_argument("--raw-dir", type=str, default="data/raw")
    parser.add_argument("--processed-dir", type=str, default="data/processed")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--segment-size", type=int, default=8192)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--use-amp", action="store_true", default=True)
    parser.add_argument("--checkpoint-dir", type=str, default="checkpoints")
    parser.add_argument("--checkpoint-every", type=int, default=10)
    parser.add_argument("--log-dir", type=str, default="runs/vocoder")
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
