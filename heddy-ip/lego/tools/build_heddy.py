"""Generate the LEGO Heddy model from the heddy-ip geometry.

Source of truth: heddy-ip/skills/heddy-ip/references/heddy-dna.md (product SVG,
viewBox 120). Every dimension below is derived from those anchors, scaled so
the body is 20 studs wide.

Frame: X right (viewer's right), Y up, Z toward the viewer. Units: LDU
(1 stud = 20, 1 plate = 8, 1 brick = 24; 1 LDU = 0.4 mm).

Output: model/heddy.json (locked part list with modules, steps and
sub-assemblies) and model/heddy.ldr (LDraw, opens in Studio / LDCad / LeoCAD).
"""
import json, math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from parts import CAT, PLATES, BRICKS, TILES

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, '..', 'model')

# ---------------------------------------------------------------- colours
WHITE, WING, AMBER, INK, GREEN, SPECK, HIDDEN, TECH = 15, 151, 191, 272, 2, 71, 71, 72

# ---------------------------------------------------------------- IP geometry
S = 496.0 / 89.0            # LDU per IP unit: body 89 units tall -> 62 plates
FOOT_H = 16                 # feet: two plates under the body
Y0 = FOOT_H                 # body layer 0 bottom
NL = 62                     # body layers
DEPTH = 0.90                # body depth / width (turnaround side view)
SEAM_K = 5                  # swivel seam: turntable between body layers 4 and 5
FLOORS = {8, 21, 31, 41, 50}
ZF = 120                    # face panel back plane
ZCAP = 140                  # flattened front (owl facial plane): no cell beyond this
SHELL_T = 2                 # shell thickness in cells


def ipY(y_ip):
    return Y0 + (107.0 - y_ip) * S


def bez(p0, p1, p2, p3, t):
    t = np.asarray(t)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


_t = np.linspace(0, 1, 2000)
_seg = np.concatenate([bez(np.array([60, 18.]), np.array([82, 18.]), np.array([96, 36.]), np.array([96, 62.]), _t),
                       bez(np.array([96, 62.]), np.array([96, 90.]), np.array([80, 107.]), np.array([60, 107.]), _t)])
_order = np.argsort(_seg[:, 1])
_py, _px = _seg[_order, 1], _seg[_order, 0]


def half_width(Y):
    """Body half-width (LDU) at height Y, from the product silhouette path."""
    y_ip = 107.0 - (Y - Y0) / S
    if y_ip <= 18 or y_ip >= 107:
        return 0.0
    return (np.interp(y_ip, _py, _px) - 60.0) * S


def front_z(X, Y):
    a = half_width(Y)
    b = a * DEPTH
    if a <= 0 or abs(X) >= a:
        return -1e9
    return min(ZCAP, b * math.sqrt(1 - (X / a) ** 2))


# face anchors (heddy-dna.md anchors 4-8)
EYE_L = (-80, 296)   # viewer-left eye, iris r 13.5 -> Dish 8x8
EYE_R = (80, 296)    # viewer-right eye, iris r 11 -> Dish 6x6
DISC_C, DISC_RX, DISC_RY = (0, ipY(60)), 23 * S, 22 * S
BEAK_Y = 206         # stud row centre nearest ipY(72.5)
ROW0 = 16            # face-panel row r spans Y [ROW0+20r, ROW0+20r+20]

# ---------------------------------------------------------------- geometry helpers


def rot_y(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def frame(c1, c2):
    """Rotation whose columns are images of local x (c1), local y/studs (c2), local z."""
    c1, c2 = np.array(c1, float), np.array(c2, float)
    return np.column_stack([c1, c2, np.cross(c1, c2)])


R_FLAT = np.eye(3)
R_FACE = frame((1, 0, 0), (0, 0, 1))          # studs +Z, grid v runs down (-Y)
R_WING_R = frame((0, 0, 1), (1, 0, 0))        # studs +X, v runs +Y
R_WING_L = frame((0, 0, 1), (-1, 0, 0))       # studs -X, v runs -Y


class Model:
    def __init__(self):
        self.parts = []

    def add(self, ldraw, colour, pos, R, module, sub='main', approach=None, layer=None, tag=None):
        R = np.asarray(R, float)
        if approach is None:
            approach = R[:, 1]          # along the stud axis
        p = dict(id=len(self.parts), ldraw=ldraw, colour=int(colour), pos=[float(v) for v in pos],
                 R=np.round(R, 6).tolist(), module=module, sub=sub,
                 approach=[float(v) for v in approach], layer=layer, tag=tag)
        self.parts.append(p)
        return p


M = Model()

# ---------------------------------------------------------------- tiler


def tile_anchor(cells, dims, support):
    """Solid overhanging layers: every overhang cell first gets a short straight
    rect that reaches into the supported area; the rest is filled largest-first."""
    cells = set(cells)
    covered = set()
    out = []
    lens = sorted({max(d) for d in dims if min(d) == 1})

    def options(c):
        opts = []
        for L in lens:
            for du, dv in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rc = [(c[0] + du * n, c[1] + dv * n) for n in range(L)]
                if all(r in cells and r not in covered for r in rc) and any(r in support for r in rc):
                    u0, v0 = min(r[0] for r in rc), min(r[1] for r in rc)
                    opts.append(((u0, v0, abs(du) * (L - 1) + 1, abs(dv) * (L - 1) + 1), rc))
        return opts

    todo = {c for c in cells if c not in support}
    while todo:
        # most constrained overhang cell first
        scored = [(len(options(c)), c) for c in todo]
        n, c = min(scored, key=lambda x: (x[0] if x[0] else 99, x[1][1], x[1][0]))
        opts = options(c)
        if opts:
            # prefer the option that blocks the fewest other overhang cells
            others = [(d, options(d)) for d in todo if d != c]

            def cost(o):
                rect, rc = o
                rs = set(rc)
                blocked = sum(1 for d, od in others if od and all(set(r2) & rs for _, r2 in od))
                hurt = sum(1 for d, od in others for _, r2 in od if set(r2) & rs)
                return (blocked, hurt, len(rc))
            rect, rc = min(opts, key=cost)
        else:
            rect, rc = (c[0], c[1], 1, 1), [c]
        out.append(rect)
        covered.update(rc)
        todo -= set(rc)
    return out + tile(cells - covered, dims, support=support)


def tile(cells, dims, support=None, below=None, prefer_long=True):
    """Greedy rectangle cover of a 2D cell set. dims: allowed (w,h) (both
    orientations tried). support: cells with studs underneath - every rect must
    touch at least one when given (cells next to support are covered first so
    overhangs get anchored). below: cell -> owner id underneath, rewarded when a
    rect spans several owners (running bond). Returns [(u0, v0, w, h)]."""
    cells = set(cells)
    covered = set()
    out = []
    cand = set()
    for w, h in dims:
        cand.add((w, h))
        cand.add((h, w))
    cand = sorted(cand, key=lambda d: -d[0] * d[1])
    if support is not None:
        # breadth-first distance from the supported cells
        dist = {c: 0 for c in cells if c in support}
        frontier = list(dist)
        while frontier:
            nxt = []
            for (u, v) in frontier:
                for n in ((u + 1, v), (u - 1, v), (u, v + 1), (u, v - 1)):
                    if n in cells and n not in dist:
                        dist[n] = dist[(u, v)] + 1
                        nxt.append(n)
            frontier = nxt
        order = sorted(cells, key=lambda c: (-dist.get(c, 99), c[1], c[0]))   # overhangs first
    else:
        order = sorted(cells, key=lambda c: (c[1], c[0]))
    def rects_with(c, taken):
        for w, h in cand:
            for u0 in range(c[0] - w + 1, c[0] + 1):
                for v0 in range(c[1] - h + 1, c[1] + 1):
                    rc = [(u0 + du, v0 + dv) for du in range(w) for dv in range(h)]
                    if all((r in cells) and (r not in taken) for r in rc):
                        yield (u0, v0, w, h), rc

    def anchored(c, taken):
        return any(any(r in support for r in rc) for _, rc in rects_with(c, taken))

    for c in order:
        if c in covered:
            continue
        scored = []
        for rect, rc in rects_with(c, covered):
            w, h = rect[2], rect[3]
            s = w * h
            if support is not None:
                sup = sum(1 for r in rc if r in support)
                if sup == 0:
                    s -= 1000
                s += 0.25 * min(sup, 4)
            if below:
                owners = {below.get(r) for r in rc} - {None}
                s += 0.8 * max(0, len(owners) - 1)
            s -= 0.001 * (abs(rect[0] - c[0]) + abs(rect[1] - c[1]))
            scored.append((s, rect, rc))
        scored.sort(key=lambda x: -x[0])
        best = scored[0][1]
        if support is not None:
            # look-ahead: never strand a neighbouring overhang cell
            for s_, rect, rc in scored:
                taken = covered | set(rc)
                nb = {(u + du, v + dv) for (u, v) in rc for du, dv in ((1, 0), (-1, 0), (0, 1), (0, -1))}
                nb = {n for n in nb if n in cells and n not in taken and n not in support}
                if all(anchored(n, taken) for n in nb):
                    best = rect
                    break
        out.append(best)
        for du in range(best[2]):
            for dv in range(best[3]):
                covered.add((best[0] + du, best[1] + dv))
    return out


def part_for(kind, w, h):
    table = {'plate': PLATES, 'brick': BRICKS, 'tile': TILES}[kind]
    a, b = min(w, h), max(w, h)
    return table[(a, b)], (w < h)   # swapped -> rotate 90 about the stud axis


PLATE_DIMS = [(a, b) for (a, b) in PLATES]
BRICK_DIMS = [(a, b) for (a, b) in BRICKS]
TILE_DIMS = [(a, b) for (a, b) in TILES]


def place_rect(kind, rect, Rf, origin, top, colour, module, sub='main', approach=None, layer=None, tag=None):
    """rect in grid cells (u0,v0,w,h); grid u along Rf[:,0], v along Rf[:,2];
    origin = world position of grid point (0,0) on the part's top plane."""
    u0, v0, w, h = rect
    ld, swap = part_for(kind, w, h)
    R = Rf @ rot_y(90) if swap else Rf
    cu, cv = 20 * (u0 + w / 2.0), 20 * (v0 + h / 2.0)
    pos = np.asarray(origin, float) + cu * Rf[:, 0] + cv * Rf[:, 2] + top * Rf[:, 1]
    return M.add(ld, colour, pos, R, module, sub, approach, layer, tag)


# ---------------------------------------------------------------- body regions
I_RANGE = range(-11, 11)
J_RANGE = range(-9, 9)


def layer_Y(k):
    return Y0 + 8 * k


def ellipse_cells(k):
    Yc = layer_Y(k) + 4
    a = half_width(Yc)
    b = a * DEPTH
    out = set()
    if a <= 0:
        return out
    for i in I_RANGE:
        for j in J_RANGE:
            x, z = 20 * i + 10, 20 * j + 10
            if (x / a) ** 2 + (z / b) ** 2 <= 1.0 and 20 * j + 20 <= ZCAP:
                out.add((i, j))
    return out


# --- wing leaf, side view (turnaround sheet; heddy-dna anchor 9: rooted at the
# body's sides from y 54 to y 99, short, no feather detail)
WING_TOP = (-5.0, ipY(54) + 4)
WING_TIP = (-95.0, ipY(99))


def wing_inside(Z, Y):
    top, tip = np.array(WING_TOP), np.array(WING_TIP)
    ax = tip - top
    L = np.linalg.norm(ax)
    ax /= L
    p = np.array([Z, Y]) - top
    t = p @ ax / L
    d = abs(p @ np.array([-ax[1], ax[0]]))
    if t < 0:
        return np.hypot(*p) <= 46
    if t > 1:
        return False
    if t < 0.33:
        hw = 46 + (62 - 46) * math.sin(t / 0.33 * math.pi / 2)
    else:
        s = (t - 0.33) / 0.67
        hw = 62 * (1 - s ** 1.8) ** 0.8
    return d <= hw


def wing_cells(k, body):
    """Grey cells: the body's outermost cell plus one proud cell, on rows inside the leaf."""
    Yc = layer_Y(k) + 4
    out = set()
    for j in J_RANGE:
        if not wing_inside(20 * j + 10, Yc):
            continue
        row = [i for (i, jj) in body if jj == j]
        if not row:
            continue
        for edge, sgn in ((max(row), 1), (min(row), -1)):
            out.add((edge, j))
            out.add((edge + sgn, j))
    return out


# --- face panel footprint (rows r, columns i); anchor 4 facial disc + eyes 5
def panel_cells():
    out = set()
    for r in range(4, 22):
        Yc = ROW0 + 20 * r + 10
        for i in I_RANGE:
            Xc = 20 * i + 10
            in_disc = ((Xc - DISC_C[0]) / DISC_RX) ** 2 + ((Yc - DISC_C[1]) / DISC_RY) ** 2 <= 1
            in_eye = False
            for (ex, ey), rad in ((EYE_L, 80), (EYE_R, 60)):
                nx = min(max(ex, 20 * i), 20 * i + 20)
                ny = min(max(ey, ROW0 + 20 * r), ROW0 + 20 * r + 20)
                if math.hypot(nx - ex, ny - ey) < rad - 2:
                    in_eye = True
            if not (in_disc or in_eye):
                continue
            zmin = min(front_z(x, y) for x in (20 * i + 1, 20 * i + 19) for y in (ROW0 + 20 * r + 1, ROW0 + 20 * r + 19))
            if zmin < ZF + 6 and not in_eye:
                continue
            if zmin < ZF - 6:
                continue
            out.add((i, r))
    # every column must start and end on a row edge that coincides with a plate
    # layer edge (16 + 20r = 16 + 8k needs r even): otherwise a 4 LDU slit opens
    cols = {}
    for i, r in out:
        cols.setdefault(i, []).append(r)
    fixed = set()
    for i, rs in cols.items():
        lo, hi = min(rs), max(rs)
        if lo % 2:
            lo -= 1 if front_z(20 * i + 10, ROW0 + 20 * (lo - 1) + 10) >= ZF + 6 else -1
        if hi % 2 == 0:
            hi += 1 if front_z(20 * i + 10, ROW0 + 20 * (hi + 1) + 10) >= ZF + 6 else -1
        for r in range(lo, hi + 1):
            fixed.add((i, r))
    return fixed


PANEL = panel_cells()
SNOT_ROWS = sorted({r for (i, r) in PANEL if (ROW0 + 20 * r + 10 - 30) % 8 == 0})


def panel_rows_for_layer(k):
    y0, y1 = layer_Y(k), layer_Y(k) + 8
    return [r for r in range(0, 30) if ROW0 + 20 * r < y1 and ROW0 + 20 * r + 20 > y0]


# --- belly badge (anchor 11)
BADGE_K = 9                                  # 11211 at layers 9-11; side studs at Y = 30 + 8k
BADGE_C = (0.0, 30 + 8 * BADGE_K - 10)       # jumper centre (X, Y)
BADGE_J = None                               # set after the regions exist
BADGE_ZF = None


# middle of the body: 3-layer brick courses on a 5-layer rhythm that matches the
# face-panel SNOT rows (layers 22, 27, 32, 37, 42); plates elsewhere for curvature
COURSE_STARTS = [k for k in range(12, 46) if k % 5 == 2]
COURSE_OF = {}
for c0 in COURSE_STARTS:
    for kk in (c0, c0 + 1, c0 + 2):
        COURSE_OF[kk] = c0


def region(k):
    ks = [k]
    kr = k
    if k in COURSE_OF:
        c0 = COURSE_OF[k]
        ks = [c0, c0 + 1, c0 + 2]
        kr = c0 + 1                        # silhouette sampled at the middle layer
    R = ellipse_cells(kr)
    if k == 0:                    # flat base: one 4 x 8 plate bridging both feet
        R = {(i, j) for i in range(-4, 4) for j in range(-2, 2)}
    W = wing_cells(kr, R) if layer_Y(k) >= layer_Y(SEAM_K) else set()
    R |= W
    for kk in ks:
        rows = panel_rows_for_layer(kk)
        cols = {i for (i, r) in PANEL if r in rows}
        R -= {(i, j) for (i, j) in R if i in cols and 20 * j + 20 > ZF}
        if BADGE_ZF is not None and BADGE_C[1] - 30 < layer_Y(kk) + 8 and layer_Y(kk) < BADGE_C[1] + 30:
            R -= {(i, j) for (i, j) in R if -2 <= i <= 1 and 20 * j + 20 > BADGE_ZF}
    if k == 0:
        R -= {(i, j) for (i, j) in R if i in (-4, -3, 2, 3) and j >= 2}
    return R, W & R


_rw = [region(k) for k in range(NL)]
# badge: its SNOT brick needs the floor below it (layer BADGE_K - 1) and all three of its own layers
BADGE_J = min(max(j for (i, j) in _rw[kk][0] if i in (-1, 0)) for kk in range(BADGE_K - 1, BADGE_K + 3))
BADGE_ZF = 20 * (BADGE_J + 1)
_rw = [region(k) for k in range(NL)]
# trim one-plate lips that would hang in the air (nothing below, nothing above)
for _k in range(SEAM_K + 4, NL):
    _r, _w = _rw[_k]
    below_r = _rw[_k - 1][0]
    above_r = _rw[_k + 1][0] if _k + 1 < NL else set()
    lips = {c for c in _r if c not in below_r and c not in above_r and _k not in COURSE_OF}
    _rw[_k] = (_r - lips, _w - lips)
# lower body is solid: a cell that only touches the layer below diagonally gets a cell under it
for _k in range(SEAM_K - 1, 0, -1):
    _r = _rw[_k][0]
    _b = _rw[_k - 1][0]
    for (i, j) in list(_r):
        if (i, j) in _b:
            continue
        if not any(n in _b for n in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1))):
            _b.add((i, j))
REG = [r for r, w in _rw]
WREG = [w for r, w in _rw]


def _anchor_lower_body():
    """Solid lower body: where two overhang cells compete for one anchor, widen
    the layer beneath by that cell (hidden under the body), until every plate
    reaches a stud below."""
    for _ in range(20):
        changed = False
        for k in range(SEAM_K - 1, 0, -1):
            rects = tile_anchor(REG[k], PLATE_DIMS, REG[k - 1])
            for (u0, v0, w, h) in rects:
                rc = [(u0 + du, v0 + dv) for du in range(w) for dv in range(h)]
                if not any(r in REG[k - 1] for r in rc):
                    REG[k - 1].update(rc)
                    changed = True
        if not changed:
            return


_anchor_lower_body()
REG_ALL = REG + [set()]


def erode(cells, n):
    cur = set(cells)
    for _ in range(n):
        cur = {(i, j) for (i, j) in cur if all((i + di, j + dj) in cur for di in (-1, 0, 1) for dj in (-1, 0, 1))}
    return cur


def near_axis(i, j, r=58):
    nx = min(max(0, 20 * i), 20 * i + 20)
    nz = min(max(0, 20 * j), 20 * j + 20)
    return math.hypot(nx, nz) < r


reserved = {k: set() for k in range(NL)}

# ---------------------------------------------------------------- FEET (anchor 10: two small amber pads, no talons)
FEET_X = {'L': (-4, -3), 'R': (2, 3)}
for side, (i0, i1) in FEET_X.items():
    place_rect('plate', (i0, -4, 2, 8), R_FLAT, (0, FOOT_H - 8, 0), 0, AMBER, 'feet', layer=-2, tag='foot')
    place_rect('plate', (i0, -4, 2, 6), R_FLAT, (0, FOOT_H, 0), 0, AMBER, 'feet', layer=-1, tag='foot')
    for i in (i0, i1):
        M.add('11477', AMBER, (20 * i + 10, FOOT_H + 8, 60), R_FLAT, 'feet', layer=-1, tag='toe')

# ---------------------------------------------------------------- SNOT bricks behind the face panel
for r in SNOT_ROWS:
    k = (ROW0 + 20 * r + 10 - 30) // 8
    cols = sorted(i for (i, rr) in PANEL if rr == r)
    j = ZF // 20 - 1
    runs, cur = [], []
    for i in cols:
        if cur and i != cur[-1] + 1:
            runs.append(cur)
            cur = []
        cur.append(i)
    if cur:
        runs.append(cur)
    for run in runs:
        idx = 0
        while idx < len(run):
            n = len(run) - idx
            size = 4 if n >= 4 else (2 if n >= 2 else 1)
            ids = run[idx: idx + size]
            if not all((i, j) in REG[kk] and (i, j) not in reserved[kk] for i in ids for kk in (k, k + 1, k + 2)):
                idx += 1
                continue
            ld = {4: '30414', 2: '11211', 1: '87087'}[size]
            x = 20 * ids[0] + 10 * size
            M.add(ld, WHITE, (x, layer_Y(k) + 24, 20 * j + 10), R_FLAT, 'facial', layer=k, tag='snot-face')
            for kk in (k, k + 1, k + 2):
                for i in ids:
                    reserved[kk].add((i, j))
            idx += size

# badge SNOT
for kk in (BADGE_K, BADGE_K + 1, BADGE_K + 2):
    for i in (-1, 0):
        assert (i, BADGE_J) in REG[kk], ('badge wall', kk)
        reserved[kk].add((i, BADGE_J))
M.add('11211', WHITE, (0, layer_Y(BADGE_K) + 24, 20 * BADGE_J + 10), R_FLAT, 'details', layer=BADGE_K, tag='snot-badge')

# turntable (swivel between lower body and upper body)
M.add('3403c01', TECH, (0, layer_Y(SEAM_K) + 24, 0), R_FLAT, 'core', layer=SEAM_K, tag='turntable')
for kk in (SEAM_K, SEAM_K + 1, SEAM_K + 2):
    reserved[kk] |= {(i, j) for i in range(-2, 2) for j in range(-2, 2)}

TOP_K = max(k for k in range(NL) if REG[k])
TUFT_CELLS = {(-1, 0), (0, 0)}


def exposed(k, cells):
    above = REG_ALL[k + 1] if k + 1 < NL else set()
    return {c for c in cells if c not in above}


def visible_cell(k, c):
    i, j = c
    if any((i + di, j + dj) not in REG[k] for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))):
        return True
    if k + 1 >= NL or c not in REG[k + 1]:
        return True
    if k == 0 or c not in REG[k - 1]:
        return True
    return False


speck_budget = [(-0.55, 0.95), (0.35, 0.93), (-0.15, 0.99), (0.75, 0.80), (-0.85, 0.72), (0.95, 0.62), (-0.98, 0.55)]


def pick_speckles():
    """Seven speckles (anchor 12): crown and upper flanks, sparse, not a pattern."""
    cands = []
    for k in range(40, TOP_K):
        for c in exposed(k, REG[k]):
            if c in TUFT_CELLS or c in WREG[k]:
                continue
            x, z = 20 * c[0] + 10, 20 * c[1] + 10
            cands.append((k, c, math.atan2(x, z), (layer_Y(k) - 330) / 190.0))
    chosen = []
    for ang_frac, h in speck_budget:
        tgt = ang_frac * math.pi * 0.55
        best = min(cands, key=lambda q: (q[2] - tgt) ** 2 * 3 + (q[3] - h) ** 2
                   + (0 if all(abs(q[0] - c0[0]) + abs(q[1][0] - c0[1][0]) + abs(q[1][1] - c0[1][1]) > 4
                               for c0 in chosen) else 50))
        chosen.append(best[:2])
    return chosen


SPECKLES = pick_speckles()

QUAD_ROT = {}
for deg in (0, 90, 180, 270):
    v = rot_y(deg) @ np.array([1.0, 0, -1.0])     # 25269 arc points local (+X, -Z)
    QUAD_ROT[(int(round(v[0])), int(round(v[2])))] = deg


def convex_quadrant(R, c):
    """Quadrant of a convex outline corner worth rounding: the cell sticks out
    on two sides and is not just one step of a diagonal staircase."""
    i, j = c
    for su in (1, -1):
        for sv in (1, -1):
            if (i + su, j) not in R and (i, j + sv) not in R and (i + su, j + sv) not in R:
                stair = ((i - su, j + sv) in R) or ((i + su, j - sv) in R)
                if not stair:
                    return su, sv
    return None


# ---------------------------------------------------------------- body layers
FEET_CELLS = {(i, j) for side in FEET_X.values() for i in side for j in range(-4, 2)}
studded = {k: set() for k in range(-1, NL + 3)}
owner = {}
for p in M.parts:            # pre-placed bricks give studs on their top layer
    if p['tag'] in ('snot-face', 'snot-badge'):
        n = {'30414': 4, '11211': 2, '87087': 1}[p['ldraw']]
        for c in range(n):
            x = p['pos'][0] - 10 * (n - 1) + 20 * c
            studded[p['layer'] + 2].add((int(math.floor(x / 20)), int(math.floor(p['pos'][2] / 20))))


def shell_of(k):
    Rk = REG[k]
    if k in FLOORS or k < SEAM_K or k == TOP_K:
        sh = set(Rk)
    else:
        # brick courses are single-stud walls, locked between two-stud plate layers
        sh = Rk - erode(Rk, SHELL_T)
        sh |= WREG[k]
        # never leave the hollow open: a cell with nothing above (or below) is skin
        up = REG_ALL[k + 1] if k + 1 < NL else set()
        dn = REG[k - 1] if k > 0 else set()
        sh |= {c for c in Rk if c not in up or c not in dn}
    if SEAM_K <= k < SEAM_K + 3:
        sh = {c for c in sh if not near_axis(*c)}
    return sh - reserved[k]


SHELL = [shell_of(k) for k in range(NL)]


def _pin_exposed():
    changed = True
    while changed:
        changed = False
        for k in range(NL - 1, 0, -1):
            E = exposed(k, SHELL[k])
            for c in E:
                if c in REG[k - 1] and c not in SHELL[k - 1] and c not in reserved[k - 1] \
                        and not (SEAM_K <= k <= SEAM_K + 3):
                    SHELL[k - 1].add(c)
                    changed = True


_pin_exposed()


def exposed_set(k):
    E = exposed(k, SHELL[k])
    if k == SEAM_K - 1:
        E = {c for c in SHELL[k] if not (-2 <= c[0] < 2 and -2 <= c[1] < 2)}
    if k == TOP_K:
        E -= TUFT_CELLS
    return E


EXP = [exposed_set(k) for k in range(NL)]


def module_of(k):
    if k < SEAM_K:
        return 'lower-body'
    if k == SEAM_K + 3:
        return 'core'
    return 'torso' if k < 30 else 'head'


def sub_of(k):
    return 'upper' if SEAM_K <= k < SEAM_K + 3 else 'main'


def support_of(k):
    if k == 0:
        return FEET_CELLS
    if SEAM_K <= k <= SEAM_K + 3:
        return None
    return studded[k - 1]


def cell_colour_groups(k, cells):
    return [(WING, cells & WREG[k]), (WHITE, cells - WREG[k])]


def lay_rects(kind, rects, k, Ytop, colour, mod, sub, appr, tag=None, auto_hidden=False, height=1):
    for rc in rects:
        cells = [(rc[0] + du, rc[1] + dv) for du in range(rc[2]) for dv in range(rc[3])]
        col = colour
        if auto_hidden and colour == WHITE and not any(visible_cell(kk, c) for c in cells for kk in range(k, k + height)):
            col = HIDDEN
        p = place_rect(kind, rc, R_FLAT, (0, Ytop, 0), 0, col, mod, sub, appr, k, tag)
        for kk in range(k, k + height):
            for c in cells:
                owner[(kk, c[0], c[1])] = p['id']
        if kind != 'tile':
            for c in cells:
                studded[k + height - 1].add(c)


def is_course(k):
    """Start of a brick course (see COURSE_STARTS)."""
    return k in COURSE_STARTS and k + 2 < TOP_K


done = set()
k = 0
while k < NL:
    if not REG[k]:
        k += 1
        continue
    mod, sub = module_of(k), sub_of(k)
    appr = (0, 1, 0) if sub == 'main' else (0, -1, 0)
    if is_course(k):
        ks = (k, k + 1, k + 2)
        common = set(SHELL[k])
        for kk in ks:
            common &= SHELL[kk]
        common -= EXP[k] | EXP[k + 1] | EXP[k + 2]
        # a brick course: cells present in all three layers (tops not exposed)
        sup = support_of(k)
        below = {c: owner.get((k - 1, c[0], c[1])) for c in common}
        for col, cells in cell_colour_groups(k, common):
            lay_rects('brick', tile(cells, BRICK_DIMS, support=sup, below=below), k, layer_Y(k) + 24, col, mod, sub,
                      appr, 'course', auto_hidden=True, height=3)
        rest_layers = [(kk, SHELL[kk] - common) for kk in ks]
    else:
        rest_layers = [(k, SHELL[k])]
    for kk, cells in rest_layers:
        E = EXP[kk] & cells
        Ytop = layer_Y(kk) + 8
        specks = {c for (k2, c) in SPECKLES if k2 == kk} & E
        quarter = {}
        if kk != SEAM_K - 1:
            for c in E - specks:
                q = convex_quadrant(REG[kk], c)
                if q:
                    quarter[c] = q
        sup = support_of(kk)
        if sup is not None and kk in (k + 1, k + 2) and rest_layers[0][0] != kk:
            sup = sup | studded[kk - 1]
        below = {c: owner.get((kk - 1, c[0], c[1])) for c in cells}
        mod_k, sub_k = module_of(kk), sub_of(kk)
        appr_k = (0, 1, 0) if sub_k == 'main' else (0, -1, 0)
        for col, grp in cell_colour_groups(kk, cells - E):
            if 0 < kk < SEAM_K:
                rects = tile_anchor(grp, PLATE_DIMS, sup)
            else:
                rects = tile(grp, PLATE_DIMS, support=sup, below=below)
            lay_rects('plate', rects, kk, Ytop, col, mod_k, sub_k, appr_k, None, auto_hidden=True)
        for col, grp in cell_colour_groups(kk, E - specks - set(quarter)):
            lay_rects('tile', tile(grp, TILE_DIMS, support=sup), kk, Ytop, col, mod_k, sub_k, appr_k, 'terrace')
        for c, q in quarter.items():
            col = WING if c in WREG[kk] else WHITE
            p = M.add('25269', col, (20 * c[0] + 10, Ytop, 20 * c[1] + 10), rot_y(QUAD_ROT[q]), mod_k, sub_k, appr_k,
                      kk, tag='quarter')
            owner[(kk, c[0], c[1])] = p['id']
        for c in specks:
            p = M.add('98138', SPECK, (20 * c[0] + 10, Ytop, 20 * c[1] + 10), R_FLAT, 'details', sub_k, appr_k, kk,
                      tag='speckle')
            owner[(kk, c[0], c[1])] = p['id']
        for c in reserved[kk]:
            owner.setdefault((kk, c[0], c[1]), -1)
    k += 3 if len(rest_layers) == 3 else 1

# ---------------------------------------------------------------- tuft (anchor 2: exactly one soft bump)
M.add('6091', WHITE, (-10, layer_Y(TOP_K) + 8 + 32, 10), rot_y(90), 'details', layer=TOP_K + 1, tag='tuft')

# ---------------------------------------------------------------- face panel (module: facial)
PANEL_ORIGIN = np.array([-200.0, ROW0 + 20 * 22, float(ZF + 8)])


def to_uv(i, r):
    return (i + 10, 21 - r)


PANEL_UV = {to_uv(i, r) for (i, r) in PANEL}
snot_uv = set()
for p in M.parts:
    if p['tag'] == 'snot-face':
        size = {'30414': 4, '11211': 2, '87087': 1}[p['ldraw']]
        r = (30 + 8 * p['layer'] - ROW0 - 10) // 20
        i0 = int(round((p['pos'][0] - 10 * size) / 20))
        for i in range(i0, i0 + size):
            snot_uv.add(to_uv(i, r))
face_rects = tile(PANEL_UV, PLATE_DIMS, support=snot_uv)
panel_owner = {}
for rc in face_rects:
    p = place_rect('plate', rc, R_FACE, PANEL_ORIGIN, 0, WHITE, 'facial', 'main', (0, 0, 1), None, 'face-base')
    for du in range(rc[2]):
        for dv in range(rc[3]):
            panel_owner[(rc[0] + du, rc[1] + dv)] = p['id']


def uv_of(X, Y):
    return (int(math.floor((X + 200) / 20)), int(math.floor((PANEL_ORIGIN[1] - Y) / 20)))


def world_on_panel(X, Y, lift):
    return (X, Y, ZF + 8 + lift)


eye_centre_cells = {}
for name, (ex, ey) in (('L', EYE_L), ('R', EYE_R)):
    eye_centre_cells[name] = {uv_of(ex + dx, ey + dy) for dx in (-10, 10) for dy in (-10, 10)}
beak_cells = {uv_of(-10, BEAK_Y), uv_of(10, BEAK_Y)}
tile_cells = PANEL_UV - eye_centre_cells['L'] - eye_centre_cells['R'] - beak_cells
for rc in tile(tile_cells, TILE_DIMS, below=panel_owner):
    place_rect('tile', rc, R_FACE, PANEL_ORIGIN, 8, WHITE, 'facial', 'main', (0, 0, 1), None, 'face-tile')

# ---------------------------------------------------------------- eyes (anchors 5-6)
HIGHLIGHT = (10, 10)     # one white highlight, upper-right of the pupil centre


def eye(name, centre, dish, n_spacers):
    ex, ey = centre
    for s in range(n_spacers):
        M.add('4032b', AMBER, world_on_panel(ex, ey, 8 * (s + 1)), R_FACE, 'eyes', tag=f'eye{name}-spacer')
    top = 8 * n_spacers + 8                  # dish receptor sits 8 below its top
    M.add(dish, AMBER, world_on_panel(ex, ey, top), R_FACE, 'eyes', tag=f'eye{name}-iris')
    M.add('60474', INK, world_on_panel(ex, ey, top + 8), R_FACE, 'eyes', tag=f'eye{name}-pupil')
    # three quarter-disc tiles make the pupil smooth and round; the upper-right
    # quadrant carries the single white highlight (anchor 6)
    for sx, sy in ((-1, 1), (-1, -1), (1, -1)):
        for deg in (0, 90, 180, 270):
            v = rot_y(deg) @ np.array([1.0, 0, -1.0])        # arc direction, local (x, z)
            if (round(v[0]), round(-v[2])) == (sx, sy):
                break
        M.add('27925', INK, world_on_panel(ex + 20 * sx, ey + 20 * sy, top + 16), R_FACE @ rot_y(deg), 'eyes',
              tag=f'eye{name}-pupil-tile')
    for deg in (0, 90, 180, 270):
        v = rot_y(deg) @ np.array([1.0, 0, -1.0])
        if (round(v[0]), round(-v[2])) == (1, 1):
            break
    for dx, dy in ((30, 10), (10, 30)):
        M.add('25269', INK, world_on_panel(ex + dx, ey + dy, top + 16), R_FACE @ rot_y(deg), 'eyes',
              tag=f'eye{name}-pupil-tile')
    M.add('98138', WHITE, world_on_panel(ex + HIGHLIGHT[0], ey + HIGHLIGHT[1], top + 16), R_FACE, 'eyes',
          tag=f'eye{name}-highlight')


eye('L', EYE_L, '3961', 3)
eye('R', EYE_R, '44375a', 2)

# ---------------------------------------------------------------- beak (anchor 8: small amber diamond)
R45 = R_FACE @ rot_y(45)
M.add('3794b', WHITE, world_on_panel(0, BEAK_Y, 8), R_FACE, 'beak', tag='beak-jumper')
M.add('3022', AMBER, world_on_panel(0, BEAK_Y, 16), R45, 'beak', tag='beak')
M.add('3022', AMBER, world_on_panel(0, BEAK_Y, 24), R45, 'beak', tag='beak')
M.add('3068b', AMBER, world_on_panel(0, BEAK_Y, 32), R45, 'beak', tag='beak')

# ---------------------------------------------------------------- belly badge (anchor 11: one spark-green 8-point star)
M.add('87580', GREEN, (0, BADGE_C[1], BADGE_ZF + 8), R_FACE, 'details', tag='badge')
M.add('3068b', GREEN, (0, BADGE_C[1], BADGE_ZF + 16), R_FACE @ rot_y(45), 'details', tag='badge')

# ---------------------------------------------------------------- output
os.makedirs(OUTDIR, exist_ok=True)
meta = dict(scale_ldu_per_ip=S, body_layers=NL, seam_layer=SEAM_K, floors=sorted(FLOORS), zf=ZF,
            eye_L=EYE_L, eye_R=EYE_R, beak_y=BEAK_Y, badge_c=BADGE_C, badge_zf=BADGE_ZF,
            top_layer=TOP_K, speckles=[(k, list(c)) for k, c in SPECKLES])
json.dump(dict(meta=meta, parts=M.parts), open(os.path.join(OUTDIR, 'heddy.json'), 'w'), indent=0)
if __name__ == '__main__':
    from collections import Counter
    print('parts', len(M.parts))
    print(Counter(p['module'] for p in M.parts))
    print(Counter(CAT[p['ldraw']]['cat'] for p in M.parts))
    print('courses', sum(1 for p in M.parts if p['tag'] == 'course'))
