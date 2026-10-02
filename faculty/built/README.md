# The brick-built faculty, built from real bricks

**English** · [中文](README.zh-CN.md)

![The code-built faculty](sheet.jpg)

The eight aitutors.me AI tutors as brick busts **engineered in code from real LDraw parts**,
the same way [LEGO Heddy](../../heddy-ip/lego/README.md) was made, and rendered in Heddy's
own studio (same plastic, bevels, lights and sweep). Each bust is 1,400–1,600 plates and tiles.

This is **version 2**. Version 1, painted by an image model, is in [`../`](../README.md).
Both are kept.

This folder is a **toolkit**, not just a set of pictures. Any agent (or person) can rebuild a
professor, render a new angle, cut them out on a transparent background, or add a new
character that sits in the same set.
Agents can start from the [ready-made prompts](#prompts-for-ai-agents).

## Use the portraits (no setup)

Any person or agent can use the finished portraits straight from this folder. Paste this into
any session (Claude Code, Codex, ChatGPT, Cursor):

```text
Use the brick-built faculty from https://github.com/maggielovelace/aitutors-plugin/tree/main/faculty/built
(read its README first). Portraits: renders/cutout/<id>.png (transparent) or renders/<id>.png (cream).
To make one talk or blink, swap renders/faces/<id>-{base,half,open,blink}.webp. Every portrait
appears with the label "AI tutor"; never call them LEGO. Curie, Quill and the Mentor are women.
```

Ids: `pi` (maths), `quill` (English), `darwin` (biology), `curie` (chemistry), `newton`
(physics), `harari` (history), `mercator` (geography), `mentor` (your week).

## What's here

| Path | What |
|---|---|
| `renders/<id>.png` | 1200 × 1200 portrait on the Heddy cream sweep |
| `renders/cutout/<id>.png` | the same shot with a transparent background (plinth kept, no floor) |
| `renders/faces/<id>-<state>.webp` | the face states, transparent: `base`, `half` and `open` (mouth), `blink` |
| `model/<id>.json` | the parts list the renderer reads (LDraw part, colour, position, rotation) |
| `model/<id>.ldr` | standard LDraw file. Opens in Studio, LDCad or LeoCAD, one step per plate layer |
| `tools/bust.py` | the builder: voxel field → hollow shell → real plates and tiles → `.json` + `.ldr` |
| `tools/prof_<id>.py` | one spec per character (face, hair, clothes, the object they hold) |
| `tools/render_bust.py` | renders a model with Heddy's studio (`../../heddy-ip/lego/tools/scene.py`) |
| `tools/build.py` | one command to rebuild and render one professor or all of them |
| `tools/face_states.py` | builds a professor with the mouth half open, open, or the eyes shut |
| `sheet.jpg` | all eight on one sheet |

Ids: `pi`, `newton`, `curie`, `darwin`, `quill`, `harari`, `mercator`, `mentor`.

## Setup (once)

Building a model needs only Python 3. Rendering needs Blender as a Python module, which needs
**Python 3.11** (tested with `bpy` 5.0.1):

```bash
conda create -y -p ./bpyenv python=3.11          # or any Python 3.11 venv
./bpyenv/bin/pip install bpy numpy pillow
export BPY_PYTHON=$PWD/bpyenv/bin/python
```

No Blender app is needed, and the LDraw part geometry is already in the repo
(`heddy-ip/lego/ldraw`, CC BY 4.0).

## Commands (run from the repo root)

```bash
python3 faculty/built/tools/build.py all                     # rebuild every model (.json + .ldr)
python3 faculty/built/tools/build.py pi --render             # rebuild Pi, render renders/pi.png
python3 faculty/built/tools/build.py all --render --cutout   # everything, both shots

# one-off renders
$BPY_PYTHON faculty/built/tools/render_bust.py faculty/built/model/pi.json out.png \
    --size 700 --samples 24            # quick draft (seconds)
$BPY_PYTHON faculty/built/tools/render_bust.py faculty/built/model/pi.json pi-left.png --rot 30
$BPY_PYTHON faculty/built/tools/render_bust.py faculty/built/model/pi.json pi-cut.png --cutout
```

A quick draft renders in seconds. A full-quality render (1200 px, 64 samples) takes a few minutes on a laptop CPU, longer if the machine is busy.

## How the builder works

A bust is a voxel field at real brick resolution: **one cell = 1 stud (20 LDU) wide × 1 stud
deep × 1 plate (8 LDU) tall**. Coordinates are in LDU, with X to the right, Y up and Z toward the viewer.

- `b.fill(pred, colour, tag)` sets every cell whose centre satisfies `pred(x, y, z)`.
  Helpers: `ell` (ellipsoid), `box`, `cyl_y`, `cyl_z`, and a `capsule` for limbs in the specs.
- `b.recolour(pred, colour, tags=…)` repaints existing cells (patterns, collars, hair on the head).
- `b.paint_front(pred2d, colour, tags=…, depth=1)` paints the **frontmost** cells of each column.
  This is how faces are drawn: eyes, mouth, glasses, beard.
- `b.bump_front(pred2d, colour, n=1)` adds cells in front: nose, brows, a chin.
- `b.to_parts(studded=(HAIR,))` hollows the model to a 2-cell shell. It then merges each plate layer
  greedily into the largest real plates that fit, with **tiles** on exposed tops (smooth) and studs kept
  on hair (texture). Only parts in Heddy's vendored library are used.
- `save(parts, 'model/<id>.json', meta)` writes the JSON and the `.ldr` beside it.

## The set lock: keep these, or it stops matching

Every professor shares these, and so must any new character or asset:

| | Value |
|---|---|
| Head | `ell(0, 334, 8, 130, 166, 118)`: 13 studs wide, 41 plates tall |
| Torso, neck, ears, arms | copy the functions in `prof_pi.py` unchanged |
| Eyes | 3-stud white with a 1-stud, 2-plate black pupil, centred |
| Brows / nose | a 1-cell forward bump |
| Plinth | colour 72, 3 plates, the whole bust shifted up 3 plates (end of each spec) |
| Camera | height **0.11149 m**, 85 mm lens, turntable **−16°**. The render script defaults to this |
| Final render | 1200 px, 64 samples, bg `EFE8DA`, floor `F4EEE3` |

The camera is fixed on purpose: a taller model (Curie's bun) must not move the camera, or she
would sit higher than the others.

## Adding a new character

1. Copy `tools/prof_pi.py` to `tools/prof_<id>.py` and add the id to `FACULTY` in `tools/build.py`.
2. Change **only** skin, hair, facial hair, glasses, mouth, clothes and the one object they hold.
   Give each character a single signature object held at the chest, as the eight do.
3. Draft at `--size 700 --samples 24`, **look at every render**, fix it, repeat (the eight took 4–8 drafts each).
4. Render the final and a cutout: `build.py <id> --render --cutout`.

**Quality bar, learned building the eight:**
- A light colour directly above a dark mouth line reads as **teeth**. Keep a plain skin row, or
  drop the moustache (Pi's fix).
- A heavy black frame across both eyes reads as a **visor**. Use thin frames, or only the top and outer rows.
- Check that the object still reads against the clothes. Tan paper vanished on tan sleeves
  (Harari's scroll is white), and a white flask neck vanished on a white coat.
- A brown lens rim reads as a hand mirror. Darwin's magnifier rim is black.

**Colours:** official LDraw codes only. Those used here: 15 white, 0 black, 71/72 greys, 78/92/84
nougats, 70 reddish brown, 308 dark brown, 19 tan, 28 dark tan, 2/10/288 greens, 330 olive, 272
dark blue, 73 medium blue, 212 light blue, 3 dark turquoise, 378 sand green, 4 red, 320 dark red,
25 orange, 484 dark orange, 14 yellow, 191 bright light orange. To add one, extend the colour
table in `render_bust.py` with its LDConfig hex.

## Making new assets from the same models

- **Other angles / a turntable:** `--rot` in steps (e.g. −60…60) and stitch the frames.
- **Expressions:** copy a spec and change only the face lines. A blink is the eye cells painted
  in skin colour with a one-plate lash line. A bigger smile moves the mouth corners up one plate.
  Keep the set lock.
- **Stickers, avatars, web:** use `renders/cutout/`. For small sizes crop to the head, then
  downscale. Don't upscale.
- **Talking and blinking:** use the face states (next section). Never fake a mouth by
  editing pixels; the states are real renders of the same bust.
- **Physical builds:** the `.ldr` opens in Studio. Note: unlike LEGO Heddy, these models have
  **not** been checked for stability or buildability (no connection or collision
  validation). They are made of real parts, but treat them as render models first.

## Face states: talking and blinking

Every professor has four renders of the same bust, from the same locked camera:
`renders/faces/<id>-base.webp`, `-half.webp` and `-open.webp` (the mouth opening by one and
two plates, with a tongue in `open`), and `-blink.webp` (skin over the eyes and one lash
line). Because only the face cells change, the four images are identical outside the face, so
you can stack them and swap which one is visible without anything else flickering.

- **Talking:** while a voice plays, pick a state per frame from its loudness (quiet `base`,
  medium `half`, loud `open`), with no single-frame flickers. This is how the introduction
  films and Live Talk move the mouths.
- **Blinking:** show `blink` for about 130 ms every 4 seconds or so, and never when the
  viewer prefers reduced motion.
- **New states:** `python3 faculty/built/tools/build.py <id> --faces` re-renders them as PNGs
  (needs BPY_PYTHON). `tools/face_states.py` shows how they're made if you want another
  expression.

## Prompts for AI agents

These prompts work in Codex, Claude Code, Cursor, Gemini CLI or any coding agent that can run shell
commands and view images. Clone the repo first and open the agent in its root:

```bash
git clone https://github.com/maggielovelace/aitutors-plugin.git && cd aitutors-plugin
```

Paste one prompt below, replacing the part in `<angle brackets>`. Every prompt tells the agent to
read this README first, keep the set lock and look at each render. Most bad results come from
skipping those three steps.

**1. Set up and check the toolkit works**

```text
Read faculty/built/README.md. Set up rendering as its "Setup" section describes (a Python 3.11
env with bpy, numpy and pillow) and export BPY_PYTHON. Then run
`python3 faculty/built/tools/build.py pi` and confirm `git status` shows no change to
faculty/built/model/ (a rebuild must reproduce the committed model exactly). Finally render a quick
draft: `$BPY_PYTHON faculty/built/tools/render_bust.py faculty/built/model/pi.json /tmp/pi-draft.png
--size 700 --samples 24`, open the image and tell me what you see.
```

**2. Stickers or avatars for one professor**

```text
Read faculty/built/README.md. Using the existing cutout faculty/built/renders/cutout/<curie>.png
(do not re-render), make <a 512 px square sticker with a 16 px white outline and a 256 px
circular avatar cropped to the head>. Crop first, then downscale; never upscale. Keep the plinth
out of the avatar. Save to <out/curie/> and show me each file.
```

**3. A new angle or a turntable**

```text
Read faculty/built/README.md and keep its set lock (do not change --cam-height, the lens or the
model). Render faculty/built/model/<newton>.json at --rot values from <-60 to 60 in steps of 10>,
at --size 700 --samples 24 for drafts. Look at every frame and check nothing clips or turns
unreadable. Then render the finals at 1200 px, 64 samples, and stitch them into <a 3-second MP4
loop with ffmpeg>. Never mirror an image to fake the other side.
```

**4. A new expression (blink, smile, surprise)**

```text
Read faculty/built/README.md, especially "Making new assets from the same models". Copy
faculty/built/tools/prof_<darwin>.py to prof_<darwin>_<smile>.py and change ONLY the face lines to
make <a bigger smile: mouth corners up one plate>. Keep everything in the set lock. Build it with
`python3 faculty/built/tools/prof_<darwin>_<smile>.py faculty/built/model/<darwin>_<smile>.json`, render a draft, and show me the draft next to
faculty/built/renders/<darwin>.png. Iterate until the only visible difference is the expression.
Do not overwrite the original professor.
```

**5. A new character that belongs in the set**

```text
Read faculty/built/README.md in full, then read faculty/built/tools/prof_pi.py and bust.py.
Create a new brick-built character: <Professor X, a man, teaches geography, dark skin, short grey
hair, round glasses, green jumper, holds a globe at his chest>. Follow "Adding a new
character": copy prof_pi.py, change only skin, hair, facial hair, glasses, mouth, clothes and the
one held object, and keep the set lock. Draft at --size 700 --samples 24, open every render and
fix what reads wrong (see the quality bar). Expect 4 to 8 drafts. When it is right, add the id to
FACULTY in build.py and run `build.py <id> --render --cutout`. Show me the final next to
faculty/built/renders/pi.png so I can check they match. The face must be original: it must not
resemble any real person.
```

**6. Put a professor into a web page or app**

```text
Read faculty/built/README.md, especially "Rules for every asset". Add the portrait
faculty/built/renders/cutout/<quill>.png to <the tutor card in src/components/TutorCard.tsx>.
Show the visible label "AI tutor" next to it, use alt text "<Professor Quill, AI tutor>", and
serve a downscaled WebP (no larger than twice the display size). Do not call it LEGO anywhere.
```

**7. Animate a professor (talking or blinking)**

```text
Read faculty/built/README.md, especially "Face states". Stack
faculty/built/renders/faces/<newton>-{base,half,open,blink}.webp exactly on top of each other.
Blink: show blink for ~130 ms every ~4 s (skip under prefers-reduced-motion). Talking: while
<this audio file> plays, choose base / half / open each frame from its loudness, holding each
state for at least 2 frames. Keep the "AI tutor" label visible next to the professor.
```

**What to check in anything an agent gives back**

- It matches the set: same head size, camera height, angle and plinth as the eight.
- It still says "AI tutor" wherever a professor appears in a product.
- The face is original, and the gender is right (Curie, Quill and the Mentor are women).
- Public text says "brick-built", never "LEGO".
- No teaching-method detail was added to this repository.

## Rules for every asset

- **AI tutors, labelled as such.** Wherever a portrait appears in the product it carries
  "AI tutor" ("AI 导师"). The faces are for warmth, never to suggest a person is on the other end.
- **Original characters.** The names honour real people. No face may resemble them or anyone real.
- **Genders are fixed** (owner rule): Curie, Quill and the Mentor are women; the other five are
  men. Quill is named after a pen, not a person.
- **"Brick-built", never "LEGO"** in anything public-facing. LEGO is a trademark.
- **No teaching-method detail** in this repository. Names, subjects and objects only.

Licence: see [`../LICENSE.md`](../LICENSE.md). Personal, non-commercial use of the artwork. Part
geometry: LDraw.org, CC BY 4.0.
