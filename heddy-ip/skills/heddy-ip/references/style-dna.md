# Style DNA — the fixed visual language

The visual language for every Heddy content image. Character identity lives in
`heddy-dna.md` and always outranks anything here. This file governs the canvas
around her: ground, line, colour, labels, and the two renditions.

## One sentence

Warm paper, generous quiet space, one clear idea, and a small white owl doing
real work in the picture — like a page from a calm children's encyclopaedia,
never a training slide.

## Canvas rules

- Default ground: warm paper `#F8F3EB` (paper-2 `#F1EDE0` for panels/cards
  within the image). Flat colour — no paper texture, gradients, noise, drop
  shadows, or fake UI chrome.
- Alternative ground: night-sky ink `#00173B` / `#08203B` (the observatory
  scene). Use it deliberately — celebration, wonder, "lighting the way" — not
  as a random dark mode. See Value rules below.
- Subject (Heddy + the objects she acts on) occupies 40–60% of the canvas.
  Keep at least one third of the image as quiet negative space.
- One image = one action, relationship, or metaphor. If a second idea creeps
  in, it is a second image.
- Heddy is load-bearing: mentally paint her out — if the picture still
  explains itself, she was a sticker. Restage so she performs the idea
  (carries, presents, lights, perches on, points at).

## Line language

- Ink (`#08203B`) carries structure: outlines, connectors, simple hand-built
  frames. Lines are confident but slightly human — no ruler-perfect vector
  boxes, no chart grids, no arrow storms.
- No PPT furniture: no bullet columns, no dashboard widgets, no formal
  flowchart lozenges, no category title parked in the top-left corner.

## Colour semantics (exact palette, no additions)

| Colour | Hex | Owns |
|---|---|---|
| Paper | `#F8F3EB` / `#F1EDE0` | Ground, quiet space |
| Ink | `#00173B` / `#08203B` / soft `#3C4F62` | Structure, line work, night sky |
| Amber | `#DC9400` | Warmth, attention, the moon, Heddy's eyes/beak/feet |
| Spark green | `#238744` (deep `#00601F`, soft `#CEEFD3`) | Progress, success, the belly badge |
| White | `#FFFFFF` (wing `#ECEBE5`) | Heddy herself |

Hard rules: white is Heddy's colour — do not fill props solid white on paper
grounds where they would compete with her. Amber and spark keep their
meanings; never swap them (a green moon or an amber success tick is a fail).
No colours beyond this table, ever.

## Value rules per ground (write the right one into every prompt)

- **Warm paper ground (light):** Heddy is a white owl on a light field — the
  ink outline carries her. Her silhouette must read from the outline alone;
  amber eyes/beak/feet and the spark badge are the anchoring accents. Any
  dark prop detail uses ink, not pure black. Do not add a shadow blob or halo
  to "help" her separate — fix the composition instead.
- **Night-sky ink ground (dark):** Heddy is the brightest value in the scene
  — the white body glows against the ink, natively on-brand (the observatory:
  amber moon, small amber/paper stars). Structure lines invert to paper or
  soft ink; amber does the warmth (moon, lantern-light); spark stays reserved
  for progress marks. Never outline her in black on a dark ground.

## Labels

- Maximum 6 labels per image; each 1–4 short words, set in a simple
  hand-lettered or humanist style consistent within the image.
- en-market assets: English-only labels — no Chinese anywhere in the image
  (S3). zh assets follow zh conventions (keep KS3/GCSE and proper nouns in
  English).
- Prefer no baked-in text at all: overlay in post-processing where the format
  allows (see `social-formats.md`). Never write text on Heddy's body.
- Labels name things in the scene; they do not narrate. If a label explains
  what the picture failed to show, redraw the picture.

## The two renditions (sibling packs, one identity)

Both packs obey `heddy-dna.md` identically — same proportions, same
asymmetric eyes (left iris > right, ~1.23:1), same amber diamond beak, same
spark badge. A rendition is a look, never a licence to redesign. Each pack
carries its own frozen reference sheet (Phase 2, `assets/`); generations for
a pack condition on that pack's sheet only — never restyle one pack's output
into the other at runtime.

### heddy-flat

The product-exact look: flat SVG-derived shapes, clean fills, the geometry of
`lib/concierge/heddy.ts` rendered as-is. Use for anything that sits beside
product UI (screenshots, docs images, OG cards mixing UI and mascot). Zero
texture, zero painterly licence.

### heddy-storybook

The social illustration look — richer, warmer, for feed/editorial images.
**D1 resolved 2026-08-12: crayon storybook** (owner picked candidate A from
the four-way pilot). The frozen `{STYLE_BLOCK}` — use verbatim in every
storybook prompt, never improvised or paraphrased:

> Premium restrained hand-drawn children's-storybook illustration in wax
> crayon, oil pastel and coloured pencil. Visible handmade grain and soft
> strokes, clean edges, warm paper #F8F3EB background with a faint honey
> inner glow around the subject. Quiet, warm, companionable.

- The block describes medium, texture, edge quality and lighting ONLY. It
  must never mention anatomy, colours outside the palette, eye shapes, props,
  or mood — those belong to the DNA and the shot.
- On the night-sky ground, keep the same crayon medium and swap only the
  ground sentence: "deep ink #00173B night ground; the white owl is the
  brightest value, gently lit in warm amber" (see Value rules).

## The aesthetic test

The reader should feel "slightly odd but instantly clear" — a beat of charm,
then one-second comprehension of the single relationship shown. If the first
impression is a training slide, a corporate infographic, or a Duolingo ad,
delete elements and redraw with fewer parts.
