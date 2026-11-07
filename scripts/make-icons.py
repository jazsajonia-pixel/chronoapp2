"""Regenerate every app icon and splash PNG from the reference mark crop.

Run: python3 scripts/make-icons.py (needs Pillow; dev-only, not an app dependency).
Outputs (assets/images/):
  icon.png                      1024, mark on the brand background (iOS / legacy launcher)
  android-icon-background.png   1024, solid brand background
  android-icon-foreground.png   1024, mark only, inside the adaptive-icon safe zone
  android-icon-monochrome.png   1024, white mark for Android themed icons
  splash-icon.png               512, mark only
  favicon.png                    48
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/brand/chrono-symbol.png"
OUT = ROOT / "assets/images"
BG = "#0A0F1A"  # = app.json splash/adaptive background = dark theme background
MARK = Image.open(SOURCE).convert("RGBA")


def render(size: int, scale: float, background: str | None = None, mono: str | None = None) -> Image.Image:
    """Fit the exact reference mark to a centred percentage of a square canvas."""
    width = round(size * scale)
    height = round(width * MARK.height / MARK.width)
    # Resize premultiplied pixels so transparent background colors cannot bleed into the mark.
    mark = MARK.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    if mono:
        alpha = mark.getchannel("A")
        mark = Image.new("RGBA", mark.size, mono)
        mark.putalpha(alpha)
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((size - width) // 2, (size - height) // 2))
    return canvas


render(1024, 0.70, BG).save(OUT / "icon.png")
Image.new("RGBA", (1024, 1024), BG).save(OUT / "android-icon-background.png")
render(1024, 0.62).save(OUT / "android-icon-foreground.png")
render(1024, 0.62, mono="#FFFFFF").save(OUT / "android-icon-monochrome.png")
render(512, 0.62).save(OUT / "splash-icon.png")
render(48, 0.92, BG).save(OUT / "favicon.png")
print("icons written to", OUT)
