"""Professor Pi — brick-built bust spec. python3 prof_pi.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, CARDI, SHIRT_A, SHIRT_B, WHITE, BLACK, FRAME, TEA, MOUTH = 70, 71, 2, 272, 15, 15, 0, 0, 308, 0
b = Bust(W=14, D=10, H=64)

# ---------------- body (proportions of a brick bust: a big head on a compact torso)
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, CARDI, 'body')
V = lambda x, y, z: z > 36 and y > 70 and abs(x) <= (y - 70) * 0.45 + 8
b.recolour(V, SHIRT_A, tags={'body'})
b.recolour(lambda x, y, z: V(x, y, z) and ((int((x + 400) // 20) + int(y // 16)) % 2 == 0), SHIRT_B, tags={'body'})
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and z > 60 and abs(x) >= 30 + (178 - y) * 0.9, WHITE, 'collar')
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head: 13 studs wide, 41 plates tall
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# short grey hair: a studded cap on the crown and the back, sideburns above the ears
cap = lambda x, y, z: ell(HX, HY + 16, HZ - 4, 138, 170, 126)(x, y, z) and (y > 452 or (z < -34 and y > 300) or (abs(x) > 112 and y > 360 and z < 44))
b.fill(cap, HAIR, 'hair')
b.recolour(lambda x, y, z: y > 452 or (z < -34 and y > 300), HAIR, tags={'head'})

T = {'head'}
for s in (-1, 1):
    # eye: 3-stud white with a centred 1-stud black pupil (2 plates), inside a thin black frame
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    b.paint_front(lambda x, y, s=s: (20 <= x * s <= 80 and (332 <= y <= 339 or 380 <= y <= 387)) or (x * s == 90 and 340 <= y <= 372), FRAME, tags=T)
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 396 <= y <= 403, HAIR, tags=T, n=1, tag='brow')   # brows
b.paint_front(lambda x, y: abs(x) <= 10 and 364 <= y <= 371, FRAME, tags=T)                                        # bridge
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')                 # nose
# beard on the jaw and chin, moustache, and a closed smile
b.paint_front(lambda x, y: (y <= 244 and abs(x) <= 110) or (y <= 300 and abs(x) >= 96), HAIR, tags=T, depth=2)
b.bump_front(lambda x, y: y <= 220 and abs(x) <= 50, HAIR, tags=T, n=1, tag='beard')
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)                                # smile
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)

# ---------------- arms and the mug of tea
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), CARDI, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), CARDI, 'arm')
    b.fill(ell(56 * s, 90, 136, 30, 26, 30), SKIN, 'hand')
b.fill(cyl_y(0, 142, 42, 56, 136), WHITE, 'mug')
b.fill(lambda x, y, z: 128 <= y <= 136 and x * x + (z - 142) ** 2 <= 32 * 32, TEA, 'mug')
b.fill(lambda x, y, z: 46 <= x <= 70 and 76 <= y <= 120 and 130 <= z <= 154 and not (50 <= x <= 62 and 84 <= y <= 112), WHITE, 'mug')

# ---------------- plinth: every professor stands on the same dark base
PLINTH = 72
b2 = {}
for k, v in list(b.v.items()):
    b2[(k[0], k[1] + 3, k[2])] = v
    if k in b.tag:
        pass
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Professor Pi', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
