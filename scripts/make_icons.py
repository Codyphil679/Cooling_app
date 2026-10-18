"""Generate the app icons in public/icons. Run: python3 scripts/make_icons.py"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BLUE = (15, 76, 129, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling for smooth edges


def snowflake(draw, cx, cy, r, width):
    for k in range(6):
        a = math.radians(90 + k * 60)
        x, y = cx + r * math.cos(a), cy - r * math.sin(a)
        draw.line([(cx, cy), (x, y)], fill=WHITE, width=width)
        for frac in (0.45, 0.72):
            bx, by = cx + r * frac * math.cos(a), cy - r * frac * math.sin(a)
            for side in (-1, 1):
                b = a + side * math.radians(45)
                br = r * 0.26
                draw.line([(bx, by), (bx + br * math.cos(b), by - br * math.sin(b))], fill=WHITE, width=width)
    dot = width * 0.9
    draw.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=WHITE)


def icon(size, *, maskable=False, rounded=True):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, s, s], fill=BLUE)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BLUE)
    # Maskable icons must keep content inside the central 80% safe zone.
    r = s * (0.30 if maskable else 0.36)
    snowflake(d, s / 2, s / 2, r, max(2, int(s * 0.045)))
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192).save(OUT / "icon-192.png")
    icon(512).save(OUT / "icon-512.png")
    icon(512, maskable=True).save(OUT / "maskable-512.png")
    icon(180, rounded=False).save(OUT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
