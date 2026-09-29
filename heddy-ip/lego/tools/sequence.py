"""Assembly sequence for the locked model: modules -> steps, plus the LDraw file.

Order (heddy brief section 12): feet, lower body, internal core (turntable +
upper module built upside-down), torso (with the wings rising in the flank
layers), head structure, facial geometry, eyes, beak, finishing details.
Writes model/heddy_steps.json and model/heddy.ldr (0 STEP separated).
"""
import json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from parts import CAT

MODEL = os.path.join(HERE, '..', 'model')
m = json.load(open(os.path.join(MODEL, 'heddy.json')))
P = m['parts']
meta = m['meta']
SEAM = meta['seam_layer']

MODULES = [
    ('feet', 'Feet'),
    ('lower-body', 'Lower body'),
    ('core', 'Internal core & swivel'),
    ('torso', 'Torso & wings'),
    ('head', 'Head structure'),
    ('facial', 'Facial geometry'),
    ('eyes', 'Eyes'),
    ('beak', 'Beak'),
    ('details', 'Finishing details'),
]
MAX_STEP = 14


def angle(p):
    return math.atan2(p['pos'][0], -p['pos'][2])     # sweep starting at the back


def chunks(parts, n=MAX_STEP):
    """Split into balanced consecutive chunks of at most n."""
    if not parts:
        return []
    k = max(1, math.ceil(len(parts) / n))
    size = math.ceil(len(parts) / k)
    return [parts[i:i + size] for i in range(0, len(parts), size)]


def by_layer(parts):
    out = {}
    for p in parts:
        out.setdefault(p['layer'], []).append(p)
    return out


steps = []


def add_steps(module, title, groups, sub='main', note=None, view=None):
    for g in groups:
        steps.append(dict(n=len(steps) + 1, module=module, title=title, sub=sub, parts=[p['id'] for p in g],
                          note=note, view=view))
        note = None


layered = [p for p in P if p['layer'] is not None]
L = by_layer(layered)

# 1 feet
feet = [p for p in P if p['module'] == 'feet']
add_steps('feet', 'Feet', [sorted([p for p in feet if p['layer'] == -2], key=angle),
                           sorted([p for p in feet if p['layer'] == -1], key=angle)])

# 2 lower body: layers 0..SEAM-1
for k in range(0, SEAM):
    g = sorted([p for p in L.get(k, []) if p['sub'] == 'main'], key=angle)
    add_steps('lower-body', 'Lower body', chunks(g))
# turntable on the lower body
tt = [p for p in P if p['tag'] == 'turntable']
add_steps('core', 'Internal core & swivel', [tt], note='Turntable: the upper body can turn on its feet')

# 3 upper module, built separately and upside-down: floor first, then rings below it
floor = sorted([p for p in L.get(SEAM + 3, [])], key=angle)
add_steps('core', 'Internal core & swivel', chunks(floor), sub='upper', note='Build the upper module separately')
for k in (SEAM + 2, SEAM + 1, SEAM):
    g = sorted([p for p in L.get(k, []) if p['sub'] == 'upper' and p['tag'] != 'turntable'], key=angle)
    add_steps('core', 'Internal core & swivel', chunks(g), sub='upper',
              note='Turn the module over' if k == SEAM + 2 else None, view='under')
steps.append(dict(n=len(steps) + 1, module='core', title='Internal core & swivel', sub='attach-upper', parts=[],
                  note='Turn the module back and press it onto the turntable', view=None))

# 4/5 torso and head: layers above the upper module; SNOT and wing parts ride in their layers
placed_late = {'tuft', 'badge'}
for k in range(SEAM + 4, max(L) + 1):
    g = [p for p in L.get(k, []) if p['sub'] == 'main' and p['tag'] not in placed_late]
    if not g:
        continue
    mod = 'torso' if k < 30 else 'head'
    title = 'Torso & wings' if mod == 'torso' else 'Head structure'
    g = sorted(g, key=angle)
    add_steps(mod, title, chunks(g))

# 6 facial geometry: base plates onto the side studs, then the smooth tile skin
base = sorted([p for p in P if p['tag'] == 'face-base'], key=lambda p: (-p['pos'][1], p['pos'][0]))
add_steps('facial', 'Facial geometry', chunks(base, 8), note='Studs forward: the face is built sideways')
skin = sorted([p for p in P if p['tag'] == 'face-tile'], key=lambda p: (-p['pos'][1], p['pos'][0]))
add_steps('facial', 'Facial geometry', chunks(skin, 10))

# 7 eyes: surround (spacers) -> iris -> pupil -> highlight, big eye first
for name in ('L', 'R'):
    sp = [p for p in P if p['tag'] == f'eye{name}-spacer']
    iris = [p for p in P if p['tag'] == f'eye{name}-iris']
    pupil = [p for p in P if p['tag'] == f'eye{name}-pupil']
    ptiles = [p for p in P if p['tag'] == f'eye{name}-pupil-tile']
    hl = [p for p in P if p['tag'] == f'eye{name}-highlight']
    lab = 'left (larger) eye' if name == 'L' else 'right eye'
    add_steps('eyes', 'Eyes', [sp + iris], note=f'The {lab}: iris')
    add_steps('eyes', 'Eyes', [pupil + ptiles])
    add_steps('eyes', 'Eyes', [hl], note='One highlight, upper right')

# 8 beak
beak = [p for p in P if p['module'] == 'beak']
add_steps('beak', 'Beak', [beak[:2], beak[2:]], note='Turn the square 45 degrees on the single centre stud')

# 9 details: badge, tuft
badge = [p for p in P if p['tag'] == 'badge']
tuft = [p for p in P if p['tag'] == 'tuft']
add_steps('details', 'Finishing details', [badge], note='Two squares, 45 degrees apart: the eight-point star')
add_steps('details', 'Finishing details', [tuft], note='One soft tuft')

# sanity: every part appears exactly once
seen = [i for s in steps for i in s['parts']]
missing = set(range(len(P))) - set(seen)
dupes = len(seen) - len(set(seen))
assert not dupes, dupes
if missing:
    extra = sorted(missing)
    raise SystemExit(f'unsequenced parts: {[(P[i]["ldraw"], P[i]["module"], P[i]["layer"], P[i]["tag"]) for i in extra[:20]]}')

json.dump(dict(steps=steps, modules=MODULES), open(os.path.join(MODEL, 'heddy_steps.json'), 'w'), indent=0)

# ---------------------------------------------------------------- LDraw export
T = np.diag([1.0, -1.0, -1.0])
lines = ['0 LEGO Heddy - desk sculpture', '0 Name: heddy.ldr', '0 Author: heddy-lego project',
         '0 !LICENSE Model: see repository licence; part geometry LDraw.org CC BY 4.0', '0 // units: LDU, -y up',
         f'0 // {len(P)} parts, {len(steps)} steps', '']
cur_mod = None
for s in steps:
    if s['module'] != cur_mod:
        cur_mod = s['module']
        lines.append(f'0 // ===== {dict(MODULES)[cur_mod]} =====')
    if s['note']:
        lines.append(f"0 // {s['note']}")
    for i in s['parts']:
        p = P[i]
        R = T @ np.array(p['R']) @ T
        t = T @ np.array(p['pos'])
        v = [t[0], t[1], t[2]] + list(R.reshape(-1))
        lines.append('1 %d %s %s.dat' % (p['colour'], ' '.join(('%.4f' % x).rstrip('0').rstrip('.') for x in v),
                                          p['ldraw']))
    lines.append('0 STEP')
open(os.path.join(MODEL, 'heddy.ldr'), 'w').write('\n'.join(lines) + '\n')
print('steps', len(steps), 'parts', len(seen))
