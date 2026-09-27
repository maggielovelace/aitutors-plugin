"""Overlay assembly labels on the exploded render -> renders/exploded-labelled.png"""
import json, os
from PIL import Image, ImageDraw, ImageFont
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'renders')
im = Image.open(os.path.join(R, 'exploded.png')).convert('RGB')
W, H = im.size
A = json.load(open(os.path.join(R, 'exploded-anchors.json')))
d = ImageDraw.Draw(im)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', int(H * 0.022))
FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(H * 0.03))
INK, AMBER = (8, 32, 59), (220, 148, 0)
NAMES = {'head': 'HEAD SHELL', 'eyes': 'EYES', 'beak': 'BEAK', 'face': 'FACE PANEL', 'wingR': 'WING',
         'body': 'BODY + TURNTABLE', 'feet': 'FEET', 'badge': 'BELLY STAR'}
OFFS = {'head': (160, -60), 'eyes': (-260, -120), 'beak': (-260, 60), 'face': (-300, -20), 'wingR': (120, -80),
        'body': (-300, 120), 'feet': (180, 60), 'badge': (-260, 120)}
for k, (x, y) in A.items():
    px, py = x * W, y * H
    if not (0 <= px <= W and 0 <= py <= H):
        continue
    ox, oy = OFFS[k]
    tx, ty = px + ox * W / 2400, py + oy * H / 1600
    d.line((px, py, tx, ty), fill=INK, width=max(2, W // 900))
    d.ellipse((px - 6, py - 6, px + 6, py + 6), fill=AMBER)
    d.text((tx + (8 if ox > 0 else -8), ty), NAMES[k], font=F, fill=INK, anchor='lm' if ox > 0 else 'rm')
y = H * 0.06
for t in ('Real brick geometry', 'Buildable connections', 'Designed piece by piece'):
    d.text((W * 0.05, y), t, font=FB, fill=INK)
    y += H * 0.05
im.save(os.path.join(R, 'exploded-labelled.png'))
