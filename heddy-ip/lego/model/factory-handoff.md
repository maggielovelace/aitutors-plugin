# LEGO Heddy — factory handoff / 工厂交接说明

**English** · [中文](#中文)

## What to send

| File | Purpose |
|---|---|
| [`heddy-factory-bom.csv`](heddy-factory-bom.csv) | Parts list in the BrickLink Studio export format the factory uses: 94 lots, 1,446 pieces |
| [`heddy.ldr`](heddy.ldr) | The model, with every part placed. Opens in BrickLink Studio, LDCad and LeoCAD |
| [`../instructions/heddy-lego-instructions.pdf`](../instructions/heddy-lego-instructions.pdf) | 82-page, 148-step building instructions |
| [`validation.md`](validation.md) | Engineering checks: collisions, connections, build order, stability |

## Before the file goes out

1. **Fill ElementId and Weight with Studio.** Both columns are blank in the CSV. They are
   LEGO/BrickLink catalogue data that could not be verified when the file was generated.
   Open `heddy.ldr` in BrickLink Studio, then use *Export → Parts list (CSV)*. That produces the
   same columns with Element IDs and weights filled from the live catalogue. Compare its
   piece count with this CSV: it must be 1,446.
2. **Turntable.** `3403c01` is the classic 4 × 4 square-base turntable. If the factory only
   makes the locking turntable (`61485c01`), its height must be checked against the model.
   The swivel's clearance was designed for a 1-brick-high turntable.
3. **Updated part numbers.** Two parts were switched to the versions in production today, with the same
   shape and function: the 1 × 2 jumper `3794b` → `15573`, and the 6 × 6 dish `44375a` → `44375b`.
4. **Colours a third-party factory moulds to order.** These element/colour pairs may not
   exist in the LEGO catalogue, so they need moulding in the specified colour rather than
   sourcing:
   - Dish 8 × 8 (`3961`) and Dish 6 × 6 (`44375b`) in Bright Light Orange: these are the eyes
   - Round plate 4 × 4 (`60474`), macaroni tile (`27925`) and quarter tile (`25269`) in Dark Blue: these are the pupils
5. **Colour match.** Heddy's brand colours are matched to these BrickLink colours:
   - amber `#DC9400` → Bright Light Orange (110)
   - pupils `#00173B` → Dark Blue (63)
   - wings `#ECEBE5` → Very Light Bluish Gray (99)
   - star `#238744` → Green (6)

   If the factory can mould custom colours, sending the brand hex values gives a closer match.
   Bright Light Orange is the largest gap (ΔE 10.3).
6. **Build one physical prototype before mass production.** The model passed digital checks.
   Clutch strength in a factory's own moulds is not something a digital check can confirm,
   especially for the 1.5 kg upper body on one turntable and the face panel held by
   side-stud bricks.

## Naming and IP

The product must not be called "LEGO" or use LEGO branding. LEGO is a trademark of the LEGO
Group. Use wording such as "brick-built Heddy" or "Heddy building set". The Heddy character
is aitutors.me brand IP (see `LICENSE`).

---

## 中文

### 要交给工厂的文件

| 文件 | 用途 |
|---|---|
| [`heddy-factory-bom.csv`](heddy-factory-bom.csv) | 零件清单，采用工厂使用的 BrickLink Studio 导出格式：94 个品类，共 1,446 块 |
| [`heddy.ldr`](heddy.ldr) | 模型文件，每块零件的位置都已摆好；可用 BrickLink Studio、LDCad、LeoCAD 打开 |
| [`../instructions/heddy-lego-instructions.pdf`](../instructions/heddy-lego-instructions.pdf) | 82 页、148 步拼装说明书 |
| [`validation.md`](validation.md) | 工程校验：碰撞、连接、拼装顺序、稳定性 |

### 发出前要做的事

1. **用 Studio 补齐 ElementId 和 Weight。** CSV 里这两列是空的：它们属于乐高/BrickLink
   目录数据，生成文件时无法核实。用 BrickLink Studio 打开 `heddy.ldr`，选择
   *导出 → 零件清单（CSV）*，会得到同样的列，元素编号和重量都由在线目录填好。
   核对总数必须是 1,446 块。
2. **转盘。** `3403c01` 是经典的 4 × 4 方底转盘。如果工厂只生产带锁定的转盘
   （`61485c01`），需要核对它的高度：转身结构的间隙是按 1 块砖高的转盘设计的。
3. **已换成现产编号的零件。** 有两种零件已换成目前在产的版本，形状和功能相同：
   1 × 2 跳板 `3794b` → `15573`，6 × 6 碟 `44375a` → `44375b`。
4. **需要按指定颜色开模的零件。** 以下零件和颜色的组合在乐高目录里可能不存在，
   需要按指定颜色注塑，不能指望现货：
   - 亮浅橙色（Bright Light Orange）的 8 × 8 碟（`3961`）和 6 × 6 碟（`44375b`）：这是眼睛
   - 深蓝色（Dark Blue）的 4 × 4 圆板（`60474`）、马卡龙砖片（`27925`）、四分之一圆砖片（`25269`）：这是瞳孔
5. **颜色匹配。** 海迪的品牌色已对应到下面的 BrickLink 颜色：
   - 琥珀 `#DC9400` → Bright Light Orange（110）
   - 瞳孔 `#00173B` → Dark Blue（63）
   - 翅膀 `#ECEBE5` → Very Light Bluish Gray（99）
   - 星 `#238744` → Green（6）

   如果工厂能定制颜色，直接给品牌色值会更准。差距最大的是琥珀色（ΔE 10.3）。
6. **量产前先做一台实物样品。** 模型通过了数字校验，但工厂模具的实际咬合力只能实物
   验证，尤其是 1.5 kg 的上半身只靠一个转盘支撑，以及靠侧凸点砖固定的脸板。

### 命名与知识产权

产品不能叫"LEGO/乐高"，也不能使用乐高的品牌标识（LEGO 是乐高集团的商标），可以用
"积木海迪""海迪拼装套装"这类说法。海迪这个角色是 aitutors.me 的品牌知识产权（见 `LICENSE`）。
