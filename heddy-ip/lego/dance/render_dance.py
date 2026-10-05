"""Brick Studio dance: the locked LEGO Heddy dances on the paper sweep (10 s, 112 BPM).

Heddy has one real joint (the turntable swivel, +/-20 deg, per heddy-ip), so the
dance is stop motion of the whole toy: hops, rocks, shuffles and spins, with the
swivel as the counter-twist. Nothing on the model is bent, redrawn or recoloured.
Stop motion on twos. Captions and the beat are composited later (make_dance.py).

With --team the eight brick-built AI tutors (aitutors-plugin/faculty/built) dance
in two rows behind Heddy, who leads: each move reaches the tutors a little later.

Usage: python3 render_dance.py LEGO_DIR OUT_DIR [W H SAMPLES] [first last] [--team]
  LEGO_DIR = aitutors-plugin/heddy-ip/lego
"""
import sys, os, math, json, shutil, re, ast

TEAM = '--team' in sys.argv
ARGV = [a for a in sys.argv if a != '--team']
LEGO = os.path.abspath(ARGV[1])
OUT = os.path.abspath(ARGV[2])
W = int(ARGV[3]) if len(ARGV) > 3 else 1280
H = int(ARGV[4]) if len(ARGV) > 4 else 720
SAMPLES = int(ARGV[5]) if len(ARGV) > 5 else 32
sys.path.insert(0, os.path.join(LEGO, 'tools'))

import bpy
import scene as S

FPS = 24
DUR = 10.0
NF = int(DUR * FPS)
BPM = 112.0
BEAT = 60.0 / BPM
T0 = 0.45                          # first beat (s), matches make_dance.py
SWIVEL = 20.0                      # heddy-ip: upper body turns +/-20 deg
Z = 0.087                          # model mid-height (m)
FOOT_X, FOOT_Y = 0.055, 0.045      # half footprint (m): keeps a rocked toy on the floor
CAM_X = -0.045                     # solo: lens looks left of Heddy, caption room on the left
FIRST = int(ARGV[6]) if len(ARGV) > 6 else 0
LAST = int(ARGV[7]) if len(ARGV) > 7 else NF - 1

FACULTY = os.path.abspath(os.path.join(LEGO, '..', '..', 'faculty', 'built'))
LAND = W > H
# behind the lead: (id, x, y, row) in metres. 16:9 = two staggered rows; 9:16 = a diamond, four rows deep
ROWS = [('quill', -0.44, 0.30, 1), ('pi', -0.19, 0.30, 1), ('newton', 0.19, 0.30, 1), ('curie', 0.44, 0.30, 1),
        ('harari', -0.32, 0.58, 2), ('darwin', -0.105, 0.58, 2), ('mercator', 0.105, 0.58, 2),
        ('mentor', 0.32, 0.58, 2)] if LAND else [
        ('pi', -0.15, 0.27, 1), ('newton', 0.15, 0.27, 1),
        ('quill', -0.30, 0.54, 2), ('mentor', 0.0, 0.54, 2), ('curie', 0.30, 0.54, 2),
        ('darwin', -0.15, 0.81, 3), ('mercator', 0.15, 0.81, 3), ('harari', 0.0, 1.08, 4)]
LAG = 0.5 if LAND else 0.25        # beats: each row follows the row in front


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def seg(t, a, b):
    """0 before a, 1 after b, eased in between."""
    return ease((t - a) / (b - a))


def gate(t, a, b, r=0.12):
    """1 inside [a, b], eased over r seconds at each end."""
    return seg(t, a - r, a + r) * (1 - seg(t, b - r, b + r))


def pose(t):
    """Whole-toy pose at time t (s): x, hop, yaw, roll, pitch, swivel (m / deg)."""
    b = (t - T0) / BEAT                       # beat position
    ph = b - math.floor(b)                    # 0..1 inside the beat
    bounce = 4 * ph * (1 - ph) if b >= 0 else 0.0      # one hop per beat
    sway = math.sin(math.pi * b) if b >= 0 else 0.0    # left / right, one side per beat

    # 0.0-1.5  back to the lens, tail wiggle on the swivel
    # 1.5-2.4  hop-turn to face the lens
    # 2.4-5.0  rock side to side, swivel counter-twists
    # 5.0-6.3  shuffle left / right
    # 6.3-7.8  nod and quarter turns
    # 7.8-8.7  full spin
    # 8.7-10   landing pose, head cocked, hold
    g_back = 1 - seg(t, 1.4, 1.6)
    g_rock = gate(t, 2.4, 5.0)
    g_shuf = gate(t, 5.0, 6.3)
    g_nod = gate(t, 6.3, 7.8)
    g_end = seg(t, 8.7, 8.95)

    yaw = 180.0 * (1 - seg(t, 1.5, 2.4))               # the turn-around
    yaw += 360.0 * seg(t, 7.8, 8.7)                    # the spin
    yaw += g_back * 8 * sway + g_shuf * 24 * sway + g_nod * 34 * sway
    yaw += g_end * -12

    hop = bounce * (0.010 * g_back + 0.016 * g_rock + 0.012 * g_shuf + 0.024 * g_nod)
    hop += 0.035 * math.sin(math.pi * seg(t, 1.5, 2.4)) + 0.045 * math.sin(math.pi * seg(t, 7.8, 8.7))
    hop += 0.012 * math.sin(math.pi * seg(t, 8.7, 9.0)) * (1 - seg(t, 8.7, 9.0))   # settle

    roll = g_rock * 7 * sway + g_shuf * 5 * sway + g_end * 5
    pitch = g_nod * 4 * bounce
    x = g_rock * 0.015 * sway + g_shuf * 0.045 * sway
    swivel = g_back * SWIVEL * sway - g_rock * 15 * sway - g_nod * 12 * sway + g_end * 14
    return x, hop, yaw, roll, pitch, max(-SWIVEL, min(SWIVEL, swivel))


S.reset()
S.SSS = False
S.BEVEL_SAMPLES = 2
sc = bpy.context.scene


def empty(name, parent=None):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.parent = parent
    return e


def dancer(name, parts, home, lag=0.0, jointed=False):
    """A toy on the floor: root (place, facing) > tilt (rock, nod) > pivot > swivel (the real joint)."""
    objs = S.add_parts(parts, name_prefix=name)
    root = empty(name + '_root')
    tilt = empty(name + '_tilt', root)
    piv = empty(name + '_pivot', tilt)
    swivel = empty(name + '_swivel', piv)
    for p in parts:
        fixed = not jointed or p['module'] in ('feet', 'lower-body') or p['tag'] == 'turntable'
        objs[p['id']].parent = piv if fixed else swivel
    return dict(root=root, tilt=tilt, swivel=swivel, home=home, lag=lag, jointed=jointed)


heddy_parts = json.load(open(os.path.join(LEGO, 'model', 'heddy.json')))['parts']
cast = [dancer('heddy', heddy_parts, (0.0, 0.0), jointed=True)]
if TEAM:
    # the tutors' extra LDConfig colours live in their own renderer; read them from there
    src = open(os.path.join(FACULTY, 'tools', 'render_bust.py')).read()
    extra = ast.literal_eval(re.search(r'S\.COLOURS\.update\((\{.*?\})\)', src, re.S).group(1))
    for code, hexv in extra.items():
        S.COLOURS.setdefault(code, hexv)               # Heddy's own colours stay locked
    for pid, x, y, row in ROWS:
        parts = json.load(open(os.path.join(FACULTY, 'model', pid + '.json')))['parts']
        cast.append(dancer(pid, parts, (x, y), lag=LAG * row))

rig = S.studio(bg='EFE8DA', floor='F4EEE3')
bl = bpy.data.lights.new('backdrop', 'AREA')
bl.size, bl.energy, bl.color = 1.5, 14, (1.0, 0.93, 0.84)
bo = bpy.data.objects.new('backdrop', bl)
S.aim(bo, (0, 0.55, 0.9), (0, 1.7, 0.45))
sc.collection.objects.link(bo)
if TEAM:
    # the stock softboxes sit close to Heddy; lift and widen them so the back row is lit too
    for k, mul in (('key', 2.4), ('fill', 2.4), ('rim', 1.6), ('rim2', 1.6)):
        rig[k].data.energy *= mul
        rig[k].data.size *= 1.8
    S.aim(rig['key'], (-0.9, -0.9, 1.0), (0, 0.25, 0.1))
    S.aim(rig['fill'], (1.1, -0.8, 0.45), (0, 0.25, 0.1))
    S.aim(rig['rim'], (0.7, 1.1, 0.7), (0, 0.3, 0.1))
    S.aim(rig['rim2'], (-0.8, 1.05, 0.6), (0, 0.3, 0.1))
cam = S.camera((CAM_X, -0.95, 0.13), (CAM_X, 0, Z), lens=60, fstop=8)
sc.render.fps = FPS
# GPU when available (Metal on Apple silicon, CUDA/OptiX elsewhere); HEDDY_DEVICE=CPU forces CPU
if os.environ.get('HEDDY_DEVICE', 'GPU').upper() == 'GPU':
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('METAL', 'OPTIX', 'CUDA', 'HIP'):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                sc.cycles.device = 'GPU'
                print('Cycles device:', kind, [d.name for d in gpus], flush=True)
                break
    except Exception as e:
        print('GPU setup skipped:', e, flush=True)
sc.render.use_persistent_data = True
for k, v in dict(max_bounces=4, diffuse_bounces=2, glossy_bounces=2, transmission_bounces=0,
                 transparent_max_bounces=2, caustics_reflective=False, caustics_refractive=False,
                 adaptive_threshold=0.04).items():
    setattr(sc.cycles, k, v)


def place(d, t):
    x, hop, yaw, roll, pitch, sw = pose(t - d['lag'] * BEAT)
    if not d['jointed']:                                 # a bust on a plinth: smaller, no swivel
        x, hop, roll, pitch, sw = 0.6 * x, 0.7 * hop, 0.7 * roll, 0.6 * pitch, 0.0
    r, p = math.radians(roll), math.radians(pitch)
    lift = abs(math.sin(r)) * FOOT_X + abs(math.sin(p)) * FOOT_Y     # rocked onto an edge, not through the floor
    d['root'].location = (d['home'][0] + x, d['home'][1], hop + lift)
    d['root'].rotation_euler = (0, 0, math.radians(yaw))
    d['tilt'].rotation_euler = (-p, r, 0)
    d['swivel'].rotation_euler = (0, 0, math.radians(sw))


def setup(f):
    t = f / FPS
    for d in cast:
        place(d, t)
    push = seg(t, 8.7, 10.0)                             # small push-in on the landing pose
    if TEAM:
        dist = 1.75 - 0.10 * push
        if LAND:
            S.aim(cam, (0, -dist, 0.50), (0, 0.22, 0.115))
            cam.data.lens = 62
        else:                                            # look down the diamond
            S.aim(cam, (0, -dist, 1.05), (0, 0.42, 0.10))
            cam.data.lens = 55
        cam.data.dof.focus_distance = dist + (0.15 if LAND else 0.55)
        cam.data.dof.aperture_fstop = 11
    else:
        dist = 0.95 - 0.07 * push
        S.aim(cam, (CAM_X, -dist, 0.13), (CAM_X, 0, Z))
        cam.data.dof.focus_distance = dist


os.makedirs(OUT, exist_ok=True)
for f in range(FIRST, LAST + 1):
    fe = f - (f % 2)                     # stop motion on twos
    path = os.path.join(OUT, f'f{f:04d}.png')
    if f % 2 and os.path.exists(os.path.join(OUT, f'f{fe:04d}.png')):
        shutil.copy(os.path.join(OUT, f'f{fe:04d}.png'), path)
        continue
    if not os.path.exists(path):
        setup(fe)
        bpy.context.view_layer.update()
        S.render(path, W, H, SAMPLES)
    print('dance', f, flush=True)
json.dump(dict(W=W, H=H, fps=FPS, frames=NF, bpm=BPM, t0=T0, team=TEAM), open(os.path.join(OUT, 'dance.json'), 'w'))
print('done')
