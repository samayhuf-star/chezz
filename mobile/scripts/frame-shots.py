#!/usr/bin/env python3
"""Frames raw simulator screenshots into App Store screenshots (6.9-inch, 1320x2868, RGB, no alpha).

Usage: python3 scripts/frame-shots.py <raw_dir> <out_dir> [font_bold.otf] [font_regular.otf]
Raw files are the PNGs written by .maestro/store-shots.yaml. Every image shown is a real capture of the app;
this script only adds a caption above it.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1320, 2868
BG_TOP, BG_BOTTOM = (22, 24, 29), (14, 40, 34)
ACCENT, TEXT, MUTED = (79, 209, 165), (245, 247, 250), (168, 178, 190)

SHOTS = [
    ("zz-home", "Win it for your city", "A new City vs City season every month"),
    ("zz-online", "Play real people, live", "7-minute games with matchmaking and an online rating"),
    ("zz-board", "50 bots on Stockfish", "Real clocks, and every ranked game is re-checked"),
    ("zz-pick-level", "Climb five tiers", "Beginner to Grandmaster Zero, one level at a time"),
    ("zz-rankings", "Rule the league table", "City, state, country and world boards"),
    ("zz-puzzles", "A daily puzzle", "Plus 223 mates in 1 and 2 to keep your streak"),
]


def gradient():
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        row = tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        for x in range(W):
            px[x, y] = row
    return img


def fit(draw, text, path, size, max_w):
    while size > 40:
        font = ImageFont.truetype(path, size)
        if draw.textlength(text, font=font) <= max_w:
            return font
        size -= 4
    return ImageFont.truetype(path, size)


def wrap(draw, text, font, max_w):
    lines, cur = [], ""
    for word in text.split():
        nxt = (cur + " " + word).strip()
        if draw.textlength(nxt, font=font) <= max_w:
            cur = nxt
        else:
            lines.append(cur)
            cur = word
    return lines + [cur]


def main():
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    bold = sys.argv[3] if len(sys.argv) > 3 else "/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf"
    regular = sys.argv[4] if len(sys.argv) > 4 else "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
    out.mkdir(parents=True, exist_ok=True)
    base = gradient()
    n = 0
    for name, head, sub in SHOTS:
        src = raw / f"{name}.png"
        if not src.exists():
            print("missing", src)
            continue
        n += 1
        img = base.copy()
        d = ImageDraw.Draw(img)
        d.rectangle([100, 150, 196, 162], fill=ACCENT)
        hf = fit(d, head, bold, 132, W - 200)
        d.text((100, 200), head, font=hf, fill=TEXT)
        sf = ImageFont.truetype(regular, 52)
        y = 200 + hf.size + 36
        for line in wrap(d, sub, sf, W - 200):
            d.text((100, y), line, font=sf, fill=MUTED)
            y += 68

        shot = Image.open(src).convert("RGB")
        sw = 1060
        sh = round(shot.height * sw / shot.width)
        shot = shot.resize((sw, sh), Image.LANCZOS)
        top = max(y + 70, 640)
        x = (W - sw) // 2
        radius = 84
        mask = Image.new("L", (sw, sh), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius, fill=255)
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle([x - 6, top + 24, x + sw + 6, top + sh + 40], radius, fill=(0, 0, 0, 150))
        img.paste(Image.alpha_composite(img.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(40))).convert("RGB"))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([x - 10, top - 10, x + sw + 10, top + sh + 10], radius + 10, fill=(42, 46, 54))
        img.paste(shot, (x, top), mask)
        dest = out / f"{n:02d}-{name.split('-', 1)[1]}.png"
        img.save(dest, "PNG", optimize=True)
        print("wrote", dest, img.size, img.mode)


if __name__ == "__main__":
    main()
