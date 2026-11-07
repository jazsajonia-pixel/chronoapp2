"""Regenerate every app icon and splash PNG from assets/brand/chrono-mark.svg.

Run: python3 scripts/make-icons.py   (needs Python 3 with cairosvg and Pillow; dev-only, not an app dependency)

Outputs (assets/images/):
  icon.png                      1024, mark on the brand background (iOS / legacy launcher)
  android-icon-background.png   1024, solid brand background
  android-icon-foreground.png   1024, mark only, inside the 66/108 adaptive-icon safe zone
  android-icon-monochrome.png   1024, white mark for Android themed icons
  splash-icon.png               512, mark only (Android 12+ masks the splash icon to a circle)
  favicon.png                   48
"""
import io
import re
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "assets/brand/chrono-mark.svg").read_text()
OUT = ROOT / "assets/images"
BG = "#0A0F1A"  # = app.json splash/adaptive background = dark theme background

inner = re.search(r"<svg[^>]*>(.*)</svg>", SRC, re.S).group(1)
inner = re.sub(r"<!--.*?-->", "", inner, flags=re.S)


def render(size: int, scale: float, background: str | None = None, mono: str | None = None) -> Image.Image:
    """Mark centred on a size×size canvas, the 72-unit viewBox occupying `scale` of the width."""
    body = inner
    if mono:
        body = re.sub(r'(stroke|fill)="#[0-9A-Fa-f]{6}"', lambda m: f'{m.group(1)}="{mono}"', body)
    off = 72 * (1 - scale) / 2 / scale
    view = 72 / scale
    bg = f'<rect x="{-off}" y="{-off}" width="{view}" height="{view}" fill="{background}"/>' if background else ""
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-off} {-off} {view} {view}">{bg}{body}</svg>'
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


render(1024, 0.70, BG).save(OUT / "icon.png")
Image.new("RGBA", (1024, 1024), BG).save(OUT / "android-icon-background.png")
render(1024, 0.62).save(OUT / "android-icon-foreground.png")
render(1024, 0.62, mono="#FFFFFF").save(OUT / "android-icon-monochrome.png")
render(512, 0.62).save(OUT / "splash-icon.png")
render(48, 0.92, BG).save(OUT / "favicon.png")
print("icons written to", OUT)
