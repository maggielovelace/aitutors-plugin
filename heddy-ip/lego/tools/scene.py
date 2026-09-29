"""Blender (bpy) scene builder for the locked LEGO Heddy model.

Loads model/heddy.json, builds one mesh per (LDraw part, colour) from the real
LDraw geometry, instances every part, and sets up the studio.
Model frame (X right, Y up, Z to viewer) -> Blender (X right, -Y to viewer, Z up).
"""
import json, math, os, sys
import numpy as np
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ldraw

ROOT = os.path.abspath(os.path.join(HERE, '..'))
ldraw.set_library(os.path.join(ROOT, 'ldraw'), os.path.join(ROOT, 'ldraw', 'lib'))
LDU = 0.0004                                  # metres per LDU
C = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)   # model -> blender
T = np.diag([1.0, -1.0, -1.0])                               # ldraw local -> model local

# LDraw colour code -> sRGB hex (official LDConfig values)
COLOURS = {15: 'FFFFFF', 151: 'E6E3E0', 191: 'F8BB3D', 272: '0D325B', 2: '257A3E', 71: 'A0A5A9',
           72: '6C6E68', 0: '05131D', 7: '9BA19D', 8: '6D6E5C', 19: 'E4CD9E', 4: 'C91A09', 14: 'F2CD37',
           1: '0055BF', 25: 'FE8A18', 28: '958A73', 70: '582A12', 320: '720E0F', 378: 'A0BCAC'}


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexlin(h):
    return tuple(srgb2lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (1.0,)


def load_model(path=None):
    path = path or os.path.join(ROOT, 'model', 'heddy.json')
    return json.load(open(path))


# ------------------------------------------------------------------ materials
_mats = {}
SSS = True          # subsurface on white ABS (stills); the film switches it off for speed
BEVEL_SAMPLES = 4


def plastic(code):
    if code in _mats:
        return _mats[code]
    h = COLOURS.get(code, 'FF00FF')
    m = bpy.data.materials.new(f'ABS_{code}')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = hexlin(h)
    lum = sum(hexlin(h)[:3]) / 3
    bsdf.inputs['Roughness'].default_value = 0.22
    bsdf.inputs['IOR'].default_value = 1.54
    if code in (15, 151) and SSS:
        bsdf.inputs['Subsurface Weight'].default_value = 0.08
        bsdf.inputs['Subsurface Radius'].default_value = (0.8, 0.8, 0.8)
        bsdf.inputs['Subsurface Scale'].default_value = 0.002
    # micro surface: tiny roughness variation + scratches, rounded moulded edges
    tex = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 900.0
    noise.inputs['Detail'].default_value = 6.0
    nt.links.new(tex.outputs['Object'], noise.inputs['Vector'])
    rmap = nt.nodes.new('ShaderNodeMapRange')
    rmap.inputs['To Min'].default_value = 0.16
    rmap.inputs['To Max'].default_value = 0.30
    nt.links.new(noise.outputs['Fac'], rmap.inputs['Value'])
    nt.links.new(rmap.outputs['Result'], bsdf.inputs['Roughness'])
    scr = nt.nodes.new('ShaderNodeTexWave')
    scr.wave_type = 'BANDS'
    scr.inputs['Scale'].default_value = 60.0
    scr.inputs['Distortion'].default_value = 40.0
    scr.inputs['Detail'].default_value = 2.0
    nt.links.new(tex.outputs['Object'], scr.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.97
    ramp.color_ramp.elements[1].position = 1.0
    nt.links.new(scr.outputs['Fac'], ramp.inputs['Fac'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.04
    bump.inputs['Distance'].default_value = 0.00002
    nt.links.new(ramp.outputs['Color'], bump.inputs['Height'])
    bev = nt.nodes.new('ShaderNodeBevel')
    bev.samples = BEVEL_SAMPLES
    bev.inputs['Radius'].default_value = 0.00022
    nt.links.new(bev.outputs['Normal'], bump.inputs['Normal'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    _mats[code] = m
    return m


# ------------------------------------------------------------------ meshes
_meshes = {}


def part_mesh(ld, colour):
    key = (ld, colour)
    if key in _meshes:
        return _meshes[key]
    V, F, FC = ldraw.mesh(ld + '.dat')
    me = bpy.data.meshes.new(f'{ld}_{colour}')
    me.from_pydata(V.tolist(), [], F.tolist())
    codes = sorted(set(int(c) if c != 16 else colour for c in FC))
    for c in codes:
        me.materials.append(plastic(c))
    idx = {c: n for n, c in enumerate(codes)}
    fc = [idx[int(c) if c != 16 else colour] for c in FC]
    me.polygons.foreach_set('material_index', fc)
    # weld + smooth-by-angle so studs and dishes are round, box edges stay crisp
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.05)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    try:
        me.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass
    me.transform(Matrix.Scale(LDU, 4))
    _meshes[key] = me
    return me


def part_matrix(p, extra=None):
    """World matrix for a part (optionally with an extra model-frame 4x4 applied)."""
    R = np.array(p['R'])
    t = np.array(p['pos'])
    M4 = np.eye(4)
    M4[:3, :3] = R @ T
    M4[:3, 3] = t
    if extra is not None:
        M4 = extra @ M4
    B = np.eye(4)
    B[:3, :3] = C @ M4[:3, :3]
    B[:3, 3] = C @ M4[:3, 3] * LDU
    return Matrix(B.tolist())


def add_parts(parts, collection=None, name_prefix='p'):
    coll = collection or bpy.context.scene.collection
    objs = {}
    for p in parts:
        me = part_mesh(p['ldraw'], p['colour'])
        ob = bpy.data.objects.new(f"{name_prefix}{p['id']:04d}_{p['ldraw']}", me)
        ob.matrix_world = part_matrix(p)
        coll.objects.link(ob)
        objs[p['id']] = ob
    return objs


def to_blender(v):
    return Vector((C @ np.asarray(v, float) * LDU).tolist())


# ------------------------------------------------------------------ studio
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    _meshes.clear()


def studio(bg='F1EDE0', floor='F8F3EB', warm=True, floor_rough=0.55, world_strength=0.12):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 4
    sc.view_settings.view_transform = 'Khronos PBR Neutral'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    # world
    w = bpy.data.worlds.new('World')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bgn = nt.nodes['Background']
    bgn.inputs['Color'].default_value = hexlin(bg)
    bgn.inputs['Strength'].default_value = world_strength
    cam_bg = nt.nodes.new('ShaderNodeBackground')
    cam_bg.inputs['Color'].default_value = hexlin(bg)
    cam_bg.inputs['Strength'].default_value = 1.0
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bgn.outputs['Background'], mix.inputs[1])
    nt.links.new(cam_bg.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], nt.nodes['World Output'].inputs['Surface'])
    # seamless sweep (floor + curved backdrop)
    # seamless cyclorama: flat floor that curves up into a back wall
    prof = [(-4.0, 0.0), (0.9, 0.0)]
    R = 0.9
    for n in range(1, 17):
        a = math.pi / 2 * n / 16
        prof.append((0.9 + R * math.sin(a), R * (1 - math.cos(a))))
    prof.append((1.8, 4.0))
    verts, faces = [], []
    for x in (-4.0, 4.0):
        for y, z in prof:
            verts.append((x, y, z))
    n = len(prof)
    for i in range(n - 1):
        faces.append((i, i + 1, n + i + 1, n + i))
    me = bpy.data.meshes.new('floor')
    me.from_pydata(verts, [], faces)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    fl = bpy.data.objects.new('floor', me)
    sc.collection.objects.link(fl)
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexlin(floor)
    b.inputs['Roughness'].default_value = floor_rough
    fl.data.materials.append(m)
    # key: large softbox upper-left/front
    def area(name, loc, size, energy, colour=(1, 1, 1), target=(0, 0, 0.1)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.size = size
        ld.energy = energy
        ld.color = colour
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        d = Vector(target) - Vector(loc)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(ob)
        return ob
    key = area('key', (-0.55, -0.6, 0.65), 0.9, 14)
    fill = area('fill', (0.7, -0.5, 0.25), 1.0, 3, (0.95, 0.97, 1.0))
    rim = area('rim', (0.35, 0.6, 0.45), 0.5, 10, (1.0, 0.82, 0.6) if warm else (1, 1, 1))
    rim2 = area('rim2', (-0.45, 0.55, 0.35), 0.4, 5, (1.0, 0.86, 0.66) if warm else (1, 1, 1))
    return dict(key=key, fill=fill, rim=rim, rim2=rim2, floor=fl)


def camera(loc, target, lens=50, name='cam', fstop=None, focus=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    ob = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus or d.length
    bpy.context.scene.camera = ob
    return ob


def aim(ob, loc, target):
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render(path, w=1280, h=720, samples=48):
    sc = bpy.context.scene
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
