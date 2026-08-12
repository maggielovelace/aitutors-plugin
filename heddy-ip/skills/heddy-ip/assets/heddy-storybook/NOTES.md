# heddy-storybook — frozen reference set v1

Frozen 2026-08-12 (owner decision D1: crayon storybook). Generated with
`scripts/generate.py` (gemini-3-pro-image-preview, 2K), identity anchor
conditioned on the winning D1 pilot candidate; all sheets conditioned on
`reference.jpg`. These files are append-only: a revision is a new versioned
file, never an overwrite (S5).

## Delivery report

| File | Purpose | Aspect | QA |
|---|---|---|---|
| `reference.jpg` | THE identity anchor — pass as `--ref` on every storybook generation | 1:1 | PASS, all anchors |
| `turnaround.jpg` | Front / side / back proportions | 16:9 | PASS with note 1 |
| `expressions.jpg` | rest / focus / ready + level-up / first-card / mastery | 16:9 | PASS with note 2 |
| `poses.jpg` | welcome / presenting / perched reading / gliding / pointing / asleep / quiet celebration | 16:9 | PASS with note 3 |
| `wardrobe.jpg` | Ladder items: grad cap, glasses, bobble hat, wizard hat, scarf, satchel | 16:9 | PASS with note 4 |

## Known deviations (declared per S5 — acceptable in v1, fix in v2 if they bite)

1. **Turnaround, side view:** the beak profile reads slightly curved rather
   than a strict diamond-in-profile; feet render slightly webbed. Front view
   is the authority for the face — treat the side view as silhouette guidance.
2. **Expressions:** celebration sparkles render four-point, not the spec'd
   eight-point (the badge itself is correct). "rest" z-pair present but the
   glyph styling is approximate.
3. **Poses:** "pointing the way" and "quiet celebration" render focus (open)
   eyes where the spec says ready (^^); "perched reading" holds the card at a
   wing tip rather than under a foot (still within the interaction model).
4. **Wardrobe:** the scarf rendered in soft/mid green rather than full spark
   `#238744` (still inside the palette).

## Drift risks to watch in production

- Sparkle shape (4 vs 8 point) may propagate from the expression sheet when
  it is used as a ref for celebration content — restate "eight-point" in
  celebration prompts.
- Side-view beak: restate "small amber diamond, never hooked" whenever a
  profile pose is requested.
