"""Training hyperparameters."""

from dataclasses import dataclass
from pathlib import Path


@dataclass
class AutoencoderConfig:
    # Data
    data_dir: Path = Path("data/processed")
    val_split: float = 0.1

    # Model
    latent_dim: int = 4

    # Training
    batch_size: int = 32
    learning_rate: float = 1e-4
    epochs: int = 100
    num_workers: int = 4

    # KL annealing: weight ramps from kl_weight_start to kl_weight_end
    # over the first kl_anneal_epochs epochs
    kl_weight_start: float = 0.0001
    kl_weight_end: float = 0.001
    kl_anneal_epochs: int = 20

    # Mixed precision
    use_amp: bool = True

    # Checkpointing
    checkpoint_dir: Path = Path("checkpoints")
    checkpoint_every: int = 10

    # Logging
    log_dir: Path = Path("runs/autoencoder")

    def kl_weight_at_epoch(self, epoch: int) -> float:
        """Linearly anneal KL weight over first N epochs."""
        if epoch >= self.kl_anneal_epochs:
            return self.kl_weight_end
        t = epoch / self.kl_anneal_epochs
        return self.kl_weight_start + t * (
            self.kl_weight_end - self.kl_weight_start
        )


@dataclass
class DiffusionConfig:
    # Data
    data_dir: Path = Path("data/processed")
    latents_dir: Path = Path("data/latents")
    metadata_csv: Path = Path("data/metadata.csv")
    val_split: float = 0.1

    # VAE
    vae_checkpoint: Path = Path("checkpoints/vae_epoch_100.pt")
    latent_dim: int = 4

    # Noise schedule
    timesteps: int = 1000
    beta_start: float = 0.0001
    beta_end: float = 0.02

    # Model
    base_channels: int = 64
    cond_dim: int = 256
    text_embed_dim: int = 64

    # Training
    batch_size: int = 16
    learning_rate: float = 1e-4
    iterations: int = 100_000
    num_workers: int = 4
    gradient_accumulation: int = 2
    use_amp: bool = True

    # EMA
    ema_decay: float = 0.9999

    # Classifier-free guidance
    cfg_dropout: float = 0.15

    # Checkpointing
    checkpoint_dir: Path = Path("checkpoints")
    checkpoint_every: int = 5000  # iterations

    # Logging
    log_dir: Path = Path("runs/diffusion")
