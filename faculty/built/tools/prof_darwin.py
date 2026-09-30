"""Professor Darwin — brick-built bust spec (biology). python3 prof_darwin.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, cyl_z, save

SKIN, HAIR, JACKET, SHIRT, WHITE, BLACK, MOUTH = 78, 484, 330, 19, 15, 0, 0
FRECKLE, POCKET, WOOD, LENS, LEAF, RIB = 92, 288, 308, 212, 2, 10
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
# chest pockets: a darker panel with a flap line, either side of the V
b.recolour(lambda x, y, z: z > 36 and 96 <= abs(x) <= 150 and 70 <= y <= 124 and not V(x, y, z), POCKET, tags={'body'})
b.fill(lambda x, y, z: 156 <= y <= 178 and 30 <= abs(x) <= 62 and z > 60 and abs(x) >= 30 + (178 - y) * 0.9, 28, 'collar')
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head: 13 studs wide, 41 plates tall (identical to Pi)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears

# curly red-brown mop: a fuller, bumpy studded cap, curls tumbling onto the forehead
def bumpy(x, y, z):
    n = math.sin(x / 21.0 + 1.3) * math.sin(z / 17.0 + 0.4) + 0.6 * math.sin(y / 13.0 + x / 31.0)
    k = 1.0 + 0.09 * n
    return (((x - HX) / (150 * k)) ** 2 + ((y - HY - 22) / (178 * k)) ** 2 + ((z - HZ + 2) / (136 * k)) ** 2) <= 1.0

def fringe(x, y, z):
    edge = 444 - 14 * abs(math.sin(x / 26.0))
    return y > edge

mop = lambda x, y, z: bumpy(x, y, z) and (fringe(x, y, z) or (z < -30 and y > 296) or (abs(x) > 112 and y > 360 and z < 40))
b.fill(mop, HAIR, 'hair')
b.recolour(lambda x, y, z: y > 448 or (z < -30 and y > 296), HAIR, tags={'head'})

T = {'head'}
for s in (-1, 1):
    # eye: 3-stud white with a centred 1-stud black pupil (2 plates) -- no glasses
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 396 <= y <= 403, HAIR, tags=T, n=1, tag='brow')   # brows
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')                 # nose
# freckles: a few single cells across the cheeks and nose bridge
for (fx, fy) in ((70, 316), (90, 300), (110, 324), (-70, 316), (-90, 300), (-110, 324)):
    b.paint_front(lambda x, y, fx=fx, fy=fy: x == fx and fy <= y <= fy + 15, FRECKLE, tags=T)
# short neat beard: chin and jaw only, well below the mouth
b.paint_front(lambda x, y: (y <= 248 and abs(x) <= 112) or (y <= 292 and abs(x) >= 100), HAIR, tags=T, depth=2)
b.bump_front(lambda x, y: y <= 224 and abs(x) <= 50, HAIR, tags=T, n=1, tag='beard')
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)                                # smile
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)

# ---------------- arms: a magnifying glass held up (viewer's left) and a leaf (viewer's right)
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

HAND = {-1: (-86, 96, 136), 1: (96, 92, 136)}
for s in (-1, 1):
    hx, hy, hz = HAND[s]
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), JACKET, 'arm')
    b.fill(capsule((170 * s, 44, 28), (hx - 14 * s, hy - 6, 124), 38), JACKET, 'arm')
    b.fill(ell(hx, hy, hz, 30, 26, 30), SKIN, 'hand')

# magnifying glass: black ring, light-blue lens, short handle down into the fist
GX, GY, GZ = -104, 196, 150
ring = lambda x, y, z: 140 <= z <= 160 and (x - GX) ** 2 + ((y - GY) * 1.0) ** 2 <= 62 * 62
b.fill(ring, BLACK, "glass")
b.fill(lambda x, y, z: 140 <= z <= 160 and (x - GX) ** 2 + (y - GY) ** 2 <= 44 * 44, LENS, 'glass')
b.fill(lambda x, y, z: -100 <= x <= -80 and 104 <= y <= 140 and 140 <= z <= 160, WOOD, 'glass')
b.fill(lambda x, y, z: z == 150 and x == -130 and 204 <= y <= 227, WHITE, 'glass')   # glint
b.fill(lambda x, y, z: z == 150 and x == -110 and 220 <= y <= 227, WHITE, 'glass')

# leaf: one plain green oval with a lighter midrib, on a short stem in the fist
LX, LY, LZ = 104, 196, 150
def leaf(x, y, z):
    if not (140 <= z <= 160):
        return False
    a = math.radians(0)                       # tip leans outward
    u = (x - LX) * math.cos(a) - (y - LY) * math.sin(a)
    v = (x - LX) * math.sin(a) + (y - LY) * math.cos(a)
    t = v / 72
    return abs(t) <= 1 and abs(u) <= 58 * (1 - t * t)
b.fill(leaf, LEAF, 'leaf')
def rib(x, y, z):
    a = math.radians(0)
    u = (x - LX) * math.cos(a) - (y - LY) * math.sin(a)
    v = (x - LX) * math.sin(a) + (y - LY) * math.cos(a)
    return leaf(x, y, z) and abs(u) <= 10 and v <= 36
b.recolour(rib, 288)
b.fill(lambda x, y, z: abs(x - 110) <= 10 and 100 <= y <= 130 and 140 <= z <= 160, WOOD, 'leaf')

# ---------------- plinth: every professor stands on the same dark base (identical to Pi)
PLINTH = 72
b2 = {}
for k, v in list(b.v.items()):
    b2[(k[0], k[1] + 3, k[2])] = v
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Professor Darwin', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
