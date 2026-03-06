"""
Aggregate kick samples from nested folders into a single flat folder.
Copies files (originals remain untouched) and generates metadata CSV.
"""

import re
import shutil
from pathlib import Path
from tqdm import tqdm
import pandas as pd

# Configuration
SOURCE_DIR = Path("/Users/hookline/Dropbox/PRESTIGEWORLDWIDE/02_Samples")
DEST_DIR = Path(__file__).parent.parent / "data" / "raw"
METADATA_PATH = Path(__file__).parent.parent / "data" / "metadata.csv"

# Audio extensions to include
AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff", ".mp3", ".flac", ".ogg", ".m4a"}


def extract_keywords(filename: str) -> list[str]:
    """Extract descriptive keywords from filename."""
    # Remove extension
    filename_no_extension = Path(filename).stem

    # Split on common separators
    potential_keywords = re.split(r"[-_\s.]+", filename_no_extension)

    keywords = []
    for word in potential_keywords:
        if word:
            keywords.append(word.lower())

    return keywords


def aggregate_kicks() -> None:
    """
    Find all kick samples and copy to destination folder.
    """
    # Clear destination folder if it exists, then recreate
    if DEST_DIR.exists():
        shutil.rmtree(DEST_DIR)
    DEST_DIR.mkdir(parents=True)

    # Find all audio files with "kick" in the name
    print(f"Pulling together kicks in {SOURCE_DIR}...")
    kick_files = [
        f
        for f in SOURCE_DIR.rglob("*")
        if "kick" in f.name.lower() and f.suffix.lower() in AUDIO_EXTENSIONS
    ]
    print(f"Found {len(kick_files)} before filtering")

    # filter out kicks with "bpm" or "loop" in the name
    # and files less than 5kb or larger than 1MB
    kick_files = [
        f
        for f in kick_files
        if "loop" not in f.name.lower()
        and "bpm" not in f.name.lower()
        and 5_000 < f.stat().st_size < 1_000_000
    ]
    print(f"{len(kick_files)} kick samples left after filtering")

    # Copy files and build metadata
    metadata_rows = []

    for i, filepath in enumerate(tqdm(kick_files, desc="Copying kicks")):
        # Generate unique filename with hash prefix
        short_hash = f"{i:06x}"  # 6 digit hex from increasing count
        new_name = f"{short_hash}-{filepath.name}"
        dest_path = DEST_DIR / new_name

        # Copy file
        shutil.copy2(filepath, dest_path)

        # Extract metadata
        keywords = extract_keywords(filepath.name)
        metadata_rows.append(
            {
                "filename": new_name,
                "original_path": str(filepath),
                "keywords": ",".join(keywords),
            }
        )

    # Save metadata
    df = pd.DataFrame(metadata_rows)
    df.to_csv(METADATA_PATH, index=False)
    print(f"Saved metadata to {METADATA_PATH}")
    print(f"Copied {len(metadata_rows)} files to {DEST_DIR}")


if __name__ == "__main__":
    aggregate_kicks()
