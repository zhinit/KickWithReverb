"""
End-to-end kick drum generation pipeline.

Diffusion sampling → VAE decode → HiFi-GAN vocoder → WAV file.

Usage:
    uv run inference/generate.py
    uv run inference/generate.py --prompt "deep 808"
    uv run inference/generate.py --prompt "punchy analog" --cfg-scale 5.0 --steps 50
    uv run inference/generate.py --no-vocoder  # outputs mel only, uses Griffin-Lim fallback
"""

import argparse
import csv
import random
import string
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
import torchaudio

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.autoencoder import KickVAE
from models.diffusion import LatentUNet, NoiseScheduler
from models.text_encoder import KeywordEncoder

# Audio params (must match preprocess.py)
SAMPLE_RATE = 44100
N_FFT = 2048
HOP_LENGTH = 512
N_MELS = 128
DURATION_SECONDS = 2.0
TARGET_SAMPLES = int(SAMPLE_RATE * DURATION_SECONDS)


# ---------------------------------------------------------------------------
# DDIM Sampler
# ---------------------------------------------------------------------------

class DDIMSampler:
    """Denoising Diffusion Implicit Models sampler for fast inference."""

    def __init__(self, scheduler: NoiseScheduler, num_steps: int = 50) -> None:
        self.scheduler = scheduler
        self.num_steps = num_steps
        # Build sub-sequence of timesteps
        total = scheduler.timesteps
        step_size = total // num_steps
        self.timesteps = list(range(total - 1, -1, -step_size))[:num_steps]

    @torch.no_grad()
    def sample(
        self,
        model: LatentUNet,
        shape: tuple,
        cond: torch.Tensor,
        uncond: torch.Tensor | None = None,
        cfg_scale: float = 3.0,
        device: torch.device = torch.device("cpu"),
    ) -> torch.Tensor:
        """Run DDIM sampling loop.

        Args:
            model: Noise prediction U-Net.
            shape: Latent tensor shape (batch, C, H, W).
            cond: Conditional embedding (batch, cond_dim).
            uncond: Unconditional embedding for CFG. None to disable CFG.
            cfg_scale: Classifier-free guidance scale.
            device: Target device.

        Returns:
            Denoised latent tensor.
        """
        x = torch.randn(shape, device=device)
        alpha_bars = self.scheduler.alpha_bars.to(device)

        for i, t in enumerate(self.timesteps):
            t_batch = torch.full((shape[0],), t, device=device, dtype=torch.long)

            # Classifier-free guidance
            if uncond is not None and cfg_scale > 1.0:
                noise_cond = model(x, t_batch, cond)
                noise_uncond = model(x, t_batch, uncond)
                noise_pred = noise_uncond + cfg_scale * (noise_cond - noise_uncond)
            else:
                noise_pred = model(x, t_batch, cond)

            # DDIM update
            alpha_bar_t = alpha_bars[t]
            # Previous alpha_bar
            if i + 1 < len(self.timesteps):
                t_prev = self.timesteps[i + 1]
                alpha_bar_prev = alpha_bars[t_prev]
            else:
                alpha_bar_prev = torch.tensor(1.0, device=device)

            # Predicted x_0
            x0_pred = (x - (1 - alpha_bar_t).sqrt() * noise_pred) / alpha_bar_t.sqrt()
            # Direction pointing to x_t
            dir_xt = (1 - alpha_bar_prev).sqrt() * noise_pred
            # DDIM step (eta=0, deterministic)
            x = alpha_bar_prev.sqrt() * x0_pred + dir_xt

        return x


# ---------------------------------------------------------------------------
# Log-mel inversion
# ---------------------------------------------------------------------------

def log_mel_to_mel(log_mel: torch.Tensor) -> torch.Tensor:
    """Convert log-mel spectrogram back to linear mel scale."""
    return torch.exp(log_mel)


# ---------------------------------------------------------------------------
# Griffin-Lim fallback
# ---------------------------------------------------------------------------

def griffin_lim_synthesis(mel: torch.Tensor, sr: int = SAMPLE_RATE) -> torch.Tensor:
    """Approximate waveform from mel spectrogram using Griffin-Lim.

    This is a fallback when no trained vocoder is available.

    Args:
        mel: (1, n_mels, time) mel spectrogram (linear scale).
        sr: Sample rate.

    Returns:
        (1, samples) waveform tensor.
    """
    mel_basis = torchaudio.functional.melscale_fbanks(
        n_freqs=N_FFT // 2 + 1,
        f_min=0.0,
        f_max=sr / 2.0,
        n_mels=N_MELS,
        sample_rate=sr,
    )  # (n_freqs, n_mels)

    # Pseudo-inverse to go from mel -> linear spectrogram
    mel_basis_pinv = torch.linalg.pinv(mel_basis.T).to(mel.device)  # (n_freqs, n_mels)

    # mel: (1, n_mels, T) -> (1, T, n_mels)
    mel_t = mel.squeeze(0).T  # (T, n_mels)
    linear = (mel_basis_pinv @ mel_t.T).clamp(min=0)  # (n_freqs, T)
    linear = linear.unsqueeze(0)  # (1, n_freqs, T)

    # Griffin-Lim (runs on CPU)
    linear = linear.cpu()
    gl = torchaudio.transforms.GriffinLim(
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        power=1.0,
        n_iter=64,
    )
    waveform = gl(linear)
    return waveform


# ---------------------------------------------------------------------------
# Prompt parsing
# ---------------------------------------------------------------------------

def parse_prompt(prompt: str, vocab: list[str]) -> list[int]:
    """Convert a text prompt into keyword token IDs.

    Splits on spaces and commas, matches against vocab.
    """
    kw_to_idx = {kw: i for i, kw in enumerate(vocab)}
    tokens = []
    for word in prompt.replace(",", " ").lower().split():
        word = word.strip()
        if word in kw_to_idx:
            tokens.append(kw_to_idx[word])
    return tokens


# ---------------------------------------------------------------------------
# Main generation function
# ---------------------------------------------------------------------------

def generate(
    diffusion_checkpoint: Path,
    vae_checkpoint: Path,
    vocoder_checkpoint: Path | None = None,
    prompt: str = "",
    cfg_scale: float = 3.0,
    ddim_steps: int = 50,
    output_path: Path | None = None,
    seed: int | None = None,
) -> Path:
    """Run the full generation pipeline.

    Args:
        diffusion_checkpoint: Path to diffusion model checkpoint.
        vae_checkpoint: Path to VAE checkpoint.
        vocoder_checkpoint: Path to HiFi-GAN checkpoint (None for Griffin-Lim fallback).
        prompt: Text prompt (keywords).
        cfg_scale: Classifier-free guidance scale.
        ddim_steps: Number of DDIM sampling steps.
        output_path: Output WAV path. If None, auto-generates in generations/ folder.
        seed: Random seed for reproducibility.

    Returns:
        Path to the generated WAV file.
    """
    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"Using device: {device}")

    if seed is not None:
        torch.manual_seed(seed)

    # --- Load diffusion checkpoint ---
    print("Loading diffusion model...")
    diff_ckpt = torch.load(diffusion_checkpoint, weights_only=False, map_location=device)
    vocab = diff_ckpt["vocab"]
    cfg = diff_ckpt["config"]

    model = LatentUNet(
        latent_dim=cfg.latent_dim,
        base_channels=cfg.base_channels,
        cond_dim=cfg.cond_dim,
    ).to(device)
    # Use EMA weights for better quality
    model.load_state_dict(diff_ckpt["ema_state_dict"])
    model.eval()

    text_enc = KeywordEncoder(
        vocab_size=len(vocab),
        embed_dim=cfg.text_embed_dim,
        cond_dim=cfg.cond_dim,
    ).to(device)
    text_enc.load_state_dict(diff_ckpt["text_enc_state_dict"])
    text_enc.eval()

    scheduler = NoiseScheduler(cfg.timesteps, cfg.beta_start, cfg.beta_end).to(device)

    # --- Encode prompt ---
    token_ids = parse_prompt(prompt, vocab) if prompt else []
    if token_ids:
        matched = [vocab[i] for i in token_ids]
        print(f"Prompt keywords matched: {matched}")
    else:
        matched = []
        print("No prompt / unconditional generation")

    # --- Generate output path if not specified ---
    if output_path is None:
        name_parts = ["kick"] + matched + [generate_hash()]
        output_path = Path(f"generations/{'_'.join(name_parts)}.wav")

    cond = text_enc([token_ids], device)
    uncond = text_enc([[]], device)  # null embedding for CFG

    # --- DDIM sampling ---
    print(f"Sampling with DDIM ({ddim_steps} steps, cfg_scale={cfg_scale})...")
    sampler = DDIMSampler(scheduler, num_steps=ddim_steps)
    latent = sampler.sample(
        model,
        shape=(1, cfg.latent_dim, 8, 11),
        cond=cond,
        uncond=uncond,
        cfg_scale=cfg_scale,
        device=device,
    )

    # --- VAE decode ---
    print("Decoding latent with VAE...")
    vae_ckpt = torch.load(vae_checkpoint, weights_only=False, map_location=device)
    vae = KickVAE(latent_dim=cfg.latent_dim).to(device)
    vae.load_state_dict(vae_ckpt["model_state_dict"])
    vae.eval()

    with torch.no_grad():
        log_mel = vae.decode(latent)  # (1, 1, 128, 173)

    # --- Vocoder ---
    # Squeeze for processing: (1, 128, 173)
    log_mel_2d = log_mel.squeeze(0)  # Keep in log scale

    if vocoder_checkpoint is not None and vocoder_checkpoint.exists():
        print("Synthesizing waveform with HiFi-GAN vocoder...")
        from models.vocoder import HiFiGANGenerator
        vocoder = HiFiGANGenerator(in_channels=N_MELS).to(device)
        voc_ckpt = torch.load(vocoder_checkpoint, weights_only=False, map_location=device)
        vocoder.load_state_dict(voc_ckpt["generator"])
        vocoder.eval()
        vocoder.remove_weight_norm()

        with torch.no_grad():
            waveform = vocoder(log_mel_2d)  # Pass LOG-mel to vocoder
            waveform = waveform.squeeze(0)  # (1, T)
    else:
        print("No vocoder checkpoint found, using Griffin-Lim fallback...")
        mel_linear = log_mel_to_mel(log_mel_2d)  # Convert to linear only for Griffin-Lim
        waveform = griffin_lim_synthesis(mel_linear)

    # Trim or pad to target length
    if waveform.shape[-1] > TARGET_SAMPLES:
        waveform = waveform[..., :TARGET_SAMPLES]
    elif waveform.shape[-1] < TARGET_SAMPLES:
        waveform = F.pad(waveform, (0, TARGET_SAMPLES - waveform.shape[-1]))

    # Normalize
    peak = waveform.abs().max()
    if peak > 0:
        waveform = waveform * (0.95 / peak)

    # Exponential fade-out (1.0s–1.75s) + silent tail (1.75s–2.0s).
    # Exponential curve (power=3) drops fast then tapers, keeping OTT from
    # re-amplifying the tail. 0.25s of hard silence lets OTT fully release.
    fade_start = int(1.0 * SAMPLE_RATE)
    fade_end = int(1.75 * SAMPLE_RATE)
    fade_samples = fade_end - fade_start
    if fade_start < waveform.shape[-1]:
        fade = torch.linspace(1.0, 0.0, fade_samples, device=waveform.device) ** 3
        waveform[..., fade_start:fade_end] *= fade
        waveform[..., fade_end:] = 0.0

    # Save WAV using scipy (avoids torchcodec dependency)
    import scipy.io.wavfile
    waveform_cpu = waveform.cpu()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    audio_np = waveform_cpu.squeeze(0).numpy().astype(np.float32)
    scipy.io.wavfile.write(str(output_path), SAMPLE_RATE, audio_np)
    print(f"Saved: {output_path}")
    return output_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def generate_hash(length: int = 4) -> str:
    """Generate a random alphanumeric hash."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate kick drum samples")
    parser.add_argument("--prompt", type=str, default="", help="Text prompt (keywords)")
    parser.add_argument("--cfg-scale", type=float, default=3.0, help="Classifier-free guidance scale")
    parser.add_argument("--steps", type=int, default=50, help="DDIM sampling steps")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--output", type=str, default=None, help="Output WAV path (default: generations/kick_XXXX.wav)")
    parser.add_argument(
        "--diffusion-ckpt", type=str,
        default="checkpoints/diffusion_step_100000.pt",
        help="Diffusion model checkpoint",
    )
    parser.add_argument(
        "--vae-ckpt", type=str,
        default="checkpoints/vae_epoch_100.pt",
        help="VAE checkpoint",
    )
    parser.add_argument(
        "--vocoder-ckpt", type=str,
        default="checkpoints/vocoder.pt",
        help="HiFi-GAN vocoder checkpoint",
    )
    parser.add_argument(
        "--no-vocoder", action="store_true",
        help="Skip vocoder, use Griffin-Lim fallback",
    )
    args = parser.parse_args()

    vocoder_path = None if args.no_vocoder else Path(args.vocoder_ckpt)
    output_path = Path(args.output) if args.output else None

    generate(
        diffusion_checkpoint=Path(args.diffusion_ckpt),
        vae_checkpoint=Path(args.vae_ckpt),
        vocoder_checkpoint=vocoder_path,
        prompt=args.prompt,
        cfg_scale=args.cfg_scale,
        ddim_steps=args.steps,
        output_path=output_path,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
