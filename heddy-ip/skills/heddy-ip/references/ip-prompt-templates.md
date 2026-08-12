# Heddy IP prompt templates (Mode B — brand IP extension)

Templates for identity-locked IP assets: reference sheets, turnarounds, wardrobe,
3D conversions, style transfers, co-brands and repairs. One asset per generation.
Every template states the role of each input image explicitly — the model must
never be left to guess whether an image is identity, style, scene or edit target.

Rules that bind every template below:

- **Describe Heddy by design, never by name.** Models render descriptions, not
  proper nouns. "Heddy" lives in captions and shot lists only.
- **Image 1 is always the fixed identity reference** (the frozen reference set,
  S5). It conditions *shape and identity*; it is never a style or scene licence.
- **Priority ladder on conflict:** identity anchors → the user's current explicit
  instruction (variables only) → task structure → style/decoration. Only "create
  a new character" unlocks the anchors.
- **`{STYLE_BLOCK}`** is the rendition slot — fill from `style-dna.md`:
  heddy-flat (product-exact SVG look) or heddy-storybook (social illustration
  look, direction pending owner decision D1). Same DNA either way.
- Reference sheets (turnaround, expressions, poses) are internal production
  assets: small English labels are allowed there. Everything else: no text.

## The character block (paste wherever `{CHARACTER}` appears)

```text
one round soft snowy owl character: plump rounded white body (#FFFFFF), a small
head-fluff tuft on top, two short pale side wings (#ECEBE5) held close to the
body, two small amber (#DC9400) elliptical feet. Face: a subtle facial-disc
double outline, NO eyebrows, NO nose; the beak is a small amber DIAMOND (a
rotated square), never a hooked raptor beak. Eyes are deliberately ASYMMETRIC —
the left iris is visibly larger than the right (13.5 : 11, about 1.23:1), round amber
(#DC9400) irises, deep-ink pupils about half the iris, and exactly ONE small
white highlight in the upper-right of each eye. On the belly sits a small
spark-green (#238744) eight-point star badge; faint low-opacity ink snow
speckles dust the head and flanks.
```

## The palette line (paste wherever `{PALETTE}` appears)

```text
Colour palette (exact, no additions): paper #F8F3EB, paper-2 #F1EDE0, ink-deep
#00173B, ink #08203B, ink-soft #3C4F62, spark green #238744 (deep #00601F,
soft #CEEFD3), amber #DC9400, body white #FFFFFF, wing #ECEBE5. Amber =
warmth/attention/moon/beak/feet; spark green = progress/success/badge; ink =
structure/night; white = the owl.
```

## The standard Avoid list (extend per template, never shorten)

```text
Avoid: generic cartoon owl, Duolingo-adjacent styling, realistic raptor (sharp
hooked beak, talon detail, fierce brow), symmetric matched eyes, eyebrows, a
nose, cheek blush, extra colours beyond the stated palette, teaching props
(whiteboard, pointer, lectern, marking pen) that frame her as a tutor, crisis
or distress scenes, text written on her body, logos, watermarks.
```

---

## Standard portrait

```text
Use case: identity-preserve
Asset type: brand mascot standard character portrait
Input images: Image 1 is the fixed character identity reference — preserve the
character exactly; do not redesign it.
Primary request: create one polished full-body illustration of the mascot
{doing what — a pose validated against the interaction model: wings and feet
are the only contact surfaces, the beak never operates props}.
Scene/backdrop: minimal warm paper background #F8F3EB with generous breathing
room, or {scene: oak branch / library perch / observatory with amber moon and
stars on ink}.
Subject: {CHARACTER}
Style/medium: {STYLE_BLOCK}
Composition/framing: full body, feet visible, centred, generous padding.
Lighting/mood: warm, calm, quietly encouraging — quiet joy, never fanfare.
{PALETTE}
Constraints: character identity takes priority over every other instruction;
exactly one character; the asymmetric eyes, diamond beak, belly star badge and
head tuft must all be present; no text, logo or watermark.
{AVOID}
```

## Three-view turnaround (front / side / back)

```text
Use case: identity-preserve
Asset type: character model sheet — three-view turnaround
Input images: Image 1 is the fixed character identity reference — this sheet
documents that exact character; do not redesign it.
Primary request: one reference sheet showing the SAME character three times in
a row on one plain background: front view, side (profile) view, back view.
Identical height, identical body proportions, identical head-to-body ratio in
all three views, standing neutral, wings relaxed at the sides.
Subject: {CHARACTER} Side view: the round silhouette and head tuft read in
profile, one wing visible, the near eye keeps its amber iris and single
highlight. Back view: white back, both wing shapes visible from behind, tuft
on top, no face.
Scene/backdrop: plain paper #F8F3EB, no scene, no props. Small English labels
"front / side / back" beneath each view are allowed; no other text.
Style/medium: {STYLE_BLOCK}
{PALETTE}
Constraints: three views of ONE identity, not three characters; proportions
must match across views; the front view is the authority for the face — left
iris larger than right, one highlight per eye, diamond beak, no brows, no nose.
{AVOID} Also avoid: differing sizes between views, three-quarter views
replacing the requested angles, a face drawn on the back view.
```

## Expression sheet (moods + celebration states)

```text
Use case: identity-preserve
Asset type: character expression sheet — labelled grid
Input images: Image 1 is the fixed character identity reference — every cell
shows this exact character; only the eyes and small posture cues change.
Primary request: one labelled grid, six cells, same full-body character in
each, identical proportions and palette. Only the geometry below varies:
  1. "rest" — both eyes closed as smooth downward arcs; a small italic serif
     "z" floats upper-right of the head (a second smaller "z" above it).
  2. "focus" — the standard open eyes: asymmetric amber irises (left larger),
     ink pupils, one upper-right white highlight each.
  3. "ready" — happy ^^ eyes: each eye a single clean upward arc, no iris.
  4. "level-up" — ready ^^ eyes; a small round medallion presented beside
     her (floating at a wing tip or held flat by a foot); 3–5 small
     spark-green eight-point sparkles near her head.
  5. "first-card" — ready ^^ eyes; one flat blank card presented at a wing
     tip or held under a foot against a surface; at most 3 spark-green
     sparkles.
  6. "mastery" — ready ^^ eyes; a tiny hop, both feet just off the ground,
     body otherwise unchanged; at most 3 spark-green sparkles. Quiet joy in
     every celebration cell — never fanfare, confetti storms or open-beak
     cheering.
Subject: {CHARACTER}
Scene/backdrop: plain paper #F8F3EB grid, thin ink dividers. One small English
label per cell (the names above); no other text.
Style/medium: {STYLE_BLOCK}
{PALETTE}
Constraints: expressions are GEOMETRIC specs, not moods — draw exactly the eye
shapes stated; the diamond beak, badge and tuft persist in every cell; no
eyebrows or mouth curves added to carry emotion.
{AVOID} Also avoid: teary eyes, sparkle-anime eyes, open shouting beak,
emoji-style effects, differing body sizes between cells.
```

## Pose sheet

```text
Use case: identity-preserve
Asset type: character pose sheet — labelled grid
Input images: Image 1 is the fixed character identity reference — every cell
shows this exact character; do not redesign it.
Primary request: one labelled grid, seven cells, the same full-body character
in each. Poses (each already validated against the interaction model — wing
tips carry/present/wave/point with NO fingers and NO grasp; feet perch, stand,
or hold a flat card against a surface; the beak never operates props; reach is
short, wings contact close beside the body):
  1. "welcome" — both wings spread open in greeting, focus eyes.
  2. "presenting" — one wing tip presenting a small flat card outward, the
     card resting against the wing tip, never gripped.
  3. "perched reading" — perched on an oak-branch fragment, feet curled over
     it, looking down at a flat card held under one foot against the branch.
  4. "gliding" — mid-flight, wings out, body horizontal, feet tucked.
  5. "pointing the way" — one wing tip extended to the side, body angled the
     same direction, ready eyes.
  6. "asleep" — rest eyes (closed downward arcs), the floating italic "z"
     pair, body settled low.
  7. "quiet celebration" — a small hop, ready eyes, wings lifted slightly.
Subject: {CHARACTER}
Scene/backdrop: plain paper #F8F3EB grid, thin ink dividers, only the minimal
contact fragments named above (a branch fragment, a card). One small English
label per cell; no other text.
Style/medium: {STYLE_BLOCK}
{PALETTE}
Constraints: identity anchors persist in every pose; wings stay short and
rounded — never stretched into arms; no fingers, hands or grasping; props
touch only wing tips or feet.
{AVOID} Also avoid: long articulated wing-arms, held pens or pointers,
props merged into the body, poses that require grip.
```

## Wardrobe render (Ladder shop items)

```text
Use case: identity-preserve
Asset type: character wardrobe render
Input images: Image 1 is the fixed character identity reference — preserve the
character exactly; add only the named wardrobe item(s).
Primary request: the mascot wearing {item(s) from the Ladder set ONLY: grad
cap, reading glasses, bobble hat, wizard hat, scarf, explorer satchel},
{pose — validated against the interaction model}.
Subject: {CHARACTER} The wardrobe item sits ON the body and follows its round
silhouette: hats perch around the head tuft (the tuft may poke through or
flatten under the brim), glasses sit on the facial disc without hiding the
asymmetric eyes, the scarf wraps the neck, the satchel strap crosses the body
without covering the belly star badge.
Scene/backdrop: minimal paper #F8F3EB, or {scene: oak branch / library perch /
observatory}.
Style/medium: {STYLE_BLOCK}
{PALETTE} Wardrobe items use only these same hexes.
Constraints: the item is additive — nothing under it is redesigned; eyes, beak,
badge and speckles all remain visible or plausibly occluded, never removed;
one character; no text or watermark.
{AVOID} Also avoid: new accessory colours, branded clothing, shoes or gloves
(she has bare amber feet and wing tips), items that frame her as the teacher
(mortarboard is fine as celebration; a pointer or marking pen is not).
```

## 3D soft-vinyl conversion

```text
Use case: identity-preserve
Asset type: collectible 3D character render
Input images: Image 1 is the fixed character identity reference — preserve the
character; do not redesign it.
Primary request: convert the fixed mascot into a collectible 3D interpretation.
Change ONLY volume, material and lighting.
Subject: preserve the round white snowy-owl silhouette, head tuft, short pale
side wings, amber elliptical feet, ASYMMETRIC amber eyes (left larger, one
highlight each), amber diamond beak, spark-green eight-point belly badge and
faint snow speckles.
Style/medium: matte soft vinyl with a fine frosted texture and the gentlest
surface sheen; flat printed-on face and badge (eyes, beak, badge and speckles
read as clean surface print, not sculpted holes).
Scene/backdrop: warm paper-white seamless studio background #F8F3EB.
Composition/framing: full body, centred, simple three-quarter view, generous
padding, restrained soft contact shadow.
Lighting/mood: soft studio lighting, warm and calm.
{PALETTE}
Constraints: proportions and every identity anchor unchanged; the eye asymmetry
survives the conversion; no text or watermark.
{AVOID} Also avoid: fur, feather sculpting, plush/knit fabric, glass, metal,
realistic taxidermy owl, glossy toy-photo glare, complex scenery.
```

## Style transfer

```text
Use case: style-transfer
Input images: Image 1 is the character identity and composition reference.
Image 2 is ONLY the visual-language reference — line quality, material,
texture, palette restraint and atmosphere. Nothing else transfers.
Primary request: render the same character and the same action from Image 1
using Image 2's visual language.
Constraints: preserve Image 1's silhouette logic, head tuft, asymmetric eyes
(left larger, one highlight each), diamond beak, wing and foot proportions,
belly star badge and the action. Transfer only visual language from Image 2.
Do not copy Image 2's characters, body shapes, facial identity, signature
props or any protected design (S4: style transfer moves visual language only —
never another studio's character). Keep the brand palette dominant: paper
#F8F3EB, ink #08203B / #00173B, spark green #238744, amber #DC9400, white
#FFFFFF, wing #ECEBE5 — borrow Image 2's restraint and texture, not new hues.
No extra elements, text or watermark.
{AVOID}
```

## Co-brand (two identities, one scene)

```text
Use case: stylized-concept
Asset type: IP collaboration illustration
Input images: Image 1 is the fixed identity reference for the snowy-owl
mascot. Image 2 is the collaborating character's identity reference. Each
image locks its OWN character only.
Primary request: place both characters in one shared scene where they {shared
action — the owl welcomes, celebrates, lights the way or hands over; she never
teaches or demonstrates at the partner}.
Scene/backdrop: {scene}.
Style/medium: one coherent visual language based on {whose style rules govern
the shared scene}; each character keeps its own construction inside it.
Composition/framing: both characters clearly separated, equally readable, no
overlap of bodies.
{PALETTE} The partner character keeps its own palette; shared scene elements
follow the governing style.
Constraints: preserve each character's own silhouette, facial identity and
signature symbols — for the owl that means the asymmetric eyes, diamond beak,
head tuft, belly star badge, amber feet. Share only line language, lighting,
palette logic and scene treatment. Never merge bodies, swap features, or dress
one character in the other's marks. No text or watermark. Only proceed when
the collaboration is licensed — S4 forbids rendering protected IP without it.
{AVOID}
```

## Identity repair (local edit)

```text
Use case: precise-object-edit
Input images: Image 1 is the edit target (the failed render). If provided,
Image 2 is the fixed identity reference showing the correct design of the
failed anchor.
Primary request: fix ONLY {the failed anchor — e.g. "the eyes: make the left
iris visibly larger than the right, one white upper-right highlight each, no
eyebrows" / "the beak: replace with a small amber #DC9400 diamond" / "the
belly: restore the spark-green #238744 eight-point star badge"} so it matches
the fixed character DNA.
Constraints: change only {the failed anchor}; preserve the current pose,
composition, background, silhouette, colours, texture and every unaffected
element exactly. Do not add characters, props or text.
Repair policy (from qa-checklist.md): use this template for ONE failed anchor
only — freeze everything else. Two or more failed anchors → regenerate from
the portrait/pose template instead. Repeated topology failure → change the
pose, not the prompt.
```
