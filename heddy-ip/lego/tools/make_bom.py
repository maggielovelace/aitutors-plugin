"""Bill of materials + colour usage for the locked model -> model/bom.csv, model/bom.md."""
import json, os, sys, csv
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parts import CAT
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', 'model')
P = json.load(open(os.path.join(MODEL, 'heddy.json')))['parts']
# LDraw code -> (LEGO colour id, LEGO name, BrickLink name, hex, role)
COL = {15: (1, 'White', 'White', 'FFFFFF', 'body (Heddy white)'),
       151: (208, 'Light Stone Grey', 'Light Bluish Gray, Very', 'E6E3E0', 'wings'),
       191: (191, 'Flame Yellowish Orange', 'Bright Light Orange', 'F8BB3D', 'eyes, beak, feet (amber)'),
       272: (140, 'Earth Blue', 'Dark Blue', '0D325B', 'pupils (ink)'),
       2: (28, 'Dark Green', 'Green', '257A3E', 'belly star (spark green)'),
       71: (194, 'Medium Stone Grey', 'Light Bluish Gray', 'A0A5A9', 'speckles + hidden structure'),
       72: (199, 'Dark Stone Grey', 'Dark Bluish Gray', '6C6E68', 'turntable (hidden)')}
AUTHORED = {f[:-4] for f in os.listdir(os.path.join(HERE, '..', 'ldraw', 'parts'))}
rows = defaultdict(lambda: dict(qty=0, modules=Counter()))
for p in P:
    r = rows[(p['ldraw'], p['colour'])]
    r['qty'] += 1
    r['modules'][p['module']] += 1
out = sorted(rows.items(), key=lambda kv: (kv[0][1] != 15, CAT[kv[0][0]]['cat'], kv[0][0]))
with open(os.path.join(MODEL, 'bom.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['element', 'description', 'lego_colour_id', 'lego_colour', 'bricklink_colour', 'ldraw_colour', 'qty', 'used_in'])
    for (ld, c), r in out:
        cid, cname, bl, hx, role = COL[c]
        w.writerow([ld, CAT[ld]['name'], cid, cname, bl, c, r['qty'], '; '.join(f'{k} {v}' for k, v in r['modules'].most_common())])
by_col = Counter()
for p in P:
    by_col[p['colour']] += 1
md = ['# LEGO Heddy - bill of materials', '', f'**{len(P)} pieces**, {len(rows)} element/colour lots, '
      f'{len({p["ldraw"] for p in P})} designs. Full list: [`bom.csv`](bom.csv).', '',
      '| Colour (LEGO id) | Pieces | Role |', '|---|---|---|']
for c, n in by_col.most_common():
    md.append(f'| {COL[c][1]} ({COL[c][0]}) | {n} | {COL[c][4]} |')
md += ['', '| Element | Description | Colour | Qty |', '|---|---|---|---|']
for (ld, c), r in out:
    star = ' \\*' if ld in AUTHORED else ''
    md.append(f'| {ld}{star} | {CAT[ld]["name"]} | {COL[c][1]} | {r["qty"]} |')
md += ['', '\\* real LEGO element whose LDraw geometry was not in the vendored library subset; '
       'this project authored simplified geometry at the element\'s true dimensions (`ldraw/parts/`).']
open(os.path.join(MODEL, 'bom.md'), 'w').write('\n'.join(md) + '\n')
print(len(rows), 'lots')
