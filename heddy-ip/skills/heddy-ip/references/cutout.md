# Cutout register — transparent Heddy stickers

Transparent-PNG Heddy cutouts for compositing: dropped onto web pages, decks,
social layouts, video frames and thumbnails. A cutout is **pose only** — one
character, no scene, no idea, no text. If the request needs a scene or has to
explain something, it is not a cutout: route it to the editorial or explainer
register instead.

## What a cutout is

- One compositing unit: the owl, plus at most a **minimal contact fragment**
  she is actually touching (a branch fragment under her feet, a flat card
  against a wing tip). Never a whole branch-to-trunk tree, floor plane, desk
  or nearby-but-untouched object.
- **Full body, feet visible**, not cropped by the frame, with a clear
  transparent margin below the feet. Character large and centred, ~60–80% of
  frame height. Default aspect 1:1.
- **No text anywhere** — no labels, captions, numbers or watermarks. The name
  "Heddy" lives in the shot list, never in the pixels.
- Pose validated against the interaction model **before** prompting: wing tips
  carry/present/wave/point (no fingers, no grasp); feet perch, stand, or hold
  a flat card against a surface; the beak never operates props; reach is
  short. A pose the model can only achieve by inventing hands is the wrong
  pose — change the pose, not the prompt.

## Chroma-key approach

Cutouts are generated on a **flat magenta screen `#FF00FF`** — a colour
deliberately absent from Heddy's palette (paper #F8F3EB, inks #00173B /
#08203B / #3C4F62, spark #238744 / #00601F / #CEEFD3, amber #DC9400, white
#FFFFFF, wing #ECEBE5) — then keyed to alpha in post by
`scripts/generate.py --cutout`. Transparency comes from the script's key, not
from asking the model for "a transparent background" (models paint checkers,
they do not emit alpha).

Note: **Gemini image models often return a clean subject on plain ground
without a screen** — when the backend hands back an already-clean subject or a
true alpha channel, key only when needed; a needless key pass can nibble the
white body edge. The screen is the reliable fallback, not a ritual.

The screen colour must never appear ON the character or her contact fragment.
If a render shows magenta bleeding into the white body edge or the wing
grey, re-roll — do not try to key harder.

## Cutout prompt template

Build from the standard portrait template (`ip-prompt-templates.md`) with
these substitutions — `{CHARACTER}`, `{PALETTE}`, `{AVOID}` and
`{STYLE_BLOCK}` as defined there:

```text
Use case: identity-preserve
Asset type: character cutout — transparent compositing asset, NOT a scene
Input images: Image 1 is the fixed character identity reference — preserve the
character exactly; do not redesign it.
Primary request: one full-body cutout of the mascot, {pose — from the
validated pose set: welcoming wing spread / presenting a card / perched on a
branch fragment reading / gliding / pointing the way / asleep / quiet
celebration}.
Composition (contact continuity): ONLY the character{, plus the minimal
contact fragment in direct touch — show only the touched part: a short branch
fragment under the feet, a flat card against one wing tip — never a whole
tree, room or floor}. Large and centred, ~60–80% of frame height, FULL body
visible — both amber feet fully drawn, not cropped, with a clear margin below
the feet. NO environment: no horizon, no ground plane, no sky, no stars, no
nearby untouched objects, no text anywhere.
Subject: {CHARACTER}
Style/medium: {STYLE_BLOCK} — flat fills on the character and contact fragment
ONLY, never on the background.
{PALETTE} Do not use the screen colour anywhere on the character or fragment.
Background: solid flat magenta #FF00FF everywhere outside the character and
its contact fragment — perfectly uniform, no gradient, no paper grain, no cast
shadow on the screen, no vignette. The screen exists only for transparency
extraction and must not bleed onto the outline.
Constraints: identity anchors take priority; one character; one compositing
unit.
{AVOID} Also avoid: cast shadows, ground shadows, glow or outline halos
around the silhouette, cropped feet, orphaned props at a distance.
```

Then:

```bash
python3 scripts/generate.py --prompt-file <prompt.txt> --ref assets/<pack>/reference.jpg --aspect 1:1 --cutout -o <name>.png
```

## Cutout QA deltas

Run the standard QA order (`qa-checklist.md`) with these changes. The
thesis/artifact-job test and editorial register checks are **replaced** —
a cutout has no idea to carry; its job is to composite cleanly. On-model
anchors and structural integrity apply unchanged.

Must pass, in addition:

1. **True transparency** — corners are alpha, no residual screen anywhere,
   and no magenta fringe tracing the silhouette (check the white-body and
   wing-grey edges at 200%: white against magenta is the fringe-prone case).
2. **Full-body framing** — both feet fully drawn with transparent margin
   below; a foot touching the frame edge is a re-roll, not a crop fix.
3. **Contact continuity** — every opaque pixel is Heddy or in direct contact
   with her; no floating card, no branch extending into empty space beyond
   the perch, no scene furniture.
4. **One compositing unit** — reads as a sticker, not a cropped illustration
   (a visible background remnant, ground shadow or vignette edge fails this).
5. **No text** — anywhere, including on the card prop (a blank card is fine;
   a written one is not — text on props goes on in post, in the layout).
6. **Pose matches the ask** — gesture, facing and mood geometry (rest/focus/
   ready eyes) are the ones requested.

Fail signals → fix:

- Magenta bleed or halo on the outline → re-roll; confirm the Background line
  is present and `--cutout` was passed. Persistent fringe on the white edge →
  try the plain-ground route (no screen) and key only if the backend leaves
  residue.
- Cropped feet or no bottom margin → re-roll; check the Composition line
  names full body and margin explicitly.
- A shadow or ground blob under the feet → re-roll with "no cast shadow on
  the screen"; do not erase in post (it leaves a grey smear on white feet).
- A prop near but not touching her → re-roll pose-only or rebuild the contact
  through a wing tip or foot.
- A whole scene prop (full branch, desk, floor) → re-roll with "only the
  contacted fragment".
- Any failed identity anchor → repair policy from `qa-checklist.md`: one
  anchor → the identity-repair template (`ip-prompt-templates.md`), freeze
  the rest; two or more → regenerate; repeated topology failure → change the
  pose, not the prompt.
