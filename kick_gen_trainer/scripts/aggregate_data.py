"""
Aggregate kick samples from nested folders into a single flat folder.
Copies files (originals remain untouched) and generates metadata CSV.
"""

import hashlib
import re
import shutil
from pathlib import Path

import pandas as pd
from tqdm import tqdm

# Configuration
SOURCE_DIR = Path("/Users/hookline/Dropbox/PRESTIGEWORLDWIDE/02_Samples")
DEST_DIR = Path(__file__).parent.parent / "data" / "raw"
METADATA_PATH = Path(__file__).parent.parent / "data" / "metadata.csv"

# Audio extensions to include
AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff", ".mp3", ".flac", ".ogg", ".m4a"}


def extract_keywords(filename: str) -> list[str]:
    """Extract descriptive keywords from filename."""
    # Remove extension
    name = Path(filename).stem

    # Split on common separators
    parts = re.split(r"[-_\s.]+", name)

    # Clean up: lowercase, remove pure numbers, filter short strings
    keywords = []
    for part in parts:
        cleaned = part.lower().strip()
        # Skip pure numbers, very short strings, or common non-descriptive words
        if cleaned and not cleaned.isdigit() and len(cleaned) > 1:
            keywords.append(cleaned)

    return keywords


def get_short_hash(filepath: Path) -> str:
    """Generate short hash from file path for unique naming."""
    hash_input = str(filepath).encode()
    return hashlib.md5(hash_input).hexdigest()[:6]


def is_kick_file(filepath: Path) -> bool:
    """Check if file is a kick sample based on filename and size."""
    name_lower = filepath.name.lower()
    if "kick" not in name_lower:
        return False
    if "loop" in name_lower:
        return False
    if "bpm" in name_lower:
        return False
    size = filepath.stat().st_size
    if size > 1_000_000 or size < 5_000:
        return False
    return True


def aggregate_kicks(dry_run: bool = False) -> None:
    """
    Find all kick samples and copy to destination folder.

    Args:
        dry_run: If True, only count files without copying
    """
    # Clear destination folder if it exists, then recreate
    if DEST_DIR.exists():
        shutil.rmtree(DEST_DIR)
    DEST_DIR.mkdir(parents=True, exist_ok=True)

    # Find all audio files with "kick" in the name
    print(f"Scanning {SOURCE_DIR}...")
    all_files = []
    for ext in AUDIO_EXTENSIONS:
        all_files.extend(SOURCE_DIR.rglob(f"*{ext}"))
        all_files.extend(SOURCE_DIR.rglob(f"*{ext.upper()}"))

    kick_files = [f for f in all_files if is_kick_file(f)]
    print(f"Found {len(kick_files)} kick samples")

    if dry_run:
        print("Dry run - no files copied")
        return

    # Copy files and build metadata
    metadata_rows = []

    for filepath in tqdm(kick_files, desc="Copying kicks"):
        # Generate unique filename with hash prefix
        short_hash = get_short_hash(filepath)
        new_name = f"{short_hash}_{filepath.name}"
        dest_path = DEST_DIR / new_name

        # Handle edge case of hash collision
        counter = 1
        while dest_path.exists():
            new_name = f"{short_hash}_{counter}_{filepath.name}"
            dest_path = DEST_DIR / new_name
            counter += 1

        # Copy file
        shutil.copy2(filepath, dest_path)

        # Extract metadata
        keywords = extract_keywords(filepath.name)
        metadata_rows.append({
            "filename": new_name,
            "original_path": str(filepath),
            "keywords": ",".join(keywords),
        })

    # Save metadata
    df = pd.DataFrame(metadata_rows)
    df.to_csv(METADATA_PATH, index=False)
    print(f"Saved metadata to {METADATA_PATH}")
    print(f"Copied {len(metadata_rows)} files to {DEST_DIR}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Aggregate kick samples")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count files without copying",
    )
    args = parser.parse_args()

    aggregate_kicks(dry_run=args.dry_run)
