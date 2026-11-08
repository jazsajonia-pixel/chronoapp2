"""Regenerate Chrono's launcher, adaptive, monochrome, splash and favicon PNGs from the vector mark.

Run: pip install -r scripts/requirements-icons.txt && python3 scripts/make-icons.py

Source of truth: assets/brand/chrono-mark.svg (Ember on transparent). Colour variants are made by
swapping the stroke colour, so every export is the same clean vector geometry, never a crop.
Palette: Ember on Ink (see src/ui/theme.tsx BRAND).
"""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "assets/brand/chrono-mark.svg").read_text()
OUT = ROOT / "assets/images"
BRAND = ROOT / "assets/brand"

INK = "#0B0D12"
SURFACE = "#14181F"
EMBER = "#FF7A3C"
PAPER = "#FAF8F5"
EMBER_DEEP = "#C94A12"
TEXT = "#ECEEF2"


def mark(size: int, color: str = EMBER) -> Image.Image:
    """The full 120-unit mark canvas (with its built-in optical padding) rendered at `size` px."""
    svg = SOURCE.replace(EMBER, color)
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(BytesIO(png)).convert("RGBA")


def tile(size: int, background: str, color: str, scale: float, radius: float | None = None) -> Image.Image:
    """Mark centred on a solid background; `scale` is the mark canvas size relative to the tile."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if radius is None:
        canvas.paste(Image.new("RGBA", (size, size), background))
    else:
        ImageDraw.Draw(canvas).rounded_rectangle((0, 0, size - 1, size - 1), round(size * radius), fill=background)
    m = mark(round(size * scale), color)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas


def on_transparent(size: int, color: str, scale: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    m = mark(round(size * scale), color)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas


# Launcher icon: the Ember tile with an Ink mark (first variant in the brand reference).
tile(1024, EMBER, INK, 0.80).save(OUT / "icon.png")
# Android adaptive icon: solid Ember background layer, Ink mark kept inside the 66% safe zone.
Image.new("RGBA", (1024, 1024), EMBER).save(OUT / "android-icon-background.png")
on_transparent(1024, INK, 0.64).save(OUT / "android-icon-foreground.png")
# Themed (Material You) icon: single-colour silhouette; the launcher tints it.
on_transparent(1024, "#FFFFFF", 0.64).save(OUT / "android-icon-monochrome.png")
# Native splash: Ember mark on Ink (the background colour comes from app.json). The React launch
# screen draws the same vector at the same size and position, so the hand-off doesn't jump.
mark(1024, EMBER).save(OUT / "splash-icon.png")
tile(48, INK, EMBER, 1.0).save(OUT / "favicon.png")

# Reference exports for docs/stores: the three tiles from the brand sheet and a lockup.
tile(512, EMBER, INK, 0.80, radius=0.22).save(BRAND / "icon-ember.png")
tile(512, SURFACE, EMBER, 0.80, radius=0.22).save(BRAND / "icon-ink.png")
tile(512, PAPER, EMBER_DEEP, 0.80, radius=0.22).save(BRAND / "icon-paper.png")

font_path = ROOT / "node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf"
font = ImageFont.truetype(str(font_path), 150)
lockup = Image.new("RGBA", (900, 760), INK)
m = mark(460)
lockup.alpha_composite(m, ((900 - 460) // 2, 40))
draw = ImageDraw.Draw(lockup)
box = draw.textbbox((0, 0), "chrono", font=font)
draw.text(((900 - (box[2] - box[0])) / 2 - box[0], 540 - box[1]), "chrono", font=font, fill=TEXT)
lockup.save(BRAND / "chrono-lockup.png")
print("Chrono icon, splash and brand exports written from assets/brand/chrono-mark.svg")
