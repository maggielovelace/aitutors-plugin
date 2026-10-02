"""Face states for a professor: the same bust with its mouth half open, open, or its eyes shut.

    python3 face_states.py <id> <half|open|blink> OUT.json

Builds prof_<id>.py with a few extra paint lines added just before its arms section, so the
model is identical to the original everywhere except the face. Rendered with the set's locked
camera, a state differs from the base render ONLY in the face pixels, so swapping images
(talking, blinking) never makes anything else flicker. This is how the introduction films,
Live Talk and the heddy.app cards animate the busts.

The mouth row sits at y 268 (Harari: 260); the eyes at y 340..372, the same for every spec.
"""
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
pid, var, out = sys.argv[1:4]
if var not in ('half', 'open', 'blink'):
    sys.exit('variant must be half, open or blink')
src = open(os.path.join(HERE, f'prof_{pid}.py')).read()
M = 260 if pid == 'harari' else 268
code = f"""
# ---- face state: {var} (tools/face_states.py)
_V = {var!r}; _M = {M}
if _V in ('half', 'open'):
    _lo = _M - (8 if _V == 'half' else 16)              # the mouth opens downward, one or two plates
    b.paint_front(lambda x, y: abs(x) <= 30 and _lo <= y <= _M + 7, MOUTH, tags=T)
    if _V == 'open':                                    # a tongue at the bottom (red if the lips are already dark red)
        b.paint_front(lambda x, y: abs(x) <= 10 and _M - 16 <= y <= _M - 9, 4 if MOUTH == 320 else 320, tags=T)
if _V == 'blink':
    for s in (-1, 1):                                   # skin over the eye, one dark lash line across it
        b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 340 <= y <= 372, SKIN, tags=T)
        b.paint_front(lambda x, y, s=s: 20 <= x * s <= 80 and 348 <= y <= 355, 0, tags=T)
"""
marker = '\n# ---------------- arms'
i = src.index(marker)
with tempfile.NamedTemporaryFile('w', suffix='.py', dir=HERE, delete=False) as f:
    f.write(src[:i] + code + src[i:])
    tmp = f.name
try:
    subprocess.run([sys.executable, tmp, out], check=True)
finally:
    os.remove(tmp)
