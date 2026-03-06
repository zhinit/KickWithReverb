# Training Handoff

This doc is for picking up on the Linux machine after pulling from GitHub. Read this first, then kick off the training runs in order.

## What Was Changed

All changes are already committed. Summary of what's different from the last training run:

- **Latent dim bumped from 4 to 8** — more information capacity in the VAE, better reconstruction, richer latents for diffusion. Everything must be retrained from scratch.
- **Cosine noise schedule** — replaces linear schedule in `models/diffusion.py`. Better for small latents.
- **VAE now uses CosineAnnealingLR** — LR decays smoothly to near-zero over 100 epochs.
- **Vocoder trains on full 2-second samples** — was using random 8,192-sample crops which caused granularization artifacts at inference. Batch size is now 4.
- **Data pipeline cleaned up** — `scripts/` renamed to `data_preprocessing/`, `aggregate_data.py` → `aggregate_raw_data.py`, `preprocess.py` → `convert_raw_to_mel.py`. Uses left channel instead of channel averaging. Hex counter prefix instead of MD5 hash.

## Data

The raw data and processed mels need to be regenerated because the preprocessing changed (left channel, normalization). The latents also need regenerating because `latent_dim` changed.

Run these in order:

```bash
cd kick_gen_trainer

# 1. Aggregate raw kicks (only needed if data/raw/ doesn't exist or you want a fresh pull)
uv run data_preprocessing/aggregate_raw_data.py

# 2. Convert to mel spectrograms (wipes and regenerates data/processed/)
uv run data_preprocessing/convert_raw_to_mel.py
```

Latents are generated automatically at the start of diffusion training — no separate step needed.

## Training Order

Must train in this order. Each stage depends on the previous.

### 1. VAE (~100 epochs, expect several hours)

```bash
uv run training/train_autoencoder.py
```

Checkpoint saved to `checkpoints/vae_epoch_100.pt`. This is what diffusion training and latent encoding need.

### 2. Diffusion (100k iterations, expect many hours)

```bash
uv run training/train_diffusion.py
```

This will first auto-encode all mels to latents using the VAE checkpoint, then train. Checkpoint saved to `checkpoints/diffusion_step_100000.pt`.

### 3. Vocoder (~50 epochs, expect several hours)

```bash
uv run training/train_vocoder.py
```

Checkpoint saved to `checkpoints/vocoder_epoch_50.pt`.

## Checking Progress

All three scripts write TensorBoard logs:

```bash
tensorboard --logdir runs/
```

## After Training

Once all three checkpoints exist, test inference locally:

```bash
uv run inference/generate.py \
    --vocoder-ckpt checkpoints/vocoder_epoch_50.pt \
    --prompt "808" \
    --seed 42
```

Then upload the three checkpoints to HuggingFace (`zhinit/kick-gen-v1`) to replace the old ones before deploying.

## Checkpoint Files Needed for Deployment

```
checkpoints/vae_epoch_100.pt
checkpoints/diffusion_step_100000.pt
checkpoints/vocoder_epoch_50.pt
```
