# Heddy's dance

**English** · [中文](README.zh-CN.md)

A 10-second stop-motion dance, rendered from the locked `../model/heddy.json` in the same
studio as the film. Heddy dances alone, or leads the eight brick-built AI tutors from
[`faculty/built`](../../../faculty/built/README.md).

| File | Format | Content |
|---|---|---|
| `video/heddy-lego-dance-16x9.mp4` | 10 s, 1280×720, 24 fps | Heddy alone |
| `video/heddy-team-dance-16x9.mp4` | 10 s, 1280×720, 24 fps | Heddy leads the AI tutors, two staggered rows |
| `video/heddy-team-dance-9x16.mp4` | 10 s, 720×1280, 24 fps | the same, in a diamond four rows deep |

## How it moves

Heddy has one real joint, the turntable swivel (±20°). Nothing on the model is bent, redrawn
or recoloured. The dance is stop motion of the whole toy, the way a hand would move it: hops,
rocks, shuffles and spins, with the swivel as the counter-twist. The tutors are busts on
plinths with no joint, so they hop, rock and spin as whole pieces.

Heddy starts every move. Each row behind follows a fraction of a beat later, so the
turn-around and the final spin ripple back through the team.

| Time | Move |
|---|---|
| 0.0–1.5 s | back to the lens, wiggle on the swivel |
| 1.5–2.4 s | hop-turn to face the lens |
| 2.4–5.0 s | rock side to side |
| 5.0–6.3 s | shuffle left and right |
| 6.3–7.8 s | nod and quarter turns |
| 7.8–8.7 s | full spin |
| 8.7–10 s | landing pose, head cocked |

The whole dance is the `pose(t)` function in `render_dance.py`. The tempo is 112 BPM, rendered
on twos. Captions land one word at a time on the beat, set in Bricolage Grotesque (OFL,
`../tools/fonts/`). The beat is synthesised in `make_dance.py`; no sampled audio is used. The
team videos carry the label "Heddy and the AI tutors".

## Rebuild

Needs Python 3.11 with `bpy`, `numpy`, `pillow` and `imageio-ffmpeg`. Run from the repo root:

```bash
# Heddy alone
python heddy-ip/lego/dance/render_dance.py heddy-ip/lego /tmp/dance 1280 720 32
python heddy-ip/lego/dance/make_dance.py /tmp/dance heddy-ip/lego heddy-lego-dance-16x9.mp4

# with the AI tutors (16:9, then 9:16)
python heddy-ip/lego/dance/render_dance.py heddy-ip/lego /tmp/team169 1280 720 32 --team
python heddy-ip/lego/dance/make_dance.py /tmp/team169 heddy-ip/lego heddy-team-dance-16x9.mp4
python heddy-ip/lego/dance/render_dance.py heddy-ip/lego /tmp/team916 720 1280 32 --team
python heddy-ip/lego/dance/make_dance.py /tmp/team916 heddy-ip/lego heddy-team-dance-9x16.mp4
```

Rendering is resumable: finished frames are skipped. The AI tutors are covered by
[`faculty/LICENSE.md`](../../../faculty/LICENSE.md).
