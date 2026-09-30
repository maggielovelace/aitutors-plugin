"""Brick-built professor busts, engineered in code like LEGO Heddy.

A bust is modelled as a voxel field at real brick resolution: one cell = 1 stud
(20 LDU) wide x 1 stud deep x 1 plate (8 LDU) tall. Each cell carries an LDraw
colour code. The field is hollowed to a 2-cell shell, then every plate layer is
merged greedily into real LDraw plates (and tiles on exposed tops, except hair,
which keeps its studs). Output: the same parts JSON Heddy's renderer reads.

Model frame (as Heddy): X right, Y up, Z toward the viewer, LDU.
"""
import json, os

# ---- real parts (from heddy-ip/lego/tools/parts.py), keyed (short, long) in studs
PLATES = {(1, 1): '3024', (1, 2): '3023', (1, 3): '3623', (1, 4): '3710', (1, 6): '3666', (1, 8): '3460',
          (1, 10): '4477', (2, 2): '3022', (2, 3): '3021', (2, 4): '3020', (2, 6): '3795', (2, 8): '3034',
          (2, 10): '3832', (2, 12): '2445', (4, 4): '3031', (4, 6): '3032', (4, 8): '3035', (4, 10): '3030',
          (4, 12): '3029', (6, 6): '3958', (6, 8): '3036'}
TILES = {(1, 1): '3070b', (1, 2): '3069b', (1, 3): '63864', (1, 4): '2431', (1, 6): '6636', (1, 8): '4162',
         (2, 2): '3068b'}
R0 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
R90 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]


class Bust:
    def __init__(self, W=24, D=16, H=76):
        self.W, self.D, self.H = W, D, H          # half-width (studs), half-depth (studs), height (plates)
        self.v = {}                                # (X, Y, Z) -> colour ; X,Z centred, Y from 0
        self.tag = {}                              # (X, Y, Z) -> region tag

    # cell centre in LDU
    @staticmethod
    def c(X, Y, Z):
        return X * 20 + 10, Y * 8 + 4, Z * 20 + 10

    def cells(self):
        for Y in range(self.H):
            for X in range(-self.W, self.W):
                for Z in range(-self.D, self.D):
                    yield X, Y, Z

    def fill(self, pred, colour, tag=None, only_empty=False):
        """Set every cell whose centre satisfies pred(x, y, z) (LDU)."""
        for X, Y, Z in self.cells():
            x, y, z = self.c(X, Y, Z)
            if pred(x, y, z):
                k = (X, Y, Z)
                if only_empty and k in self.v:
                    continue
                self.v[k] = colour
                if tag:
                    self.tag[k] = tag

    def recolour(self, pred, colour, tags=None):
        for k in list(self.v):
            if tags and self.tag.get(k) not in tags:
                continue
            x, y, z = self.c(*k)
            if pred(x, y, z):
                self.v[k] = colour

    def front(self, tags=None):
        """(X, Y) -> frontmost Z among cells (optionally of given tags)."""
        f = {}
        for (X, Y, Z), col in self.v.items():
            if tags and self.tag.get((X, Y, Z)) not in tags:
                continue
            if (X, Y) not in f or Z > f[(X, Y)]:
                f[(X, Y)] = Z
        return f

    def paint_front(self, pred, colour, tags=None, depth=1):
        """Colour the frontmost `depth` cells of columns whose (x, y) satisfy pred."""
        fr = self.front(tags)
        for (X, Y), Zf in fr.items():
            x, y, _ = self.c(X, Y, 0)
            if pred(x, y):
                for d in range(depth):
                    k = (X, Y, Zf - d)
                    if k in self.v:
                        self.v[k] = colour

    def bump_front(self, pred, colour, tags=None, n=1, tag=None):
        """Add n cells in front of the frontmost cell (a raised feature: nose, brows)."""
        fr = self.front(tags)
        for (X, Y), Zf in fr.items():
            x, y, _ = self.c(X, Y, 0)
            if pred(x, y):
                for d in range(1, n + 1):
                    self.v[(X, Y, Zf + d)] = colour
                    if tag:
                        self.tag[(X, Y, Zf + d)] = tag

    # ---- to parts
    def shell(self, t=2):
        occ = set(self.v)
        keep = {}
        for k, col in self.v.items():
            X, Y, Z = k
            near = False
            for dx in range(-t, t + 1):
                for dy in (-t, 0, t) if t > 1 else (-1, 0, 1):
                    for dz in range(-t, t + 1):
                        if (X + dx, Y + dy, Z + dz) not in occ:
                            near = True
                            break
                    if near:
                        break
                if near:
                    break
            if near:
                keep[k] = col
        return keep

    def to_parts(self, studded=(), shell_t=2):
        cells = self.shell(shell_t)
        occ = set(self.v)
        parts = []
        pid = 0
        for Y in range(self.H):
            layer = {(X, Z): col for (X, YY, Z), col in cells.items() if YY == Y}
            if not layer:
                continue
            # split by (colour, top-exposed)
            groups = {}
            for (X, Z), col in layer.items():
                exposed = (X, Y + 1, Z) not in occ
                use_tile = exposed and col not in studded
                groups.setdefault((col, use_tile), set()).add((X, Z))
            for (col, use_tile), s in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1])):
                catalog = TILES if use_tile else PLATES
                sizes = sorted(catalog, key=lambda ab: -ab[0] * ab[1])
                s = set(s)
                while s:
                    X0, Z0 = min(s, key=lambda k: (k[1], k[0]))
                    placed = False
                    for a, b in sizes:
                        for w, d, rot in ((b, a, False), (a, b, True)):   # w along X, d along Z
                            if all((X0 + i, Z0 + j) in s for i in range(w) for j in range(d)):
                                for i in range(w):
                                    for j in range(d):
                                        s.discard((X0 + i, Z0 + j))
                                cx = (X0 + w / 2) * 20
                                cz = (Z0 + d / 2) * 20
                                parts.append(dict(id=pid, ldraw=catalog[(a, b)], colour=col,
                                                  pos=[cx, (Y + 1) * 8.0, cz], R=R90 if rot else R0,
                                                  module='bust', sub='main', approach=[0, 1, 0], layer=Y,
                                                  tag='tile' if use_tile else 'plate'))
                                pid += 1
                                placed = True
                                break
                        if placed:
                            break
                    if not placed:   # cannot happen: 1x1 always fits
                        s.discard((X0, Z0))
        return parts


# ---------------------------------------------------------------- helpers (LDU)
def ell(cx, cy, cz, rx, ry, rz):
    return lambda x, y, z: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.0


def box(x0, x1, y0, y1, z0, z1):
    return lambda x, y, z: x0 <= x <= x1 and y0 <= y <= y1 and z0 <= z <= z1


def cyl_y(cx, cz, r, y0, y1):
    return lambda x, y, z: y0 <= y <= y1 and (x - cx) ** 2 + (z - cz) ** 2 <= r * r


def cyl_z(cx, cy, r, z0, z1):
    return lambda x, y, z: z0 <= z <= z1 and (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def write_ldr(parts, path, title):
    """LDraw export, same conversion as LEGO Heddy (heddy-ip/lego/tools/sequence.py):
    model frame (Y up, Z to viewer) -> LDraw (-Y up) by T = diag(1, -1, -1)."""
    lines = [f'0 {title}', f'0 Name: {os.path.basename(path)}', '0 Author: aitutors.me brick-built faculty',
             '0 !LICENSE Model: see repository licence; part geometry LDraw.org CC BY 4.0',
             '0 // units: LDU, -y up', f'0 // {len(parts)} parts, one step per plate layer', '']
    layer = None
    for p in sorted(parts, key=lambda q: (q['layer'], q['id'])):
        if p['layer'] != layer:
            if layer is not None:
                lines.append('0 STEP')
            layer = p['layer']
        R = [[p['R'][i][j] * (1 if i == 0 else -1) * (1 if j == 0 else -1) for j in range(3)] for i in range(3)]
        t = [p['pos'][0], -p['pos'][1], -p['pos'][2]]
        v = t + [R[i][j] for i in range(3) for j in range(3)]
        lines.append('1 %d %s %s.dat' % (p['colour'], ' '.join(('%.4f' % x).rstrip('0').rstrip('.') or '0' for x in v), p['ldraw']))
    lines.append('0 STEP')
    open(path, 'w').write('\n'.join(lines) + '\n')


def save(parts, path, meta):
    """Write the parts JSON (read by render_bust.py) and, beside it, an LDraw .ldr."""
    json.dump(dict(meta=meta, parts=parts), open(path, 'w'))
    if path.endswith('.json'):
        write_ldr(parts, path[:-5] + '.ldr', meta.get('name', 'Brick-built professor'))
