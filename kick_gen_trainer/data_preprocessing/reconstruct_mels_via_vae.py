"""
Pass all processed mel spectrograms through the VAE encode→decode cycle and
save the reconstructed mels to data/vae_reconstructed/.

These reconstructed mels match the distribution the vocoder will receive at
inference time, so training the vocoder on them reduces the domain mismatch
between training and inference.

Usage:
    uv run data_preprocessing/reconstruct_mels_via_vae.py
"""

import sys
from pathlib import Path

import torch
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.autoencoder import KickVAE

PROCESSED_DIR = Path("data/processed")
OUTPUT_DIR = Path("data/vae_reconstructed")
VAE_CHECKPOINT = Path("checkpoints/vae_epoch_100.pt")


def reconstruct_all() -> None:
    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"Using device: {device}")

    ckpt = torch.load(VAE_CHECKPOINT, weights_only=False, map_location=device)
    latent_dim = ckpt["config"].latent_dim
    vae = KickVAE(latent_dim=latent_dim).to(device)
    vae.load_state_dict(ckpt["model_state_dict"])
    vae.eval()

    mel_files = sorted(
        f for f in PROCESSED_DIR.glob("*.pt") if not f.name.startswith("._")
    )
    if not mel_files:
        raise FileNotFoundError(f"No .pt files found in {PROCESSED_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Reconstructing {len(mel_files)} mels via VAE...")
    with torch.no_grad():
        for f in tqdm(mel_files):
            out_path = OUTPUT_DIR / f.name
            if out_path.exists():
                continue
            mel = torch.load(f, weights_only=False).unsqueeze(0).to(device)
            recon = vae(mel)[0]  # (recon, mu, logvar) -> take recon
            torch.save(recon.squeeze(0).cpu(), out_path)

    print(f"Done. Reconstructed mels saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    reconstruct_all()
