"""
Variational Autoencoder for mel spectrogram compression.

Input:  (batch, 1, 128, 173) log-mel spectrogram
Latent: (batch, 4, 8, 11)
Output: (batch, 1, 128, 173) reconstructed log-mel spectrogram
"""

import torch
import torch.nn as nn


class ResBlock(nn.Module):
    """Residual block with GroupNorm and SiLU activation."""

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.block = nn.Sequential(
            nn.GroupNorm(8, channels),
            nn.SiLU(),
            nn.Conv2d(channels, channels, 3, padding=1),
            nn.GroupNorm(8, channels),
            nn.SiLU(),
            nn.Conv2d(channels, channels, 3, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)


class Encoder(nn.Module):
    """Encodes mel spectrograms to mu and logvar in latent space."""

    def __init__(self, latent_dim: int = 4) -> None:
        super().__init__()
        self.net = nn.Sequential(
            # (1, 128, 173) -> (32, 64, 87)
            nn.Conv2d(1, 32, 3, stride=2, padding=1),
            ResBlock(32),
            # (32, 64, 87) -> (64, 32, 44)
            nn.Conv2d(32, 64, 3, stride=2, padding=1),
            ResBlock(64),
            # (64, 32, 44) -> (128, 16, 22)
            nn.Conv2d(64, 128, 3, stride=2, padding=1),
            ResBlock(128),
            # (128, 16, 22) -> (256, 8, 11)
            nn.Conv2d(128, 256, 3, stride=2, padding=1),
            ResBlock(256),
        )
        self.conv_mu = nn.Conv2d(256, latent_dim, 1)
        self.conv_logvar = nn.Conv2d(256, latent_dim, 1)

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.net(x)
        return self.conv_mu(h), self.conv_logvar(h)


class Decoder(nn.Module):
    """Decodes latent vectors back to mel spectrograms."""

    def __init__(self, latent_dim: int = 4) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(latent_dim, 256, 1),
            ResBlock(256),
            # (256, 8, 11) -> (128, 16, 22)
            nn.ConvTranspose2d(256, 128, 4, stride=2, padding=1),
            ResBlock(128),
            # (128, 16, 22) -> (64, 32, 44)
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1),
            ResBlock(64),
            # (64, 32, 44) -> (32, 64, 88)
            nn.ConvTranspose2d(64, 32, 4, stride=2, padding=1),
            ResBlock(32),
            # (32, 64, 88) -> (1, 128, 176)
            nn.ConvTranspose2d(32, 1, 4, stride=2, padding=1),
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        out = self.net(z)
        # Crop to match input dimensions (128, 173)
        return out[:, :, :128, :173]


class KickVAE(nn.Module):
    """Variational Autoencoder for kick drum mel spectrograms."""

    def __init__(self, latent_dim: int = 4) -> None:
        super().__init__()
        self.encoder = Encoder(latent_dim)
        self.decoder = Decoder(latent_dim)

    def reparameterize(
        self, mu: torch.Tensor, logvar: torch.Tensor
    ) -> torch.Tensor:
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Returns (reconstruction, mu, logvar)."""
        mu, logvar = self.encoder(x)
        z = self.reparameterize(mu, logvar)
        recon = self.decoder(z)
        return recon, mu, logvar

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        """Encode to latent space (uses mu, no sampling)."""
        mu, _ = self.encoder(x)
        return mu

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        """Decode from latent space."""
        return self.decoder(z)
