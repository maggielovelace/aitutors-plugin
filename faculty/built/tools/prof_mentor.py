"""Mentor — brick-built bust spec (same skeleton as prof_pi.py). python3 prof_mentor.py OUT.json"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bust import Bust, ell, cyl_y, save

SKIN, HAIR, SHAWL, KNIT, TOP, WHITE, BLACK, FRAME, CORD, MOUTH = 84, 71, 3, 378, 15, 15, 0, 72, 320, 320
COVER, PAGES, RIBBON = 70, 15, 320
b = Bust(W=14, D=10, H=64)

# ---------------- body (identical torso to Pi) — a teal knitted shawl in place of the cardigan
def torso(x, y, z):
    if y < 0 or y > 176:
        return False
    hw = 190 if y < 110 else 70 + 120 * math.sqrt(max(0.0, 1 - ((y - 110) / 68) ** 2))
    hd = 92 if y < 130 else 92 - (y - 130) * 0.6
    return (abs(x) / hw) ** 4 + (abs(z) / hd) ** 4 <= 1

b.fill(torso, SHAWL, 'body')
KNITP = lambda x, y, z: int(y // 8) % 6 in (0, 1) and (int((x + 400) // 20) + int(y // 8)) % 2 == 0   # knitted bands
b.recolour(KNITP, KNIT, tags={'body'})
V = lambda x, y, z: z > 36 and y > 110 and abs(x) <= (y - 110) * 0.55 + 8
b.recolour(lambda x, y, z: z > 36 and y > 100 and abs(x) <= (y - 100) * 0.55 + 36, KNIT, tags={'body'})   # shawl border
b.recolour(V, TOP, tags={'body'})
b.fill(cyl_y(0, 4, 54, 160, 214), SKIN, 'neck')

# ---------------- head: 13 studs wide, 41 plates tall (identical to Pi)
HX, HY, HZ = 0, 334, 8
b.fill(ell(HX, HY, HZ, 130, 166, 118), SKIN, 'head')
for s in (-1, 1):
    b.fill(ell(132 * s, 340, 0, 18, 34, 22), SKIN, 'head')          # ears
# silver hair swept back from the face into a soft bun at the back of the crown
HL = lambda x, y: y > 446 - (abs(x) / 130) ** 2 * 60      # soft hairline, lower at the temples
cap = lambda x, y, z: ell(HX, HY + 16, HZ - 4, 138, 170, 126)(x, y, z) and (HL(x, y) or (z < -30 and y > 280) or (abs(x) > 108 and y > 376 and z < 50))
b.fill(cap, HAIR, 'hair')
b.recolour(lambda x, y, z: HL(x, y) or (z < -30 and y > 280), HAIR, tags={'head'})
b.fill(ell(0, 468, -118, 54, 50, 46), HAIR, 'hair')                  # the bun

T = {'head'}
for s in (-1, 1):
    b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, WHITE, tags=T)
    b.paint_front(lambda x, y, s=s: 40 <= x * s <= 60 and 352 <= y <= 368, BLACK, tags=T)
    # light reading-glasses frame: top rim and outer side only
    b.paint_front(lambda x, y, s=s: (20 <= x * s <= 80 and 380 <= y <= 387) or (x * s == 90 and 340 <= y <= 387), FRAME, tags=T)
    b.bump_front(lambda x, y, s=s: 30 <= x * s <= 70 and 396 <= y <= 403, HAIR, tags=T, n=1, tag='brow')
b.paint_front(lambda x, y: abs(x) <= 10 and 372 <= y <= 379, FRAME, tags=T)                                        # bridge
b.bump_front(lambda x, y: abs(x) <= 10 and 300 <= y <= 332, SKIN, tags=T, n=1, tag='nose')
b.paint_front(lambda x, y: abs(x) <= 30 and 268 <= y <= 275, MOUTH, tags=T)                                # smile
b.paint_front(lambda x, y: abs(x) == 50 and 276 <= y <= 283, MOUTH, tags=T)
# glasses temples run back to the ears
b.paint_front(lambda x, y: abs(x) == 110 and 364 <= y <= 371, FRAME, tags=T)

# ---------------- arms and the notebook
def capsule(p, q, r):
    px, py, pz = p; qx, qy, qz = q
    dx, dy, dz = qx - px, qy - py, qz - pz
    L2 = dx * dx + dy * dy + dz * dz
    def f(x, y, z):
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2))
        return (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2 + (z - pz - t * dz) ** 2 <= r * r
    return f

# cord continues down the sides of the neck to the chest
for s in (-1, 1):
    b.fill(capsule((120 * s, 290, 12), (84 * s, 172, 34), 11), CORD, 'cord', only_empty=True)
for s in (-1, 1):
    b.fill(capsule((178 * s, 140, 0), (176 * s, 50, 18), 42), SHAWL, 'arm')
    b.fill(capsule((170 * s, 44, 28), (70 * s, 84, 124), 38), SHAWL, 'arm')
    b.recolour(lambda x, y, z: KNITP(x, y, z), KNIT, tags={'arm'})
# closed notebook held flat against the chest: back cover, a page block, a front cover a plate shorter
b.fill(lambda x, y, z: abs(x) <= 70 and 44 <= y <= 156 and 124 <= z <= 136, COVER, 'book')             # back cover
b.fill(lambda x, y, z: abs(x) <= 62 and 44 <= y <= 156 and 144 <= z <= 156, PAGES, 'book')             # pages
b.fill(lambda x, y, z: abs(x) <= 70 and 36 <= y <= 148 and 164 <= z <= 176, COVER, 'book')            # front cover
b.recolour(lambda x, y, z: abs(x) <= 30 and 108 <= y <= 124 and z > 160, 19, tags={'book'})          # label
b.fill(lambda x, y, z: 10 <= x <= 30 and 20 <= y <= 36 and 144 <= z <= 156, RIBBON, 'book')     # ribbon marker
for s in (-1, 1):
    b.fill(ell(84 * s, 96, 158, 24, 26, 26), SKIN, 'hand')

# ---------------- plinth
PLINTH = 72
b2 = {}
for k, v in list(b.v.items()):
    b2[(k[0], k[1] + 3, k[2])] = v
tags = {(k[0], k[1] + 3, k[2]): t for k, t in b.tag.items()}
b.v, b.tag, b.H = b2, tags, b.H + 3
b.fill(lambda x, y, z: y < 24 and abs(x) <= 230 and -110 <= z <= 150, PLINTH, 'plinth')
parts = b.to_parts(studded=(HAIR,))
save(parts, sys.argv[1], dict(name='Mentor', cells=len(b.v)))
print('cells', len(b.v), 'parts', len(parts))
