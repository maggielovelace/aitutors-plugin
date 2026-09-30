# Motion DNA — how Heddy moves

How Heddy moves is part of her identity, exactly like the asymmetric eyes. A clip where she
moves like a generic bouncy mascot is off-model even if every frame passes the still-image
anchors. This file defines the movement vocabulary as render-checkable specs, then the two
reel pipelines that use it. Source of truth for the numbers: the production animation rig
(`scripts/video/heddy-intro/rig.ts` + `timeline.ts`) — do not re-derive them.

Character anchors (silhouette, eyes, palette, interaction model) live in `heddy-dna.md`.
Every motion spec below inherits them: an anchor that holds at frame 1 must hold at every
frame. **One declared exception:** anchor 8's closed beak is a still-image and merchandise
rule — in motion the beak may open, but only exactly as the Speaking and Yawn specs below
allow (lower mandible drops and closes; the diamond shape, colour and upper half never
change). Speaking articulation is driven by **Heddy's own audio only** — see §1a. This is
the sole motion exception; `heddy-dna.md` anchor 8 cross-references it.

**Changed 2026-09-30.** Until this date the Talking row read "no lip-sync — an owl beak,
not a mouth": the beak dropped in a loose jitter that was not tied to any words. Heddy now
speaks her own short companion lines in a live voice session, and her beak is synchronised
to them. What did not change: she never teaches, the beak never becomes a mouth, and it
never moves to anyone else's voice.

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
| Speaking (her own lines) | lower mandible opens and closes **in sync with Heddy's own audio**, stepping through a small set of beak positions (closed → part-open → open, max ~70%); upper mandible fixed; never fully shut mid-line, never gaping; closed again the moment her line ends | moves ONLY while she herself is speaking — still and closed whenever another voice (the professor, a narrator) is heard; no lip shapes, no teeth, no tongue — an owl beak opening and closing, never a mouth |

Asleep (rest mood) variant: eyes are the closed downward arcs, italic serif "z" floats
upper-right, and the ONLY motion is the slow breathe — no blink (eyes are shut), no gaze,
no gestures. Sleep is still, not limp.

### 1a. Speaking — her own lines only (changed 2026-09-30)

In a live voice session the **professor is the tutor** and carries the teaching voice;
Heddy is the companion beside the lesson. Her spoken lines are short and there are three
kinds:

| She may say | Example register |
|---|---|
| **Greeting / hand-over** | hello, then over to the professor |
| **Encouragement / celebration** | a quiet "well done" — the single-bounce register, never fanfare |
| **Goodbye** | the sign-off |

Render-checkable rules:

1. **Her audio, her beak.** Beak articulation is synchronised to Heddy's own audio and
   nothing else. While the professor (or a narrator, or the child) is speaking, her beak is
   closed and still — the idle layer continues, the beak does not. A beak moving over
   another character's voice is a hard fail. (The one silent opening is the **Yawn**
   gesture in §2 — rest-adjacent scenes only, never mid-session.)
2. **She never teaches.** No subject content, no hints, no answers, never explaining
   working, never at a whiteboard instructing. If a line would carry any of the lesson it
   is the professor's line, not hers.
3. **Same beak, open or closed.** The articulator is the amber diamond and only that. No
   drawn mouth, lips, teeth or tongue; the beak does not stretch, curve into a smile, or
   change colour when it opens.
4. **Closed is the default.** Still images and merchandise keep the closed / at-rest beak.
   Only live voice and animated contexts open it.
5. **Never on a safeguarding screen.** If a safeguarding message is on screen, Heddy does
   not speak and does not appear (brand-safety S1, unchanged).
6. **Never mirrored.** Flipping the character swaps her asymmetric eyes (`heddy-dna.md`
   anchor 5) — unchanged, and it matters more here because voice UIs like to flip a
   character to face the speaker. Turn her by head tilt and gaze instead.

The written-voice rules in `voice-and-captions.md` (one quiet sentence, no fanfare, British
English) apply to spoken lines as written.

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
   stretches into a smile, snout, hooked raptor bill, or a mouth with lips, teeth or a
   tongue.
5. The face interior stays protected: nothing enters it during motion (no wing across the
   face, no props overlapping the eyes/beak).
6. The belly badge and snow speckles stay attached to the body through every transform.
7. Idle layer present in every held moment — a frozen Heddy mid-clip is a fail.
8. Silhouette is preserved at motion extremes: the round body never squashes/stretches
   beyond ~±5% (no rubber-hose deformation).
9. The beak moves only on Heddy's own audio (§1a). Scrub any stretch where another voice
   is heard: her beak must be closed and still throughout it.
10. She is never mirrored: the larger iris is on HER left at every frame.

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
NEGATIVE: no lip-sync to the narration (clips are generated silent — see Mascot arc),
  no mouth shapes (lips, teeth, tongue), no captions or on-screen text, no realism,
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

**Mascot arc.** Block 1: Heddy greets by GESTURE (wave or hop). Clips are generated
silent, so the video model is never asked to lip-sync — a beak flapping against a
narration it cannot hear is a fail. If the narration bed is Heddy's own voice and the edit
animates her beak to it, that follows §1a exactly: driven by her audio, only over her own
lines, closed and still under any other voice. Final block: sign-off wave. Middle blocks: Heddy cameos only when
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
   glint. If a beat's action has no legal Heddy equivalent (grasping, typing, delivering a
   lesson to camera), change the STAGING of the beat, keep its job. A presenter's
   to-camera greeting or sign-off CAN become Heddy's own line under §1a; a presenter
   explaining the content cannot — that beat is restaged around the professor or a
   diagram.
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
  head turn, the beak growing a hook in profile, the beak turning into a mouth (lips,
  teeth, tongue), the beak moving over a voice that is not hers, wings sprouting fingers
  to gesture, a fifth colour blooming in.
- **Re-roll the failing CLIP, not the whole reel.** Same style key, same prompt; if the
  same anchor fails twice, change the POSE or camera in that block (repeated topology
  failure means the pose is fighting the model — the repair policy from
  `qa-checklist.md` applies per clip).
- A clip that passes fidelity but breaks the beat's job (wrong energy, wrong direction of
  attention) also re-rolls — motion serves the story, then the gate protects the owl.
