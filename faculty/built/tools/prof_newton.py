"""Professor Newton — brick-built bust spec (structure copied from prof_pi.py). python3 prof_newton.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, SUIT, SHIRT, TIE, WHITE, BLACK, MOUTH = 308, 0, 272, 15, 25, 15, 0, 0
APPLE, STEM, LEAF = 4, 308, 2
b = Bust(W=14, D=10, H=64)

# ---------------- body (identical proportions to Pi)
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, SUIT, 'body')
V = lambda x, y, z: z > 36 and y > 70 and abs(x) <= (y - 70) * 0.45 + 8
b.recolour(V, SHIRT, tags={'body'})                                          # white shirt front in the lapel V
b.recolour(lambda x, y, z: V(x, y, z) and abs(x) <= 10 and y < 162, TIE, tags={'body'})   # tie blade
b.recolour(lambda x, y, z: V(x, y, z) and abs(x) <= 30 and y >= 162, TIE, tags={'body'})  # knot
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and z > 60 and abs(x) >= 30 + (178 - y) * 0.9, WHITE, 'collar')
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head: 13 studs wide, 41 plates tall (identical to Pi)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# close-cropped black hair: a tight studded cap on the crown and back, short at the temples
cap = lambda x, y, z: ell(HX, HY + 12, HZ - 4, 136, 168, 124)(x, y, z) and (y > 452 or (z < -34 and y > 310) or (abs(x) > 112 and y > 384 and z < 30))
b.fill(cap, HAIR, 'hair')
b.recolour(lambda x, y, z: y > 452 or (z < -34 and y > 310), HAIR, tags={'head'})

T = {'head'}
for s in (-1, 1):
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
# brows (2 plates, for contrast on dark skin): the viewer's-right one raised 2 plates — "what happens next?"
b.bump_front(lambda x, y: 30 <= -x <= 70 and 396 <= y <= 411, HAIR, tags=T, n=1, tag='brow')
b.bump_front(lambda x, y: 30 <= x <= 70 and 412 <= y <= 427, HAIR, tags=T, n=1, tag='brow')
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')                 # nose
# short neat chin beard, then a closed smile above it with skin between
b.paint_front(lambda x, y: y <= 228 and abs(x) <= 50, HAIR, tags=T, depth=2)
b.bump_front(lambda x, y: 204 <= y <= 220 and abs(x) <= 30, HAIR, tags=T, n=1, tag='beard')
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)                                # smile
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)

# ---------------- arms and the apple
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), SUIT, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), SUIT, 'arm')
    b.fill(ell(56 * s, 90, 136, 30, 26, 30), SKIN, 'hand')
b.fill(ell(0, 86, 142, 48, 46, 42), APPLE, 'apple')
b.fill(lambda x, y, z: 74 <= y <= 94 and abs(x) <= 10 and z > 176, APPLE, 'apple')   # keep the face of it round
b.recolour(lambda x, y, z: x == -30 and 92 <= y <= 108 and z == 170, WHITE, tags={'apple'})   # shine
b.fill(lambda x, y, z: x == 10 and 118 <= y <= 140 and z == 150, STEM, 'stem')
b.fill(lambda x, y, z: 30 <= x <= 50 and 126 <= y <= 136 and z == 150, LEAF, 'leaf')

# ---------------- plinth: every professor stands on the same dark base
PLINTH = 72
b2 = {(k[0], k[1] + 3, k[2]): v for k, v in b.v.items()}
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Professor Newton', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
