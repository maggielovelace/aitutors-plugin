"""Copy the LDraw part files used by the catalogue (and their sub-files) from an
extracted LDraw library into ../ldraw/lib. Source used for this project: the
official-library packed models shipped in the npm package
@gjsify/example-dom-three-loader-ldraw (LDraw.org parts, CC BY 4.0)."""
import os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parts import CAT
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lib'
here = os.path.dirname(os.path.abspath(__file__))
dst = os.path.join(here, '..', 'ldraw', 'lib')
authored = os.path.join(here, '..', 'ldraw', 'parts')


def find(n):
    n = n.strip().replace('\\', '/').lower()
    for c in [n, 'parts/' + n, 'p/' + n]:
        if os.path.exists(os.path.join(src, c)):
            return c


need, stack = set(), []
for k in CAT:
    a = os.path.join(authored, f'{k}.dat')
    if os.path.exists(a):
        stack += [' '.join(l.split()[14:]) for l in open(a) if l.split()[:1] == ['1']]
    else:
        stack.append(f'parts/{k}.dat')
while stack:
    n = stack.pop()
    c = find(n)
    if c is None:
        print('MISSING', n)
        continue
    if c in need:
        continue
    need.add(c)
    for l in open(os.path.join(src, c), encoding='latin-1'):
        t = l.split()
        if t and t[0] == '1' and len(t) >= 15:
            stack.append(' '.join(t[14:]))
for c in need:
    os.makedirs(os.path.dirname(os.path.join(dst, c)), exist_ok=True)
    shutil.copy(os.path.join(src, c), os.path.join(dst, c))
print('vendored', len(need), 'files')
