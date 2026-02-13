"""Loss functions for autoencoder training."""

import torch
import torch.nn as nn
import torch.nn.functional as F


def reconstruction_loss(
    recon: torch.Tensor, target: torch.Tensor
) -> torch.Tensor:
    """MSE reconstruction loss."""
    return F.mse_loss(recon, target)


def spectral_convergence_loss(
    recon: torch.Tensor, target: torch.Tensor
) -> torch.Tensor:
    """L1 loss on magnitude (encourages spectral fidelity)."""
    return F.l1_loss(recon, target)


def kl_divergence(
    mu: torch.Tensor, logvar: torch.Tensor
) -> torch.Tensor:
    """KL divergence from N(mu, sigma) to N(0, 1)."""
    return -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())


def vae_loss(
    recon: torch.Tensor,
    target: torch.Tensor,
    mu: torch.Tensor,
    logvar: torch.Tensor,
    kl_weight: float = 0.0001,
) -> tuple[torch.Tensor, dict[str, float]]:
    """Combined VAE loss.

    Returns:
        Total loss tensor and dict of individual loss values for logging.
    """
    mse = reconstruction_loss(recon, target)
    spectral = spectral_convergence_loss(recon, target)
    kl = kl_divergence(mu, logvar)

    total = mse + spectral + kl_weight * kl

    metrics = {
        "mse": mse.item(),
        "spectral": spectral.item(),
        "kl": kl.item(),
        "kl_weighted": (kl_weight * kl).item(),
        "total": total.item(),
    }
    return total, metrics
