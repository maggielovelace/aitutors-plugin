"""Render a brick-built bust in LEGO Heddy's studio (Blender Cycles via the `bpy` module).

    python render_bust.py MODEL.json OUT.png [--size 1200] [--samples 64] [--rot -16]
                          [--cam-height 0.11149] [--cutout]

--rot         turntable angle in degrees (the set is shot at -16)
--cam-height  camera target height in metres. Leave it at the default: every portrait in the
              set is shot at 0.11149 so the eight line up (a taller model must not move the camera).
--cutout      transparent background, no floor, no shadow: for putting a professor on any page.

Uses Heddy's own renderer (heddy-ip/lego/tools/scene.py) and vendored LDraw part library
(heddy-ip/lego/ldraw), so the plastic, bevels, lights and sweep are identical to LEGO Heddy.
"""
import argparse, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'heddy-ip', 'lego', 'tools'))

import bpy          # noqa: E402  (pip install bpy; needs Python 3.11)
import scene as S   # noqa: E402  Heddy's studio

# extra official LDConfig colours used by the faculty (skin, hair, clothes)
S.COLOURS.update({78: 'F6D7B3', 92: 'D09168', 84: 'AA7D55', 70: '582A12', 308: '352100', 86: '755945',
                  19: 'E4CD9E', 28: '958A73', 330: '9B9A5A', 288: '184632', 484: 'A95500', 3: '008F9B',
                  322: '36AEBF', 321: '078BC9', 379: '6074A1', 1: '0055BF', 26: 'C870A0', 5: 'C870A0',
                  226: 'FFF03A', 68: 'F3CF9B', 212: '9FC3E9', 73: '5A93DB', 85: '6C4E3A', 450: 'B67B50',
                  2: '237841', 10: '4B9F4A', 27: 'BBE90B', 326: 'DFEEA5', 118: 'B3D7D1', 323: 'ACC7EF'})

SET_CAMERA_HEIGHT = 0.11149   # metres; locked for the whole faculty

ap = argparse.ArgumentParser()
ap.add_argument('model')
ap.add_argument('out')
ap.add_argument('--size', type=int, default=1200)
ap.add_argument('--samples', type=int, default=64)
ap.add_argument('--rot', type=float, default=-16)
ap.add_argument('--cam-height', type=float, default=SET_CAMERA_HEIGHT)
ap.add_argument('--cutout', action='store_true')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

S.reset()
m = S.load_model(a.model)
objs = S.add_parts(m['parts'])
piv = bpy.data.objects.new('pivot', None)
bpy.context.scene.collection.objects.link(piv)
for o in objs.values():
    o.parent = piv
rig = S.studio(bg='EFE8DA', floor='F4EEE3')
bl = bpy.data.lights.new('backdrop', 'AREA'); bl.size = 1.5; bl.energy = 14; bl.color = (1.0, 0.93, 0.84)
bo = bpy.data.objects.new('backdrop', bl); S.aim(bo, (0, 0.55, 0.9), (0, 1.7, 0.45))
bpy.context.scene.collection.objects.link(bo)

if a.cutout:
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    rig['floor'].hide_render = True

H = a.cam_height
piv.rotation_euler = (0, 0, math.radians(a.rot))
S.camera((0.0, -0.62, H + 0.05), (0, 0, H), lens=85, fstop=8.0)
S.render(a.out, a.size, a.size, a.samples)
print('parts', len(m['parts']), '->', a.out)
