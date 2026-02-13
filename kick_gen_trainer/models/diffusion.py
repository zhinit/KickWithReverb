"""U-Net diffusion model operating in the VAE latent space."""

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Noise schedule
# ---------------------------------------------------------------------------

class NoiseScheduler:
    """Linear beta noise schedule with precomputed alpha values."""

    def __init__(
        self,
        timesteps: int = 1000,
        beta_start: float = 0.0001,
        beta_end: float = 0.02,
    ) -> None:
        self.timesteps = timesteps
        self.betas = torch.linspace(beta_start, beta_end, timesteps)
        self.alphas = 1.0 - self.betas
        self.alpha_bars = torch.cumprod(self.alphas, dim=0)

    def to(self, device: torch.device) -> "NoiseScheduler":
        self.betas = self.betas.to(device)
        self.alphas = self.alphas.to(device)
        self.alpha_bars = self.alpha_bars.to(device)
        return self

    def add_noise(
        self,
        x: torch.Tensor,
        noise: torch.Tensor,
        t: torch.Tensor,
    ) -> torch.Tensor:
        """q(x_t | x_0) = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * noise"""
        ab = self.alpha_bars[t]
        # Reshape for broadcasting: (batch, 1, 1, 1)
        while ab.dim() < x.dim():
            ab = ab.unsqueeze(-1)
        return ab.sqrt() * x + (1 - ab).sqrt() * noise


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

def sinusoidal_embedding(t: torch.Tensor, dim: int) -> torch.Tensor:
    """Sinusoidal timestep embedding."""
    half = dim // 2
    freqs = torch.exp(
        -math.log(10000) * torch.arange(half, device=t.device).float() / half
    )
    args = t.float().unsqueeze(1) * freqs.unsqueeze(0)
    return torch.cat([args.cos(), args.sin()], dim=1)


class CondResBlock(nn.Module):
    """ResBlock with conditioning injection via addition."""

    def __init__(self, channels: int, cond_dim: int) -> None:
        super().__init__()
        self.norm1 = nn.GroupNorm(8, channels)
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.norm2 = nn.GroupNorm(8, channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.cond_proj = nn.Linear(cond_dim, channels)

    def forward(self, x: torch.Tensor, cond: torch.Tensor) -> torch.Tensor:
        h = F.silu(self.norm1(x))
        h = self.conv1(h)
        # Inject conditioning
        h = h + self.cond_proj(cond)[:, :, None, None]
        h = F.silu(self.norm2(h))
        h = self.conv2(h)
        return x + h


class SelfAttention2d(nn.Module):
    """Simple self-attention over spatial dimensions."""

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.norm = nn.GroupNorm(8, channels)
        self.qkv = nn.Conv2d(channels, channels * 3, 1)
        self.out = nn.Conv2d(channels, channels, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, c, h, w = x.shape
        h_norm = self.norm(x)
        qkv = self.qkv(h_norm).reshape(b, 3, c, h * w)
        q, k, v = qkv[:, 0], qkv[:, 1], qkv[:, 2]
        attn = torch.bmm(q.transpose(1, 2), k) * (c ** -0.5)
        attn = attn.softmax(dim=-1)
        out = torch.bmm(v, attn.transpose(1, 2)).reshape(b, c, h, w)
        return x + self.out(out)


# ---------------------------------------------------------------------------
# U-Net
# ---------------------------------------------------------------------------

class LatentUNet(nn.Module):
    """U-Net for noise prediction in the VAE latent space.

    Input/output shape: (batch, latent_dim, 8, 11)
    """

    def __init__(
        self,
        latent_dim: int = 4,
        base_channels: int = 64,
        cond_dim: int = 256,
    ) -> None:
        super().__init__()
        ch = base_channels  # 64

        # Timestep embedding
        self.time_mlp = nn.Sequential(
            nn.Linear(ch, cond_dim),
            nn.SiLU(),
            nn.Linear(cond_dim, cond_dim),
        )

        # Down path
        self.down_in = nn.Conv2d(latent_dim, ch, 3, padding=1)
        self.down1 = CondResBlock(ch, cond_dim)           # 64
        self.down_conv1 = nn.Conv2d(ch, ch * 2, 3, stride=2, padding=1)
        self.down2 = CondResBlock(ch * 2, cond_dim)       # 128
        self.down_conv2 = nn.Conv2d(ch * 2, ch * 4, 3, stride=2, padding=1)

        # Middle
        self.mid1 = CondResBlock(ch * 4, cond_dim)        # 256
        self.mid_attn = SelfAttention2d(ch * 4)
        self.mid2 = CondResBlock(ch * 4, cond_dim)

        # Up path
        self.up_conv2 = nn.ConvTranspose2d(ch * 4, ch * 2, 4, stride=2, padding=1)
        self.up2 = CondResBlock(ch * 4, cond_dim)  # ch*4 because of skip concat
        self.up_reduce2 = nn.Conv2d(ch * 4, ch * 2, 1)
        self.up_conv1 = nn.ConvTranspose2d(ch * 2, ch, 4, stride=2, padding=1)
        self.up1 = CondResBlock(ch * 2, cond_dim)  # ch*2 because of skip concat
        self.up_reduce1 = nn.Conv2d(ch * 2, ch, 1)

        # Output
        self.out_norm = nn.GroupNorm(8, ch)
        self.out_conv = nn.Conv2d(ch, latent_dim, 3, padding=1)

    def forward(
        self,
        x: torch.Tensor,
        t: torch.Tensor,
        cond: torch.Tensor,
    ) -> torch.Tensor:
        """
        Args:
            x: (batch, latent_dim, 8, 11) noisy latent
            t: (batch,) integer timesteps
            cond: (batch, cond_dim) conditioning vector (timestep_emb + text_emb combined externally, or just text)
        """
        # Timestep embedding
        t_emb = sinusoidal_embedding(t, self.time_mlp[0].in_features)
        t_emb = self.time_mlp(t_emb)
        c = t_emb + cond  # Combined conditioning

        # Down
        h1 = self.down_in(x)                    # (ch, 8, 11)
        h1 = self.down1(h1, c)
        h2 = self.down_conv1(h1)                # (ch*2, 4, 6)
        h2 = self.down2(h2, c)
        h3 = self.down_conv2(h2)                # (ch*4, 2, 3)

        # Middle
        h3 = self.mid1(h3, c)
        h3 = self.mid_attn(h3)
        h3 = self.mid2(h3, c)

        # Up
        h = self.up_conv2(h3)                   # (ch*2, 4, 6)
        h = h[:, :, :h2.shape[2], :h2.shape[3]]  # crop to match skip
        h = torch.cat([h, h2], dim=1)           # (ch*4, 4, 6)
        h = self.up2(h, c)
        h = self.up_reduce2(h)                  # (ch*2, 4, 6)

        h = self.up_conv1(h)                    # (ch, 8, 12)
        h = h[:, :, :h1.shape[2], :h1.shape[3]]  # crop to match skip
        h = torch.cat([h, h1], dim=1)           # (ch*2, 8, 11)
        h = self.up1(h, c)
        h = self.up_reduce1(h)                  # (ch, 8, 11)

        h = F.silu(self.out_norm(h))
        return self.out_conv(h)                 # (latent_dim, 8, 11)
