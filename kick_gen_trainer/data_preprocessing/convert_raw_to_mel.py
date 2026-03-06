"""
Preprocess raw kick samples into mel spectrogram tensors.

For each audio file in data/raw/:
  1. Load and convert to mono
  2. Resample to 44.1kHz
  3. Pad or trim to 2 seconds
  4. Apply 0.2s fade-out
  5. Compute mel spectrogram
  6. Save as .pt tensor in data/processed/
"""

import shutil
from pathlib import Path

import numpy as np
import torch
import torchaudio
from tqdm import tqdm

# Paths
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"

# Audio params
SAMPLE_RATE = 44_100
DURATION_SECONDS = 2.0
TARGET_SAMPLES = int(SAMPLE_RATE * DURATION_SECONDS)  # 88_200
FADE_OUT_SECONDS = 0.2
FADE_OUT_SAMPLES = int(SAMPLE_RATE * FADE_OUT_SECONDS)  # 8_820

# Mel spectrogram params
N_FFT = 2048
HOP_LENGTH = 512
N_MELS = 128


def apply_fade_out(waveform: torch.Tensor, fade_samples: int) -> torch.Tensor:
    """Apply a linear fade-out to the last fade_samples of the waveform."""
    fade = torch.linspace(1.0, 0.0, fade_samples)
    waveform[0, -fade_samples:] *= fade
    return waveform


def preprocess_file(
    filepath: Path,
    mel_transform: torchaudio.transforms.MelSpectrogram,
) -> torch.Tensor | None:
    """Load an audio file and return its mel spectrogram tensor.

    Returns:
        Mel spectrogram tensor of shape (1, 128, T), or None on failure.
    """
    try:
        waveform, sample_rate = torchaudio.load(filepath)
    except Exception as e:
        print(f"Failed to load {filepath.name}: {e}")
        return None

    # Convert to mono
    if waveform.shape[0] > 1:
        waveform = waveform[0:1]  # keep dims as (1, samples) to make torch audio happy

    # Resample
    if sample_rate != SAMPLE_RATE:
        resampler = torchaudio.transforms.Resample(sample_rate, SAMPLE_RATE)
        waveform = resampler(waveform)

    # Pad or trim to target length
    current_samples = waveform.shape[1]
    if current_samples < TARGET_SAMPLES:
        padding = TARGET_SAMPLES - current_samples
        waveform = torch.nn.functional.pad(waveform, (0, padding))
    elif current_samples > TARGET_SAMPLES:
        waveform = waveform[:, :TARGET_SAMPLES]

    # Normalize to full volume
    peak = waveform.abs().max()
    if peak > 0:
        waveform = waveform / peak

    # apply fade out
    waveform = apply_fade_out(waveform, FADE_OUT_SAMPLES)

    # map linear frequency bins to mel scaled frequency bins (perceptual)
    mel = mel_transform(waveform)

    # Convert amplitudes to log scale
    mel = torch.log(mel.clamp(min=1e-5))

    return mel


def preprocess_all() -> None:
    """Process all raw audio files into mel spectrograms."""
    if PROCESSED_DIR.exists():
        shutil.rmtree(PROCESSED_DIR)
    PROCESSED_DIR.mkdir(parents=True)

    mel_transform = torchaudio.transforms.MelSpectrogram(
        sample_rate=SAMPLE_RATE,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        n_mels=N_MELS,
    )

    raw_files = list(RAW_DIR.iterdir())
    success = 0
    failed = 0

    for filepath in tqdm(raw_files, desc="Preprocessing"):
        if filepath.suffix.lower() not in {
            ".wav",
            ".aif",
            ".aiff",
            ".mp3",
            ".flac",
            ".ogg",
            ".m4a",
        }:
            continue

        mel = preprocess_file(filepath, mel_transform)
        if mel is None:
            failed += 1
            continue

        out_path = PROCESSED_DIR / f"{filepath.stem}.pt"
        torch.save(mel, out_path)
        success += 1

    print(f"Done: {success} processed, {failed} failed")


if __name__ == "__main__":
    preprocess_all()
