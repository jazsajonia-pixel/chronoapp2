"""Regenerate app icon and splash PNGs from the canonical vector mark.
Run: pip install -r scripts/requirements-icons.txt && python3 scripts/make-icons.py
"""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/brand/chrono-mark.svg"
OUT = ROOT / "assets/images"
SYMBOL = ROOT / "assets/brand/chrono-symbol.png"
BG = "#080A10"


def render_mark(size: int, scale: float, background: str | None = None, monochrome: str | None = None) -> Image.Image:
    """Render the complete vector mark, preserving its proportions and clean alpha."""
    width = round(size * scale)
    height = round(width * 180 / 240)
    svg = cairosvg.svg2png(url=str(SOURCE), output_width=width, output_height=height)
    mark = Image.open(BytesIO(svg)).convert("RGBA")
    if monochrome:
        alpha = mark.getchannel("A")
        mark = Image.new("RGBA", mark.size, monochrome)
        mark.putalpha(alpha)
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((size - width) // 2, (size - height) // 2))
    return canvas


# Keep the source mark at its native 4:3 ratio; launcher exports add their own padding.
symbol_png = cairosvg.svg2png(url=str(SOURCE), output_width=960, output_height=720)
Image.open(BytesIO(symbol_png)).convert("RGBA").save(SYMBOL)
render_mark(1024, 0.70, BG).save(OUT / "icon.png")
Image.new("RGBA", (1024, 1024), BG).save(OUT / "android-icon-background.png")
render_mark(1024, 0.62).save(OUT / "android-icon-foreground.png")
render_mark(1024, 0.62, monochrome="#FFFFFF").save(OUT / "android-icon-monochrome.png")
render_mark(512, 0.62).save(OUT / "splash-icon.png")
render_mark(48, 0.92, BG).save(OUT / "favicon.png")

font_path = ROOT / "node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf"
font = ImageFont.truetype(str(font_path), 116)
wordmark = Image.new("RGBA", (512, 160), (0, 0, 0, 0))
draw = ImageDraw.Draw(wordmark)
bounds = draw.textbbox((0, 0), "chrono", font=font)
text_width = bounds[2] - bounds[0]
text_height = bounds[3] - bounds[1]
draw.text(((512 - text_width) / 2 - bounds[0], (160 - text_height) / 2 - bounds[1]), "chrono", font=font, fill="#F0F2F7")
wordmark.crop(wordmark.getchannel("A").getbbox()).save(OUT / "splash-wordmark.png")
print("Chrono vector mark, wordmark, and icon assets written")
