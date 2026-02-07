# Modeling Process

## Overview

This project trains a **latent diffusion model** that generates kick drum audio samples. It uses a three-component architecture:

1. **VAE (Variational Autoencoder)** -- compresses mel spectrograms into a compact latent space
2. **Diffusion Model (U-Net)** -- generates new latents from noise, with optional text conditioning
3. **Vocoder (HiFi-GAN)** -- converts mel spectrograms back to audio waveforms

The diffusion process operates in the VAE's latent space rather than on raw audio, which makes both training and inference much faster while maintaining quality.

## Audio Parameters

These constants are shared across all components:

| Parameter | Value |
|-----------|-------|
| Sample rate | 44,100 Hz |
| Duration | 2 seconds (88,200 samples) |
| n_fft | 2048 |
| hop_length | 512 |
| n_mels | 128 |
| Mel shape | (1, 128, 173) |
| Latent shape | (4, 8, 11) -- 352 floats, ~63x compression |

## Data Pipeline

### Step 1: Aggregate samples (`scripts/aggregate_data.py`)

Collects kick drum samples from a source directory of nested folders into a single flat `data/raw/` folder. Filters files by:
- Filename contains "kick"
- Not a loop or BPM-tagged file
- File size between 5KB and 1MB

Each file is renamed with a hash prefix to avoid collisions (e.g. `a3f2e1_KICK3.WAV`). A `data/metadata.csv` is generated with columns: `filename`, `original_path`, `keywords`.

Keywords are extracted from filenames by splitting on separators (`-`, `_`, spaces, dots), lowercasing, and removing pure numbers and tokens shorter than 2 characters.

**Result:** ~13,600 kick samples in `data/raw/`, with `data/metadata.csv`.

### Step 2: Preprocess audio (`scripts/preprocess.py`)

Converts each raw audio file to a log-mel spectrogram tensor:

1. Load audio via `soundfile`
2. Convert to mono
3. Resample to 44,100 Hz
4. Pad or trim to exactly 2 seconds
5. Normalize to -1 dB peak
6. Apply 0.2s linear fade-out
7. Compute mel spectrogram via `torchaudio.transforms.MelSpectrogram`
8. Convert to log scale: `log(mel.clamp(min=1e-5))`
9. Save as `.pt` tensor in `data/processed/`

**Result:** 13,613 tensors of shape `(1, 128, 173)` in `data/processed/`.

## VAE Training

### Architecture

**Encoder:** 4 downsampling stages using strided Conv2d + ResBlocks (GroupNorm + SiLU):
```
(1, 128, 173) -> (32, 64, 87) -> (64, 32, 44) -> (128, 16, 22) -> (256, 8, 11)
```
Then 1x1 convolutions produce `mu` and `logvar`, each of shape `(4, 8, 11)`.

**Decoder:** Mirror of encoder using ConvTranspose2d, outputs are cropped to `(1, 128, 173)`.

**Reparameterization:** `z = mu + std * epsilon` during training; inference uses `mu` directly (no sampling).

### Loss

```
loss = MSE(recon, target) + L1(recon, target) + kl_weight * KL_divergence
```

KL weight anneals linearly from 0.0001 to 0.001 over the first 20 epochs to prevent posterior collapse.

### Training Config

| Parameter | Value |
|-----------|-------|
| Batch size | 32 |
| Learning rate | 1e-4 (AdamW) |
| Epochs | 100 |
| Mixed precision | Yes (fp16 on CUDA) |
| Checkpoint every | 10 epochs |

**Checkpoint:** `checkpoints/vae_epoch_100.pt` (contains model state, optimizer state, config).

### Pre-encoding latents

Before diffusion training, all mel spectrograms are encoded to latents using the frozen VAE encoder (`mu` only, no sampling). Saved as `.pt` files in `data/latents/`, shape `(4, 8, 11)` each.

## Diffusion Model Training

### Architecture

**LatentUNet** operates on `(4, 8, 11)` latent tensors:

- **Timestep embedding:** Sinusoidal positional encoding (dim=64) -> MLP -> (256,)
- **Text embedding:** Keyword embeddings averaged -> linear projection -> (256,)
- **Conditioning:** timestep + text embeddings added together

**Down path:**
```
Conv2d(4, 64) -> CondResBlock(64)              -> (64, 8, 11)
Conv2d(64, 128, stride=2) -> CondResBlock(128) -> (128, 4, 6)
Conv2d(128, 256, stride=2)                     -> (256, 2, 3)
```

**Middle:** CondResBlock(256) -> SelfAttention2d(256) -> CondResBlock(256)

**Up path** with skip connections (concat + 1x1 reduce):
```
ConvTranspose2d + skip + CondResBlock -> (128, 4, 6)
ConvTranspose2d + skip + CondResBlock -> (64, 8, 11)
```

**Output:** GroupNorm + SiLU + Conv2d -> `(4, 8, 11)` predicted noise.

### Text Encoder

`KeywordEncoder` maps keyword token IDs to a conditioning vector:
- Embedding layer: `(vocab_size, 64)`
- Average keyword embeddings -> Linear projection to `(256,)`
- Empty keywords use a learnable `null_embedding` (enables unconditional generation)

Vocabulary is built from `metadata.csv` keywords with `min_count=5`.

### Noise Schedule

Linear beta schedule from 0.0001 to 0.02 over 1000 timesteps.

### Classifier-Free Guidance (CFG)

During training, 15% of samples have their keywords dropped (replaced with empty list), training the model to handle both conditional and unconditional generation. At inference, CFG interpolates between conditional and unconditional predictions.

### Training Config

| Parameter | Value |
|-----------|-------|
| Batch size | 16 |
| Learning rate | 1e-4 (AdamW) |
| Iterations | 100,000 |
| Gradient accumulation | 2 |
| Mixed precision | Yes (fp16 on CUDA) |
| EMA decay | 0.9999 |
| CFG dropout | 0.15 |
| Checkpoint every | 5,000 iterations |

**Checkpoint:** `checkpoints/diffusion_step_100000.pt` (contains model state, EMA state, text encoder state, vocab list, config).

## Vocoder Training

### Architecture

**HiFi-GAN v1 Generator** (sized for 6GB VRAM):
```
Input: (128, T) mel spectrogram
-> Conv1d(128, 256, 7)
-> Upsample 8x + 3x ResBlock1  -> (128, T*8)
-> Upsample 8x + 3x ResBlock1  -> (64, T*64)
-> Upsample 2x + 3x ResBlock1  -> (32, T*128)
-> Upsample 2x + 3x ResBlock1  -> (16, T*256)
-> Upsample 2x + 3x ResBlock1  -> (8, T*512)
-> Conv1d(8, 1, 7) + tanh
Output: (1, T*512) waveform
```

Total upsample factor: 8 * 8 * 2 * 2 * 2 = 512 (matches hop_length).

**Discriminators:**
- Multi-Period Discriminator (periods: 2, 3, 5, 7, 11)
- Multi-Scale Discriminator (3 scales with average pooling)

### Loss

```
loss_g = adversarial_loss + 2.0 * feature_matching_loss + 45.0 * mel_reconstruction_loss
loss_d = LS-GAN discriminator loss (real vs fake)
```

### Training Config

| Parameter | Value |
|-----------|-------|
| Batch size | 4-8 |
| Learning rate | 2e-4 (AdamW, betas=0.8/0.99) |
| Epochs | 50 |
| Segment size | 8,192 samples (random crop per batch item) |
| Mixed precision | No (fp32 for GAN stability) |
| LR scheduler | ExponentialLR(gamma=0.999) |
| Checkpoint every | 10 epochs |

The vocoder dataset lazy-loads raw audio paired with pre-computed mel spectrograms. Only file paths are stored in memory.

**Checkpoint:** `checkpoints/vocoder_epoch_50.pt` (contains generator, discriminator, optimizer, and scheduler states).

## Training Hardware

- **Training:** Linux desktop with 6GB VRAM GPU
- **Inference:** CPU-only (designed for Railway / Django deployment)

## Dependencies

```
torch>=2.10.0
torchaudio>=2.10.0
numpy>=2.4.2
pandas>=3.0.0
soundfile>=0.13.1
scipy>=1.14.0
tensorboard>=2.20.0
tqdm>=4.67.2
```
