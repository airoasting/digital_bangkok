#!/usr/bin/env python3
"""og-image.png 생성 (1200x630).

썸네일의 은하는 그림이 아니라 정본 데이터다. docs/data/concepts.json의
실제 좌표와 부 색을 그대로 투영해 그린다. 개념이 늘거나 줄면 이 그림도 바뀐다.

실행: python3 tools/make-og.py
필요: Pillow, Pretendard-Black.ttf(사용자 폰트 폴더)
"""

import json
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
SS = 2  # 슈퍼샘플링 배율. 별과 글자의 계단을 없앤다

FONT_BLACK = os.path.expanduser("~/Library/Fonts/Pretendard-Black.ttf")
FONT_BOLD = os.path.expanduser("~/Library/Fonts/Pretendard-Bold.ttf")
FONT_MED = os.path.expanduser("~/Library/Fonts/Pretendard-Medium.ttf")

GOLD = (232, 163, 61)
PAPER = (247, 242, 230)
DIM = (196, 204, 224)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background(size):
    """style.css의 --space-bg를 그대로 옮긴다. 새로 만든 색이 없다."""
    w, h = size
    img = Image.new("RGB", (w, h))
    px = img.load()
    top, mid, bot = (10, 12, 26), (7, 8, 20), (4, 4, 9)
    for y in range(h):
        t = y / (h - 1)
        px_row = lerp(top, mid, t / 0.52) if t < 0.52 else lerp(mid, bot, (t - 0.52) / 0.48)
        for x in range(w):
            px[x, y] = px_row

    def radial(cx, cy, rx, ry, color, alpha, stop):
        layer = Image.new("RGB", (w, h), color)
        mask = Image.new("L", (w, h), 0)
        md = ImageDraw.Draw(mask)
        steps = 60
        for i in range(steps, 0, -1):
            f = i / steps
            a = int(alpha * (1 - f) ** 1.6 * 255) if stop else int(alpha * (1 - f) * 255)
            md.ellipse([cx - rx * f, cy - ry * f, cx + rx * f, cy + ry * f], fill=a)
        mask = mask.filter(ImageFilter.GaussianBlur(w * 0.02))
        img.paste(layer, (0, 0), mask)

    radial(w * 0.62, h * 0.50, w * 0.60, h * 0.85, (72, 47, 20), 0.30, True)   # 태양 온기
    radial(w * 0.14, h * 0.16, w * 0.50, h * 0.70, (28, 54, 88), 0.34, True)   # 좌상 청람
    radial(w * 0.90, h * 0.88, w * 0.46, h * 0.62, (80, 26, 68), 0.26, True)   # 우하 로즈
    return img


def glow_sprite(radius, color, core=1.0):
    """가산 합성용 점광원. 코어는 흰빛으로 타고 바깥이 부 색으로 남는다."""
    d = radius * 2
    sp = Image.new("RGB", (d, d), (0, 0, 0))
    dr = ImageDraw.Draw(sp)
    steps = max(12, radius)
    for i in range(steps, 0, -1):
        f = i / steps
        fall = (1 - f) ** 2.2
        r = radius * f
        # 흰 코어는 아주 좁게. 색이 헤일로를 차지해야 부가 읽힌다(style.css 별 규약과 같은 원칙)
        white = max(0.0, (1 - f * 6.5)) * core
        c = tuple(min(255, int(color[k] * fall * 2.3 + 255 * white)) for k in range(3))
        dr.ellipse([radius - r, radius - r, radius + r, radius + r], fill=c)
    return sp


def add(base, sprite, cx, cy):
    """가산 합성. 빛은 겹칠수록 밝아진다."""
    x, y = int(cx - sprite.width / 2), int(cy - sprite.height / 2)
    if x + sprite.width < 0 or y + sprite.height < 0 or x > base.width or y > base.height:
        return
    box = (max(0, x), max(0, y), min(base.width, x + sprite.width), min(base.height, y + sprite.height))
    if box[2] <= box[0] or box[3] <= box[1]:
        return
    crop = sprite.crop((box[0] - x, box[1] - y, box[2] - x, box[3] - y))
    region = base.crop(box)
    from PIL import ImageChops
    base.paste(ImageChops.add(region, crop), box)


def draw_tracked(draw, xy, text, font, fill, tracking=0):
    """PIL에는 자간이 없다. 글자마다 밀어 그린다."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def main():
    data = json.load(open(os.path.join(ROOT, "docs", "data", "concepts.json")))
    concepts, galaxies = data["concepts"], data["galaxies"]
    gcolor = {g["id"]: tuple(int(g["color"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) for g in galaxies}

    w, h = W * SS, H * SS
    img = background((w, h))

    # ── 은하 투영 ──────────────────────────────
    # 원반은 x-z 평면에 눕고 y가 두께다. x축으로 기울여 3/4로 본다.
    TILT = math.radians(66)  # 나선팔이 보이도록 원반을 눕힌다
    ca, sa = math.cos(TILT), math.sin(TILT)
    pts = []
    for c in concepts:
        x, y, z = c["position"]
        yy = y * ca - z * sa
        zz = y * sa + z * ca
        pts.append((x, yy, zz, c["galaxy"], c["importance"]))

    span = max(max(abs(p[0]) for p in pts), max(abs(p[1]) for p in pts))
    SCALE = (h * 0.415) / span
    CX, CY = w * 0.685, h * 0.50  # 왼쪽은 글자 자리로 비운다

    pts.sort(key=lambda p: p[2])  # 먼 별부터 그려야 앞의 별이 위에 온다

    # 태양(책). 화면에서 유일한 금색 덩어리.
    # 흰 포화가 넓으면 광구가 아니라 흰 반죽으로 보인다. 코어는 좁게, 코로나는 멀리.
    add(img, glow_sprite(int(210 * SS), tuple(int(v * 0.30) for v in GOLD), core=0.0), CX, CY)
    add(img, glow_sprite(int(96 * SS), tuple(int(v * 0.60) for v in GOLD), core=0.0), CX, CY)
    add(img, glow_sprite(int(34 * SS), GOLD, core=0.85), CX, CY)

    for x, yy, zz, g, imp in pts:
        px_, py_ = CX + x * SCALE, CY - yy * SCALE
        r = int((6.0 + imp * 3.4) * SS)
        add(img, glow_sprite(r, gcolor.get(g, (200, 200, 200))), px_, py_)

    # ── 글자 ──────────────────────────────────
    d = ImageDraw.Draw(img)
    M = int(76 * SS)

    logo = Image.open(os.path.join(ROOT, "docs", "assets", "logos", "logo1-white.png")).convert("RGBA")
    ls = int(44 * SS)
    logo = logo.resize((ls, ls), Image.LANCZOS)
    img.paste(logo, (M, int(64 * SS)), logo)

    f_brand = ImageFont.truetype(FONT_BLACK, int(23 * SS))
    draw_tracked(d, (M + ls + int(16 * SS), int(64 * SS) + int(9 * SS)),
                 "AI ROASTING", f_brand, PAPER, tracking=int(4.2 * SS))

    f_title = ImageFont.truetype(FONT_BLACK, int(104 * SS))
    ty = int(215 * SS)
    d.text((M - int(4 * SS), ty), "디지털 방콕", font=f_title, fill=PAPER)
    line2 = "인사이트"
    d.text((M - int(4 * SS), ty + int(104 * SS)), line2, font=f_title, fill=PAPER)
    # 마침표는 태양과 같은 금색. 책을 가리키는 표시다
    dot_x = M - int(4 * SS) + d.textlength(line2, font=f_title)
    d.text((dot_x, ty + int(104 * SS)), ".", font=f_title, fill=GOLD)

    f_sub = ImageFont.truetype(FONT_BOLD, int(30 * SS))
    f_sub_l = ImageFont.truetype(FONT_MED, int(30 * SS))
    sy = ty + int(238 * SS)
    x = M
    for text, fnt, col in (("200개", f_sub, PAPER), (" 개념과 ", f_sub_l, DIM),
                           ("540개", f_sub, PAPER), (" 연결", f_sub_l, DIM)):
        d.text((x, sy), text, font=fnt, fill=col)
        x += d.textlength(text, font=fnt)

    out = img.resize((W, H), Image.LANCZOS)
    path = os.path.join(ROOT, "docs", "assets", "og-image.png")
    out.save(path, optimize=True)
    print(f"{path}  {W}x{H}  {os.path.getsize(path) // 1024}KB  (별 {len(concepts)}개)")


if __name__ == "__main__":
    main()
