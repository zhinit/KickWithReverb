# /// script
# requires-python = ">=3.11"
# dependencies = ["matplotlib", "numpy", "soundfile", "librosa"]
# ///
"""Generate images/arnold-log-mel-spectrogram-zoom.png.

Log-mel spectrogram of the first 0.4s of the Arnold kick, plotted with
each mel bin at equal height (y-axis follows the mel scale, ticks show
the Hz each position corresponds to). This mirrors how the model sees
the input: a 128-row image with mel-spaced rows.

Mel params match kick_gen_trainer/scripts/preprocess.py:
    sr=44100, n_fft=2048, hop=512, n_mels=128, log = ln(clamp(mel, 1e-5))
(librosa with htk=True, norm=None, power=2.0 matches torchaudio defaults)

Run:
    uv run write_ups/images/scripts/arnold_log_mel_spectrogram_zoom.py
"""

from pathlib import Path

import librosa
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf
from matplotlib.colors import LinearSegmentedColormap

REPO = Path(__file__).resolve().parents[3]
SAMPLE = REPO / "frontend" / "src" / "assets" / "kicks" / "Arnold.wav"
OUT = Path(__file__).resolve().parents[1] / "arnold-log-mel-spectrogram-zoom.png"

SR = 44100
N_FFT = 2048
HOP = 512
N_MELS = 128
ZOOM_SECONDS = 0.4

# Style shared by the write-up figures
BG = "#f8f8f5"
TEXT = "#555555"
CMAP = LinearSegmentedColormap.from_list(
    "kickgreen", ["#f8fbf9", "#8fbCA4".lower(), "#1d4d38"]
)

# --- Load audio, mirror preprocess.py ---
audio, sr = sf.read(SAMPLE, dtype="float32")
if audio.ndim > 1:
    audio = audio.mean(axis=1)
if sr != SR:
    audio = librosa.resample(audio, orig_sr=sr, target_sr=SR)
peak = np.abs(audio).max()
if peak > 0:
    audio = audio * (10 ** (-1.0 / 20) / peak)  # normalize to -1dB peak

mel = librosa.feature.melspectrogram(
    y=audio, sr=SR, n_fft=N_FFT, hop_length=HOP, n_mels=N_MELS,
    htk=True, norm=None, power=2.0,
)
log_mel = np.log(np.clip(mel, 1e-5, None))

# --- Zoom to first 0.4s ---
n_frames = int(ZOOM_SECONDS * SR / HOP) + 1
log_mel = log_mel[:, :n_frames]
t_edges = np.arange(n_frames + 1) * HOP / SR

# --- Y axis: mel bin index (equal height per bin), ticks labeled in Hz ---
# Bin centers are evenly spaced on the mel scale, so freq -> bin index is
# a straight rescale of hz_to_mel.
mel_max = librosa.hz_to_mel(SR / 2, htk=True)


def freq_to_bin(f: float) -> float:
    return librosa.hz_to_mel(f, htk=True) / mel_max * (N_MELS + 1) - 1


bin_edges = np.arange(N_MELS + 1) - 0.5

# --- Plot ---
fig, ax = plt.subplots(figsize=(9.0, 7.09), dpi=100)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

mesh = ax.pcolormesh(t_edges, bin_edges, log_mel, cmap=CMAP, shading="flat")

ax.set_ylim(bin_edges[0], bin_edges[-1])
ax.set_xlim(0, ZOOM_SECONDS)

ytick_hz = [60, 250, 500, 1000, 2000, 5000, 10000, 20000]
ax.set_yticks([freq_to_bin(f) for f in ytick_hz])
ax.set_yticklabels(["60", "250", "500", "1k", "2k", "5k", "10k", "20k"])
ax.minorticks_off()

ax.set_title("Arnold kick — log-mel spectrogram (first 0.4s)",
             fontsize=16, color="#222222", pad=14)
ax.set_xlabel("Time (s)", fontsize=13, color=TEXT, labelpad=8)
ax.set_ylabel("Frequency (Hz, mel-spaced)", fontsize=13, color=TEXT, labelpad=8)
ax.tick_params(colors=TEXT, labelsize=12)
for spine in ax.spines.values():
    spine.set_visible(False)

cbar = fig.colorbar(mesh, ax=ax, pad=0.02)
cbar.set_label("log(mel energy)", fontsize=13, color=TEXT, labelpad=10)
cbar.ax.tick_params(colors=TEXT, labelsize=12)
cbar.outline.set_visible(False)

fig.tight_layout()
fig.savefig(OUT, facecolor=BG)
print(f"Saved: {OUT}")
