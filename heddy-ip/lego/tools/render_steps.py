"""Render every assembly step (and part icons) for the instruction booklet.

New parts in full colour; parts from earlier steps slightly faded so the eye
lands on what changed. Transparent film: the page composer adds the paper.
Usage: python3 render_steps.py OUTDIR [first] [last] [size] [samples] [--icons]
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy
from mathutils import Vector, Matrix
import scene as S

OUT = sys.argv[1]
FIRST = int(sys.argv[2]) if len(sys.argv) > 2 else 1
LAST = int(sys.argv[3]) if len(sys.argv) > 3 else 9999
SIZE = int(sys.argv[4]) if len(sys.argv) > 4 else 900
SAMPLES = int(sys.argv[5]) if len(sys.argv) > 5 else 16
ICONS = '--icons' in sys.argv
os.makedirs(OUT, exist_ok=True)

S.reset()
m = S.load_model()
P = m['parts']
steps = json.load(open(os.path.join(S.ROOT, 'model', 'heddy_steps.json')))['steps']
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Khronos PBR Neutral'
sc.cycles.max_bounces = 4
w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 0.97, 0.93, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.45


def light(name, loc, size, energy):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.size = size
    ld.energy = energy
    ob = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(ob)
    S.aim(ob, loc, (0, 0, 0.09))
    return ob


# lights ride with the camera rig so every view is lit the same way
rig = bpy.data.objects.new('rig', None)
sc.collection.objects.link(rig)
for n, loc, sz, e in (('key', (-0.5, -0.7, 0.6), 0.9, 14), ('fill', (0.7, -0.4, 0.2), 1.0, 5), ('top', (0, 0.2, 1.0), 1.0, 6)):
    lo = light(n, loc, sz, e)
    lo.parent = rig

objs = S.add_parts(P)
root_main = bpy.data.objects.new('main', None)
root_upper = bpy.data.objects.new('upper', None)
for r in (root_main, root_upper):
    sc.collection.objects.link(r)
upper_ids = {i for s in steps if s['sub'] == 'upper' for i in s['parts']}
for i, o in objs.items():
    o.parent = root_upper if i in upper_ids else root_main

# faded twin materials for "already built" parts
_fade = {}


def faded(mat):
    if mat.name in _fade:
        return _fade[mat.name]
    f = mat.copy()
    f.name = mat.name + '_fade'
    b = f.node_tree.nodes.get('Principled BSDF')
    c = list(b.inputs['Base Color'].default_value)
    b.inputs['Base Color'].default_value = [c[k] * 0.72 + 0.28 * 0.6 for k in range(3)] + [1]   # grey veil
    _fade[mat.name] = f
    return f


_fmesh = {}
_orig = {}


def set_faded(o, flag):
    base = _orig.setdefault(o.name, o.data)
    if flag:
        if base.name not in _fmesh:
            fm = base.copy()
            for k, mat in enumerate(fm.materials):
                fm.materials[k] = faded(mat)
            _fmesh[base.name] = fm
        o.data = _fmesh[base.name]
    else:
        o.data = base


for fm_key in list(bpy.data.meshes.keys()):
    pass

new_coll = bpy.data.collections.new('new_parts')
sc.collection.children.link(new_coll)
sc.render.use_freestyle = True
sc.render.line_thickness_mode = 'ABSOLUTE'
sc.render.line_thickness = 1.6
vl = bpy.context.view_layer
vl.use_freestyle = True
fs = vl.freestyle_settings
ls = fs.linesets[0] if fs.linesets else fs.linesets.new('new')
ls.select_by_collection = True
ls.collection = new_coll
ls.select_by_visibility = True
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = False
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('amber')
ls.linestyle.color = (0.86, 0.46, 0.0)
ls.linestyle.thickness = 1.6

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam_data.clip_start = 0.002
cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
sc.render.resolution_x = SIZE
sc.render.resolution_y = SIZE
sc.cycles.samples = SAMPLES


def frame(ids, az=-35, el=28, pad=1.18, flip=False):
    """Point the camera at the bounding sphere of the given parts."""
    pts = []
    for i in ids:
        o = objs[i]
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    if not pts:
        return
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (lo + hi) / 2
    rad = max((p - ctr).length for p in pts)
    dist = rad * pad / math.sin(cam_data.angle / 2)
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    loc = ctr + d * dist
    S.aim(cam, loc, ctr)
    rig.location = ctr - Vector((0, 0, 0.09))
    rig.rotation_euler = (0, 0, a)


VIEW = {'feet': (-35, 32), 'lower-body': (-35, 32), 'core': (-35, 30), 'torso': (-32, 26), 'head': (-30, 24),
        'facial': (-18, 8), 'eyes': (-12, 6), 'beak': (-10, 4), 'details': (-24, 10)}

built_main, built_upper = [], []
attached = False
for s in steps:
    n = s['n']
    new = set(s['parts'])
    if s['sub'] == 'upper':
        built_upper += s['parts']
    elif s['sub'] == 'attach-upper':
        attached = True
    else:
        built_main += s['parts']
    if n < FIRST or n > LAST:
        continue
    show = set(built_upper) if s['sub'] == 'upper' else set(built_main) | (set(built_upper) if attached else set())
    for o in list(new_coll.objects):
        new_coll.objects.unlink(o)
    for i in new:
        if i in objs and objs[i].name not in new_coll.objects:
            new_coll.objects.link(objs[i])
    for i, o in objs.items():
        vis = i in show
        o.hide_render = not vis
        if vis:
            set_faded(o, i not in new and s['sub'] != 'attach-upper')
    if s['sub'] == 'upper':
        # the module is built upside-down once the floor is done
        flip = s.get('view') == 'under'
        root_upper.rotation_euler = (math.pi if flip else 0, 0, 0)
        root_upper.location = (0, 0, 0.09 if flip else 0)
    else:
        root_upper.rotation_euler = (0, 0, 0)
        root_upper.location = (0, 0, 0)
    bpy.context.view_layer.update()
    az, el = VIEW[s['module']]
    if s['sub'] == 'attach-upper':
        ids = list(show)
        # show the module hovering above the turntable, arrow drawn by the composer
        root_upper.location = (0, 0, 0.03)
        bpy.context.view_layer.update()
        frame(ids, az, el)
    elif s['module'] in ('eyes', 'beak', 'facial', 'details'):
        # frame the face / the new parts with some context
        ctx = [i for i in show if P[i]['tag'] in ('face-base', 'face-tile') or i in new]
        frame(ctx if ctx else list(new), az, el, pad=1.55)
    else:
        frame(list(show), az, el)
    S.render(os.path.join(OUT, f'step-{n:03d}.png'), SIZE, SIZE, SAMPLES)
    print('step', n, flush=True)

if ICONS:
    sc.render.use_freestyle = False
    # one icon per element/colour, isolated
    for o in objs.values():
        o.hide_render = True
    root_upper.rotation_euler = (0, 0, 0)
    root_upper.location = (0, 0, 0)
    done = set()
    sc.render.resolution_x = sc.render.resolution_y = 240
    for p in P:
        key = (p['ldraw'], p['colour'])
        if key in done:
            continue
        done.add(key)
        o = objs[p['id']]
        set_faded(o, False)
        saved = o.matrix_world.copy()
        o.parent = None
        # canonical pose: studs up (tiles/plates), turned 3/4
        o.matrix_world = Matrix.Translation((0, 0, 0)) @ S.part_matrix(dict(p, R=np.eye(3).tolist(), pos=[0, 0, 0]))
        o.hide_render = False
        bpy.context.view_layer.update()
        frame([p['id']], -35, 30, pad=1.1)
        S.render(os.path.join(OUT, f"icon-{p['ldraw']}-{p['colour']}.png"), 240, 240, 12)
        o.hide_render = True
        o.matrix_world = saved
print('done')
