import modal
from pathlib import Path

# Define Image & Dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch", "torchaudio", "huggingface_hub", "scipy", "numpy"
)

app = modal.App("kick-generator-app")
volume = modal.Volume.persisted("kick-gen-model-cache")


@app.cls(
    image=image,
    gpu="T4",
    volumes={"/cache": volume},
    container_idle_timeout=300,  # Keep GPU warm for 5 minutes
    timeout=600,
)
class KickGenerator:
    @modal.enter()
    def setup(self):
        """
        This runs ONCE when the GPU boots up.
        We load all 3 models here and store them in 'self'.
        """
        import sys
        import os
        import torch
        from huggingface_hub import snapshot_download

        # --- A. Download Model Repo ---
        self.repo_dir = snapshot_download(
            "zhinit/kick-gen-v1",
            cache_dir="/cache",
        )

        # --- B. Setup Imports ---
        # Add repo to path so we can import 'models' and 'inference'
        if self.repo_dir not in sys.path:
            sys.path.insert(0, self.repo_dir)

        # Import your custom classes
        from models.autoencoder import KickVAE
        from models.diffusion import LatentUNet, NoiseScheduler
        from models.text_encoder import KeywordEncoder

        # Note: We import helper functions from your generate.py
        # (Make sure generate.py doesn't run main() on import!)
        from inference.generate import (
            DDIMSampler,
            parse_prompt,
            log_mel_to_mel,
            griffin_lim_synthesis,
        )

        # Save helpers for later use
        self.parse_prompt = parse_prompt
        self.DDIMSampler = DDIMSampler
        self.log_mel_to_mel = log_mel_to_mel
        self.griffin_lim_synthesis = griffin_lim_synthesis

        self.device = torch.device("cuda")

        # --- C. Load Diffusion Model ---
        print("Loading Diffusion...")
        diff_path = os.path.join(self.repo_dir, "weights/diffusion_step_100000.pt")
        diff_ckpt = torch.load(diff_path, map_location=self.device, weights_only=False)

        self.diff_cfg = diff_ckpt["config"]
        self.vocab = diff_ckpt["vocab"]

        self.model = LatentUNet(
            latent_dim=self.diff_cfg.latent_dim,
            base_channels=self.diff_cfg.base_channels,
            cond_dim=self.diff_cfg.cond_dim,
        ).to(self.device)
        self.model.load_state_dict(diff_ckpt["ema_state_dict"])
        self.model.eval()

        # --- D. Load Text Encoder ---
        self.text_enc = KeywordEncoder(
            vocab_size=len(self.vocab),
            embed_dim=self.diff_cfg.text_embed_dim,
            cond_dim=self.diff_cfg.cond_dim,
        ).to(self.device)
        self.text_enc.load_state_dict(diff_ckpt["text_enc_state_dict"])
        self.text_enc.eval()

        self.scheduler = NoiseScheduler(
            self.diff_cfg.timesteps, self.diff_cfg.beta_start, self.diff_cfg.beta_end
        ).to(self.device)

        # --- E. Load VAE ---
        print("Loading VAE...")
        vae_path = os.path.join(self.repo_dir, "weights/vae_epoch_100.pt")
        vae_ckpt = torch.load(vae_path, map_location=self.device, weights_only=False)
        self.vae = KickVAE(latent_dim=self.diff_cfg.latent_dim).to(self.device)
        self.vae.load_state_dict(vae_ckpt["model_state_dict"])
        self.vae.eval()

        # --- F. Load Vocoder (Optional) ---
        print("Loading Vocoder...")
        voc_path = os.path.join(self.repo_dir, "weights/vocoder_epoch_50.pt")
        if os.path.exists(voc_path):
            from models.vocoder import HiFiGANGenerator

            self.vocoder = HiFiGANGenerator(in_channels=128).to(self.device)
            voc_ckpt = torch.load(
                voc_path, map_location=self.device, weights_only=False
            )
            self.vocoder.load_state_dict(voc_ckpt["generator"])
            self.vocoder.eval()
            self.vocoder.remove_weight_norm()
        else:
            print("Vocoder not found, using Griffin-Lim")
            self.vocoder = None

    @modal.method()
    def generate_kick(
        self, prompt: str = "hit house", cfg_scale: float = 3.0, steps: int = 50
    ) -> bytes:
        """
        This runs for each generation. It reuses the models loaded in setup().
        """
        import torch
        import io
        import scipy.io.wavfile
        import numpy as np

        # 1. Parse Prompt
        token_ids = self.parse_prompt(prompt, self.vocab)

        # 2. Get Embeddings
        cond = self.text_enc([token_ids], self.device)
        uncond = self.text_enc([[]], self.device)

        # 3. Sample (DDIM)
        sampler = self.DDIMSampler(self.scheduler, num_steps=steps)
        latent = sampler.sample(
            self.model,
            shape=(1, self.diff_cfg.latent_dim, 8, 11),
            cond=cond,
            uncond=uncond,
            cfg_scale=cfg_scale,
            device=self.device,
        )

        # 4. Decode VAE
        with torch.no_grad():
            log_mel = self.vae.decode(latent)
            log_mel_2d = log_mel.squeeze(0)

        # 5. Vocode
        if self.vocoder:
            with torch.no_grad():
                waveform = self.vocoder(log_mel_2d)
                waveform = waveform.squeeze(0)
        else:
            mel_linear = self.log_mel_to_mel(log_mel_2d)
            waveform = self.griffin_lim_synthesis(mel_linear)

        # 6. Post-Process & Return Bytes
        # (Standard normalization logic from your script)
        peak = waveform.abs().max()
        if peak > 0:
            waveform = waveform * (0.95 / peak)

        waveform_cpu = waveform.cpu()
        audio_np = waveform_cpu.squeeze(0).numpy().astype(np.float32)

        # Write to memory buffer
        buffer = io.BytesIO()
        scipy.io.wavfile.write(buffer, 44100, audio_np)
        buffer.seek(0)

        return buffer.read()
