# Heddy IP & Brand Illustration

> One snowy owl, everywhere the brand goes. This skill generates and governs
> Heddy — the aitutors.me concierge — across marketing images, blog
> illustrations, social posts, stickers, and (later) reels, keeping the same
> character identity in every single asset.

Heddy is not a generic cartoon owl. She has a fixed identity: round soft white
body, head-fluff tuft, asymmetric amber eyes (left noticeably larger than
right), a small amber diamond beak, a spark-green star badge on her belly, and
a strict brand palette (paper cream, ink navy, spark green, amber). She is the
front-of-house concierge — she welcomes, celebrates, and lights the way. She
never teaches (the professors do that) and never appears in crisis-adjacent
content. In a live voice session she may say hello, hand over to the professor,
cheer, and say goodbye in her own voice — and her beak moves only on those
lines, never to the professor's (`references/motion-dna.md` §1a). Pose, scene, wardrobe, and medium can all change; the identity cannot.

## The pack model

Two sibling packs share one character DNA:

| Pack | Look | Status |
|---|---|---|
| `heddy-flat` | Product-exact flat SVG look, straight from `lib/concierge/heddy.ts` | Templates ready |
| `heddy-storybook` | Softer social-illustration look for feeds and blog heroes | **D1 resolved: crayon storybook** — the frozen `{STYLE_BLOCK}` lives in `references/style-dna.md` |

Every prompt template works with either pack; the pack contributes the style
block, the DNA contributes everything else.

## Four registers

- **Editorial scene** (default) — Heddy performs the idea; remove her and the
  image stops explaining itself.
- **Explainer** — a hand-built diagram (≤5 stations, ≤6 callouts) with Heddy
  as a working part.
- **Cutout** — transparent PNG sticker, pose only, no scene, no text.
- **Reel** — Phase 4, spec'd in `references/motion-dna.md`.

## Quick invocations

Plan only (no images yet):

```text
Use the heddy-ip skill. Don't generate yet — read this blog post and give me
a shot list of the 4 places most worth an illustration: placement, core
meaning, register, Heddy's action, and label words for each.
```

Generate a set:

```text
Use the heddy-ip skill to generate 4 blog images for this article in the
heddy-flat pack, 16:9. Shot list first, then one image per shot.
```

A cutout sticker:

```text
heddy-ip: make a transparent cutout of the owl waving with one wing tip,
1:1, no background, no text.
```

An expression sheet:

```text
heddy-ip: expression sheet — rest, focus, and ready moods plus the three
celebration poses, one asset each, heddy-flat.
```

## Install

**Claude Code:** the skill lives in this repo at `skills/heddy-ip/` and is
picked up from the project skills directory.

**Hermes Agent** (NousResearch `hermes-agent`): skills live in
`~/.hermes/skills/<category>/<name>/` — drop the directory in and it's live,
no registration:

```bash
cp -R skills/heddy-ip ~/.hermes/skills/creative/heddy-ip
hermes skills list | grep heddy-ip   # verify
```

On first load Hermes reads `required_environment_variables` from the
frontmatter and prompts for `GEMINI_API_KEY` (stored in its `config.yaml`
under `skills.config.*`; manage later with `hermes skills config heddy-ip`).

Either way, generation needs:

```bash
export GEMINI_API_KEY=...   # scripts/generate.py renders via Gemini
```

## Status

| Piece | Status |
|---|---|
| Character DNA, style DNA, templates, QA (Phase 1) | Written |
| `heddy-storybook` style direction (D1) | Resolved 2026-08-12: crayon storybook |
| Reference sheets in `assets/<pack>/` (Phase 2) | **heddy-storybook FROZEN 2026-08-12** (anchor + turnaround + expressions + poses + wardrobe, see `assets/heddy-storybook/NOTES.md`); heddy-flat pending |
| Cutout register | Written |
| Video / reels (Phase 4) | **Pilot reel delivered 2026-08-12** (3x8s 9:16, Veo 3.1 fast + Gemini TTS; pipeline calibrated over 4 rounds — the live lessons are in `motion-dna.md`) |
| Speaking / beak articulation | **Rule changed 2026-09-30:** Heddy speaks her own short companion lines (greeting / hand-over, encouragement, goodbye) and her beak moves only on them, synced to her own audio. Still never teaches, never a mouth, never moved by another voice (`references/motion-dna.md` §1a, `references/heddy-dna.md` § Speaking) |

Sources of truth: character geometry `lib/concierge/heddy.ts`; PRD
`docs/prd/PRD-v0.55.0-heddy-ip-system.md`; plan
`docs/plans/heddy-ip-skill-plan.md`.

**License:** proprietary — internal aitutors.me brand IP. Do not redistribute
the skill or the character.
