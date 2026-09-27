"""Product stills of the locked model: orthographic-style views, 3/4 hero,
exploded engineering view. Usage:
  python3 render_stills.py OUTDIR [shots] [scale] [samples]
shots: comma list of front,rear,left,right,hero,hero4k,exploded
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy
from mathutils import Vector
import scene as S

OUT = sys.argv[1]
SHOTS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['front', 'rear', 'left', 'right', 'hero', 'exploded']
SCALE = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
SAMPLES = int(sys.argv[4]) if len(sys.argv) > 4 else 64
os.makedirs(OUT, exist_ok=True)

S.reset()
m = S.load_model()
P = m['parts']
objs = S.add_parts(P)
piv = bpy.data.objects.new('pivot', None)
bpy.context.scene.collection.objects.link(piv)
for o in objs.values():
    o.parent = piv
rig = S.studio(bg='EFE8DA', floor='F4EEE3')
# soft light on the sweep so the ground reads warm paper, not grey
bl = bpy.data.lights.new('backdrop', 'AREA')
bl.size = 1.5
bl.energy = 14
bl.color = (1.0, 0.93, 0.84)
bo = bpy.data.objects.new('backdrop', bl)
S.aim(bo, (0, 0.55, 0.9), (0, 1.7, 0.45))
bpy.context.scene.collection.objects.link(bo)

H = 0.087          # model centre height (m)


def shot(name, rot, cam, tgt, lens, w, h, fstop=None):
    piv.rotation_euler = (0, 0, math.radians(rot))
    S.camera(cam, tgt, lens=lens, fstop=fstop)
    S.render(os.path.join(OUT, name + '.png'), int(w * SCALE), int(h * SCALE), SAMPLES)


VIEWS = {  # name: model rotation (deg), camera far & low for a near-orthographic read
    'front': 0, 'rear': 180, 'left': 90, 'right': -90}
for v, rot in VIEWS.items():
    if v in SHOTS:
        shot(f'view-{v}', rot, (0, -1.9, H + 0.02), (0, 0, H), 240, 1600, 1600)

if 'hero' in SHOTS:
    shot('hero-3q', -32, (0.0, -0.62, 0.17), (0, 0, H + 0.004), 70, 1600, 1600, fstop=5.6)
if 'hero4k' in SHOTS:
    shot('hero-4k', -26, (0.0, -0.66, 0.15), (0, 0, H + 0.006), 58, 3840, 2160, fstop=6.3)

if 'exploded' in SHOTS:
    # major assemblies moved apart along their assembly axes (model frame, LDU)
    def group(p):
        t = p['tag'] or ''
        if p['module'] == 'feet':
            return 'feet'
        if t.startswith('eye'):
            return 'eyes'
        if p['module'] == 'beak':
            return 'beak'
        if t in ('face-base', 'face-tile'):
            return 'face'
        if t == 'tuft':
            return 'head'
        if t == 'badge':
            return 'badge'
        if p['colour'] == 151:
            return 'wingR' if p['pos'][0] > 0 else 'wingL'
        if p['layer'] is not None and p['layer'] >= 30:
            return 'head'
        return 'body'
    LIFT = 100
    OFF = {'feet': (0, -90, 0), 'body': (0, 0, 0), 'head': (0, 150, 0), 'face': (0, 60, 190), 'eyes': (0, 60, 330),
           'beak': (0, 60, 290), 'wingR': (170, 0, 0), 'wingL': (-170, 0, 0), 'badge': (0, -10, 190)}
    piv.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    for p in P:
        g = group(p)
        o = objs[p['id']]
        off = np.array(OFF[g], float) + np.array([0, LIFT, 0])
        o.matrix_world = S.part_matrix(p, extra=np.block([[np.eye(3), off[:, None]], [np.zeros((1, 3)), np.ones((1, 1))]]))
    shot('exploded', -40, (0.0, -0.95, 0.34), (0, 0, H + 0.055), 50, 2400, 1600)
    # label anchors (projected to 2D for the overlay step)
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    cam = sc.camera
    groups = {}
    for p in P:
        groups.setdefault(group(p), []).append(np.array(p['pos']) + np.array(OFF[group(p)]) + np.array([0, LIFT, 0]))
    piv.rotation_euler = (0, 0, math.radians(-40))
    bpy.context.view_layer.update()
    out = {}
    Mw = piv.matrix_world
    for k, pts in groups.items():
        if k == 'wingL':
            continue
        a = np.mean(pts, axis=0)
        wpt = Mw @ S.to_blender(a)
        co = world_to_camera_view(sc, cam, wpt)
        out[k] = (co.x, 1 - co.y)
    json.dump(out, open(os.path.join(OUT, 'exploded-anchors.json'), 'w'))
print('done')
