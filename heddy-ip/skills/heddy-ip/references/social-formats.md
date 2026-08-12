# Social formats — per-platform specs

Pick the format BEFORE writing the shot list: aspect ratio changes the
composition, not just the crop. Never generate one master image and crop it
to other ratios — restage per format. Style and colour rules live in
`style-dna.md`; identity in `heddy-dna.md`.

## Format table

| Use | Ratio | Generate at | Notes |
|---|---|---|---|
| Blog hero / OG card | 16:9 | 1200×630 (OG) or 1600×900 (hero) | OG is the strictest crop — verify at 1200×630, not the hero size |
| Feed post (square) | 1:1 | 1080×1080 | Default for X/LinkedIn feed images |
| Feed post (portrait) | 4:5 | 1080×1350 | Instagram/LinkedIn portrait — earns more screen than 1:1; prefer it when the composition is vertical |
| Story / reel cover | 9:16 | 1080×1920 | Safe zones apply — see below |
| X banner | 1536×640 | 21:9, crop to 1536×640 in post | Extreme letterbox (~2.4:1 is not a generator aspect — generate at 21:9, the nearest supported ratio, and crop): one wide quiet scene, subject centred, nothing important in the outer ~15% each side (profile-photo overlap bottom-left) |
| xiaohongshu note (zh) | 3:4 | 1080×1440 | zh-market card format; zh label conventions apply |

## Safe zones (9:16 story/reel)

Platform UI overlays eat the edges. Keep:

- Top ~15% clear — username, close button.
- Bottom ~20% clear — caption, CTA, reply bar, progress dots.
- Sides: keep labels ≥64px from either edge.

Compose the idea in the middle ~65%. Heddy's face and any label must sit
entirely inside it. A composition that only works using the full height is
the wrong composition for this format.

## Text-overlay rule

**Prefer overlaying text in post-processing, not baking it into
generation** — model-rendered text is unreliable (misspellings, wrong glyphs,
worse still for CJK). Default workflow:

1. Generate the image text-free (or with at most the ≤6 in-scene labels from
   `style-dna.md`, and only when they are part of the drawing itself).
2. Add headlines, captions, CTAs as a separate overlay layer (post tool,
   template, or compositor) using brand type and palette colours.
3. If text MUST be baked in (a platform that strips overlays), keep it to 1–3
   short words, inspect every glyph at 100% zoom, and regenerate on any
   defect — never ship approximate lettering.

Never place text on Heddy's body in either workflow.

## en / zh split (S3)

- en-market assets: English-only — no Chinese in the image, labels, or
  overlay.
- zh-market assets: follow the zh conventions — Chinese labels/overlays are
  fine, but KS3, GCSE, product names and "Claude" stay in English; 「」
  quotes and full-width punctuation in overlay copy.
- An en asset and its zh sibling are two separate files (two generations or
  two overlay passes) — never one bilingual image for the en market.

## File naming and hygiene

- Name outputs `NN-topic.png` ascending within a job (`01-welcome-hero.png`,
  `02-welcome-feed-1x1.png` …). Include the format when a topic ships in
  several ratios (`-16x9`, `-1x1`, `-4x5`, `-9x16`, `-3x4`, `-banner`).
- zh siblings take a `-zh` suffix before the extension.
- **Never overwrite** a delivered or frozen file. A revision is a new file
  (`02b-…` or the next number); the old version stays for comparison.
- One asset per generation — no contact sheets, no multi-image canvases.

## Per-format QA additions

After the standard QA order (`qa-checklist.md`), check:

- OG 16:9: does the image still read at ~300px wide in a link preview? If a
  label is illegible at that size, it should not be in the image.
- 9:16: simulate the overlays — is anything load-bearing in the top 15% /
  bottom 20%?
- 4:5 and 3:4: no accidental crop of Heddy's head-fluff or feet — portrait
  ratios tempt tight framing; give her air.
- X banner: check against the profile-photo overlap (bottom-left) at
  actual placement.
