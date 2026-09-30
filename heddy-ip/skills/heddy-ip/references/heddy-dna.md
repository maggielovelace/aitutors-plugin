# Heddy character DNA

**Heddy** is the snowy-owl concierge of aitutors.me — she/her, front-of-house, never a teacher and never a crisis service. She may speak a few short companion lines in her own voice (a greeting, a hand-over to the professor, a cheer, a goodbye — see § Speaking); she never teaches. This file is the locked identity: every render, in every style and every register, is checked against it item by item. Source of geometric truth: `lib/concierge/heddy.ts` (the product SVG, viewBox 120 full-body). Anything not locked here does not appear.

Use this file to answer one question about any image: **is this Heddy?** Each anchor below is a yes/no check a reviewer who has never seen Heddy can run.

---

## Locked anchors

Check every anchor on every render. Coordinates are the product SVG's viewBox-120 full-body geometry — in other media, hold the **proportions and relationships**, not the pixel values.

| # | Anchor | Render check (yes/no) |
|---|---|---|
| 1 | **Silhouette** | One round, soft, huggable owl body (product path `M60 18 C82 18 96 36 96 62 C96 90 80 107 60 107 C40 107 24 90 24 62 C24 36 38 18 60 18 Z`) — slightly taller than wide, widest just below the middle. No neck, no separate head sphere: head and body are one form. |
| 2 | **Head fluff** | A single small tuft on top of the head (one soft bump, `M55.5 18 Q60 8.5 64.5 18`) — not ear tufts, not a crest, not hair. Exactly one. |
| 3 | **Body colour** | Body is white (`#FFFFFF`) with a very light ink outline (low-opacity `#00173B`). Heddy is the whitest thing in the frame. |
| 4 | **Facial disc** | A subtle second ring inside the body outline framing the face (`M60 38 Q39 41 37 62 Q39 79 60 82 Q81 79 83 62 Q81 41 60 38 Z`, low opacity) — a faint double-outline effect, never a hard mask or colour change. |
| 5 | **Eyes — asymmetric (SIGNATURE)** | Two round amber irises, **left visibly larger than right**: left radius 13.5 at (46,57), right radius 11 at (74,57) — ratio ~1.23. If the eyes are the same size, it is not Heddy. |
| 6 | **Pupils + highlight** | Ink pupil (`#00173B`) roughly **half** the iris (6.7 / 5.6), centred; exactly ONE white highlight per eye, upper-right of the pupil ((49.5,53.2) r2.4 and (76.8,53.8) r2). No second highlight, no ring highlights. |
| 7 | **No brows, no nose, no blush, no mouth** | Nothing above the eyes; nothing between them but face; no cheek colour, ever. No drawn mouth — no lips, teeth or tongue, in any medium. The beak (anchor 8) is her only articulator. |
| 8 | **Beak** | A small amber **diamond** (a rotated square, `M60 67 L54.5 72 L60 78.5 L65.5 72 Z`) below and between the eyes. Never a hooked or pointed raptor beak, never holding anything. **Closed / at rest is the default** — in still assets and on merchandise the beak is always closed. In motion and live voice the beak may open, but ONLY as `motion-dna.md` §1–2 allow: the lower half drops and closes in time with **Heddy's own audio** (or one Yawn); it is never moved by another character's voice. Open or closed it stays the same amber diamond — it opens, it does not become a mouth. |
| 9 | **Wings** | Two short side wings in warm off-white (`#ECEBE5`), rooted at the body's sides (`M33 54 C21 64 21 88 33 99 C42 90 42 70 42 60 Z` and mirror). Short reach — they contact things close beside the body. No feather detail, no fingers. |
| 10 | **Feet** | Two small amber ellipses at the base ((50,106) and (70,106), rx6.5 ry4). Soft pads — never talons, claws or toes. |
| 11 | **Belly badge** | ONE spark-green 8-point star on the belly, centred at ~(60,94), radius ~7 (`M0 -7 L1.6 -1.7 L7 0 L1.6 1.7 L0 7 L-1.6 1.7 L-7 0 L-1.6 -1.7 Z`). Always present, always exactly one, always spark green. |
| 12 | **Snow speckles** | A handful (~7) of tiny low-opacity ink dots on the crown and flanks (product: opacities 0.18–0.30). Sparse texture, not a pattern, not spots. |
| 13 | **Nothing else on the body** | No text, no extra colours, no extra parts. Wardrobe items appear only when the brief asks and only from the inventory below. |

**On-model rule:** anchors 1–13 are binary. One failed anchor → freeze the rest and repair locally; two or more → regenerate (see `qa-checklist.md`).

## Mood specs

Moods map to the product energy system. Each is a render-checkable eye state; the rest of the body is unchanged.

| Mood | Energy | Eyes | Extras |
|---|---|---|---|
| **rest** | Red | Both eyes CLOSED as gentle **downward** arcs (`M38 60 Q47 66 56 60` / `M64 60 Q73 66 82 60`) — lids down, calm | Two italic serif "z" glyphs floating upper-right of the head, the nearer larger and more opaque (product: sizes 15/10, opacities 0.5/0.35). Rest is the ONLY mood with the z's. |
| **focus** | Amber | Open eyes exactly as anchors 5–6 (asymmetric amber irises, half-size pupils, one highlight each) | None. This is the default open-eyed face. |
| **ready** | Green | Happy **^^** eyes: two **upward** arcs (`M37 58 Q47 47 57 58` / `M63 58 Q73 47 83 58`), no iris visible | None. Bright and waiting. |

### Celebration set (PRD-v0.33.0 — quiet joy, never fanfare)

Celebrations reuse the **ready** ^^ eyes plus one small, countable extra. No confetti storms, no open-beak cheering (she has no mouth, and in stills the beak stays closed — anchor 8), no motion-blur chaos.

| Moment | Render check |
|---|---|
| **level-up** | ready eyes + the child's rank medallion presented beside her (held flat against a surface by a foot, or shown floating beside a wing tip) + a small burst of 3–5 spark-green sparkles near her head. The one repeatable "wow". |
| **first-card** | ready eyes + one flat card held by a foot against a surface or presented at a wing tip + at most 3 spark-green sparkles. |
| **mastery** | ready eyes + a tiny hop (both feet just off the perch, body otherwise identical) + at most 3 spark-green sparkles. |

Celebration sparkles are the same 8-point star as the belly badge, small and few. If a celebration render would read as fanfare, quieten it.

## Palette

Use EXACTLY these values; no colour outside this table appears anywhere in a Heddy asset.

| Token | Hex | Usage semantics |
|---|---|---|
| paper | `#F8F3EB` | Default background, warmth |
| paper-2 | `#F1EDE0` | Secondary background, panels |
| ink-deep | `#00173B` | Pupils, outlines, structure, night skies |
| ink | `#08203B` | Structure, text-in-scene |
| ink-soft | `#3C4F62` | Soft structure, secondary lines |
| spark green | `#238744` | Progress, success, the belly badge, celebration sparkles |
| spark deep | `#00601F` | Deep accent |
| spark soft | `#CEEFD3` | Soft accent fills |
| amber | `#DC9400` | Warmth and attention: eyes, beak, feet, the moon |
| body white | `#FFFFFF` | Heddy's body — hers alone |
| wing | `#ECEBE5` | Wings only |

Colour semantics in one line: **amber = warmth/attention, spark = progress/success, ink = structure/night, white = Heddy.**

## Wardrobe + scene inventory

Only these items exist (the Ladder reward shop). They appear only when the brief asks for them; unlisted accessories never appear.

- **Head:** graduation cap (ink, amber tassel) · reading glasses (thin ink rings over both eyes, sized to the asymmetric irises) · bobble hat (amber, white bobble) · wizard hat (ink cone + brim, amber stars)
- **Neck/body:** scarf (spark green, one trailing end) · explorer satchel (amber strap across the body, amber bag at the hip)
- **Scenes:** oak branch (ink branch, spark-green leaves) · library perch (bookshelf uprights + spark/amber shelf spines) · observatory (ink night circle, amber moon upper-right, 2–3 amber stars)

Accessories sit ON TOP of the locked anatomy — they never replace, cover or distort anchors 5–8 (glasses ring the eyes, they don't hide them).

## Interaction model

Validate every pose against this BEFORE staging a scene. Derivation is conservative: no invented dexterity.

- **Contact surfaces:** wing tips — carry, present, wave, point (NO fingers, NO grasp; a carried object is balanced or hugged against the body). Feet — perch, stand, and hold a **flat** card or object against a surface.
- **Beak:** NEVER operates props. It is a marking, not a tool. It is her only articulator: in motion it opens and closes to her own voice (`motion-dna.md` §1) and is never drawn as lips, teeth or a tongue.
- **Reach:** short — wing contacts happen close beside the body, never across the torso or at arm's length.
- **Grip:** pressure/contact only.
- **Locomotion:** flight, perch, small hop. No walking gaits, no running.
- **Protected region:** the face interior — only the locked eyes and beak appear there. No prop, limb or scene stroke enters it.

## Forbidden (hard fails)

Any one of these fails the render outright:

- Generic cartoon owl (loses the asymmetric eyes, the diamond beak, the badge)
- Realistic raptor: sharp hooked beak, talon detail, fierce brow
- **Symmetric eyes** — the single most common drift; check it first
- Eyebrows, a nose, blush, a drawn mouth (lips, teeth, a tongue — the beak is the only articulator, and when it opens it stays a beak)
- An open beak in a still asset or on merchandise (closed / at rest is the default — anchor 8)
- The beak moving to a voice that is not Heddy's own — the professor's speech never moves her beak (`motion-dna.md` §1)
- Any colour outside the palette table
- Duolingo-adjacent styling (green body, aggressive expressions, pressure poses)
- Teaching props that frame her as a tutor (at a whiteboard instructing, marking work, wielding a pointer) — professors teach; Heddy welcomes
- Teaching in her own voice — subject content, a hint, an answer, explaining working — in any spoken line (see § Speaking)
- Crisis-adjacent scenes of any kind (see S1 in `SKILL.md` brand safety); she never appears on a safeguarding screen
- A mirrored (horizontally flipped) Heddy — mirroring swaps her asymmetric eyes (anchor 5)
- Text written on her body

## Brand semantics — what Heddy stands for

Heddy means **welcome, quiet celebration, lighting the way, and companionship**. She greets, notices, celebrates with, hands over to the professors, and keeps a child company — she never instructs, never grades, never pressures, and never handles distress. Where a product gives her a voice, she says exactly those things and nothing more (§ Speaking).

**Performing, not posing.** In every scene Heddy is load-bearing: she performs the image's one idea — carrying the card, lighting the lamp, waving the visitor in. Quick check: mentally paint her out. If the image still explains itself, she was a sticker — rebuild the scene so it cannot happen without her.

## Priority ladder

When requirements conflict, decide in this order:

1. **Identity anchors** (everything locked above) — only an explicit "create a new character" instruction unlocks them.
2. **The user's current explicit instruction** — variables only (mood, wardrobe, scene, register, format).
3. **The task's structure and semantics** — the idea the image must carry.
4. **Style, medium and decoration** — always yields to 1–3.

## Speaking — what Heddy may say (changed 2026-09-30)

In a live voice session the **professor is the tutor** and carries the teaching voice; Heddy is the companion. She may speak her own short lines, in her own voice:

- **Greeting and hand-over** — hello, and over to the professor.
- **Encouragement and celebration** — a quiet "well done", the same register as the celebration set.
- **Goodbye** — the sign-off.

That is the whole list. She still **never teaches**: no subject content, no hints, no answers, never explaining working, never "at a whiteboard instructing". If a line would carry any of the lesson, it belongs to the professor. Spoken lines follow the written voice rules in `voice-and-captions.md` (one quiet sentence, no fanfare, British English).

When she speaks, her **beak moves — and only then** (`motion-dna.md` §1): articulation is synchronised to Heddy's own audio, never to the professor's or anyone else's, and the beak stays the same diamond shape and colour throughout. She never speaks on a safeguarding screen, and she is never mirrored.

*Before 2026-09-30 this file said "never a tutor" and `motion-dna.md` allowed only an un-synced lower-beak drop with no lip-sync. The principle is unchanged — Heddy never teaches — but she now has a voice of her own, and her beak follows it.*

## Voice

Heddy's written voice (captions, on-image labels, shot lists) is specified in `voice-and-captions.md`; her spoken lines are bounded by § Speaking above. Remember the prompt rule: generation prompts describe her **by design, never by name** — "Heddy" lives only in human-facing copy.
