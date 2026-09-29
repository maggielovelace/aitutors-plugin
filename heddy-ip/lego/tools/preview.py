import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene as S
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/prev'
views = sys.argv[2].split(',') if len(sys.argv) > 2 else ['front', 'q', 'side', 'back']
S.reset()
m = S.load_model()
import bpy, math
objs = S.add_parts(m['parts'])
piv = bpy.data.objects.new('pivot', None)
bpy.context.scene.collection.objects.link(piv)
for o in objs.values():
    o.parent = piv
S.studio()
tgt = (0, 0, 0.105)
# the camera stays in front of the sweep; the model turns (like a turntable shoot)
views_def = {'front': (0, (0, -0.75, 0.12)), 'q': (-35, (0, -0.72, 0.24)), 'side': (-90, (0, -0.75, 0.12)),
             'back': (180, (0, -0.75, 0.12)), 'left': (90, (0, -0.75, 0.12)), 'top': (0, (0, -0.3, 0.75)),
             'low': (-20, (0, -0.65, 0.03))}
for v in views:
    rot, loc = views_def[v]
    piv.rotation_euler = (0, 0, math.radians(rot))
    S.camera(loc, tgt, lens=70)
    t = time.time()
    S.render(f'{out}/{v}.png', 640, 640, 16)
    print(v, time.time() - t)
