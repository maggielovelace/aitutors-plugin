# Composition patterns — Mode A (content illustration)

How to stage one idea as one image in Heddy's world. Read `heddy-dna.md` (identity + interaction model) and `style-dna.md` (rendition look) first; this file governs structure, metaphor, and pose feasibility. Prompt assembly lives in `prompt-templates.md`.

## Pick ONE structure per image

Never mix structures. Before choosing, ask: *what must a stranger understand in one glance?* Then pick the single structure that carries that relationship.

1. **Before / after** — two states of the same scene, one visible change. Heddy's world: a chaotic scatter of flashcards → a tidy constellation of cards pinned to the night sky; an unlit study desk → the same desk with one lantern lit. Heddy performs the change (lights the lantern with a wing tip, pins the last card with a foot) or presents the after-state. The two states share the frame; do not draw an arrow between them — spatial contrast (left/right, dark/lit) does the work.
2. **Input → transform** — material enters a device, something visibly different comes out. Heddy's world: loose pages fed into a post-owl pigeonhole and emerging as a sorted card deck; a jumbled question dropped through a telescope and projected as one clear star. Heddy operates the device at a declared contact surface (wing presents the input; feet perch on the mechanism). One device only, hand-built and low-tech.
3. **Bottleneck / feedback** — something stuck, leaking, or looping back at a gate, scale, or return chute. Heddy's world: a stack of cards jammed at a narrow library slot; one card sliding back down a return chute to the desk (the SRS "again" loop); a balance scale weighing two small piles. Heddy attends the choke point — peering at it, nudging one card through with a wing tip. Amber marks the point of attention.
4. **Layered build** — capability rising step by step. Heddy's world: a ladder against a bookshelf with one book placed per rung; stacked lantern shelves each a little brighter; steps up to an observatory platform. Heddy is partway up — perched on a rung (feet), placing the next element (wing tip) — never at the top celebrating. Three to five layers, no more.
5. **Route / choice** — a path that forks, or a threshold to cross. Heddy's world: a branch that splits toward two lit windows (two professors' doors); a night path marked by lanterns where one fork is lit and one is dark; a doorway between a cluttered room and a clear sky. Heddy stands at the fork and *points with a wing* — she lights the way, she does not walk the path for the reader. (S2: she is a guide, never the teacher behind either door.)
6. **2–3 panel mini-comic** — the same Heddy and the same key object across 2–3 scenes, one action per panel, read left to right. Use for a change of state over time (energy Red → Amber → Green maps to rest → focus → ready eye specs per panel). ≤1 short label per panel. Run every QA check on every panel separately.

## Heddy's object world

Draw metaphors from this low-tech, night-school register — nothing electronic, nothing branded:

lanterns, candles, amber moon and stars, telescopes, observatory domes, oak branches, ladders, bookshelves, library carts, card decks and single flashcards, pigeonholes, post owls / letter satchels, balance scales, ink bottles, rolled maps, wooden doors and thresholds, stone steps, bunting made of cards.

Pick **1–2 objects** per image. The colour semantics are fixed (`style-dna.md`): amber = warmth/attention/moon; spark green = progress/success; ink = structure/night; white is reserved for Heddy.

## Fresh-metaphor rule

Never reuse a previous image's **object + action + label** combination — not within a set, not across sets. The same theme gets a different physical move each time: if "revision progress" was a ladder last time, it is a constellation filling in this time. Before prompting, check the shot list (and any prior delivery for the same channel) for collisions. Repeating an object is tolerable only when the action and labels are both new.

To build an original metaphor:

1. Replace the abstract word with a physical action: pile up, slot in, weigh, return, light, pin, sort, climb, hand over, uncover.
2. Choose 1–2 objects from the world above.
3. Let Heddy perform the action **with a real resistance or result** — a card that doesn't fit the slot, a lantern that changes what's visible, a scale that actually tips.

## The load-bearing test

Before finalising any editorial composition, ask: **if Heddy were painted out, would the image still explain itself?** If yes, she is decoration — restage so she performs the key conceptual action. She must be the actor at the point where the idea happens (feeding the input, unjamming the bottleneck, placing the rung, lighting the fork), not a mascot standing beside a diagram.

Corollary (S2): the action she performs is always *welcoming, carrying, presenting, lighting, celebrating, handing over* — never *teaching, marking, explaining at a blackboard*. If the load-bearing action would frame her as a tutor, change the metaphor, not the rule.

## Pose feasibility gate — validate BEFORE prompting

Heddy's interaction model (`heddy-dna.md`) is a hard constraint on staging. Check every planned pose against it before it goes in a prompt; an infeasible pose wastes renders and invites topology failures.

Contact surfaces and what they can do:

| Surface | Can | Cannot |
|---|---|---|
| Wing tips | carry, present, wave, point, nudge, light (touch a lantern) | grasp, grip, wrap around, hold anything requiring fingers |
| Feet | perch, stand, hold a flat card pressed against a surface | carry in flight-with-cargo poses that need a claw grip; fine manipulation |
| Beak | — (expression only) | operate, hold, peck at props |

Additional constraints:

- **Reach is short.** Wings contact objects close beside the body. No stretched arm-like wings, no wing spanning the canvas, no wing as a bridge or lever.
- **Locomotion:** flight, perch, small hop. No walking gaits, no running, no swimming.
- **Protected face interior:** only the locked eyes and diamond beak appear inside the facial disc. No prop, route line, or label may cross it.
- **One operated prop per contact surface.** A second prop rests in the scene (on the branch, the desk, the shelf). More props than surfaces is the classic fused-prop failure.
- **Occlusion:** Heddy is opaque. Ground lines, branches, shelf edges stop at her silhouette — never through it.

If a structure's key action needs a grasp (turning a crank, pulling a rope, writing), redesign the move: presses with a wing tip, perches on the mechanism so her weight operates it, or a card held flat under a foot. If no feasible move exists, pick a different metaphor. **Repeated topology failure in renders means change the pose, not the prompt** — see `qa-checklist.md`.

## Scale and space

One core idea per image. Heddy plus her key object occupy roughly 40–60% of the canvas; leave at least a third as negative space (paper or night sky, per the active rendition). Explainer-register images (see `prompt-templates.md`) may spread wider but keep the ≤5-station, ≤6-callout budget.
