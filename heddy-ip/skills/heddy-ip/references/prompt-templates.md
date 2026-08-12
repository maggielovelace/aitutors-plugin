# Prompt templates — Mode A (content illustration)

Workflow and master prompt for turning a piece of content (blog post, feature announcement, social thread) into a set of Heddy illustrations. Structures and pose rules live in `composition-patterns.md`; identity in `heddy-dna.md`; the rendition look in `style-dna.md`; sizes in `social-formats.md`; QA in `qa-checklist.md`.

## Mode A workflow

1. **Digest the content.** Read the whole piece. State its thesis in one sentence — the claim the images must serve, not a side anecdote.
2. **Pick 3–6 cognitive anchors.** An anchor is a relationship the reader must *hold in mind* to follow the piece — never one image per paragraph, never an illustration of a passing example. Fewer, load-bearing images beat many decorative ones. For a short social post, one anchor (the thesis) is usually right.
3. **Write the shot list FIRST.** No prompting before every shot has all seven fields:
   - **Placement** — where it lands (hero, after §2, story card 3…), which fixes its job.
   - **Core idea** — the ONE relationship this image must make visible, in one sentence.
   - **Structure** — exactly one of the six in `composition-patterns.md`.
   - **Heddy's action** — the physical move, already passed through the pose feasibility gate (wing tips point/present/carry, feet perch/hold-flat; no grasp, no beak props).
   - **Key objects** — 1–2 from Heddy's object world; check the fresh-metaphor rule against every other shot and prior deliveries.
   - **Label words** — ≤6 short labels, ≤3 for editorial scenes; English-only for en-market assets (S3). Heddy's name goes in captions, never in label words.
   - **Aspect** — per `social-formats.md` (16:9 blog hero, 1:1 feed, 4:5 portrait, 9:16 story).
4. **Generate ONE image per anchor** via `scripts/generate.py`, conditioning on the active pack's reference sheet with `--ref`:

   ```
   python3 scripts/generate.py --prompt-file prompts/<slug>-01.txt \
     --ref assets/<pack>/reference.jpg --aspect 16:9 -o out/<slug>-01.png
   ```

   The pack is expressed through the `--ref` sheet and the `{STYLE_BLOCK}` in
   the prompt — there is no pack flag on the script.

   Never batch several shots into one canvas. Each image is a standalone generation with its own filled template.
5. **QA each image** in `qa-checklist.md` order (thesis test first, labels covered). Repair policy: 1 failed anchor → local edit; ≥2 → regenerate; repeated topology failure → change the pose, not the prompt.

## Master prompt template

Fill every `{SLOT}`. The prompt describes Heddy **by design, never by name** — models render descriptions, not proper nouns. `{STYLE_BLOCK}` comes from `style-dna.md` for the active rendition (heddy-flat or heddy-storybook); do not improvise style language outside it.

```text
Generate one standalone {ASPECT} illustration.

Visual direction:
{STYLE_BLOCK}
Palette, exactly and only: warm paper #F8F3EB (and #F1EDE0), deep ink #00173B / #08203B / soft ink #3C4F62, spark green #238744 (deep #00601F, soft #CEEFD3), amber #DC9400, character white #FFFFFF with #ECEBE5 wing tone. Colour semantics: amber for warmth, attention, the moon, beak and feet; spark green only for progress and success marks; ink for structure and night; white is reserved for the character.

Recurring character:
Preserve the exact identity in the supplied reference sheet: a small round snowy owl with a soft plump white body, a tiny head-fluff tuft on top, two short pale-grey side wings held close to the body, and two small amber elliptical feet. Signature ASYMMETRIC eyes: the LEFT eye is noticeably larger than the right (roughly 13.5 : 11 iris ratio), each an amber iris with an ink pupil about half the iris and exactly ONE white highlight at the upper right. A subtle double-ring facial disc frames the face. The beak is a small amber DIAMOND (a rotated square), not a hooked raptor beak. No eyebrows, no nose, no blush. A small spark-green eight-point star badge sits on the belly, and faint low-opacity ink speckles dust the head and flanks. Mood: {MOOD — focus: eyes open as specified / rest: both eyes closed as downward arcs, a pair of italic serif "z" glyphs floating upper-right, the nearer larger / ready: two happy upward ^^ arc eyes}. {WARDROBE — optional, only if asked: grad cap / reading glasses / bobble hat / wizard hat / scarf / explorer satchel}. The character is calm, warm and quietly attentive — a welcoming guide, never a teacher. It must perform the key conceptual action, not decorate the scene. Contact rules: wing tips may carry, present, wave or point but never grasp; feet may perch, stand, or hold a flat card against a surface; the beak never touches props.

Theme: {THEME — what this image accompanies}
Core idea: {the ONE relationship the reader must see}
Structure: {before-after / input-transform / bottleneck-feedback / layered build / route-choice / 2-3 panel mini-comic}
Composition: {the character's position, its exact physical action, the 1-2 key objects, and how the information reads}
Labels: {label 1} / {label 2} / {label 3 — ≤6 short English words or phrases, or "none"}

Constraints:
One core concept only. Character plus key object within 40-60% of the canvas; at least one third negative space. At most six short labels in ink on bare ground, never written on the character's body. Amber and spark green each on at most two elements.

Avoid:
generic cartoon owl; realistic raptor (sharp hooked beak, talon detail, fierce brow); symmetric same-size eyes; eyebrows; a nose; blush marks; extra colours beyond the stated palette; Duolingo-style mascot look; gradients, glossy 3D, drop shadows, photo textures; blackboards, whiteboards, marking pens or anything framing the character as a teacher; crisis or distress imagery; text on the character's body; fingers or hands on the wings; the beak holding anything; a line or object passing through the character's body; extra, doubled or floating limbs; polished vector infographic, PPT slide, formal flowchart, legend, border or title bar.
```

Register variants:

- **Editorial scene** (default): the template as-is. ≤3 labels.
- **Explainer**: add to Composition — "a hand-built structure of at most 5 stations with one main flow direction and at most one return leg; the character is a working part of the structure, not a presenter beside it." Labels budget rises to ≤6 callouts. Still no borders, grids, legends or boxed titles.
- **Cutout**: do not use this template — route to `cutout.md`.
- **Reel**: Phase 4 — route to `motion-dna.md`.

## Local-edit template

For a single failed anchor (see repair policy). Change one thing; freeze the rest.

```text
Edit the supplied illustration. Change only {the named element — e.g. the right eye's size, one label's spelling, the lantern's colour}. Preserve everything else exactly: the background, the aspect ratio, the white owl character and both its asymmetric eyes and diamond beak, the line style, the composition, all other labels, and the image quality. Do not add a title, new objects, shadows, or any extra text.
```

If the edit touches the face interior, re-run the on-model face checks from `qa-checklist.md` at full-resolution crop before delivering.
