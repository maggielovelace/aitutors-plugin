---
name: heddy-ip
description: >-
  Use when the user mentions "Heddy", "heddy image", the aitutors.me owl or
  mascot, "social image", "blog illustration", "reel", "cutout", "sticker",
  "brand IP", "expression sheet", or wants marketing/social art featuring the
  brand character (zh: 海迪 / 猫头鹰). One snowy-owl character, identity
  governed: generates, edits, and extends Heddy assets — editorial scenes,
  explainer diagrams, transparent cutouts, and (later) reels — while keeping
  the same character identity in every image. Never a generic owl generator.
version: 0.1.0
author: Jason (aitutors.me)
license: "proprietary — internal aitutors.me brand IP, do not redistribute"
metadata:
  hermes:
    tags: [illustration, mascot, brand, image-generation, aitutors]
    category: creative
    requires_toolsets: [terminal]
  openclaw:
    emoji: "🦉"
    homepage: https://aitutors.me
    os: [macos, linux]
    requires:
      bins: [python3]
required_environment_variables:
  - GEMINI_API_KEY
---

# Heddy IP & Brand Illustration

Heddy is the snowy-owl concierge of aitutors.me — she/her, front-of-house,
she NEVER teaches and she is NOT a crisis service. She may speak a few short
companion lines of her own (a greeting, a hand-over to the professor, a cheer,
a goodbye) — never a word of the lesson. This skill is the single entry point for
every Heddy asset: marketing and social images, blog illustrations, cutout
stickers, and reels. It is identity governance, not a generic image generator.

Always obey: **pose, scene, medium, and register may change; the character
identity may not.**

## Load the reference first

Before any generation, edit, or on-model judgement, load
`assets/<pack>/reference.jpg` for the active pack. The `heddy-storybook`
set is FROZEN (2026-08-12): `reference.jpg` (identity anchor) plus
`turnaround.jpg`, `expressions.jpg`, `poses.jpg`, `wardrobe.jpg` — pass the
anchor as `--ref` on every storybook generation; it is the binding identity
anchor (brand-safety rule S5; known deviations in `assets/heddy-storybook/NOTES.md`).
The `heddy-flat` pack has no sheet yet — flat requests run DNA-from-text
against `references/heddy-dna.md`.

## Route by task — read only what the task needs

| Task | Read |
|---|---|
| Identity questions, on-model checks, repair, expression/mood sheets | `references/heddy-dna.md` |
| Content illustration (blog, social, editorial scene, explainer) | `references/style-dna.md` + `references/composition-patterns.md` + `references/prompt-templates.md` |
| IP extension (poses, wardrobe, scenes, sticker sets, media conversion) | `references/ip-prompt-templates.md` |
| Cutout / transparent sticker | `references/cutout.md` |
| Sizing for a specific platform/placement | `references/social-formats.md` |
| Video / reel (Phase 4), live-voice animation, anything where her beak moves | `references/motion-dna.md` (§1a for what she may say and when her beak moves) |
| Captions, alt text, shot-list wording, any on-image text | `references/voice-and-captions.md` |
| **Before delivering anything** | `references/qa-checklist.md` — ALWAYS |

## Two work modes

### 1. Content illustration

Turn an article, feature, announcement, or single concept into images where
Heddy performs the idea.

1. **Digest the source.** Find the judgements, changes, relations, and
   metaphors actually worth a picture — never one image per paragraph.
2. **Shot list first.** Unless the user explicitly says generate, output a
   shot list (3–6 shots typical): placement, core meaning, register
   (editorial / explainer / cutout), Heddy's action, key objects, label words.
   Wait for approval or an explicit "generate" before rendering.
3. **One asset per generation.** Each shot is a separate generation call;
   never collage several ideas into one image.
4. **Heddy is load-bearing.** In an editorial scene, painting her out must
   make the image stop explaining itself. In an explainer she is a working
   part of the structure (≤5 stations, ≤6 callouts), never decoration.
5. **Check, repair, deliver** per `references/qa-checklist.md`.

### 2. IP extension

Standard poses, mood/expression sheets, wardrobe items (Ladder shop: grad
cap, reading glasses, bobble hat, wizard hat, scarf, explorer satchel),
scenes (oak branch, library perch, observatory), sticker/cutout sets, and
identity repair.

1. **Separate the inputs.** Identity reference vs style reference vs scene
   reference vs edit target — never treat every input image as the edit target.
2. **Validate the pose against the interaction model** (`heddy-dna.md`)
   BEFORE staging: wing tips present/carry/wave/point (no fingers, no grasp);
   feet perch/stand/hold a flat card; beak never operates props (and is
   closed in every still); face interior is a protected region; reach is
   short; never mirrored.
3. **Repair, don't redesign.** A wrong beak, eye ratio, or badge is fixed by
   the repair policy in `qa-checklist.md`, not by inventing a new owl.

## Unified hard rules

- **DNA beats style.** The identity anchors in `heddy-dna.md` (asymmetric
  eyes left>right, amber diamond beak, facial disc, belly star badge, palette)
  survive every medium and style. Only an explicit user instruction to
  "create a new character" unlocks them.
- **Priority ladder on conflict:** (1) identity anchors → (2) the user's
  current explicit instruction (variables only) → (3) task structure and
  semantics → (4) style, medium, decoration.
- **Describe by design, never by name.** Generation prompts never contain
  the word "Heddy" — models render descriptions, not proper nouns. The name
  lives in captions, alt text, and shot lists only.
- **One asset per generation call.** Local problems get single-target edits.
- **Brand safety S1–S5:** S1 no crisis-adjacent content ever (the Childline
  rule belongs to tutors, never marketing art; she never appears on a
  safeguarding screen). S2 never frame Heddy as teaching — she welcomes,
  celebrates, lights the way, hands over; professors teach. Where she has a
  voice (live voice, animation) she speaks only companion lines — greeting /
  hand-over, encouragement, goodbye — never subject content, hints, answers or
  working, and her beak moves only on her own audio (`motion-dna.md` §1a;
  changed 2026-09-30). S3 en-market assets carry English-only labels; zh assets follow the
  zh conventions (KS3/GCSE stay English). S4 never copy protected IP — style
  transfer moves visual language only. S5 the frozen reference set, once it
  exists, binds production.
- **Two packs, one DNA:** `heddy-flat` (product-exact SVG look) and
  `heddy-storybook` (social illustration look; D1 resolved: crayon
  storybook). Templates are style-parameterised via a `{STYLE_BLOCK}` slot —
  fill it VERBATIM from the frozen block in `style-dna.md` for the active
  pack; never improvise style language.

## Generating

The engine is `scripts/generate.py` (needs `GEMINI_API_KEY`). Set the skill
dir inline, flatten-safe: terminate the assignment with `;`, no comments on
command lines, one invocation per line.

```bash
SKILL_DIR="${HERMES_SKILL_DIR:-$(dirname "$(find . -path '*skills/heddy-ip/SKILL.md' | head -1)")}"; python3 "$SKILL_DIR/scripts/generate.py" --prompt-file /path/to/prompt.txt -o /path/to/out.png --aspect 16:9
```

Common calls (see `scripts/generate.py --help` for the full surface):

```bash
python3 "$SKILL_DIR/scripts/generate.py" --prompt-file shot-01.txt -o 01-welcome.png --aspect 16:9
python3 "$SKILL_DIR/scripts/generate.py" --prompt-file cutout.txt -o heddy-wave.png --aspect 1:1 --cutout
python3 "$SKILL_DIR/scripts/generate.py" --prompt-file edit.txt --ref previous.png -o fixed.png
```

Pass `--ref "$SKILL_DIR/assets/<pack>/reference.jpg"` once the Phase 2 sheets
exist. Aspect ratios per platform: `references/social-formats.md`.

## Output and delivery report

For shot-list planning: the list plus a recommended priority, briefly. For
delivered assets, report: count, purpose per asset, medium/register, file
path, most-stable version, and remaining drift risks. Save to the user's
directory when given; otherwise use sortable names (`01-topic.png`,
`02-topic.png`) and never overwrite earlier versions. No essays on visual
theory.
