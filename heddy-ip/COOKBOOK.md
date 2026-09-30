# Heddy IP cookbook

How to actually produce Heddy assets with the `heddy-ip` skill — the recipes, the exact
commands, the QA loop, and the calibration lessons that cost real generation rounds to learn.

**Written** 2026-08-12, after PRD-v0.55.0 Phases 0–4 shipped: DNA codified, the
`heddy-storybook` reference set frozen, the skill pilot-tested (four stills + one 24s reel).
**Audience** anyone producing Heddy marketing assets — the owner, a marketing operator, or an
agent (Claude Code, Codex, Hermes, OpenClaw, Pi) with the skill installed.

**Source of truth.** The skill itself: `skills/heddy-ip/` (SKILL.md routes to the reference
files). Character geometry: `lib/concierge/heddy.ts`. Where this cookbook and the skill files
disagree, the skill files win and this document is stale.

---

## 0. The one-paragraph mental model

Heddy is a **locked identity** (asymmetric eyes left>right ~1.23:1, amber diamond beak,
spark-green 8-point belly badge, head tuft, snow speckles, exact palette) that survives every
pose, scene, medium and register. The skill is identity *governance*: templates restate the DNA,
every generation conditions on a **frozen reference sheet**, and a QA gate with a repair policy
decides what ships. You never "draw Heddy freestyle" — you fill slots in a template and let the
anchors do the work. Prompts describe her **by design, never by name** (image models render
descriptions, not proper nouns).

## 1. Setup

```bash
export GEMINI_API_KEY=...          # the only secret; never printed by the tooling
SKILL=skills/heddy-ip              # adjust to wherever the skill is installed
python3 $SKILL/scripts/generate.py --help
```

The frozen identity anchor for the social rendition is
`$SKILL/assets/heddy-storybook/reference.jpg` — **pass it as `--ref` on every storybook
generation.** Known v1 deviations are declared in `assets/heddy-storybook/NOTES.md`; the two
that bite in practice: restate "eight-point sparkles" in celebration prompts, and restate
"small amber diamond, never hooked" for profile poses.

## 2. Recipe: blog / article illustration set (Mode A)

The highest-leverage recipe — reusable across the entire blog.

1. **Shot list first, always.** Read the article, find 3–6 *cognitive anchors* (judgements,
   before/afters, relationships — never one image per paragraph). For each shot write:
   placement, core idea, structure (one of the six in `composition-patterns.md`), Heddy's
   action (validated against the interaction model — wings present/carry/wave/point, no
   grasping), key objects, ≤3 label words, aspect.
2. **Fill the master prompt template** (`prompt-templates.md`) per shot — the `{STYLE_BLOCK}`
   comes verbatim from `style-dna.md` (crayon storybook; frozen at D1, never paraphrased).
3. **Generate one image per shot:**

   ```bash
   python3 $SKILL/scripts/generate.py --prompt-file shot-01.txt \
     --ref $SKILL/assets/heddy-storybook/reference.jpg --aspect 16:9 -o out/01-hero.png
   ```

4. **QA in checklist order** (`qa-checklist.md`): thesis test (cover the labels — what one
   idea would a stranger name?) → on-model anchors → structural integrity → register checks.
5. **Repair policy:** 1 failed anchor → local-edit template, freeze everything else;
   ≥2 anchors → regenerate; the same topology failure twice → change the pose, not the prompt.

## 3. Recipe: social post image

Same as §2 with one shot. Sizes from `social-formats.md`: feed 1:1 or 4:5, story/reel cover
9:16 (keep top ~15% / bottom ~20% clear of content), OG 16:9. X banner: generate at 21:9 and
crop to 1536×640 in post. **Prefer overlaying text in post-production** — generation text is
unreliable; en-market assets take English-only labels (rule S3).

## 4. Recipe: cutout sticker (for thumbnails / screenshot composites)

```bash
python3 $SKILL/scripts/generate.py --prompt-file cutout.txt \
  --ref $SKILL/assets/heddy-storybook/reference.jpg --aspect 1:1 --cutout -o heddy-wave.png
```

The `--cutout` flag appends the magenta-screen instruction and keys `#FF00FF` to alpha in
post. Full rules in `cutout.md`: pose only, full body with feet visible, no scene, no text,
only touched prop fragments. If `cutout_alpha` is false in the result JSON, don't ship it as a
compositing asset.

## 5. Recipe: new poses / expressions / wardrobe

Use the templates in `ip-prompt-templates.md` — every one declares input-image roles
explicitly ("Image 1 is the fixed identity reference — do not redesign"). Validate the pose
against the interaction model **before** prompting: wings have no fingers and cannot grasp;
feet perch or hold a flat card; the beak never operates props; the face interior is protected.

## 6. Recipe: a reel (Pipeline A — narrated blocks)

Fixed 10s blocks (pilot used 8s Veo clips), N = minutes × 6. **Strict order:**

1. Script → split into blocks (~20 words per block).
2. **All voice takes first** (Gemini TTS, the repo's house voice) — audio is timing truth.
3. **One style key per block, generated AT THE REEL'S ASPECT** — this matters: conditioning
   the video model on the square 1:1 anchor letterboxes every clip. The pack anchor
   conditions the *key* (`--ref anchor --aspect 9:16`); the key conditions the *clip*.
4. Veo clips per block (`veo-3.1-fast-generate-preview`, image-conditioned on the key),
   prompt per the §4 template in `motion-dna.md`, ambient audio only — narration is never
   baked into clips.
5. Character-fidelity gate per clip: extract frames at start / midpoint / motion extreme
   (`ffmpeg -ss T -frames:v 1`) and run the anchors on each. Re-roll the failing clip, never
   the reel.
6. Assemble in the edit: duck ambient ~0.25 under the VO, concat.

### The video calibration lessons (each cost a real Veo round)

| Lesson | What happened |
|---|---|
| Style key at the reel's aspect | Square anchor as condition → every clip letterboxed |
| One eye state per clip | "^^ for the first beat, then open" → eyelashes drawn mid-transition, twice |
| **Never request `^^` eyes on video** | Three phrasings (bare, arcs-then-open, fully spelled out) all drew lashes / `><` squints / blush. `^^` is a cute-anime attractor for video models in this soft style. Stills hold `^^` fine — video carries warmth with open eyes + head tilt instead |
| Night scenes drift to sleep, beyond prompting | Two maximal "NEVER sleeping" prompts still rendered her asleep under the moon. Restage (dusk / lamplight / mid-glide) or accept the rest mood deliberately |
| "Asymmetric eyes" can collapse into a wink | Video models read left-larger as one-eye-closed; say "BOTH eyes open, the right smaller but fully open, never winking" |
| No badge glints | A "glint pass" recoloured the spark badge amber mid-clip |

## 7. Recipe: identity repair

One wrong anchor on an otherwise good asset → the repair template in `ip-prompt-templates.md`:
name ONLY the failed anchor ("the beak: replace with a small amber #DC9400 diamond"), freeze
everything else, re-check the face crop at full resolution. Two or more wrong anchors →
regenerate; don't polish a broken identity.

## 8. What never ships

No crisis-adjacent content (S1 — Childline messaging belongs to the tutors, never marketing
art). No "Heddy teaches X" framing (S2 — she welcomes, celebrates, lights the way; the
professors teach). Where she has a voice, her lines are a greeting / hand-over, an
encouragement or a goodbye — never subject content, a hint, an answer or working — and her
beak moves only on her own audio, never the professor's (`motion-dna.md` §1a, changed
2026-09-30). No mirrored Heddy (it swaps her asymmetric eyes). No Chinese in en-market assets (S3). No borrowed IP, ever (S4). And no
silent deviation from the frozen reference set (S5 — deviations are declared in NOTES.md or
they are defects).

## 9. Delivery format

Every delivery reports: count, purpose per asset, medium/register, file path, most-stable
version, and remaining drift risks. Sortable filenames (`01-topic.png`), never overwrite —
a revision is a new file.

## 10. Cost & timing reality (pilot measurements, 2026-08-12)

- Still (2K, Gemini image): ~20–40s each; identity held DNA-from-text even before the
  reference sheet existed, and holds harder with `--ref`.
- Veo 3.1 fast clip (8s, 720p, 9:16): ~60–90s each to generate.
- A 3-block pilot reel end-to-end (VO + keys + clips + gate + assembly): ~25 min including
  two calibration re-roll rounds; expect ~10 min now the lessons are encoded.
- Reference freeze (anchor + 4 sheets): five generations, all first-try passes with the
  anchor as `--ref`.
