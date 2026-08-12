# Motion DNA — how Heddy moves

How Heddy moves is part of her identity, exactly like the asymmetric eyes. A clip where she
moves like a generic bouncy mascot is off-model even if every frame passes the still-image
anchors. This file defines the movement vocabulary as render-checkable specs, then the two
reel pipelines that use it. Source of truth for the numbers: the production animation rig
(`scripts/video/heddy-intro/rig.ts` + `timeline.ts`) — do not re-derive them.

Character anchors (silhouette, eyes, palette, interaction model) live in `heddy-dna.md`.
Every motion spec below inherits them: an anchor that holds at frame 1 must hold at every
frame. **One declared exception:** anchor 8's "never open" beak is a still-image rule —
motion clips may open the beak, but only exactly as the Talking and Yawn specs below
allow (lower mandible drops; the diamond shape and upper half never change). This is the
sole motion exception; `heddy-dna.md` anchor 8 cross-references it.

## 1. The idle life layer (always on)

Heddy is never a freeze-frame. Any clip longer than ~1s carries this subtle base layer
under whatever gesture is happening. It is what makes her read as alive rather than a
slideshow.

| Motion | Spec | Check |
|---|---|---|
| Breathe | whole body bobs ±~1% of body height, ~4.5–5s cycle, with a matching ±1.2% scale about the feet | continuous, sinusoidal, never a pump |
| Blink | roughly every 4–5s, ~0.17s per blink; the lids close VERTICALLY — the iris flattens to a calm lid line and reopens | irises never slide or shrink sideways; both eyes blink together |
| Gaze drift | pupils (with their single highlight) wander slowly WITHIN the fixed irises; excursion ≤40% of iris radius | the iris circles never move — only the pupil group inside them |
| Head tilt | gentle ±1–2° sway, slow | head tilts as ONE unit (disc + eyes + beak together) |
| Talking (VO clips) | lower mandible drops in a jittery envelope; upper mandible fixed; never fully shut mid-line, never gaping (max ~70% open) | no lip shapes, no lip-sync — an owl beak, not a mouth |

Asleep (rest mood) variant: eyes are the closed downward arcs, italic serif "z" floats
upper-right, and the ONLY motion is the slow breathe — no blink (eyes are shut), no gaze,
no gestures. Sleep is still, not limp.

## 2. Gesture vocabulary

Gestures layer ON TOP of the idle layer with soft ease-in/ease-out envelopes — they never
snap in or cut off. Each is short (0.6–2s) and returns Heddy to rest. One gesture at a time
unless the pairing is listed (e.g. bounce + happy eyes).

| Gesture | Spec | Hard limits |
|---|---|---|
| **Hop** | one clean sine-arc jump (~9% of body height), soft landing, whole body as one unit | one arc, no double-bounce; feet leave and return together |
| **Wave** | ONE wing (usually her right) lifts toward the head to ~40–60° and waggles ~3 times; head tilts up 2–3°; eyes go happy `^^` for the first beat | wing rotates about its shoulder only — it never bends, sprouts feather-fingers, or crosses the face |
| **Present** | wing extends outward at ~45–70° and HOLDS, open surface toward the thing being presented; slight head tilt toward it | wing tip may touch a prop's edge; it never wraps or grips |
| **Point** | wing lifts to ~45° toward the target; head tilts 2–3° the same way; pupils shift toward the target | direction is wing + head together — never a lone wing with a static head |
| **Nod** | 1–2 small body bobs (~3px in rig space) with matching head dip | stays subtle; not a bow |
| **Shake** | quick head shake ±~9°, 2 cycles, pupils counter-drift slightly | head only; body stays planted |
| **Lean-in** | body leans ~5% toward the viewer/subject with a ~4% scale-up; eyes widen slightly within their fixed asymmetric sizes | intimacy beat, not a zoom |
| **Yawn** | eyes go sleepy, beak opens wide once, head droops ~5°, recover | rest-adjacent scenes only |
| **Wing sweep** | wing sweeps tucked→wide (≈12°→70°) across ~2s — the "reveal" gesture for presenting a set of things | one continuous sweep; the revealed items appear in its wake |
| **Glide** | airborne travel: wings out symmetric ~60–75°, body tilted into the path, feet tucked; a gentle arc, never a hover-jitter | flight is calm and level — no flapping frenzy, no hover-in-place buzz |
| **Perch settle** | landing: short glide → feet contact → one small compression bob → idle | feet curl softly over a branch/edge (soft pads, no claw detail); on flat ground she simply stands |
| **Celebration** | ONE bounce (a single decaying hop with happy `^^` eyes) + one glint pass across the belly badge | never confetti explosions, firework bursts, or repeated bouncing — quiet joy is the brand |

Range clamps (from the rig — treat as hard fails when exceeded): head tilt ±13°, body lean
≤~8% of body width, wing rotation 0–78° from tucked, beak never beyond fully open.

No gesture may introduce brow strokes — Heddy has no eyebrows (`heddy-dna.md` anchor 7),
in motion as in stills. Emotion is carried by head tilt, eye state (`^^`, widened focus,
closed rest arcs), pupil shift and body lean only.

Locomotion is flight + perch + small hop ONLY. Heddy never walks, runs, jumps
repeatedly, or gestures with feet while standing on them.

## 3. Render-checkable motion rules

Check these per clip, mid-motion, not just on the first frame:

1. Left iris stays visibly larger than the right through every head angle and blink.
2. Pupils move; irises don't. A shot where the whole eye slides is a fail.
3. Wings rotate about the shoulder as rigid soft shapes — no elbows, no feather-fingers.
4. The beak stays a small amber diamond; it opens by dropping the lower half, it never
   stretches into a smile, snout, or hooked raptor bill.
5. The face interior stays protected: nothing enters it during motion (no wing across the
   face, no props overlapping the eyes/beak).
6. The belly badge and snow speckles stay attached to the body through every transform.
7. Idle layer present in every held moment — a frozen Heddy mid-clip is a fail.
8. Silhouette is preserved at motion extremes: the round body never squashes/stretches
   beyond ~±5% (no rubber-hose deformation).

## 4. Reel pipeline A — narrated blocks

For a reel built from script (announcement, explainer reel, campaign spot).

**Structure.** Fixed 10-second blocks. N = minutes × 6 (a 90s reel = 9 blocks). Each block
is one generated clip; blocks are cut end-to-end with the narration bed over the top.

**Order of work (strict):**

1. Write the script and split it into 10s blocks (≈20–28 English words per block).
2. Generate ALL voice takes first, before any clips. Timing truth comes from the audio —
   a clip generated before its VO exists will be re-cut or re-rolled.
3. Produce ONE style-key image: a single approved still of Heddy in the reel's rendition
   and setting, passed as the image condition into EVERY clip generation. This is what
   holds identity across blocks — never let blocks condition on different keys.
   **The style key MUST be generated at the reel's aspect ratio** (9:16 for a vertical
   reel), via `scripts/generate.py --ref <pack anchor> --aspect 9:16` — conditioning a
   video model on the square 1:1 pack anchor letterboxes every clip with black bars
   (verified live, first pilot reel 2026-08-12). The pack anchor conditions the KEY;
   the key conditions the CLIPS.
4. Generate clips per block with the template below.
5. Assemble: clips + VO bed + captions added in the EDIT (burned by the compositor, never
   asked of the video model).

**Per-block prompt template:**

```
STYLE REFERENCE: [the one style-key image — same file for every block]
SCENE: [setting for this block, palette-locked: paper #F8F3EB grounds, ink #08203B
  structure, amber #DC9400 warmth, spark #238744 progress accents]
CHARACTER: [describe the character by design, never by name — round white owl, small head
  tuft, one-larger-one-smaller amber eyes, small amber diamond beak, green
  eight-point star on the belly]
MOTION: [ONE primary gesture from §2 + the idle layer; camera static or one slow
  move; nothing else moves fast]
AUDIO: ambient only — room tone / soft texture. NO dialogue, NO music (music is
  added in the edit).
NEGATIVE: no lip-sync, no mouth shapes, no captions or on-screen text, no realism,
  no photoreal feathers, no extra colours, no symmetric eyes, no eyebrows, no
  EYELASHES (video models add lashes to large eyes under motion — verified drift),
  no confetti, no black bars or letterboxing.
```

Restate the identity anchors in every block's prompt — video models drift the moment an
anchor is left implicit.

**Eye-state rules for video prompts (calibrated live, first pilot reel 2026-08-12):**

- **One eye state per clip.** Mid-clip conversions ("^^ for the first beat, then open")
  are what invite drift: the model added EYELASHES on the transition twice in a row.
  Pick open OR ^^ for the whole block and say the shape "NEVER changes".
- **Do not request `^^` eyes on video at all.** Three consecutive attempts (bare "happy
  ^^", "arcs for the first beat", and a fully spelled-out "one thin smooth upward arch,
  no X, no lashes") each drew lashes, `><` squints, or blush — closed-arc happy eyes are
  a cute-anime attractor for video models in this soft style. Carry warmth with the open
  asymmetric eyes + head tilt + body language; reserve `^^` for stills, where it holds.
- **Night scenes drift to sleep — and prompting cannot fully stop it.** Two maximal
  "eyes stay OPEN, awake, NEVER sleeping" attempts both rendered her asleep under the
  moon. If a block needs an awake owl, do not stage it as calm-owl-on-branch-under-moon:
  restage (dusk, interior lamplight, mid-glide) or accept the rest mood deliberately.
- **"Asymmetric eyes" can collapse into a wink on video** — the model reads
  left-larger-than-right as one-eye-closed. If a clip must hold both eyes open, say
  "BOTH eyes open, the right eye smaller but fully open, never winking".
- **A "glint pass" over the badge reads as a recolour** — the badge flashed amber-yellow
  mid-glint. Skip glint effects on the badge in video; keep celebration to the hop.
- The blink from the idle layer is a stills-of-motion nicety the current generation of
  video models cannot do without risking lash drift — omit it from prompts; accept
  no-blink clips.

**Mascot arc.** Block 1: Heddy greets by GESTURE (wave or hop — the VO carries the words;
she never mouths them). Final block: sign-off wave. Middle blocks: Heddy cameos only when
she earns her place in the shot (presenting, pointing, reacting) — a reel where she
loiters in every frame reads as filler. Blocks that are pure diagram/product are allowed
to have no owl at all.

## 5. Reel pipeline B — reference replication

For "make us one like this" — restaging a reference video's structure with Heddy.

1. **Break down the reference into beats:** for each beat log duration, camera, subject
   action, and the job the beat does (hook, build, payoff, CTA).
2. **Translate each beat through the DNA:** recast the subject's action into Heddy's
   vocabulary (§2) via the interaction model — a hand pointing becomes a wing point; a
   character running becomes a glide; a jump-cut celebration becomes one bounce + badge
   glint. If a beat's action has no legal Heddy equivalent (grasping, typing, talking to
   camera with lip-sync), change the STAGING of the beat, keep its job.
3. **Restage, don't copy:** the reference contributes rhythm, shot grammar, and structure
   only. Zero visual assets, characters, or protected styling cross over (brand-safety
   rule S4).
4. Generate per-beat clips using the §4 template (same one-style-key rule, VO-first if
   narrated).

## 6. The character-fidelity gate (both pipelines)

Every clip passes the gate before assembly. Watch the FULL clip — drift happens
mid-motion, not on the conditioning frame.

- Run the on-model anchors (`heddy-dna.md`) at start, midpoint, and motion extreme.
- Run §3's motion rules across the clip.
- **Any identity anchor drifting mid-motion is a hard fail** — eyes equalising during a
  head turn, the beak growing a hook in profile, wings sprouting fingers to gesture, a
  fifth colour blooming in.
- **Re-roll the failing CLIP, not the whole reel.** Same style key, same prompt; if the
  same anchor fails twice, change the POSE or camera in that block (repeated topology
  failure means the pose is fighting the model — the repair policy from
  `qa-checklist.md` applies per clip).
- A clip that passes fidelity but breaks the beat's job (wrong energy, wrong direction of
  attention) also re-rolls — motion serves the story, then the gate protects the owl.
