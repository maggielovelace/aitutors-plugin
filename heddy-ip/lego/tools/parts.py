"""Part catalogue in the model frame (X right, Y up, Z toward viewer; LDU).

Local frame = LDraw part frame with y and z negated. Origin = top face centre
(LDraw convention), so a plate's body spans Y in [-8, 0] and its studs rise to +4.

Each entry: ldraw file, name, category, collision boxes, male connectors and
female connectors. A connector is (position, outward direction).
"""
import numpy as np

UP, DOWN = (0, 1, 0), (0, -1, 0)
FWD = (0, 0, 1)

CAT = {}


def _grid(nx, nz):
    return [(20 * i - 10 * (nx - 1), 20 * j - 10 * (nz - 1)) for i in range(nx) for j in range(nz)]


def rect(ldraw, name, nx, nz, h, studs=True, cat='plate', mass=None):
    g = _grid(nx, nz)
    males = [((x, 0, z), UP) for x, z in g] if studs else []
    fem = [((x, -h, z), DOWN) for x, z in g]
    if nx == 2 and nz == 2:
        fem.append(((0, -h, 0), DOWN))  # centre tube accepts a single stud
    CAT[ldraw] = dict(ldraw=ldraw, name=name, cat=cat, nx=nx, nz=nz, h=h,
                      boxes=[(-10 * nx, 10 * nx, -h, 0, -10 * nz, 10 * nz)],
                      male=males, female=fem)


LEN = {(1, 1): 1, (1, 2): 1, (1, 3): 1, (1, 4): 1, (1, 6): 1, (1, 8): 1, (1, 10): 1}
PLATES = {(1, 1): '3024', (1, 2): '3023', (1, 3): '3623', (1, 4): '3710', (1, 6): '3666', (1, 8): '3460',
          (1, 10): '4477', (2, 2): '3022', (2, 3): '3021', (2, 4): '3020', (2, 6): '3795', (2, 8): '3034',
          (2, 10): '3832', (2, 12): '2445', (4, 4): '3031', (4, 6): '3032', (4, 8): '3035', (4, 10): '3030',
          (4, 12): '3029', (6, 6): '3958', (6, 8): '3036'}
BRICKS = {(1, 1): '3005', (1, 2): '3004', (1, 3): '3622', (1, 4): '3010', (1, 6): '3009', (1, 8): '3008',
          (1, 10): '6111', (2, 2): '3003', (2, 3): '3002', (2, 4): '3001', (2, 6): '2456'}
TILES = {(1, 1): '3070b', (1, 2): '3069b', (1, 3): '63864', (1, 4): '2431', (1, 6): '6636', (1, 8): '4162',
         (2, 2): '3068b'}

# LDraw rectangular parts are long along x: key (a, b) with a <= b -> nx = b, nz = a
for (a, b), p in PLATES.items():
    rect(p, f'Plate {a} x {b}', b, a, 8, cat='plate')
for (a, b), p in BRICKS.items():
    rect(p, f'Brick {a} x {b}', b, a, 24, cat='brick')
for (a, b), p in TILES.items():
    rect(p, f'Tile {a} x {b}', b, a, 8, studs=False, cat='tile')

# round / special parts
rect('6141', 'Plate 1 x 1 Round', 1, 1, 8, cat='round')
rect('4150', 'Tile 2 x 2 Round', 2, 2, 8, studs=False, cat='tile')
rect('4032b', 'Plate 2 x 2 Round', 2, 2, 8, cat='round')
rect('98138', 'Tile 1 x 1 Round', 1, 1, 8, studs=False, cat='tile')
rect('25269', 'Tile 1 x 1 Quarter Round', 1, 1, 8, studs=False, cat='tile')
rect('27925', 'Tile 2 x 2 Round Corner', 2, 2, 8, studs=False, cat='tile')
rect('60474', 'Plate 4 x 4 Round with Hole', 4, 4, 8, cat='round')
CAT['60474']['male'] = [m for m in CAT['60474']['male'] if not (abs(m[0][0]) == 30 and abs(m[0][2]) == 30)]
CAT['60474']['boxes'] = [(-40, 40, -8, 0, -28, 28), (-28, 28, -8, 0, -40, 40)]
CAT['6141']['boxes'] = [(-9.5, 9.5, -8, 0, -9.5, 9.5)]
CAT['98138']['boxes'] = [(-9.5, 9.5, -8, 0, -9.5, 9.5)]
CAT['4032b']['boxes'] = [(-20, 20, -8, 0, -14, 14), (-14, 14, -8, 0, -20, 20)]

# jumpers
CAT['3794b'] = dict(ldraw='3794b', name='Plate 1 x 2 with 1 Centre Stud (jumper)', cat='plate', nx=2, nz=1, h=8,
                    boxes=[(-20, 20, -8, 0, -10, 10)], male=[((0, 0, 0), UP)],
                    female=[((-10, -8, 0), DOWN), ((10, -8, 0), DOWN)])
CAT['87580'] = dict(ldraw='87580', name='Plate 2 x 2 with 1 Centre Stud (jumper)', cat='plate', nx=2, nz=2, h=8,
                    boxes=[(-20, 20, -8, 0, -20, 20)], male=[((0, 0, 0), UP)],
                    female=[((x, -8, z), DOWN) for x in (-10, 10) for z in (-10, 10)] + [((0, -8, 0), DOWN)])

# SNOT bricks (side studs face +Z in local frame)
CAT['30414'] = dict(ldraw='30414', name='Brick 1 x 4 with Studs on Side', cat='snot', nx=4, nz=1, h=24,
                    boxes=[(-40, 40, -24, 0, -10, 10)],
                    male=[((x, 0, 0), UP) for x in (-30, -10, 10, 30)] + [((x, -10, 10), FWD) for x in (-30, -10, 10, 30)],
                    female=[((x, -24, 0), DOWN) for x in (-30, -10, 10, 30)])
CAT['11211'] = dict(ldraw='11211', name='Brick 1 x 2 with Studs on Side', cat='snot', nx=2, nz=1, h=24,
                    boxes=[(-20, 20, -24, 0, -10, 10)],
                    male=[((x, 0, 0), UP) for x in (-10, 10)] + [((x, -10, 10), FWD) for x in (-10, 10)],
                    female=[((x, -24, 0), DOWN) for x in (-10, 10)])
CAT['87087'] = dict(ldraw='87087', name='Brick 1 x 1 with Stud on Side', cat='snot', nx=1, nz=1, h=24,
                    boxes=[(-10, 10, -24, 0, -10, 10)],
                    male=[((0, 0, 0), UP), ((0, -10, 10), FWD)], female=[((0, -24, 0), DOWN)])

# dishes (inverted radar dishes): top 2x2 studs, centre receptor 8 LDU below the top
def dish_ring(r, y0, y1, hole=25):
    """Axis-aligned boxes inside a circular rim band (annulus r..hole)."""
    a = r * 0.41
    d = r * 0.70
    return [(hole, r, y0, y1, -a, a), (-r, -hole, y0, y1, -a, a), (-a, a, y0, y1, hole, r), (-a, a, y0, y1, -r, -hole),
            (hole, d, y0, y1, hole, d), (-d, -hole, y0, y1, hole, d), (hole, d, y0, y1, -d, -hole),
            (-d, -hole, y0, y1, -d, -hole)]


CAT['3961'] = dict(ldraw='3961', name='Dish 8 x 8 Inverted', cat='dish', nx=8, nz=8, h=24,
                   boxes=[(-20, 20, -4, 0, -20, 20)] + dish_ring(80, -24, -20),
                   male=[((x, 0, z), UP) for x in (-10, 10) for z in (-10, 10)],
                   female=[((x, -8, z), DOWN) for x in (-10, 10) for z in (-10, 10)])   # centre tube grips 2x2 studs
CAT['44375a'] = dict(ldraw='44375a', name='Dish 6 x 6 Inverted', cat='dish', nx=6, nz=6, h=16,
                     boxes=[(-20, 20, -4, 0, -20, 20)] + dish_ring(60, -16, -12),
                     male=[((x, 0, z), UP) for x in (-10, 10) for z in (-10, 10)],
                     female=[((x, -8, z), DOWN) for x in (-10, 10) for z in (-10, 10)])

# curved / shaped
CAT['6091'] = dict(ldraw='6091', name='Brick 2 x 1 x 1 1/3 with Curved Top', cat='curve', nx=1, nz=2, h=32,
                   boxes=[(-10, 10, -32, 0, -10, 30)], male=[],
                   female=[((0, -32, 0), DOWN), ((0, -32, 20), DOWN)])
CAT['11477'] = dict(ldraw='11477', name='Slope Curved 2 x 1', cat='curve', nx=1, nz=2, h=16,
                    boxes=[(-10, 10, -16, 0, -20, 20)], male=[],
                    female=[((0, -16, -10), DOWN), ((0, -16, 10), DOWN)])

# turntable (top rotates about local Y)
CAT['3403c01'] = dict(ldraw='3403c01', name='Turntable 4 x 4 Square Base', cat='technic', nx=4, nz=4, h=24,
                      boxes=[(-40, 40, -24, -16, -40, 40), (-34, 34, -16, 0, -24, 24), (-24, 24, -16, 0, -34, 34)],
                      male=[((x, 0, z), UP) for x in (-30, -10, 10, 30) for z in (-30, -10, 10, 30)
                            if not (abs(x) == 30 and abs(z) == 30)],
                      female=[((x, -24, z), DOWN) for x in (-30, -10, 10, 30) for z in (-30, -10, 10, 30)])

# approximate masses in grams (BrickLink catalogue weights, rounded)
MASS = {'3024': .4, '3023': .6, '3623': .8, '3710': 1.1, '3666': 1.6, '3460': 2.1, '4477': 2.6, '3022': 1.0,
        '3021': 1.4, '3020': 1.8, '3795': 2.6, '3034': 3.4, '3832': 4.2, '2445': 5.0, '3031': 3.3, '3032': 4.8,
        '3035': 6.3, '3030': 7.9, '3029': 9.5, '3958': 7.1, '3036': 9.4, '3005': .4, '3004': .8, '3622': 1.2,
        '3010': 1.5, '3009': 2.3, '3008': 3.0, '6111': 3.8, '3003': 1.2, '3002': 1.7, '3001': 2.3, '2456': 3.4,
        '3070b': .2, '3069b': .4, '63864': .6, '2431': .8, '6636': 1.2, '4162': 1.6, '3068b': .7, '6141': .2,
        '4032b': .6, '98138': .2, '25269': .2, '27925': .6, '60474': 2.1, '3794b': .5, '87580': .9, '30414': 1.6,
        '11211': .9, '87087': .5, '3961': 10.5, '44375a': 6.0, '6091': 1.4, '11477': .5, '3403c01': 4.5, '4150': .6}
for k, v in CAT.items():
    v['mass'] = MASS.get(k, 1.0)
