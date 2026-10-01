"""Parts list for the factory, in the BrickLink Studio export format
(BLItemNo, ElementId, LdrawId, PartName, BLColorId, LDrawColorId, ColorName,
ColorCategory, Qty, Weight) -> model/heddy-factory-bom.csv

ElementId and Weight are left blank on purpose: they are LEGO/BrickLink
catalogue data this project cannot verify offline. Studio fills both when the
model is opened and the parts list is exported (see model/factory-handoff.md).
"""
import csv, json, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', 'model')
P = json.load(open(os.path.join(MODEL, 'heddy.json')))['parts']

# LDraw colour -> (BrickLink colour id, BrickLink colour name)
COLOUR = {15: (1, 'White'), 151: (99, 'Very Light Bluish Gray'), 191: (110, 'Bright Light Orange'),
          272: (63, 'Dark Blue'), 2: (6, 'Green'), 71: (86, 'Light Bluish Gray'), 72: (85, 'Dark Bluish Gray')}

# LDraw part -> (BrickLink item no, LDraw file Studio uses, BrickLink-style name)
PART = {
    '2445': ('2445', '2445.dat', 'Plate 2 x 12'),
    '2456': ('2456', '2456.dat', 'Brick 2 x 6'),
    '2431': ('2431', '2431.dat', 'Tile 1 x 4'),
    '3001': ('3001', '3001.dat', 'Brick 2 x 4'),
    '3002': ('3002', '3002.dat', 'Brick 2 x 3'),
    '3003': ('3003', '3003.dat', 'Brick 2 x 2'),
    '3004': ('3004', '3004.dat', 'Brick 1 x 2'),
    '3005': ('3005', '3005.dat', 'Brick 1 x 1'),
    '3008': ('3008', '3008.dat', 'Brick 1 x 8'),
    '3009': ('3009', '3009.dat', 'Brick 1 x 6'),
    '3010': ('3010', '3010.dat', 'Brick 1 x 4'),
    '3622': ('3622', '3622.dat', 'Brick 1 x 3'),
    '6111': ('6111', '6111.dat', 'Brick 1 x 10'),
    '6091': ('6091', '6091.dat', 'Slope, Curved 2 x 1 x 1 1/3 with Recessed Stud'),
    '3020': ('3020', '3020.dat', 'Plate 2 x 4'),
    '3021': ('3021', '3021.dat', 'Plate 2 x 3'),
    '3022': ('3022', '3022.dat', 'Plate 2 x 2'),
    '3023': ('3023', '3023b.dat', 'Plate 1 x 2'),
    '3024': ('3024', '3024.dat', 'Plate 1 x 1'),
    '3029': ('3029', '3029.dat', 'Plate 4 x 12'),
    '3031': ('3031', '3031.dat', 'Plate 4 x 4'),
    '3032': ('3032', '3032.dat', 'Plate 4 x 6'),
    '3034': ('3034', '3034.dat', 'Plate 2 x 8'),
    '3036': ('3036', '3036.dat', 'Plate 6 x 8'),
    '3460': ('3460', '3460.dat', 'Plate 1 x 8'),
    '3623': ('3623', '3623.dat', 'Plate 1 x 3'),
    '3666': ('3666', '3666.dat', 'Plate 1 x 6'),
    '3710': ('3710', '3710.dat', 'Plate 1 x 4'),
    '3795': ('3795', '3795.dat', 'Plate 2 x 6'),
    '3832': ('3832', '3832.dat', 'Plate 2 x 10'),
    '4477': ('4477', '4477.dat', 'Plate 1 x 10'),
    # modern successor of 3794b (same shape, same function: jumper)
    '3794b': ('15573', '15573.dat', 'Plate, Modified 1 x 2 with 1 Stud with Groove and Bottom Stud Holder (Jumper)'),
    '87580': ('87580', '87580.dat', 'Plate, Modified 2 x 2 with Groove and 1 Stud in Center (Jumper)'),
    '11211': ('11211', '11211.dat', 'Brick, Modified 1 x 2 with Studs on 1 Side'),
    '30414': ('30414', '30414.dat', 'Brick, Modified 1 x 4 with Studs on 1 Side'),
    '3068b': ('3068', '3068b.dat', 'Tile 2 x 2'),
    '3069b': ('3069', '3069b.dat', 'Tile 1 x 2'),
    '3070b': ('3070', '3070b.dat', 'Tile 1 x 1'),
    '4162': ('4162', '4162.dat', 'Tile 1 x 8'),
    '63864': ('63864', '63864.dat', 'Tile 1 x 3'),
    '6636': ('6636', '6636.dat', 'Tile 1 x 6'),
    '98138': ('98138', '98138.dat', 'Tile, Round 1 x 1'),
    '25269': ('25269', '25269.dat', 'Tile, Round 1 x 1 Quarter'),
    '27925': ('27925', '27925.dat', 'Tile, Round Corner 2 x 2 Macaroni'),
    '11477': ('11477', '11477.dat', 'Slope, Curved 2 x 1 x 2/3'),
    '3961': ('3961', '3961.dat', 'Dish 8 x 8 Inverted (Radar)'),
    # currently produced version of the 6 x 6 dish (solid studs)
    '44375a': ('44375b', '44375b.dat', 'Dish 6 x 6 Inverted (Radar) - Solid Studs'),
    '4032b': ('4032', '4032b.dat', 'Plate, Round 2 x 2 with Axle Hole'),
    '60474': ('60474', '60474.dat', 'Plate, Round 4 x 4 with Hole'),
    '3403c01': ('3403c01', '3403c01.dat', 'Turntable 4 x 4 Square Base, Complete Assembly'),
}

lots = Counter((p['ldraw'], p['colour']) for p in P)
rows = []
for (ld, c), q in lots.items():
    bl, ldf, name = PART[ld]
    bc, cname = COLOUR[c]
    rows.append([bl, '', ldf, name, bc, c, cname, 'Solid Colors', q, ''])
rows.sort(key=lambda r: (r[0].zfill(8), r[4]))
out = os.path.join(MODEL, 'heddy-factory-bom.csv')
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['BLItemNo', 'ElementId', 'LdrawId', 'PartName', 'BLColorId', 'LDrawColorId', 'ColorName',
                'ColorCategory', 'Qty', 'Weight'])
    w.writerows(rows)
print(out, len(rows), 'lots', sum(r[8] for r in rows), 'pcs')
