"""
HiFi-GAN vocoder for mel spectrogram to waveform conversion.

Generator converts mel spectrograms to raw audio waveforms.
Discriminators (Multi-Period + Multi-Scale) provide adversarial training signal.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

class ResBlock1(nn.Module):
    """Residual block with dilated convolutions (HiFi-GAN type 1)."""

    def __init__(self, channels: int, kernel_size: int, dilations: tuple[int, ...] = (1, 3, 5)) -> None:
        super().__init__()
        self.convs1 = nn.ModuleList()
        self.convs2 = nn.ModuleList()
        for d in dilations:
            self.convs1.append(
                nn.utils.parametrizations.weight_norm(
                    nn.Conv1d(channels, channels, kernel_size, dilation=d,
                              padding=(kernel_size * d - d) // 2)
                )
            )
            self.convs2.append(
                nn.utils.parametrizations.weight_norm(
                    nn.Conv1d(channels, channels, kernel_size, dilation=1,
                              padding=(kernel_size - 1) // 2)
                )
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for c1, c2 in zip(self.convs1, self.convs2):
            xt = F.leaky_relu(x, 0.1)
            xt = c1(xt)
            xt = F.leaky_relu(xt, 0.1)
            xt = c2(xt)
            x = xt + x
        return x

    def remove_weight_norm(self) -> None:
        for c in self.convs1:
            nn.utils.parametrize.remove_parametrizations(c, "weight")
        for c in self.convs2:
            nn.utils.parametrize.remove_parametrizations(c, "weight")


class HiFiGANGenerator(nn.Module):
    """HiFi-GAN v1 generator (simplified for 6GB VRAM).

    Upsamples mel spectrogram (128, T) to waveform (1, T * hop_length).
    Uses smaller channel counts than the original paper to fit in memory.
    """

    def __init__(
        self,
        in_channels: int = 128,
        upsample_initial_channel: int = 256,
        upsample_rates: tuple[int, ...] = (8, 8, 2, 2, 2),
        upsample_kernel_sizes: tuple[int, ...] = (16, 16, 4, 4, 4),
        resblock_kernel_sizes: tuple[int, ...] = (3, 7, 11),
        resblock_dilations: tuple[tuple[int, ...], ...] = ((1, 3, 5), (1, 3, 5), (1, 3, 5)),
    ) -> None:
        super().__init__()
        self.num_upsamples = len(upsample_rates)

        # Initial conv
        self.conv_pre = nn.utils.parametrizations.weight_norm(
            nn.Conv1d(in_channels, upsample_initial_channel, 7, padding=3)
        )

        # Upsampling layers
        self.ups = nn.ModuleList()
        ch = upsample_initial_channel
        for i, (u, k) in enumerate(zip(upsample_rates, upsample_kernel_sizes)):
            self.ups.append(
                nn.utils.parametrizations.weight_norm(
                    nn.ConvTranspose1d(ch, ch // 2, k, stride=u,
                                       padding=(k - u) // 2)
                )
            )
            ch = ch // 2

        # Residual blocks after each upsample
        self.resblocks = nn.ModuleList()
        for i in range(len(self.ups)):
            ch_i = upsample_initial_channel // (2 ** (i + 1))
            for k, d in zip(resblock_kernel_sizes, resblock_dilations):
                self.resblocks.append(ResBlock1(ch_i, k, d))

        # Output conv
        self.conv_post = nn.utils.parametrizations.weight_norm(
            nn.Conv1d(ch_i, 1, 7, padding=3)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, n_mels, time) mel spectrogram
        Returns:
            (batch, 1, time * hop_length) waveform
        """
        x = self.conv_pre(x)
        for i, up in enumerate(self.ups):
            x = F.leaky_relu(x, 0.1)
            x = up(x)
            # Apply all resblocks for this upsample level and average
            xs = 0.0
            for j in range(len(self.resblocks) // self.num_upsamples):
                xs = xs + self.resblocks[i * (len(self.resblocks) // self.num_upsamples) + j](x)
            x = xs / (len(self.resblocks) // self.num_upsamples)
        x = F.leaky_relu(x, 0.1)
        x = self.conv_post(x)
        x = torch.tanh(x)
        return x

    def remove_weight_norm(self) -> None:
        nn.utils.parametrize.remove_parametrizations(self.conv_pre, "weight")
        for up in self.ups:
            nn.utils.parametrize.remove_parametrizations(up, "weight")
        for block in self.resblocks:
            block.remove_weight_norm()
        nn.utils.parametrize.remove_parametrizations(self.conv_post, "weight")


# ---------------------------------------------------------------------------
# Discriminators
# ---------------------------------------------------------------------------

class PeriodDiscriminator(nn.Module):
    """Single sub-discriminator for Multi-Period Discriminator."""

    def __init__(self, period: int) -> None:
        super().__init__()
        self.period = period
        self.convs = nn.ModuleList([
            nn.utils.parametrizations.weight_norm(nn.Conv2d(1, 32, (5, 1), (3, 1), (2, 0))),
            nn.utils.parametrizations.weight_norm(nn.Conv2d(32, 64, (5, 1), (3, 1), (2, 0))),
            nn.utils.parametrizations.weight_norm(nn.Conv2d(64, 128, (5, 1), (3, 1), (2, 0))),
            nn.utils.parametrizations.weight_norm(nn.Conv2d(128, 256, (5, 1), (3, 1), (2, 0))),
            nn.utils.parametrizations.weight_norm(nn.Conv2d(256, 256, (5, 1), 1, (2, 0))),
        ])
        self.conv_post = nn.utils.parametrizations.weight_norm(nn.Conv2d(256, 1, (3, 1), 1, (1, 0)))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, list[torch.Tensor]]:
        fmap = []
        # Reshape: (B, 1, T) -> (B, 1, T//p, p)
        b, c, t = x.shape
        if t % self.period != 0:
            x = F.pad(x, (0, self.period - t % self.period), "reflect")
            t = x.shape[-1]
        x = x.view(b, c, t // self.period, self.period)

        for conv in self.convs:
            x = conv(x)
            x = F.leaky_relu(x, 0.1)
            fmap.append(x)
        x = self.conv_post(x)
        fmap.append(x)
        return x.flatten(1, -1), fmap


class MultiPeriodDiscriminator(nn.Module):
    def __init__(self, periods: tuple[int, ...] = (2, 3, 5, 7, 11)) -> None:
        super().__init__()
        self.discriminators = nn.ModuleList([PeriodDiscriminator(p) for p in periods])

    def forward(self, x: torch.Tensor) -> tuple[list[torch.Tensor], list[list[torch.Tensor]]]:
        outs, fmaps = [], []
        for d in self.discriminators:
            o, f = d(x)
            outs.append(o)
            fmaps.append(f)
        return outs, fmaps


class ScaleDiscriminator(nn.Module):
    """Single sub-discriminator for Multi-Scale Discriminator."""

    def __init__(self, use_spectral_norm: bool = False) -> None:
        super().__init__()
        norm_f = nn.utils.parametrizations.spectral_norm if use_spectral_norm else nn.utils.parametrizations.weight_norm
        self.convs = nn.ModuleList([
            norm_f(nn.Conv1d(1, 64, 15, 1, 7)),
            norm_f(nn.Conv1d(64, 128, 41, 2, 20, groups=4)),
            norm_f(nn.Conv1d(128, 256, 41, 2, 20, groups=16)),
            norm_f(nn.Conv1d(256, 512, 41, 4, 20, groups=16)),
            norm_f(nn.Conv1d(512, 512, 41, 4, 20, groups=16)),
            norm_f(nn.Conv1d(512, 512, 5, 1, 2)),
        ])
        self.conv_post = norm_f(nn.Conv1d(512, 1, 3, 1, 1))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, list[torch.Tensor]]:
        fmap = []
        for conv in self.convs:
            x = conv(x)
            x = F.leaky_relu(x, 0.1)
            fmap.append(x)
        x = self.conv_post(x)
        fmap.append(x)
        return x.flatten(1, -1), fmap


class MultiScaleDiscriminator(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.discriminators = nn.ModuleList([
            ScaleDiscriminator(use_spectral_norm=True),
            ScaleDiscriminator(),
            ScaleDiscriminator(),
        ])
        self.pools = nn.ModuleList([
            nn.Identity(),
            nn.AvgPool1d(4, 2, 2),
            nn.AvgPool1d(4, 2, 2),
        ])

    def forward(self, x: torch.Tensor) -> tuple[list[torch.Tensor], list[list[torch.Tensor]]]:
        outs, fmaps = [], []
        for pool, disc in zip(self.pools, self.discriminators):
            x_in = pool(x)
            o, f = disc(x_in)
            outs.append(o)
            fmaps.append(f)
        return outs, fmaps
