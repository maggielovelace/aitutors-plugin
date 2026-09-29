"""Write LDraw geometry for real LEGO elements that were not in the vendored
library subset. Dimensions follow the physical parts (LDU); underside detail
is simplified. Each file is marked as project-authored geometry.
"""
import math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'ldraw', 'parts')
os.makedirs(OUT, exist_ok=True)


def header(num, title):
    return [f'0 {title}', f'0 Name: {num}.dat',
            '0 Author: heddy-lego project (simplified geometry, real element dimensions)',
            '0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt', '0 BFC CERTIFY CCW', '']


def q(a, b, c, d, col=16):
    return '4 %d ' % col + ' '.join('%.3f %.3f %.3f' % tuple(p) for p in (a, b, c, d))


def t(a, b, c, col=16):
    return '3 %d ' % col + ' '.join('%.3f %.3f %.3f' % tuple(p) for p in (a, b, c))


def box(x0, x1, y0, y1, z0, z1):
    """Closed box, LDraw coords (y down)."""
    P = lambda x, y, z: (x, y, z)
    L = []
    L.append(q(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)))  # top (y0)
    L.append(q(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)))  # bottom
    L.append(q(P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)))
    L.append(q(P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), P(x0, y0, z1)))
    L.append(q(P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0)))
    L.append(q(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)))
    return L


def prism(poly, y0, y1):
    """Extrude a convex-ish polygon in xz (list of (x,z), CCW seen from top) between y0 (top) and y1."""
    L = []
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cz = sum(p[1] for p in poly) / n
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        L.append(t((cx, y0, cz), (b[0], y0, b[1]), (a[0], y0, a[1])))
        L.append(t((cx, y1, cz), (a[0], y1, a[1]), (b[0], y1, b[1])))
        L.append(q((a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])))
    return L


def circle(cx, cz, r, a0=0, a1=2 * math.pi, n=32):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def stud(x, y, z):
    return f'1 16 {x} {y} {z} 1 0 0 0 1 0 0 0 1 p/stud.dat'


def side_stud(x, y, z):
    # stud pointing -z (LDraw), same transform the library uses in 30414
    return f'1 16 {x} {y} {z} 1 0 0 0 0 1 0 -1 0 p/stud.dat'


def write(num, title, lines):
    with open(os.path.join(OUT, f'{num}.dat'), 'w') as f:
        f.write('\n'.join(header(num, title) + lines) + '\n')


# Tile, Round 1 x 1
write('98138', 'Tile  1 x  1 Round', prism(circle(0, 0, 10)[:-1], 0, 8))

# Plate, Round 4 x 4 with Hole (12 studs: 4x4 grid minus the corners)
L = prism(circle(0, 0, 40, n=48)[:-1], 0, 8)
for x in (-30, -10, 10, 30):
    for z in (-30, -10, 10, 30):
        if abs(x) == 30 and abs(z) == 30:
            continue
        L.append(stud(x, 0, z))
write('60474', 'Plate  4 x  4 Round with Hole', L)

# Plate 2 x 2 with 1 Centre Stud (jumper)
write('87580', 'Plate  2 x  2 with Groove and 1 Center Stud', box(-20, 20, 0, 8, -20, 20) + [stud(0, 0, 0)])

# Tile, Round 1 x 1 Quarter (arc on +x/+z corner, centre of arc at (-10,-10))
poly = [(-10, -10)] + [(p[0], p[1]) for p in circle(-10, -10, 20, 0, math.pi / 2, 16)]
write('25269', 'Tile  1 x  1 Round Quarter', prism(poly, 0, 8))

# Tile, Round Corner 2 x 2 (quarter disc r=40 centred at (-20,-20))
poly = [(-20, -20)] + [(p[0], p[1]) for p in circle(-20, -20, 40, 0, math.pi / 2, 24)]
write('27925', 'Tile  2 x  2 Round Corner', prism(poly, 0, 8))

# Slope, Curved 2 x 1 (footprint 1 x 2 along z; high at +z, curving down to -z)
L = []
N = 12
prof = []  # (z, top_y) : y down, bottom at y=16
for i in range(N + 1):
    z = -20 + 40 * i / N
    s = (z + 20) / 40.0
    h = 3 + 13 * math.sin(min(1.0, s * 1.25) * math.pi / 2)
    prof.append((z, 16 - h))
for i in range(N):
    (za, ya), (zb, yb) = prof[i], prof[i + 1]
    L.append(q((-10, ya, za), (-10, yb, zb), (10, yb, zb), (10, ya, za)))  # curved top
    L.append(q((-10, 16, za), (-10, 16, zb), (-10, yb, zb), (-10, ya, za)))
    L.append(q((10, ya, za), (10, yb, zb), (10, 16, zb), (10, 16, za)))
L.append(q((-10, 16, -20), (10, 16, -20), (10, 16, 20), (-10, 16, 20)))
L.append(q((-10, prof[0][1], -20), (10, prof[0][1], -20), (10, 16, -20), (-10, 16, -20)))
L.append(q((-10, 16, 20), (10, 16, 20), (10, prof[-1][1], 20), (-10, prof[-1][1], 20)))
write('11477', 'Slope Curved  2 x  1', L)

# Brick 1 x 1 with Stud on 1 Side
write('87087', 'Brick  1 x  1 with Stud on 1 Side', box(-10, 10, 0, 24, -10, 10) + [stud(0, 0, 0), side_stud(0, 10, -10)])

# Brick 1 x 2 with Studs on 1 Side
write('11211', 'Brick  1 x  2 with Studs on 1 Side',
      box(-20, 20, 0, 24, -10, 10) + [stud(-10, 0, 0), stud(10, 0, 0), side_stud(-10, 10, -10), side_stud(10, 10, -10)])

# Turntable 4 x 4 Square Base, complete (base plate + rotating round top)
L = box(-40, 40, 16, 24, -40, 40) + prism(circle(0, 0, 34, n=48)[:-1], 8, 16) + prism(circle(0, 0, 40, n=48)[:-1], 0, 8)
for x in (-30, -10, 10, 30):
    for z in (-30, -10, 10, 30):
        if abs(x) == 30 and abs(z) == 30:
            continue
        L.append(stud(x, 0, z))
write('3403c01', 'Turntable  4 x  4 Square Base Complete', L)
print('ok', OUT)
