"""Keyword-based text encoder for conditioning the diffusion model."""

import csv
from pathlib import Path

import torch
import torch.nn as nn


def build_vocab(metadata_csv: Path, min_count: int = 5) -> list[str]:
    """Build vocabulary from metadata CSV keywords, filtering rare tokens."""
    counts: dict[str, int] = {}
    with open(metadata_csv) as f:
        reader = csv.DictReader(f)
        for row in reader:
            for kw in row["keywords"].split(","):
                kw = kw.strip().lower()
                if kw:
                    counts[kw] = counts.get(kw, 0) + 1

    vocab = sorted(kw for kw, c in counts.items() if c >= min_count)
    return vocab


class KeywordEncoder(nn.Module):
    """Encodes a set of keyword indices into a fixed-size conditioning vector."""

    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 64,
        cond_dim: int = 256,
    ) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.proj = nn.Linear(embed_dim, cond_dim)
        self.null_embedding = nn.Parameter(torch.randn(cond_dim))

    def forward(self, token_ids: list[list[int]], device: torch.device) -> torch.Tensor:
        """Encode batch of keyword lists into conditioning vectors.

        Args:
            token_ids: List of lists of vocab indices per sample.
            device: Target device.

        Returns:
            (batch, cond_dim) conditioning tensor.
        """
        batch_embs = []
        for ids in token_ids:
            if len(ids) == 0:
                batch_embs.append(self.null_embedding)
            else:
                idx = torch.tensor(ids, device=device)
                emb = self.embedding(idx).mean(dim=0)
                batch_embs.append(self.proj(emb))
        return torch.stack(batch_embs)
