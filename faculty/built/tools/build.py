"""Build (and optionally render) the brick-built faculty.

    python3 faculty/built/tools/build.py all                  # rebuild every model (.json + .ldr)
    python3 faculty/built/tools/build.py pi --render          # rebuild Pi and render renders/pi.png
    python3 faculty/built/tools/build.py all --render --cutout   # also renders/cutout/<id>.png
    python3 faculty/built/tools/build.py pi --faces              # renders/faces/pi-{half,open,blink}.png

Building needs only Python 3. Rendering needs a Python 3.11 with `bpy` (Blender as a module);
point BPY_PYTHON at it, e.g.  BPY_PYTHON=~/bpyenv/bin/python
"""
import argparse, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILT = os.path.dirname(HERE)
FACULTY = ['pi', 'newton', 'curie', 'darwin', 'quill', 'harari', 'mercator', 'mentor']

ap = argparse.ArgumentParser()
ap.add_argument('who', help="a professor id, or 'all'")
ap.add_argument('--render', action='store_true')
ap.add_argument('--cutout', action='store_true', help='also render a transparent cutout')
ap.add_argument('--faces', action='store_true', help='also render the half / open / blink face states as cutouts (renders/faces/)')
ap.add_argument('--samples', type=int, default=64)
a = ap.parse_args()

ids = FACULTY if a.who == 'all' else [a.who]
bpy_python = os.environ.get('BPY_PYTHON') or ''
if (a.render or a.cutout or a.faces) and not bpy_python:
    sys.exit('Set BPY_PYTHON to a Python 3.11 that has `pip install bpy` (see faculty/built/README.md).')

for pid in ids:
    spec = os.path.join(HERE, f'prof_{pid}.py')
    if not os.path.exists(spec):
        sys.exit(f'no spec: {spec}')
    model = os.path.join(BUILT, 'model', f'{pid}.json')
    subprocess.run([sys.executable, spec, model], check=True)
    if a.render:
        subprocess.run([bpy_python, os.path.join(HERE, 'render_bust.py'), model,
                        os.path.join(BUILT, 'renders', f'{pid}.png'), '--samples', str(a.samples)], check=True)
    if a.cutout:
        subprocess.run([bpy_python, os.path.join(HERE, 'render_bust.py'), model,
                        os.path.join(BUILT, 'renders', 'cutout', f'{pid}.png'), '--samples', str(a.samples),
                        '--cutout'], check=True)
    if a.faces:
        os.makedirs(os.path.join(BUILT, 'renders', 'faces'), exist_ok=True)
        for v in ('half', 'open', 'blink'):
            tmp = os.path.join(BUILT, 'model', f'{pid}-{v}.json')
            subprocess.run([sys.executable, os.path.join(HERE, 'face_states.py'), pid, v, tmp], check=True)
            subprocess.run([bpy_python, os.path.join(HERE, 'render_bust.py'), tmp,
                            os.path.join(BUILT, 'renders', 'faces', f'{pid}-{v}.png'), '--samples', str(a.samples), '--cutout'], check=True)
            for ext in ('.json', '.ldr'):
                if os.path.exists(tmp[:-5] + ext): os.remove(tmp[:-5] + ext)
