"""Cinematic film of the locked LEGO Heddy (brief sections 13-19).

Every frame is rendered from model/heddy.json - the same parts, the same
positions. Construction obeys the build sequence: a part is hidden until its
moment, then travels a short way along its own insertion axis and clicks in.
Nothing morphs, scales or passes through another part. The only joint that
moves is the real one: the turntable swivel.

Usage: python3 render_film.py OUTDIR SHOT[,SHOT] WIDTH HEIGHT SAMPLES [first] [last]
Shots: s01..s10 (see SHOTS). Frames are written as OUTDIR/SHOT/f####.png;
frames that would be identical (stop-motion 'on twos', holds) are not
re-rendered - the compositor re-uses them (see film_plan()).
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

FPS = 24
# shot lengths in seconds (hero film = 45 s)
SHOTS = [('s01', 3), ('s02', 4), ('s03', 6), ('s04', 5), ('s05', 5), ('s06', 4), ('s07', 4), ('s08', 5), ('s09', 4),
         ('s10', 5)]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
M = json.load(open(os.path.join(ROOT, 'model', 'heddy.json')))
P = M['parts']
STEPS = json.load(open(os.path.join(ROOT, 'model', 'heddy_steps.json')))['steps']
NF = {s: d * FPS for s, d in SHOTS}


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ build timeline
# order of placement = instruction order; the upper module lands as one unit
order = []
upper = [i for s in STEPS if s['sub'] == 'upper' for i in s['parts']]
for s in STEPS:
    if s['sub'] == 'upper':
        continue
    if s['sub'] == 'attach-upper':
        order.append(('unit', upper))
        continue
    for i in s['parts']:
        order.append(('part', [i]))


def idx_of(pred):
    for k, (kind, ids) in enumerate(order):
        if any(pred(P[i]) for i in ids):
            return k
    return len(order)


K_FACE = idx_of(lambda p: p['module'] == 'facial')
K_EYES = idx_of(lambda p: p['module'] == 'eyes')
K_LOWER_END = idx_of(lambda p: p['module'] in ('torso', 'head'))
N_ORDER = len(order)

# landing frame (global film frame) of each placement
S0 = {}
acc = 0
for s, d in SHOTS:
    S0[s] = acc
    acc += d * FPS
TOTAL = acc
land = {}


def spread(k0, k1, f0, f1, curve=1.0):
    n = max(k1 - k0, 1)
    for k in range(k0, k1):
        t = ((k - k0) / n) ** curve
        land[k] = f0 + t * (f1 - f0)


# s01: the first piece is already resting on the desk
land[0] = -1
# s02: first clicks slow, then faster (stop motion)
spread(1, K_LOWER_END, S0['s02'] + 10, S0['s02'] + NF['s02'] - 6, curve=0.55)
# s03: time-lapse of the whole body shell
spread(K_LOWER_END, K_FACE, S0['s03'] + 2, S0['s03'] + NF['s03'] - 8)
# s04: face skin fast, then eye by eye
face_skin = [k for k in range(K_FACE, K_EYES)]
spread(K_FACE, K_EYES, S0['s04'] + 0, S0['s04'] + 26)
eye_keys = list(range(K_EYES, N_ORDER))
# eye beats (frames within s04): left iris, left pupil, left highlight, right iris, pupil, highlight, beak
beats = {}
for k in eye_keys:
    t = P[order[k][1][0]]['tag'] or ''
    mod = P[order[k][1][0]]['module']
    if t.startswith('eyeL-spacer') or t == 'eyeL-iris':
        beats[k] = 34
    elif t.startswith('eyeL-pupil'):
        beats[k] = 46
    elif t == 'eyeL-highlight':
        beats[k] = 58
    elif t.startswith('eyeR-spacer') or t == 'eyeR-iris':
        beats[k] = 66
    elif t.startswith('eyeR-pupil'):
        beats[k] = 74
    elif t == 'eyeR-highlight':
        beats[k] = 84
    elif mod == 'beak':
        beats[k] = 92
    else:                       # badge, tuft
        beats[k] = 24
for k, f in beats.items():
    land[k] = S0['s04'] + f
TRAVEL = 7        # frames of travel before the click
DIST = 70.0       # LDU of travel along the insertion axis


def part_offset(k, gf):
    """None = not yet present; else offset vector (LDU) along the approach axis."""
    f = land[k]
    if gf >= f:
        return 0.0
    if gf < f - TRAVEL:
        return None
    t = (f - gf) / TRAVEL
    return DIST * t * t


def film_plan():
    return dict(shots=SHOTS, fps=FPS, total=TOTAL)


# ------------------------------------------------------------------ blender part
if __name__ == '__main__':
    import bpy
    from mathutils import Vector, Matrix
    import scene as S

    OUT = sys.argv[1]
    SEL = sys.argv[2].split(',')
    W, H = int(sys.argv[3]), int(sys.argv[4])
    SAMPLES = int(sys.argv[5])
    FIRST = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    LAST = int(sys.argv[7]) if len(sys.argv) > 7 else 10 ** 6

    S.reset()
    objs = S.add_parts(P)
    piv = bpy.data.objects.new('pivot', None)          # model turntable for camera-free orbits
    bpy.context.scene.collection.objects.link(piv)
    swivel = bpy.data.objects.new('swivel', None)      # the real turntable joint
    bpy.context.scene.collection.objects.link(swivel)
    swivel.parent = piv
    static_ids = {p['id'] for p in P if p['module'] in ('feet', 'lower-body') or p['tag'] == 'turntable'}
    for i, o in objs.items():
        o.parent = piv if i in static_ids else swivel
    rig = S.studio(bg='EFE8DA', floor='F4EEE3')
    sc = bpy.context.scene
    world_bg = sc.world.node_tree.nodes
    floor_mat = rig['floor'].data.materials[0].node_tree.nodes['Principled BSDF']
    bl = bpy.data.lights.new('backdrop', 'AREA')
    bl.size = 1.5
    bl.energy = 14
    bl.color = (1.0, 0.93, 0.84)
    bo = bpy.data.objects.new('backdrop', bl)
    S.aim(bo, (0, 0.55, 0.9), (0, 1.7, 0.45))
    sc.collection.objects.link(bo)
    cam = S.camera((0, -0.7, 0.15), (0, 0, 0.09), lens=50, fstop=4)
    sc.render.fps = FPS
    sc.cycles.samples = SAMPLES

    def set_env(dark):
        """Dark-neutral studio for the build, warm paper for the reveal."""
        cam_bg = [n for n in world_bg if n.bl_idname == 'ShaderNodeBackground']
        col = S.hexlin('1B1D20') if dark else S.hexlin('EFE8DA')
        for n in cam_bg:
            n.inputs['Color'].default_value = col
        floor_mat.inputs['Base Color'].default_value = S.hexlin('2A2C30') if dark else S.hexlin('F4EEE3')
        floor_mat.inputs['Roughness'].default_value = 0.35 if dark else 0.55
        bl.energy = 3 if dark else 14
        rig['rim'].data.energy = 16 if dark else 10

    # --- props: booklet pages and a notebook with the question
    def textured_plane(name, img_path, w, h):
        me = bpy.data.meshes.new(name)
        me.from_pydata([(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new()
        for li, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
            uv.data[li].uv = (u, v)
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(img_path)
        b = nt.nodes['Principled BSDF']
        b.inputs['Roughness'].default_value = 0.7
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        sc.collection.objects.link(ob)
        return ob

    pages_dir = os.path.join(ROOT, 'instructions', 'pages')
    page_files = sorted(os.listdir(pages_dir))
    flip_pages = [os.path.join(pages_dir, page_files[n]) for n in (0, 3, 20, 50, 74)]
    inv_page = os.path.join(pages_dir, [f for f in page_files][-3])
    PW, PH = 0.21, 0.148
    book = bpy.data.objects.new('book', None)
    sc.collection.objects.link(book)
    base_page = textured_plane('page_base', inv_page, PW, PH)
    base_page.parent = book
    base_page.location = (PW / 2, 0, 0.0005)
    flips = []
    for n, pth in enumerate(flip_pages):
        hinge = bpy.data.objects.new(f'hinge{n}', None)
        sc.collection.objects.link(hinge)
        hinge.parent = book
        hinge.location = (0, 0, 0.001 + 0.0004 * (len(flip_pages) - n))
        pg = textured_plane(f'page{n}', pth, PW, PH)
        pg.parent = hinge
        pg.location = (PW / 2, 0, 0)
        flips.append(hinge)
    book.location = (-0.26, -0.02, 0.0)
    book.rotation_euler = (0, 0, math.radians(12))

    note_img = os.path.join(OUT, 'notebook.png')
    if not os.path.exists(note_img):
        from PIL import Image, ImageDraw, ImageFont
        im = Image.new('RGB', (1200, 1600), '#F8F3EB')
        d = ImageDraw.Draw(im)
        for y in range(260, 1600, 80):
            d.line((80, y, 1120, y), fill='#D5DCE6', width=3)
        d.line((170, 0, 170, 1600), fill='#E8B9B0', width=3)
        fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 92)
        d.text((220, 420), 'Why does', font=fnt, fill='#08203B')
        d.text((220, 540), 'this work?', font=fnt, fill='#08203B')
        os.makedirs(OUT, exist_ok=True)
        im.save(note_img)
    note = textured_plane('notebook', note_img, 0.09, 0.12)
    note.location = (0.19, -0.12, 0.004)
    note.rotation_euler = (math.radians(-2), 0, math.radians(-24))
    cover = bpy.data.objects.new('nb_cover', bpy.data.meshes.new('nb_cover'))
    bpy.data.meshes['nb_cover'].from_pydata([(-0.047, -0.062, 0), (0.047, -0.062, 0), (0.047, 0.062, 0), (-0.047, 0.062, 0),
                                             (-0.047, -0.062, 0.0035), (0.047, -0.062, 0.0035), (0.047, 0.062, 0.0035),
                                             (-0.047, 0.062, 0.0035)], [],
                                            [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    cm = bpy.data.materials.new('cover')
    cm.use_nodes = True
    cm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = S.hexlin('238744')
    bpy.data.meshes['nb_cover'].materials.append(cm)
    sc.collection.objects.link(cover)
    cover.parent = note
    cover.location = (0, 0, -0.004)

    def props(book_on, note_on):
        for o in [book, base_page] + flips + [c for f in flips for c in f.children]:
            o.hide_render = not book_on
        note.hide_render = cover.hide_render = not note_on

    # --- per-part transforms
    BASEM = {p['id']: S.part_matrix(p) for p in P}
    approach = {p['id']: np.array(p['approach']) for p in P}
    k_of = {}
    for k, (kind, ids) in enumerate(order):
        for i in ids:
            k_of[i] = k

    def pose_build(gf, explode=0.0):
        for i, o in objs.items():
            k = k_of[i]
            off = part_offset(k, gf)
            if off is None:
                o.hide_render = True
                continue
            o.hide_render = False
            d = approach[i] * off
            if order[k][0] == 'unit':
                d = np.array([0, 1.0, 0]) * off
            if explode:
                d = d + EXPLODE[i] * explode
            T = np.eye(4)
            T[:3, 3] = d
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_basis = S.part_matrix(P[i], extra=T)

    def grp(p):
        t = p['tag'] or ''
        if p['module'] == 'feet':
            return (0, -90, 0)
        if t.startswith('eye'):
            return (0, 60, 330)
        if p['module'] == 'beak':
            return (0, 60, 290)
        if t in ('face-base', 'face-tile'):
            return (0, 60, 190)
        if t == 'badge':
            return (0, -10, 190)
        if p['colour'] == 151:
            return (170 if p['pos'][0] > 0 else -170, 0, 0)
        if t == 'tuft' or (p['layer'] is not None and p['layer'] >= 30):
            return (0, 150, 0)
        return (0, 0, 0)
    EXPLODE = {p['id']: np.array(grp(p), float) + np.array([0, 100, 0]) for p in P}

    def orbit(deg_from, deg_to, t):
        return math.radians(deg_from + (deg_to - deg_from) * ease(t))

    def cam_at(dist, height, target_z, lens, fstop=None, focus=None):
        cam.data.lens = lens
        S.aim(cam, (0, -dist, height), (0, 0, target_z))
        if fstop:
            cam.data.dof.use_dof = True
            cam.data.dof.aperture_fstop = fstop
            cam.data.dof.focus_distance = focus or math.hypot(dist, height - target_z)
        else:
            cam.data.dof.use_dof = False

    Z = 0.087

    def setup(shot, f):
        """Pose everything for frame f of a shot. Returns a key that identifies
        the image (identical keys are rendered once)."""
        n = NF[shot]
        t = f / max(n - 1, 1)
        gf = S0[shot] + f
        swivel.rotation_euler = (0, 0, 0)
        props(False, False)
        piv.rotation_euler = (0, 0, 0)
        if shot == 's01':
            set_env(True)
            pose_build(gf)
            piv.rotation_euler = (0, 0, math.radians(-30))
            d = 0.34 - 0.08 * ease(t)
            cam_at(d, 0.07 - 0.02 * t, 0.004, 100, fstop=4.0)
            return None
        if shot == 's02':
            set_env(True)
            pose_build(gf)
            piv.rotation_euler = (0, 0, orbit(-30, -15, t))
            cam_at(0.45, 0.14, 0.02, 85, fstop=5.6)
            return ('s02', f // 2) if False else None
        if shot == 's03':
            set_env(True)
            pose_build(gf)
            piv.rotation_euler = (0, 0, orbit(-15, -80, t))
            cam_at(0.72 - 0.04 * t, 0.26, 0.05 + 0.05 * ease(t), 50, fstop=8)
            return None
        if shot == 's04':
            set_env(True)
            pose_build(gf)
            piv.rotation_euler = (0, 0, orbit(-12, 0, min(1, t * 1.6)))
            cam_at(0.46 - 0.04 * ease(t), Z + 0.035, Z + 0.03, 90, fstop=5.6)
            return None
        if shot == 's05':
            set_env(False)
            pose_build(TOTAL)
            piv.rotation_euler = (0, 0, orbit(20, -25, t))
            cam_at(0.52 + 0.14 * ease(t), 0.13, Z + 0.004, 50, fstop=6.3)
            return None
        if shot == 's06':
            set_env(False)
            # explode (0-35%), hold, snap back (70-100%)
            e = ease(t / 0.35) if t < 0.35 else (1.0 if t < 0.7 else 1 - ease((t - 0.7) / 0.3))
            pose_build(TOTAL, explode=e)
            piv.rotation_euler = (0, 0, math.radians(-40))
            cam_at(0.95, 0.30 + 0.04 * e, Z + 0.03 * e, 50)
            return None
        if shot == 's07':
            set_env(False)
            pose_build(TOTAL)
            props(True, False)
            piv.rotation_euler = (0, 0, math.radians(-18))
            nfl = len(flips)
            for n_, h in enumerate(flips):
                t0 = 0.08 + n_ * 0.14
                h.rotation_euler = (0, -math.pi * ease((t - t0) / 0.12), 0)
            cam_at(0.62, 0.34, 0.03, 45, fstop=8)
            S.aim(cam, (-0.12, -0.55, 0.33), (-0.14, 0.0, 0.03))
            return None
        if shot == 's08':
            set_env(False)
            pose_build(TOTAL)
            props(False, True)
            # the real joint: turn toward the notebook, settle
            a = 20 * ease((t - 0.25) / 0.5)
            swivel.rotation_euler = (0, 0, math.radians(-a))
            piv.rotation_euler = (0, 0, math.radians(8))
            cam_at(0.66, 0.16, Z - 0.01, 50, fstop=5.6)
            S.aim(cam, (0.06, -0.64, 0.16), (0.06, 0, Z - 0.02))
            return None
        if shot == 's09':
            set_env(False)
            pose_build(TOTAL)
            props(False, True)
            # thinking: a small settle back and forth on the swivel
            a = 20 - 5 * math.sin(math.pi * ease(t)) * (1 - 0.3 * t)
            swivel.rotation_euler = (0, 0, math.radians(-a))
            piv.rotation_euler = (0, 0, math.radians(8))
            S.aim(cam, (0.14, -0.5, 0.12), (0.13, 0, 0.05))
            cam.data.lens = 50
            cam.data.dof.use_dof = True
            cam.data.dof.aperture_fstop = 4.5
            cam.data.dof.focus_distance = 0.5
            return None
        if shot == 's10':
            set_env(False)
            pose_build(TOTAL)
            piv.rotation_euler = (0, 0, math.radians(-8 + 4 * t))
            cam_at(0.78, 0.13, Z + 0.02, 50, fstop=8)
            return ('s10', int(t * 8))       # near-static hero: 8 unique frames, held
        return None

    for shot in SEL:
        os.makedirs(os.path.join(OUT, shot), exist_ok=True)
        rendered = {}
        for f in range(NF[shot]):
            if f < FIRST or f > LAST:
                continue
            path = os.path.join(OUT, shot, f'f{f:04d}.png')
            key = setup(shot, f)
            if key is not None and key in rendered:
                import shutil
                shutil.copy(rendered[key], path)
                continue
            if os.path.exists(path):
                if key is not None:
                    rendered[key] = path
                continue
            bpy.context.view_layer.update()
            S.render(path, W, H, SAMPLES)
            if key is not None:
                rendered[key] = path
            print(shot, f, flush=True)
    print('done')
