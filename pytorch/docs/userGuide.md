# User Guide

## What This Model Does

Generates 2-second kick drum audio samples (WAV, 44.1kHz) from noise using a latent diffusion model. Supports optional text conditioning with keywords like "808", "punchy", "deep", etc.

## Files Required for Inference

To integrate into another project, you need these files:

### Model code (4 files)

```
models/
├── autoencoder.py    # KickVAE (encoder/decoder)
├── diffusion.py      # LatentUNet, NoiseScheduler
├── text_encoder.py   # KeywordEncoder
└── vocoder.py        # HiFiGANGenerator
```

### Inference code (2 files)

```
inference/
├── __init__.py
└── generate.py       # Generation pipeline + CLI
```

### Checkpoints (3 files)

```
checkpoints/
├── vae_epoch_100.pt          # VAE decoder weights
├── diffusion_step_100000.pt  # Diffusion U-Net + text encoder + vocab
└── vocoder_epoch_50.pt       # HiFi-GAN generator weights
```

The diffusion checkpoint bundles everything needed for text conditioning: the U-Net weights (EMA), text encoder weights, vocabulary list, and model config.

### Python dependencies

```
torch>=2.10.0
torchaudio>=2.10.0
numpy>=2.4.2
scipy>=1.14.0
```

`scipy` is only used for writing WAV files (`scipy.io.wavfile.write`). If your project already handles WAV output differently, you can skip it and handle the waveform tensor directly.

## Python API

Import and call the `generate()` function directly:

```python
from pathlib import Path
from inference.generate import generate

output_path = generate(
    diffusion_checkpoint=Path("checkpoints/diffusion_step_100000.pt"),
    vae_checkpoint=Path("checkpoints/vae_epoch_100.pt"),
    vocoder_checkpoint=Path("checkpoints/vocoder_epoch_50.pt"),
    prompt="808",
    cfg_scale=3.0,
    ddim_steps=50,
    output_path=Path("output/my_kick.wav"),
    seed=42,
)
# output_path is the Path to the generated .wav file
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `diffusion_checkpoint` | `Path` | required | Path to diffusion model checkpoint |
| `vae_checkpoint` | `Path` | required | Path to VAE checkpoint |
| `vocoder_checkpoint` | `Path \| None` | `None` | Path to HiFi-GAN checkpoint. `None` falls back to Griffin-Lim |
| `prompt` | `str` | `""` | Space/comma-separated keywords (e.g. `"punchy 808"`) |
| `cfg_scale` | `float` | `3.0` | Classifier-free guidance strength. Higher = more prompt adherence |
| `ddim_steps` | `int` | `50` | DDIM sampling steps. More steps = higher quality, slower |
| `output_path` | `Path \| None` | `None` | Output WAV path. `None` auto-generates in `generations/` folder |
| `seed` | `int \| None` | `None` | Random seed for reproducible output |

### Return value

Returns a `Path` to the generated WAV file.

### Output format

- WAV, 44,100 Hz, mono, float32
- 2 seconds (88,200 samples)
- Normalized to 0.95 peak amplitude

### Working with the waveform tensor directly

If you need the raw tensor instead of a file (e.g. for streaming or further processing), you can replicate the pipeline steps from `generate()`:

```python
import torch
from pathlib import Path
from models.autoencoder import KickVAE
from models.diffusion import LatentUNet, NoiseScheduler
from models.text_encoder import KeywordEncoder
from models.vocoder import HiFiGANGenerator
from inference.generate import DDIMSampler, parse_prompt

device = torch.device("cpu")

# Load diffusion model
diff_ckpt = torch.load("checkpoints/diffusion_step_100000.pt", weights_only=False, map_location=device)
vocab = diff_ckpt["vocab"]
cfg = diff_ckpt["config"]

model = LatentUNet(latent_dim=cfg.latent_dim, base_channels=cfg.base_channels, cond_dim=cfg.cond_dim).to(device)
model.load_state_dict(diff_ckpt["ema_state_dict"])
model.eval()

text_enc = KeywordEncoder(vocab_size=len(vocab), embed_dim=cfg.text_embed_dim, cond_dim=cfg.cond_dim).to(device)
text_enc.load_state_dict(diff_ckpt["text_enc_state_dict"])
text_enc.eval()

scheduler = NoiseScheduler(cfg.timesteps, cfg.beta_start, cfg.beta_end).to(device)

# Encode prompt
token_ids = parse_prompt("808", vocab)
cond = text_enc([token_ids], device)
uncond = text_enc([[]], device)

# Sample latent
sampler = DDIMSampler(scheduler, num_steps=50)
latent = sampler.sample(model, shape=(1, cfg.latent_dim, 8, 11), cond=cond, uncond=uncond, cfg_scale=3.0, device=device)

# Decode with VAE
vae_ckpt = torch.load("checkpoints/vae_epoch_100.pt", weights_only=False, map_location=device)
vae = KickVAE(latent_dim=cfg.latent_dim).to(device)
vae.load_state_dict(vae_ckpt["model_state_dict"])
vae.eval()

with torch.no_grad():
    log_mel = vae.decode(latent).squeeze(0)  # (1, 128, 173)

# Vocoder
vocoder = HiFiGANGenerator(in_channels=128).to(device)
voc_ckpt = torch.load("checkpoints/vocoder_epoch_50.pt", weights_only=False, map_location=device)
vocoder.load_state_dict(voc_ckpt["generator"])
vocoder.eval()
vocoder.remove_weight_norm()

with torch.no_grad():
    waveform = vocoder(log_mel)  # (1, 1, ~88576)
    waveform = waveform.squeeze()[:88200]  # trim to 2 seconds

# waveform is a 1D tensor of float32 audio samples at 44100 Hz
```

## CLI Usage

Run from the `pytorch/` directory:

```bash
# Basic generation (unconditional)
uv run inference/generate.py --vocoder-ckpt checkpoints/vocoder_epoch_50.pt

# With text prompt
uv run inference/generate.py --vocoder-ckpt checkpoints/vocoder_epoch_50.pt --prompt "808"

# With custom settings
uv run inference/generate.py \
    --vocoder-ckpt checkpoints/vocoder_epoch_50.pt \
    --prompt "punchy analog" \
    --cfg-scale 5.0 \
    --steps 50 \
    --seed 42

# Specify output path
uv run inference/generate.py \
    --vocoder-ckpt checkpoints/vocoder_epoch_50.pt \
    --output my_kick.wav

# Griffin-Lim fallback (no vocoder needed, lower quality)
uv run inference/generate.py --no-vocoder
```

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--prompt` | `""` | Text prompt keywords |
| `--cfg-scale` | `3.0` | Guidance scale |
| `--steps` | `50` | DDIM steps |
| `--seed` | None | Random seed |
| `--output` | auto | Output path (default: `generations/kick_<keywords>_<hash>.wav`) |
| `--diffusion-ckpt` | `checkpoints/diffusion_step_100000.pt` | Diffusion checkpoint |
| `--vae-ckpt` | `checkpoints/vae_epoch_100.pt` | VAE checkpoint |
| `--vocoder-ckpt` | `checkpoints/vocoder.pt` | Vocoder checkpoint |
| `--no-vocoder` | false | Use Griffin-Lim instead of HiFi-GAN |

## Text Conditioning

The model supports keyword-based text prompts. Prompts are matched against a vocabulary built from the training data filenames. Keywords that don't match any vocabulary entry are silently ignored.

To see what keywords are available, they are stored in the diffusion checkpoint:

```python
ckpt = torch.load("checkpoints/diffusion_step_100000.pt", weights_only=False)
print(ckpt["vocab"])  # list of valid keyword strings
```

When no prompt is given (or no keywords match), the model generates unconditionally.

**CFG scale** controls how strongly the output follows the prompt:
- `1.0` = no guidance (unconditional)
- `3.0` = default, moderate adherence
- `5.0+` = stronger adherence, may reduce variety

## Vocoder Options

**HiFi-GAN** (recommended): Higher quality output. Requires the vocoder checkpoint.

**Griffin-Lim** (fallback): Lower quality, no checkpoint needed. Uses iterative phase estimation to invert the mel spectrogram. Useful for quick testing.

## Device Support

The generation pipeline auto-detects the best available device: CUDA > MPS > CPU. All checkpoints are loaded with `map_location` so they work on any device regardless of where training was done.
