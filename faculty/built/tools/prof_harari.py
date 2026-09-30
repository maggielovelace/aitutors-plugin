"""Professor Harari — brick-built bust spec. python3 prof_harari.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, VEST, SHIRT, TIE, WHITE, BLACK, LID, PAPER, WOOD, MOUTH = 78, 15, 70, 19, 2, 15, 0, 308, 15, 308, 308
b = Bust(W=14, D=10, H=64)

# ---------------- body (identical to Pi)
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, VEST, 'body')
V = lambda x, y, z: z > 36 and y > 70 and abs(x) <= (y - 70) * 0.45 + 8
b.recolour(V, SHIRT, tags={'body'})
b.recolour(lambda x, y, z: V(x, y, z) and abs(x) <= 10 and y < 166, TIE, tags={'body'})     # green tie
# shirt shoulders: the waistcoat is sleeveless
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and z > 60 and abs(x) >= 30 + (178 - y) * 0.9, SHIRT, 'collar')
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head (identical size and centre)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# fluffy white hair: a fuller studded mop, puffed out at the sides above the ears
mop = lambda x, y, z: ell(HX, HY + 20, HZ - 6, 150, 178, 136)(x, y, z) and (
    y > 440 or (z < -30 and y > 290) or (abs(x) > 104 and y > 376 and z < 56))
b.fill(mop, HAIR, 'hair')
for s in (-1, 1):
    b.fill(lambda x, y, z, s=s: ell(142 * s, 408, -6, 30, 44, 50)(x, y, z) and z < 50, HAIR, 'hair')  # side puffs
b.recolour(lambda x, y, z: y > 440 or (z < -30 and y > 290), HAIR, tags={'head'})

T = {'head'}
for s in (-1, 1):
    # eye: 3-stud white with a centred 1-stud black pupil (2 plates); no glasses, a dark upper lid
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 380 <= y <= 387, LID, tags=T)
    # bushy white brows, a little wider and taller than Pi's
    b.bump_front(lambda x, y, s=s: 20 <= x * s <= 80 and 396 <= y <= 411, HAIR, tags=T, n=1, tag='brow')
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')                 # nose
# clean-shaven: a kind closed smile
b.paint_front(lambda x, y: abs(x) <= 30 and 260 <= y <= 267, MOUTH, tags=T)
b.paint_front(lambda x, y: abs(x) == 50 and 268 <= y <= 275, MOUTH, tags=T)

# ---------------- arms and the rolled scroll
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), SHIRT, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), SHIRT, 'arm')
SY, SZ = 96, 142
b.fill(lambda x, y, z: abs(x) <= 100 and (y - SY) ** 2 + (z - SZ) ** 2 <= 26 * 26, PAPER, 'scroll')
b.recolour(lambda x, y, z: abs(x) <= 100 and z - SZ >= 4 and 8 <= SY - y <= 15, 19, tags={"scroll"})   # the paper's curled edge
b.fill(lambda x, y, z: 100 < abs(x) <= 120 and (y - SY) ** 2 + (z - SZ) ** 2 <= 34 * 34, WOOD, 'scroll')
b.fill(lambda x, y, z: 120 < abs(x) <= 140 and (y - SY) ** 2 + (z - SZ) ** 2 <= 16 * 16, WOOD, 'scroll')
for s in (-1, 1):
    b.fill(ell(56 * s, 90, 136, 30, 26, 30), SKIN, 'hand')

# ---------------- plinth (identical)
PLINTH = 72
b2 = {}
for k, v in list(b.v.items()):
    b2[(k[0], k[1] + 3, k[2])] = v
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Professor Harari', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
