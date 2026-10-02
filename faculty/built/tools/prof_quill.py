"""Professor Quill — brick-built bust spec. python3 prof_quill.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, JUMPER, SHIRT, WHITE, BLACK, MOUTH = 78, 0, 191, 15, 15, 0, 320
COVER, LINE, NIB = 70, 71, 14
b = Bust(W=14, D=10, H=64)

# ---------------- body (identical to Pi)
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, JUMPER, 'body')
# white shirt showing in a narrow V at the neck of the jumper
V = lambda x, y, z: z > 36 and y > 110 and abs(x) <= (y - 110) * 0.5 + 8
b.recolour(V, SHIRT, tags={'body'})
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and z > 60 and abs(x) >= 30 + (178 - y) * 0.9, WHITE, 'collar')
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head (identical to Pi)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# black hair: studded cap and a side-parted fringe that sweeps lower on one side; long at the sides and back (below)
def fringe_low(x):
    # parting at x = -50 (viewer's left); the fringe sweeps right and dips to y~428 just right of the parting
    if x < -50:
        return 436
    return 410 + (x + 50) * 0.2
cap = lambda x, y, z: ell(HX, HY + 16, HZ - 4, 138, 170, 126)(x, y, z) and (
    y > 452 or (y > fringe_low(x) and z > 0) or (z < -34 and y > 300) or (abs(x) > 112 and y > 360 and z < 44) or (abs(x) > 96 and y > 404 and z < 70))
b.fill(cap, HAIR, 'hair')
b.recolour(lambda x, y, z: y > 452 or (y > fringe_low(x) and z > 0) or (z < -34 and y > 300) or (abs(x) > 96 and y > 404 and z < 70), HAIR, tags={'head'})
# long hair (Quill is a woman, owner 2026-10-01): it falls past the ears to the shoulders and down the back,
# framing the face without covering it
long_hair = lambda x, y, z: ell(HX, 300, HZ - 10, 152, 214, 134)(x, y, z) and 182 <= y <= 470 and (abs(x) > 100 or z < -30) and not (abs(x) <= 100 and z > 40)
b.fill(long_hair, HAIR, 'hair')
b.recolour(lambda x, y, z: abs(x) > 98 and y > 240 and z < 70, HAIR, tags={'head'})   # hair covers the ears

T = {'head'}
# the fringe stands proud of the forehead by one cell, so it reads as hair rather than paint
b.bump_front(lambda x, y: y > fringe_low(x) and y <= 452 and abs(x) <= 100, HAIR, tags={'head', 'hair'}, n=1, tag='hair')
for s in (-1, 1):
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 392 <= y <= 399, HAIR, tags=T, n=1, tag='brow')   # brows
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')                 # nose
# a clear closed smile, corners lifted
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)

# ---------------- arms (identical to Pi) and the open book + fountain pen
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), JUMPER, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), JUMPER, 'arm')

# open book: spine at the back centre, the two halves opening forward in a shallow V
BY0, BY1 = 68, 156
def page_surface(x):          # z of the page face at x
    return 116 + abs(x) * 0.35
b.fill(lambda x, y, z: BY0 <= y <= BY1 and abs(x) <= 110 and page_surface(x) - 22 <= z < page_surface(x) - 4, COVER, 'book')
b.fill(lambda x, y, z: BY0 + 16 <= y <= BY1 - 16 and 10 < abs(x) <= 100 and page_surface(x) - 4 <= z <= page_surface(x) + 14, WHITE, 'book')
# a few lines of text on the pages
for s in (-1, 1):
    b.fill(ell(56 * s, 90, 136, 30, 26, 30), SKIN, 'hand', only_empty=False)
# fountain pen in the right hand (viewer's right), nib down towards the page
# a stepped diagonal one stud wide, two studs deep: nib on the page, clip near the cap
def pen(x, y, z):
    if not (112 <= y <= 204 and 150 <= z <= 190):
        return False
    return x == 50 + 20 * ((y - 112) // 24)
b.fill(pen, BLACK, 'pen')
b.recolour(lambda x, y, z: y <= 127, NIB, tags={'pen'})
b.recolour(lambda x, y, z: 180 <= y <= 187, NIB, tags={'pen'})

# ---------------- plinth (identical to Pi)
PLINTH = 72
b2 = {(k[0], k[1] + 3, k[2]): v for k, v in b.v.items()}
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Professor Quill', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
