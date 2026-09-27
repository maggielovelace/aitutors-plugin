"""Engineering validation of the locked LEGO Heddy model (brief section 11).

Checks
  1. collisions: oriented-box separating-axis test between every pair of parts
  2. connections: stud/anti-stud graph; no floating parts; one connected model
  3. build order: every part, in instruction order, connects to something already
     built in its (sub-)assembly and slides in along its approach axis without
     passing through built parts
  4. disassembly: reverse order, every part can leave along its approach axis
  5. centre of mass vs. the feet's support polygon; head top-heaviness
  6. swivel: upper body turns +/-20 degrees on the turntable without collisions
Writes model/validation.json and model/validation.md.
"""
import json, math, os, sys
from collections import defaultdict, Counter
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from parts import CAT

MODEL = os.path.join(HERE, '..', 'model')
m = json.load(open(os.path.join(MODEL, 'heddy.json')))
P = m['parts']
meta = m['meta']
steps = json.load(open(os.path.join(MODEL, 'heddy_steps.json')))['steps']
SEAM = meta['seam_layer']
EPS = 0.6            # LDU tolerance (moulded parts touch; they must not interpenetrate)


# ------------------------------------------------------------------ geometry
def obbs(p, R_extra=None, t_extra=None):
    R = np.array(p['R'])
    t = np.array(p['pos'])
    out = []
    for (x0, x1, y0, y1, z0, z1) in CAT[p['ldraw']]['boxes']:
        c = np.array([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
        h = np.array([(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2]) - EPS
        Rw, cw = R, R @ c + t
        if R_extra is not None:
            Rw = R_extra @ Rw
            cw = R_extra @ cw + t_extra
        out.append((cw, Rw, np.maximum(h, 0.05)))
    return out


def sat(a, b):
    ca, Ra, ha = a
    cb, Rb, hb = b
    d = cb - ca
    axes = [Ra[:, i] for i in range(3)] + [Rb[:, i] for i in range(3)]
    for i in range(3):
        for j in range(3):
            v = np.cross(Ra[:, i], Rb[:, j])
            n = np.linalg.norm(v)
            if n > 1e-6:
                axes.append(v / n)
    for ax in axes:
        ra = np.sum(ha * np.abs(Ra.T @ ax))
        rb = np.sum(hb * np.abs(Rb.T @ ax))
        if abs(d @ ax) > ra + rb:
            return False
    return True


def aabb(boxes):
    lo, hi = np.full(3, 1e9), np.full(3, -1e9)
    for c, R, h in boxes:
        e = np.abs(R) @ h
        lo = np.minimum(lo, c - e)
        hi = np.maximum(hi, c + e)
    return lo, hi


def swept(boxes, direction, dist=2000.0):
    """Extrude boxes along a direction (the insertion path, reversed)."""
    d = np.asarray(direction, float)
    d = d / np.linalg.norm(d)
    out = []
    for c, R, h in boxes:
        # grow the box along the world direction: use its own frame projection
        loc = R.T @ d
        h2 = h + np.abs(loc) * dist / 2
        out.append((c + d * dist / 2, R, h2))
    return out


def boxes_hit(A, B):
    la, ha = aabb(A)
    lb, hb = aabb(B)
    if np.any(la > hb) or np.any(lb > ha):
        return False
    return any(sat(a, b) for a in A for b in B)


BOX = {p['id']: obbs(p) for p in P}
AB = {i: aabb(b) for i, b in BOX.items()}


class Grid:
    def __init__(self, cell=60):
        self.cell = cell
        self.g = defaultdict(set)

    def keys(self, lo, hi):
        a = np.floor(lo / self.cell).astype(int)
        b = np.floor(hi / self.cell).astype(int)
        for x in range(a[0], b[0] + 1):
            for y in range(a[1], b[1] + 1):
                for z in range(a[2], b[2] + 1):
                    yield (x, y, z)

    def add(self, i, lo, hi):
        for k in self.keys(lo, hi):
            self.g[k].add(i)

    def query(self, lo, hi):
        out = set()
        for k in self.keys(lo, hi):
            out |= self.g.get(k, set())
        return out


# ------------------------------------------------------------------ 1 collisions
grid = Grid()
for i, (lo, hi) in AB.items():
    grid.add(i, lo, hi)
collisions = []
for i in BOX:
    lo, hi = AB[i]
    for j in grid.query(lo, hi):
        if j <= i:
            continue
        if boxes_hit(BOX[i], BOX[j]):
            collisions.append((i, j))

# ------------------------------------------------------------------ 2 connections


def connectors(p):
    R = np.array(p['R'])
    t = np.array(p['pos'])
    cat = CAT[p['ldraw']]
    males = [(R @ np.array(pos) + t, R @ np.array(d)) for pos, d in cat['male']]
    fem = [(R @ np.array(pos) + t, R @ np.array(d)) for pos, d in cat['female']]
    return males, fem


CON = {p['id']: connectors(p) for p in P}
fgrid = defaultdict(list)
for p in P:
    for pos, d in CON[p['id']][1]:
        fgrid[tuple(np.round(pos / 2).astype(int))].append((p['id'], pos, d))
edges = defaultdict(set)
n_links = 0
for p in P:
    for pos, d in CON[p['id']][0]:
        key = np.round(pos / 2).astype(int)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for (j, fpos, fd) in fgrid.get((key[0] + dx, key[1] + dy, key[2] + dz), []):
                        if j == p['id']:
                            continue
                        if np.linalg.norm(fpos - pos) < 1.0 and d @ fd < -0.99:
                            if j not in edges[p['id']]:
                                n_links += 1
                            edges[p['id']].add(j)
                            edges[j].add(p['id'])
# turntable: upper module rides on the turntable top (already stud links); floating = no link at all
floating = [p['id'] for p in P if not edges[p['id']]]
seen = {0}
stack = [0]
while stack:
    a = stack.pop()
    for b in edges[a]:
        if b not in seen:
            seen.add(b)
            stack.append(b)
components_ok = len(seen) == len(P)

# ------------------------------------------------------------------ 3/4 build order + disassembly
built_main = []
built_sub = defaultdict(list)
order_fail = []
approach_fail = []
upper_ids = []
for s in steps:
    if s['sub'] == 'attach-upper':
        # whole upper module drops onto the turntable from above
        ids = upper_ids
        conn = any(b in set(built_main) for a in ids for b in edges[a])
        if not conn:
            order_fail.append(('upper-module', 'no link to turntable'))
        sweptA = [bx for a in ids for bx in swept(BOX[a], (0, 1, 0))]
        la, ha = aabb(sweptA)
        hits = [b for b in built_main if boxes_hit(sweptA, BOX[b])] if False else []
        for b in built_main:
            lo, hi = AB[b]
            if np.any(lo > ha) or np.any(la > hi):
                continue
            for a in ids:
                if boxes_hit(swept(BOX[a], (0, 1, 0)), BOX[b]):
                    hits.append((a, b))
                    break
        if hits:
            approach_fail.append(('upper-module', hits[:5]))
        built_main += ids
        continue
    for i in s['parts']:
        p = P[i]
        pool = built_sub['upper'] if s['sub'] == 'upper' else built_main
        lo_i, hi_i = AB[i]
        on_table = (s['sub'] == 'main' and lo_i[1] < 1.0) or (s['sub'] == 'upper' and p['layer'] == SEAM + 3)
        if pool and not on_table and not (edges[i] & set(pool)):
            order_fail.append((i, p['ldraw'], p['module'], p['layer'], p['tag']))
        sw = swept(BOX[i], p['approach'])
        la, ha = aabb(sw)
        for b in pool:
            lo, hi = AB[b]
            if np.any(lo > ha) or np.any(la > hi):
                continue
            if boxes_hit(sw, BOX[b]):
                approach_fail.append((i, p['ldraw'], p['tag'], b, P[b]['ldraw'], P[b]['tag']))
                break
        pool.append(i)
        if s['sub'] == 'upper':
            upper_ids = pool

# disassembly: reverse order, each part leaves along its approach axis past the parts still present
present = set(built_main)
dis_fail = []
seq = [i for s in steps for i in s['parts']]
for i in reversed(seq):
    present.discard(i)
    p = P[i]
    if p['sub'] == 'upper':
        continue                       # removed as a module, then taken apart on the bench
    sw = swept(BOX[i], p['approach'])
    la, ha = aabb(sw)
    for b in present:
        lo, hi = AB[b]
        if np.any(lo > ha) or np.any(la > hi):
            continue
        if boxes_hit(sw, BOX[b]):
            dis_fail.append((i, b))
            break

# ------------------------------------------------------------------ 5 mass properties
mass = np.array([CAT[p['ldraw']]['mass'] for p in P])
cent = np.array([np.mean([c for c, R, h in BOX[p['id']]], axis=0) for p in P])
M = mass.sum()
com = (mass[:, None] * cent).sum(0) / M
feet_bottom = [p for p in P if p['layer'] == -2]
fx = [c for p in feet_bottom for c in (p['pos'][0] - 20, p['pos'][0] + 20)]
fz = []
for p in feet_bottom:
    lo, hi = AB[p['id']]
    fz += [lo[2], hi[2]]
    fx += [lo[0], hi[0]]
poly = (min(fx), max(fx), min(fz), max(fz))
margin = min(com[0] - poly[0], poly[1] - com[0], com[2] - poly[2], poly[3] - com[2])
tip_deg = math.degrees(math.atan2(margin, com[1]))
head_mass = mass[[i for i, p in enumerate(P) if cent[i][1] > 300]].sum()
upper_mass = mass[[i for i, p in enumerate(P) if p['sub'] == 'upper' or cent[i][1] > 8 * SEAM + 16]].sum()
height = max(AB[i][1][1] for i in AB)
width = max(AB[i][1][0] for i in AB) - min(AB[i][0][0] for i in AB)
depth = max(AB[i][1][2] for i in AB) - min(AB[i][0][2] for i in AB)

# ------------------------------------------------------------------ 6 swivel clearance
static = [p['id'] for p in P if p['module'] in ('feet', 'lower-body') or p['tag'] == 'turntable']
moving = [i for i in range(len(P)) if i not in set(static)]
swivel_hits = {}
for deg in (-20, -10, 10, 20):
    a = math.radians(deg)
    Ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    hits = []
    for i in moving:
        bi = obbs(P[i], Ry, np.zeros(3))
        lo, hi = aabb(bi)
        if lo[1] > 8 * SEAM + 16 + 30:
            continue
        for j in static:
            if boxes_hit(bi, BOX[j]):
                hits.append((i, j))
    swivel_hits[deg] = hits

# ------------------------------------------------------------------ report
bom = Counter((p['ldraw'], p['colour']) for p in P)
res = dict(parts=len(P), unique_elements=len(bom), unique_designs=len({p['ldraw'] for p in P}), steps=len(steps),
           collisions=len(collisions), collision_pairs=[(P[a]['ldraw'], P[a]['tag'], P[b]['ldraw'], P[b]['tag'])
                                                        for a, b in collisions[:20]],
           stud_links=n_links, floating=len(floating), floating_parts=[(P[i]['ldraw'], P[i]['tag']) for i in floating],
           single_component=components_ok, order_failures=len(order_fail), order_fail=order_fail[:20],
           approach_failures=len(approach_fail), approach_fail=approach_fail[:20],
           disassembly_failures=len(dis_fail),
           mass_g=round(float(M), 1), com_ldu=[round(float(v), 1) for v in com],
           com_mm=[round(float(v) * 0.4, 1) for v in com], support_polygon_ldu=poly,
           stability_margin_mm=round(margin * 0.4, 1), tip_angle_deg=round(tip_deg, 1),
           head_mass_share=round(float(head_mass / M), 3), upper_module_mass_g=round(float(upper_mass), 1),
           size_mm=[round(width * 0.4, 1), round(height * 0.4, 1), round(depth * 0.4, 1)],
           swivel={str(k): len(v) for k, v in swivel_hits.items()})
json.dump(res, open(os.path.join(MODEL, 'validation.json'), 'w'), indent=1)
ok = lambda b: 'PASS' if b else 'FAIL'
md = f"""# LEGO Heddy - engineering validation

Generated by `tools/validate.py` from `model/heddy.json` ({len(P)} parts, {len(steps)} steps).

| Check | Result | Detail |
|---|---|---|
| Collisions (oriented boxes, {EPS} LDU tolerance) | {ok(not collisions)} | {len(collisions)} intersecting pairs |
| Every part has a stud / anti-stud connection | {ok(not floating)} | {len(floating)} floating, {n_links} stud links |
| Model is one connected structure | {ok(components_ok)} | connected component covers {len(seen)}/{len(P)} parts |
| Build order: each part connects to what is already built | {ok(not order_fail)} | {len(order_fail)} failures |
| Build order: insertion path clear of built parts | {ok(not approach_fail)} | {len(approach_fail)} blocked |
| Disassembly in reverse order | {ok(not dis_fail)} | {len(dis_fail)} blocked |
| Centre of mass inside the feet's support polygon | {ok(margin > 0)} | COM (mm) x {com[0]*0.4:.1f}, y {com[1]*0.4:.1f}, z {com[2]*0.4:.1f}; margin {margin*0.4:.1f} mm; tips at {tip_deg:.1f} deg |
| Head not excessively top-heavy | {ok(com[1] < 0.6 * height)} | COM at {com[1]/height*100:.0f}% of height; mass above eye line {head_mass/M*100:.0f}% |
| Swivel +/-20 deg clear | {ok(all(not v for v in swivel_hits.values()))} | hits per angle {dict((k, len(v)) for k, v in swivel_hits.items())} |

Size: {width*0.4:.0f} x {height*0.4:.0f} x {depth*0.4:.0f} mm (W x H x D). Estimated mass {M:.0f} g
(catalogue weights). {len(bom)} unique element/colour combinations, {len({p['ldraw'] for p in P})} designs.
"""
open(os.path.join(MODEL, 'validation.md'), 'w').write(md)
print(md)
for k in ('collision_pairs', 'floating_parts', 'order_fail', 'approach_fail'):
    if res[k]:
        print(k, res[k][:12])
