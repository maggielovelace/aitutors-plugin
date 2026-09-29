"""Compose the instruction booklet (PNG pages + PDF) from the step renders.

An original manual system (not LEGO's): warm paper, ink type, amber step
numerals, a parts callout per step, a module banner with a progress rule.
"""
import json, os, sys, math, glob
from collections import Counter
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parts import CAT

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
STEPS_DIR = os.path.join(ROOT, 'instructions', 'steps')
OUT = os.path.join(ROOT, 'instructions')
P = json.load(open(os.path.join(ROOT, 'model', 'heddy.json')))['parts']
SJ = json.load(open(os.path.join(ROOT, 'model', 'heddy_steps.json')))
STEPS, MODULES = SJ['steps'], dict(SJ['modules'])
VAL = json.load(open(os.path.join(ROOT, 'model', 'validation.json')))

W, H = 1754, 1240
PAPER, PANEL, INK, SOFT, AMBER, GREEN = '#F8F3EB', '#F1EDE0', '#08203B', '#3C4F62', '#DC9400', '#238744'
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda s, b=False: ImageFont.truetype(FB if b else F, s)
COLNAME = {15: 'White', 151: 'Light Stone Grey', 191: 'Flame Yellowish Orange', 272: 'Earth Blue', 2: 'Dark Green',
           71: 'Medium Stone Grey', 72: 'Dark Stone Grey'}
COLHEX = {15: '#FFFFFF', 151: '#E6E3E0', 191: '#F8BB3D', 272: '#0D325B', 2: '#257A3E', 71: '#A0A5A9', 72: '#6C6E68'}
ICON = {}


def icon(ld, c, size):
    key = (ld, c, size)
    if key not in ICON:
        p = os.path.join(STEPS_DIR, f'icon-{ld}-{c}.png')
        im = Image.open(p).convert('RGBA') if os.path.exists(p) else Image.new('RGBA', (size, size), (0, 0, 0, 0))
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        im.thumbnail((size, size), Image.LANCZOS)
        ICON[key] = im
    return ICON[key]


def page(module=None, n_step=None):
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    if module:
        d.text((70, 48), MODULES[module].upper(), font=font(26, True), fill=INK)
        d.text((W - 70, 48), 'HEDDY', font=font(26, True), fill=INK, anchor='ra')
        # progress rule: the whole build, amber up to this step
        y = 96
        d.line((70, y, W - 70, y), fill='#D9D2C3', width=4)
        if n_step:
            x = 70 + (W - 140) * n_step / len(STEPS)
            d.line((70, y, x, y), fill=AMBER, width=4)
    return im, d


def paste_rgba(im, sub, xy):
    im.paste(sub, xy, sub)


def step_block(im, d, s, box):
    x0, y0, x1, y1 = box
    # step numeral
    d.text((x0, y0), str(s['n']), font=font(92, True), fill=INK)
    # parts callout
    cnt = Counter((P[i]['ldraw'], P[i]['colour']) for i in s['parts'])
    if cnt:
        cx, cy = x0 + 205, y0 + 8
        items = sorted(cnt.items(), key=lambda kv: -kv[1])
        cols = min(len(items), 5)
        rows = math.ceil(len(items) / 5)
        bw = 20 + cols * 96
        bh = 12 + rows * 112
        d.rounded_rectangle((cx, cy, cx + bw, cy + bh), 18, fill=PANEL)
        for k, ((ld, c), q) in enumerate(items):
            ix, iy = cx + 14 + (k % 5) * 96, cy + 10 + (k // 5) * 112
            ic = icon(ld, c, 76)
            paste_rgba(im, ic, (ix + (80 - ic.width) // 2, iy + (80 - ic.height) // 2))
            d.text((ix + 40, iy + 84), f'{q}x', font=font(22, True), fill=INK, anchor='ma')
        top = cy + bh + 16
    else:
        top = y0 + 120
    # render
    p = os.path.join(STEPS_DIR, f"step-{s['n']:03d}.png")
    if os.path.exists(p):
        r = Image.open(p).convert('RGBA')
        bb = r.getbbox()
        if bb:
            r = r.crop(bb)
        avail_w, avail_h = x1 - x0, y1 - top - 60
        r.thumbnail((avail_w, avail_h), Image.LANCZOS)
        paste_rgba(im, r, (x0 + (avail_w - r.width) // 2, top + (avail_h - r.height) // 2))
    if s['sub'] == 'upper' and s.get('view') == 'under':
        d.text((x1, y0 + 20), 'upside-down', font=font(22), fill=SOFT, anchor='ra')
    if s['sub'] == 'attach-upper':
        ax = (x0 + x1) // 2
        d.line((ax + 260, top + 60, ax + 260, top + 260), fill=AMBER, width=8)
        d.polygon([(ax + 240, top + 250), (ax + 280, top + 250), (ax + 260, top + 290)], fill=AMBER)
    if s['note']:
        d.text((x0, y1 - 40), s['note'], font=font(24), fill=SOFT)


pages = []
# ---- cover
im, d = page()
hero = os.path.join(ROOT, 'renders', 'hero-3q.png')
if os.path.exists(hero):
    h = Image.open(hero).convert('RGB')
    h.thumbnail((1100, 1100))
    im.paste(h, (W - h.width - 40, (H - h.height) // 2))
d.text((110, 300), 'HEDDY', font=font(150, True), fill=INK)
d.text((116, 480), 'Desk sculpture  |  build manual', font=font(40), fill=SOFT)
d.line((116, 560, 520, 560), fill=AMBER, width=6)
d.text((116, 600), f"{VAL['parts']:,} pieces", font=font(34, True), fill=INK)
d.text((116, 650), f"{VAL['size_mm'][1]:.0f} mm tall  |  {len(STEPS)} steps", font=font(30), fill=SOFT)
d.text((116, 1080), 'Think it through with Heddy.', font=font(30), fill=INK)
d.text((116, 1130), 'heddy.app', font=font(30, True), fill=AMBER)
pages.append(im)

# ---- overview
im, d = page()
d.text((110, 110), 'How this build works', font=font(56, True), fill=INK)
txt = ['Heddy is built like a real sculpture: a hollow shell of plates and bricks, one layer at a time.',
       'Her face is built sideways (studs forward) and clicked onto bricks with studs on the side.',
       'A hidden turntable lets her upper body turn on her feet. Grey inside = structure you will not see.',
       'Each step shows the new pieces in full colour; pieces from earlier steps are shown lighter.']
for k, t in enumerate(txt):
    d.text((110, 220 + k * 50), t, font=font(28), fill=SOFT)
y = 460
d.text((110, y), 'Build stages', font=font(34, True), fill=INK)
for k, (mod, name) in enumerate(SJ['modules']):
    ns = [s['n'] for s in STEPS if s['module'] == mod]
    d.text((110, y + 60 + k * 52), f'{k + 1}', font=font(30, True), fill=AMBER)
    d.text((160, y + 60 + k * 52), name, font=font(30), fill=INK)
    d.text((620, y + 60 + k * 52), f'steps {ns[0]}-{ns[-1]}', font=font(26), fill=SOFT)
d.text((980, y), 'Colours', font=font(34, True), fill=INK)
cc = Counter(p['colour'] for p in P)
for k, (c, n) in enumerate(cc.most_common()):
    yy = y + 60 + k * 70
    d.rounded_rectangle((980, yy, 1030, yy + 50), 10, fill=COLHEX[c], outline='#CFC7B6', width=2)
    d.text((1050, yy + 6), f'{COLNAME[c]}', font=font(28), fill=INK)
    d.text((1560, yy + 6), f'{n}', font=font(28, True), fill=INK, anchor='ra')
pages.append(im)

# ---- steps, two per page (a big stage gets its own page)
i = 0
while i < len(STEPS):
    s = STEPS[i]
    im, d = page(s['module'], s['n'])
    pair = [s]
    if i + 1 < len(STEPS) and STEPS[i + 1]['module'] == s['module']:
        pair.append(STEPS[i + 1])
    if len(pair) == 1:
        step_block(im, d, s, (110, 140, W - 110, H - 60))
    else:
        step_block(im, d, pair[0], (90, 140, W // 2 - 40, H - 60))
        d.line((W // 2, 170, W // 2, H - 90), fill='#E3DCCD', width=3)
        step_block(im, d, pair[1], (W // 2 + 50, 140, W - 90, H - 60))
    d.text((W // 2, H - 40), str(len(pages) + 1), font=font(22), fill=SOFT, anchor='ma')
    pages.append(im)
    i += len(pair)

# ---- inventory
lots = Counter((p['ldraw'], p['colour']) for p in P)
items = sorted(lots.items(), key=lambda kv: (kv[0][1] != 15, kv[0][1], kv[0][0]))
per = 7 * 5
for k0 in range(0, len(items), per):
    im, d = page()
    d.text((110, 70), 'Parts inventory', font=font(48, True), fill=INK)
    d.text((W - 110, 84), f"{VAL['parts']:,} pieces  |  {len(items)} lots", font=font(28), fill=SOFT, anchor='ra')
    for k, ((ld, c), q) in enumerate(items[k0:k0 + per]):
        x, y = 110 + (k % 7) * 222, 170 + (k // 7) * 204
        d.rounded_rectangle((x, y, x + 206, y + 190), 16, fill=PANEL)
        ic = icon(ld, c, 104)
        paste_rgba(im, ic, (x + (206 - ic.width) // 2, y + 12 + (104 - ic.height) // 2))
        d.text((x + 14, y + 124), f'{q}x', font=font(26, True), fill=INK)
        d.text((x + 192, y + 128), ld, font=font(20), fill=SOFT, anchor='ra')
        d.text((x + 14, y + 158), COLNAME[c], font=font(17), fill=SOFT)
    d.text((W // 2, H - 40), str(len(pages) + 1), font=font(22), fill=SOFT, anchor='ma')
    pages.append(im)

# ---- validation
im, d = page()
d.text((110, 90), 'Engineered, then checked', font=font(52, True), fill=INK)
checks = [('No part intersects another', VAL['collisions'] == 0),
          ('Every part is held by studs', VAL['floating'] == 0),
          ('One connected structure', VAL['single_component']),
          ('Buildable in this order', VAL['order_failures'] == 0 and VAL['approach_failures'] == 0),
          ('Comes apart again', VAL['disassembly_failures'] == 0),
          (f"Stands on its feet (tips only past {VAL['tip_angle_deg']} deg)", VAL['stability_margin_mm'] > 0),
          ('Upper body turns +/-20 deg freely', all(v == 0 for v in VAL['swivel'].values()))]
for k, (t, ok) in enumerate(checks):
    y = 220 + k * 90
    d.ellipse((110, y, 160, y + 50), fill=GREEN if ok else '#B3261E')
    d.text((135, y + 25), 'v' if ok else 'x', font=font(30, True), fill='white', anchor='mm')
    d.text((190, y + 6), t, font=font(34), fill=INK)
d.text((110, 900), f"{VAL['parts']:,} pieces  |  {VAL['mass_g']/1000:.1f} kg  |  "
       f"{VAL['size_mm'][0]:.0f} x {VAL['size_mm'][1]:.0f} x {VAL['size_mm'][2]:.0f} mm", font=font(30), fill=SOFT)
d.text((110, 960), 'Checks computed from the digital model (tools/validate.py).', font=font(24), fill=SOFT)
pages.append(im)

os.makedirs(os.path.join(OUT, 'pages'), exist_ok=True)
for f in glob.glob(os.path.join(OUT, 'pages', '*.png')):
    os.remove(f)
for k, im in enumerate(pages):
    im.save(os.path.join(OUT, 'pages', f'page-{k + 1:03d}.png'), optimize=True)
pages[0].save(os.path.join(OUT, 'heddy-lego-instructions.pdf'), save_all=True, append_images=pages[1:],
              resolution=150, quality=82)
print('pages', len(pages))
