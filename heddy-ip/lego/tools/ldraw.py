"""Minimal LDraw reader: resolves sub-files, flattens a part to triangles.

LDraw units (LDU): 1 stud pitch = 20, 1 plate = 8, 1 brick = 24; -y is up.
Colour 16 = "main colour" (inherits), 24 = edge colour (lines are skipped).
"""
import os
import numpy as np

LIB_DIRS = []


def set_library(*roots):
    LIB_DIRS[:] = list(roots)


def _find(name):
    name = name.strip().replace('\\', '/').lower()
    cands = [name]
    if not name.startswith(('parts/', 'p/')):
        cands += ['parts/' + name, 'p/' + name, 'parts/s/' + name[2:] if name.startswith('s/') else 'parts/s/' + name]
    for root in LIB_DIRS:
        for c in cands:
            p = os.path.join(root, c)
            if os.path.exists(p):
                return p
    raise FileNotFoundError(name)


_cache = {}


def load_file(name):
    """Return list of (kind, data) records for a file, cached."""
    path = _find(name)
    if path in _cache:
        return _cache[path]
    recs = []
    for line in open(path, encoding='latin-1'):
        t = line.split()
        if not t:
            continue
        if t[0] == '1' and len(t) >= 15:
            col = int(t[1])
            v = list(map(float, t[2:14]))
            M = np.array([[v[3], v[4], v[5], v[0]],
                          [v[6], v[7], v[8], v[1]],
                          [v[9], v[10], v[11], v[2]],
                          [0, 0, 0, 1]])
            recs.append(('ref', (col, M, ' '.join(t[14:]))))
        elif t[0] == '3' and len(t) >= 11:
            recs.append(('tri', (int(t[1]), np.array(list(map(float, t[2:11]))).reshape(3, 3))))
        elif t[0] == '4' and len(t) >= 14:
            q = np.array(list(map(float, t[2:14]))).reshape(4, 3)
            recs.append(('tri', (int(t[1]), q[[0, 1, 2]])))
            recs.append(('tri', (int(t[1]), q[[0, 2, 3]])))
    _cache[path] = recs
    return recs


def flatten(name, colour=16, M=np.eye(4), out=None, depth=0):
    """Flatten to {colour: [tri(3x3)...]} in the caller frame."""
    if out is None:
        out = {}
    for kind, data in load_file(name):
        if kind == 'tri':
            c, tri = data
            c = colour if c == 16 else c
            h = np.c_[tri, np.ones(3)] @ M.T
            out.setdefault(c, []).append(h[:, :3])
        else:
            c, M2, sub = data
            c = colour if c == 16 else c
            flatten(sub, c, M @ M2, out, depth + 1)
    return out


def mesh(name):
    """Return (verts Nx3, faces Mx3, face_colour M) for a part, main colour = 16."""
    d = flatten(name)
    V, F, C = [], [], []
    n = 0
    for c, tris in d.items():
        for t in tris:
            V.append(t)
            F.append([n, n + 1, n + 2])
            C.append(c)
            n += 3
    if not V:
        return np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros(0, int)
    return np.concatenate(V), np.array(F), np.array(C)


def bbox(name):
    V, _, _ = mesh(name)
    return V.min(0), V.max(0)
