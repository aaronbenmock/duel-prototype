"""Convert an approved PNG export to WebP while preserving transparency."""

from pathlib import Path
import sys

from PIL import Image


def main() -> None:
    if len(sys.argv) not in (3, 4):
        raise SystemExit(
            "Usage: convert_png_to_webp.py INPUT.png OUTPUT.webp [quality]"
        )

    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        image = image.convert("RGBA")
        if len(sys.argv) == 4:
            image.save(destination, "WEBP", quality=int(sys.argv[3]), method=6)
        else:
            image.save(destination, "WEBP", lossless=True, method=6)

    print(f"Created {destination}")


if __name__ == "__main__":
    main()
