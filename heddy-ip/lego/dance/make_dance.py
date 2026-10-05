"""Composite the Heddy dance: word-by-word captions on the beat plus an original drum loop.

The frames come from render_dance.py. Captions are drawn here, deterministically,
with the fonts and brick colours that ship with the LEGO Heddy tools. The beat is
synthesised (no sampled or third-party audio).

Usage: python3 make_dance.py FRAMES_DIR LEGO_DIR OUT.mp4
"""
import sys, os, json, math, wave, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

FRAMES = os.path.abspath(sys.argv[1])
LEGO = os.path.abspath(sys.argv[2])
OUT = os.path.abspath(sys.argv[3])
sys.path.insert(0, os.path.join(LEGO, 'tools'))
FF = imageio_ffmpeg.get_ffmpeg_exe()

META = json.load(open(os.path.join(FRAMES, 'dance.json')))
W, H, FPS, NF = META['W'], META['H'], META['fps'], META['frames']
BEAT, T0 = 60.0 / META['bpm'], META['t0']
TEAM = META.get('team', False)
U = H if W > H else int(W * 0.9)         # type scale: frame height, or most of the width in 9:16
DUR = NF / FPS
INK, AMBER, WHITE = '#0D325B', '#F8BB3D', '#FFFFFF'      # LEGO Earth Blue / Flame Yellowish Orange
FONT = os.path.join(LEGO, 'tools', 'fonts', 'BricolageGrotesque-ExtraBold.ttf')
LABEL_FONT = os.path.join(LEGO, 'tools', 'fonts', 'IBMPlexSans-Medium.ttf')


def beat(n):
    return T0 + n * BEAT


# (start s, text, fill): one word at a time, on the beat
CAPS = [(0.0, 'GUESS', INK), (beat(0), "WHO'S", INK), (beat(1), 'BACK', INK), (beat(4), 'AGAIN', INK),
        (beat(6), "HEDDY'S", AMBER), (beat(9), 'BACK', INK), (beat(11), 'TELL', INK),
        (beat(11.5), 'A', INK), (beat(12), 'FRIEND', INK), (beat(14), "HEDDY'S BACK", AMBER)]


def caption(im, t):
    cur = [c for c in CAPS if c[0] <= t]
    if not cur:
        return im
    t0, txt, fill = cur[-1]
    pop = 1.0 + 0.28 * max(0.0, 1 - (t - t0) / 0.12) ** 2            # lands big, settles
    size = int(U * (0.085 if len(txt) > 8 else 0.105) * pop)
    font = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(im)
    sw = max(3, size // 14)
    stroke = INK if fill == AMBER else WHITE
    cx, cy = (W // 2, int(H * (0.88 if W > H else 0.80))) if TEAM else (int(W * 0.21), int(H * 0.76))   # team: under the lead
    d.text((cx, cy), txt, font=font, fill=fill, anchor='mm', stroke_width=sw, stroke_fill=stroke)
    return im


def label(im):
    """The faculty always appear with the label 'AI tutors' (faculty/built/README.md)."""
    font = ImageFont.truetype(LABEL_FONT, int(U * 0.03))
    ImageDraw.Draw(im).text((W - int(W * 0.03), int(H * 0.05)), 'Heddy and the AI tutors', font=font,
                            fill=INK, anchor='rm')
    return im


# ---------------------------------------------------------------- the beat
SR = 44100


def soundtrack():
    n = int(DUR * SR)
    out = np.zeros(n)
    rng = np.random.default_rng(7)

    def add(sig, t):
        i = int(t * SR)
        if i < n:
            out[i:i + len(sig)] += sig[:n - i]

    def env(length, decay):
        return np.exp(-np.arange(int(length * SR)) / (decay * SR))

    def kick():
        e = env(0.28, 0.07)
        ph = 2 * np.pi * np.cumsum(45 + 110 * env(0.28, 0.025)) / SR
        return 0.9 * np.sin(ph) * e

    def clap():
        e = env(0.16, 0.035)
        x = rng.standard_normal(len(e))
        return 0.35 * np.diff(x, prepend=0) * e

    def hat():
        e = env(0.05, 0.012)
        x = rng.standard_normal(len(e))
        return 0.12 * np.diff(np.diff(x, prepend=0), prepend=0) * e

    def bass(freq, length=0.22):
        e = env(length, 0.09)
        tt = np.arange(len(e)) / SR
        return 0.32 * np.tanh(2.5 * np.sin(2 * np.pi * freq * tt)) * e

    line = [55.0, 55.0, 65.41, 55.0, 49.0, 49.0, 55.0, 73.42]        # A1 A1 C2 A1 G1 G1 A1 D2
    b = 0
    while beat(b) < DUR - 0.3:
        add(kick(), beat(b))
        add(bass(line[b % 8]), beat(b))
        add(hat(), beat(b + 0.5))
        if b % 2:
            add(clap(), beat(b))
        else:
            add(bass(line[b % 8] * 2, 0.12), beat(b + 0.5))
        b += 1
    fade = np.clip((DUR - np.arange(n) / SR) / 0.5, 0, 1)
    out = np.tanh(out * 0.9) * fade
    return (out * 0.8 * 32767).astype(np.int16)


os.makedirs(os.path.dirname(OUT), exist_ok=True)
wav = OUT[:-4] + '.wav'
with wave.open(wav, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(soundtrack().tobytes())

cmd = [FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
       '-i', '-', '-i', wav, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
       '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in range(NF):
    im = Image.open(os.path.join(FRAMES, f'f{f:04d}.png')).convert('RGB')
    im = caption(im, f / FPS)
    p.stdin.write((label(im) if TEAM else im).tobytes())
p.stdin.close()
p.wait()
os.remove(wav)
print('wrote', OUT)
