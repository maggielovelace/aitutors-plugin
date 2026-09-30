"""Professor Mercator — brick-built bust spec (geography). python3 prof_mercator.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, GREY, JACKET, SHIRT, WHITE, BLACK, MOUTH = 84, 0, 71, 3, 15, 15, 0, 0
SEA, LAND, STAND = 73, 10, 308
b = Bust(W=14, D=10, H=64)

# ---------------- body (identical to Pi)
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, JACKET, 'body')
V = lambda x, y, z: z > 36 and y > 70 and abs(x) <= (y - 70) * 0.45 + 8
b.recolour(V, SHIRT, tags={'body'})
# rain-jacket zip line down the V edges is implied; a rolled hood/collar hugs the back and sides of the neck
b.fill(lambda x, y, z: 160 <= y <= 196 and 56 ** 2 <= x * x + (z - 4) ** 2 <= 80 ** 2 and z < 30, JACKET, 'collar')
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and 60 < z <= 96 and abs(x) >= 30 + (178 - y) * 0.9, JACKET, 'collar')
b.fill(lambda x, y, z: 160 <= y <= 184 and x * x + (z - 4) ** 2 <= 68 ** 2 and z >= 10, SHIRT, 'collar')   # white crew neck
b.fill(lambda x, y, z: 160 <= y <= 208 and 54 ** 2 <= x * x + (z - 4) ** 2 <= 82 ** 2 and z < 10, JACKET, 'collar')  # rolled hood
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head: 13 studs wide, 41 plates tall (identical to Pi)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# short black hair: studded cap on crown and back, sides above the ears greying at the temples
cap = lambda x, y, z: ell(HX, HY + 16, HZ - 4, 138, 170, 126)(x, y, z) and (y > 440 or (z < -34 and y > 300) or (abs(x) > 112 and y > 360 and z < 44))
b.fill(cap, HAIR, 'hair')
b.recolour(lambda x, y, z: y > 440 or (z < -34 and y > 300), HAIR, tags={'head'})
b.recolour(lambda x, y, z: (abs(x) > 104 and 360 < y < 462 and z > -30) or (abs(x) > 84 and 440 < y < 476 and z > 20), GREY, tags={'hair', 'head'})   # grey temples

T = {'head'}
for s in (-1, 1):
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 396 <= y <= 403, HAIR, tags=T, n=1, tag='brow')   # brows
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')                 # nose
# clean-shaven; a wide, closed, friendly smile
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)

# ---------------- arms (identical to Pi) and the globe on its stand
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), JACKET, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), JACKET, 'arm')
    b.fill(ell(56 * s, 90, 136, 30, 26, 30), SKIN, 'hand')

GX, GY, GZ, GR = 10, 170, 132, 64
b.fill(lambda x, y, z: 72 <= y <= 86 and (x - GX) ** 2 + (z - GZ) ** 2 <= 40 * 40, STAND, 'globe')        # base
b.fill(lambda x, y, z: 86 < y <= 112 and abs(x - GX) <= 10 and abs(z - GZ) <= 10, STAND, 'globe')        # post
def arc(x, y, z):                                                                                   # meridian half-ring
    r = math.hypot(x - GX, (y - GY) * 1.0)
    return -10 <= z - GZ <= 30 and 70 <= r <= 86 and x < GX - 10 and y <= GY + 48
b.fill(arc, STAND, 'globe')
b.fill(ell(GX, GY, GZ, GR, GR, GR), SEA, 'globe')
# continents: blobs on the sphere's surface, seen from the front
# continents painted stud by stud on the globe's face (top row first; '#' land, 'o' sea)
MAP = """
..ooo..
.##ooo.
o###oo#
o###o##
oo#oo##
oo#oo##
ooo#o##
ooo##o#
ooo##o#
ooo#oo#
oo##ooo
oo#oooo
oo#oooo
.ooooo.
.ooooo.
..ooo..""".split()
TOPY = 28
def land(x, y):
    X, Y = (x - 10) // 20, int((y - 4) // 8)
    r, c = TOPY - Y, X + 3
    return 0 <= r < len(MAP) and 0 <= c < 7 and MAP[r][c] == '#'
b.paint_front(land, LAND, tags={'globe'}, depth=2)

# ---------------- plinth (identical to Pi)
PLINTH = 72
b2 = {}
for k, v in list(b.v.items()):
    b2[(k[0], k[1] + 3, k[2])] = v
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR, GREY))
save(parts, sys.argv[1], dict(name='Professor Mercator', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
