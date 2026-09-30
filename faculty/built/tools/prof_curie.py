"""Professor Curie — brick-built bust spec. python3 prof_curie.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, COAT, SHIRT, WHITE, BLACK, MOUTH = 78, 308, 15, 212, 15, 0, 320
GOG, LENS, LIQ, PENCIL, TIP, LAPEL = 72, 212, 10, 14, 19, 71
b = Bust(W=14, D=10, H=72)

# ---------------- body (identical to Pi)
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, COAT, 'body')
V = lambda x, y, z: z > 36 and y > 70 and abs(x) <= (y - 70) * 0.45 + 8
b.recolour(V, SHIRT, tags={'body'})
# lab-coat lapels: a grey edge line just outside the V
LAP = lambda x, y, z: z > 36 and y > 70 and (y - 70) * 0.45 + 8 < abs(x) <= (y - 70) * 0.45 + 28
b.recolour(LAP, LAPEL, tags={'body'})
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and z > 60 and abs(x) >= 30 + (178 - y) * 0.9, WHITE, 'collar')
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head: 13 studs wide, 41 plates tall (identical to Pi)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# dark hair: crown, back, forehead fringe and strands framing the face; a bun on top/back
HL = lambda x: 414 + max(0, 60 - abs(x - 20)) * 0.35        # hairline: swept, a touch lower at the temples
cap = lambda x, y, z: ell(HX, HY + 16, HZ - 4, 146, 172, 130)(x, y, z) and (
    y > HL(x) or (z < -30 and y > 250) or (abs(x) > 104 and y > 256 and z < 64))
b.fill(cap, HAIR, 'hair')
b.recolour(lambda x, y, z: y > HL(x) or (z < -30 and y > 250), HAIR, tags={'head'})
b.recolour(lambda x, y, z: abs(x) > 104 and y > 256 and z < 64, HAIR, tags={'head'})   # hair covers the ears
b.fill(ell(0, 512, -30, 62, 48, 60), HAIR, 'hair')                 # the bun, on top

T = {'head'}
for s in (-1, 1):
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 396 <= y <= 403, HAIR, tags=T, n=1, tag='brow')
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)                                # smile
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)

# goggles pushed up onto the hair: a strap across the front, two raised light-blue lenses
HH = {'hair', 'head'}
b.paint_front(lambda x, y: 446 <= y <= 470, GOG, tags=HH)
for s in (-1, 1):
    b.bump_front(lambda x, y, s=s: 10 <= x * s <= 90 and 438 <= y <= 478, GOG, tags=HH, n=1, tag='goggle')
for s in (-1, 1):
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 446 <= y <= 470, LENS, tags={'goggle'}, n=1, tag='goggle')

# ---------------- arms and the conical flask
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

# pencils in the chest pocket (her left breast, viewer's right) — before the arms so arms win
b.paint_front(lambda x, y: 70 <= x <= 150 and 112 <= y <= 119, LAPEL, tags={'body'})
for px in (90, 130):
    top = 170 if px == 90 else 162
    b.fill(lambda x, y, z, px=px, top=top: x == px and 120 <= y <= top - 20 and 66 <= z <= 112, PENCIL, 'pencil')
    b.fill(lambda x, y, z, px=px, top=top: x == px and top - 20 < y <= top - 12 and 66 <= z <= 112, TIP, 'pencil')
    b.fill(lambda x, y, z, px=px, top=top: x == px and top - 12 < y <= top and 66 <= z <= 112, BLACK, 'pencil')

for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), COAT, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), COAT, 'arm')
    b.fill(ell(56 * s, 90, 136, 30, 26, 30), SKIN, 'hand')
FZ = 150
def flask_r(y):
    if 40 <= y <= 128:
        return 60 - (y - 40) * 0.5
    if 128 < y <= 172:
        return 14
    return -1
b.fill(lambda x, y, z: x * x + (z - FZ) ** 2 <= flask_r(y) ** 2, WHITE, 'flask')
b.fill(lambda x, y, z: 166 <= y <= 174 and x * x + (z - FZ) ** 2 <= 22 ** 2, LAPEL, 'flask')   # lip
b.recolour(lambda x, y, z: y <= 100, LIQ, tags={'flask'})

# ---------------- plinth (identical to Pi)
PLINTH = 72
b2 = {}
for k, v in list(b.v.items()):
    b2[(k[0], k[1] + 3, k[2])] = v
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Professor Curie', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
