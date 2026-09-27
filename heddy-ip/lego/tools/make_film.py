"""Composite + encode the films from the rendered 1080p frames.

  hero   : 45 s, 16:9, 3840x2160 @ 24 fps (frames rendered at 1920x1080, Lanczos-upscaled)
  social : ~29 s, 9:16, 1080x1920 (centre crops of the same frames)
  sting  : 8 s, 16:9, 3840x2160 (face click -> logo)
Text is set in Bricolage Grotesque / IBM Plex Sans (OFL). Sound is synthesised:
one click per part landing (timed from the build timeline), a quiet warm pad,
a soft chime on the logo.
Usage: python3 make_film.py FRAMES_DIR OUT_DIR [hero,social,sting]
"""
import os, sys, math, wave, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_film as RF

FR = sys.argv[1]
OUT = sys.argv[2]
WHICH = sys.argv[3].split(',') if len(sys.argv) > 3 else ['hero', 'social', 'sting']
os.makedirs(OUT, exist_ok=True)
FPS = RF.FPS
FF = imageio_ffmpeg.get_ffmpeg_exe()
FD = os.path.join(HERE, 'fonts')
DISP = lambda s: ImageFont.truetype(os.path.join(FD, 'BricolageGrotesque-ExtraBold.ttf'), s)
DISPM = lambda s: ImageFont.truetype(os.path.join(FD, 'BricolageGrotesque-Medium.ttf'), s)
TEXT = lambda s: ImageFont.truetype(os.path.join(FD, 'IBMPlexSans-Medium.ttf'), s)
INK, PAPER, AMBER = (0, 23, 59), (248, 243, 235), (220, 148, 0)

# global timeline: (shot, frame) for each output frame
TL = []
for s, d in RF.SHOTS:
    for f in range(d * FPS):
        TL.append((s, f))


def frame(shot, f):
    p = os.path.join(FR, shot, f'f{f:04d}.png')
    while not os.path.exists(p) and f > 0:          # held frames
        f -= 1
        p = os.path.join(FR, shot, f'f{f:04d}.png')
    return Image.open(p).convert('RGB')


def fade(t, t0, t1, fi=0.5, fo=0.5):
    if t < t0 or t > t1:
        return 0.0
    return max(0.0, min(1.0, (t - t0) / fi, (t1 - t) / fo))


def text_layer(size, items):
    """items: (text, font, (x,y) as fractions, anchor, colour, alpha)"""
    L = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    for txt, fnt, (x, y), anc, col, a in items:
        if a <= 0:
            continue
        d.text((x * size[0], y * size[1]), txt, font=fnt, fill=col + (int(255 * a),), anchor=anc)
    return L


def overlays(t, size, vertical=False):
    """Brief section 14 text, per global time t (s)."""
    W, H = size
    u = H / 2160 if not vertical else W / 1215
    it = []
    # shot 01
    a = fade(t, 0.7, 2.9, 0.6, 0.4)
    it.append(('Every big idea starts with one small piece.', TEXT(int(64 * u)), (0.5, 0.86), 'mm', PAPER, a))
    # shot 06 engineering labels
    base = 23.0
    for n, lab in enumerate(('Real brick geometry', 'Buildable connections', 'Designed piece by piece')):
        a = fade(t, base + 0.35 + n * 0.45, base + 3.6, 0.35, 0.35)
        pos = (0.07, 0.12 + n * 0.055) if not vertical else (0.5, 0.1 + n * 0.035)
        it.append((lab, DISPM(int(58 * u)), pos, 'lm' if not vertical else 'mm', INK, a))
    # shot 10 brand reveal
    b = 40.0
    it.append(('HEDDY', DISP(int(170 * u)), (0.5, 0.12 if not vertical else 0.14), 'mm', INK, fade(t, b + 0.3, 46, 0.6, 0.1)))
    it.append(('Your AI learning companion', TEXT(int(56 * u)), (0.5, 0.205 if not vertical else 0.19), 'mm', INK,
               fade(t, b + 1.2, 46, 0.6, 0.1)))
    it.append(('heddy.app', DISP(int(72 * u)), (0.5, 0.86 if not vertical else 0.84), 'mm', AMBER, fade(t, b + 2.1, 46, 0.6, 0.1)))
    it.append(('Think it through with Heddy.', TEXT(int(50 * u)), (0.5, 0.925 if not vertical else 0.885), 'mm', INK,
               fade(t, b + 3.0, 46, 0.6, 0.1)))
    return text_layer(size, it)


def up4k(im):
    im = im.resize((3840, 2160), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=40, threshold=2))


# ------------------------------------------------------------------ audio
SR = 48000


def click(n, strength=1.0, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SR
    body = np.sin(2 * math.pi * 2900 * t) * np.exp(-t * 180) + 0.6 * np.sin(2 * math.pi * 1700 * t) * np.exp(-t * 120)
    tick = rng.normal(0, 1, n) * np.exp(-t * 900)
    return strength * (0.55 * body + 0.35 * tick)


def soundtrack(duration, events, pad=True, chime_at=None):
    n = int(duration * SR)
    a = np.zeros(n)
    for k, (tt, s) in enumerate(events):
        i = int(tt * SR)
        c = click(int(0.08 * SR), s, k)
        j = min(n, i + len(c))
        if 0 <= i < n:
            a[i:j] += c[:j - i]
    if pad:
        t = np.arange(n) / SR
        env = np.clip(t / 4, 0, 1) * np.clip((duration - t) / 2.5, 0, 1)
        chord = [220.0, 277.18, 329.63, 415.30]          # A maj7, soft
        p = sum(np.sin(2 * math.pi * f * t + k) * (0.5 + 0.5 * np.sin(2 * math.pi * 0.07 * t + k)) for k, f in enumerate(chord))
        a += 0.018 * env * p
    if chime_at is not None:
        t = np.arange(n) / SR - chime_at
        m = t >= 0
        for f, g in ((880.0, 1.0), (1318.5, 0.5), (1760.0, 0.25)):
            a[m] += 0.08 * g * np.sin(2 * math.pi * f * t[m]) * np.exp(-t[m] * 1.6)
    a = a / max(1e-6, np.abs(a).max()) * 0.6
    return (a * 32767).astype(np.int16)


def write_wav(path, data):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def build_events(t0=0.0, t1=1e9, offset=0.0):
    ev = []
    for k, f in RF.land.items():
        tt = f / FPS
        if not (t0 <= tt < t1) or f < 0:
            continue
        sh = [s for s, _ in RF.SHOTS if RF.S0[s] <= f < RF.S0[s] + RF.NF[s]]
        s = 0.35 if sh and sh[0] == 's03' else 1.0
        ev.append((tt - t0 + offset, s))
    ev.sort()
    # time-lapse: thin the dense clicks so it reads as a soft crackle
    out, last = [], -1
    for tt, s in ev:
        if s < 1 and tt - last < 0.045:
            continue
        out.append((tt, s))
        last = tt
    # exploded view snaps back together
    return out


def encode(frames_iter, size, wav, out, crf=18):
    cmd = [FF, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size[0]}x{size[1]}', '-r', str(FPS), '-i', '-',
           '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    for im in frames_iter:
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()
    print('wrote', out)


# ------------------------------------------------------------------ hero
if 'hero' in WHICH:
    def gen():
        for n, (s, f) in enumerate(TL):
            t = n / FPS
            im = up4k(frame(s, f)).convert('RGBA')
            im.alpha_composite(overlays(t, im.size))
            yield im.convert('RGB')
    ev = build_events()
    snap = RF.S0['s06'] / FPS + 0.7 * 4 + 1.1
    ev += [(snap + 0.02 * k, 0.8) for k in range(6)]
    wav = os.path.join(OUT, 'hero.wav')
    write_wav(wav, soundtrack(len(TL) / FPS, ev, chime_at=40.3))
    encode(gen(), (3840, 2160), wav, os.path.join(OUT, 'heddy-lego-hero-16x9-4k.mp4'))

# ------------------------------------------------------------------ social 9:16
# (global second in, length, horizontal crop centre)
SOCIAL = [(0.5, 2.0, 0.27), (3.2, 3.0, 0.5), (7.2, 4.0, 0.5), (13.0, 5.0, 0.5), (18.5, 3.0, 0.5), (23.0, 3.2, 0.47),
          (31.2, 4.4, 0.55), (40.0, 5.0, 0.5)]
if 'social' in WHICH:
    def gen():
        for g0, ln, cx in SOCIAL:
            for k in range(int(ln * FPS)):
                n = int(g0 * FPS) + k
                s, f = TL[min(n, len(TL) - 1)]
                im = frame(s, f)
                w = int(1080 * 9 / 16)
                x0 = int(cx * 1920 - w / 2)
                x0 = max(0, min(1920 - w, x0))
                im = im.crop((x0, 0, x0 + w, 1080)).resize((1080, 1920), Image.LANCZOS)
                im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=50, threshold=2)).convert('RGBA')
                im.alpha_composite(overlays(n / FPS, im.size, vertical=True))
                yield im.convert('RGB')
    ev = []
    acc = 0.0
    for g0, ln, cx in SOCIAL:
        ev += build_events(g0, g0 + ln, acc)
        acc += ln
    wav = os.path.join(OUT, 'social.wav')
    write_wav(wav, soundtrack(acc, ev, chime_at=acc - 5 + 0.3))
    encode(gen(), (1080, 1920), wav, os.path.join(OUT, 'heddy-lego-social-9x16.mp4'))

# ------------------------------------------------------------------ sting
if 'sting' in WHICH:
    face0 = RF.S0['s04'] + 44          # left pupil lands, highlight click, right eye, beak
    face1 = RF.S0['s04'] + 100
    brand0 = RF.S0['s10']
    seq = [(n, n / FPS) for n in range(face0, face1)]

    def gen():
        for n in range(face0, face1):
            s, f = TL[n]
            yield up4k(frame(s, f))
        for k in range(6 * FPS):
            n = brand0 + min(k, RF.NF['s10'] - 1)
            s, f = TL[n]
            im = up4k(frame(s, f)).convert('RGBA')
            # compressed brand reveal
            t = 40.0 + k / FPS * 0.62
            im.alpha_composite(overlays(t + (0.4 if k > 2 * FPS else 0), im.size))
            yield im.convert('RGB')
    L = (face1 - face0) / FPS + 6
    ev = build_events(face0 / FPS, face1 / FPS, 0)
    wav = os.path.join(OUT, 'sting.wav')
    write_wav(wav, soundtrack(L, ev, pad=True, chime_at=(face1 - face0) / FPS + 0.3))
    encode(gen(), (3840, 2160), wav, os.path.join(OUT, 'heddy-lego-sting-16x9-4k.mp4'))
