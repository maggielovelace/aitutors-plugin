#!/usr/bin/env python3
"""Heddy IP image generation — Gemini REST backend (nano-image-generator pattern).

Standalone, stdlib-only. Calls the Gemini generateContent endpoint directly.

  python3 generate.py "prompt text" -o out.png
  python3 generate.py --prompt-file prompt.txt -o out.png --ref sheet.png --aspect 4:5
  python3 generate.py "sticker pose" -o sticker.png --cutout

Requires GEMINI_API_KEY in the environment. Never prints the key.
Prints one JSON line per saved image: {path, model, aspect, refs, cutout_alpha}.
"""

import argparse
import base64
import json
import os
import struct
import sys
import urllib.error
import urllib.request
import zlib
from typing import NoReturn

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-3-pro-image-preview"
ASPECTS = ["1:1", "3:4", "4:5", "9:16", "16:9", "21:9"]
SIZES = ["1K", "2K", "4K"]
MAX_REFS = 14

CUTOUT_INSTRUCTION = (
    " Render the character alone on a completely flat, uniform, pure magenta "
    "(#FF00FF) background filling the entire frame. No scene, no shadow cast on "
    "the background, no gradient, no vignette, no text."
)


def die(msg, code=1) -> "NoReturn":
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def api_key():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        die("GEMINI_API_KEY is not set in the environment")
    return key


def http_json(url, payload=None, key=""):
    """POST payload (or GET if None) to url; return (status, parsed-json-or-text)."""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST" if data else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            body = json.loads(body)
        except ValueError:
            pass
        return e.code, body
    except urllib.error.URLError as e:
        die(f"network error calling Gemini: {e.reason}")


def mime_for(path):
    ext = os.path.splitext(path)[1].lower()
    return {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".gif": "image/gif",
    }.get(ext, "image/png")


def build_request(prompt, refs, aspect, size):
    parts = []
    for ref in refs:
        with open(ref, "rb") as f:
            parts.append({"inline_data": {
                "mime_type": mime_for(ref),
                "data": base64.b64encode(f.read()).decode(),
            }})
    parts.append({"text": prompt})
    return {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect, "imageSize": size},
        },
    }


def list_image_models(key):
    """Best-effort hint: names of models that look image-capable."""
    status, body = http_json(f"{API_BASE}/models?pageSize=200", key=key)
    if status != 200 or not isinstance(body, dict):
        return []
    names = []
    for m in body.get("models", []):
        name = m.get("name", "").removeprefix("models/")
        if "image" in name or "IMAGE" in str(m.get("supportedGenerationMethods", "")):
            names.append(name)
    return names


def extract_image(body):
    """Pull the first inline image (bytes) out of a generateContent response."""
    for cand in body.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            blob = part.get("inlineData") or part.get("inline_data")
            if blob and blob.get("data"):
                return base64.b64decode(blob["data"])
    return None


# ---------------------------------------------------------------- PNG chroma key
# Minimal PNG codec: enough to read what Gemini returns (8-bit RGB/RGBA,
# non-interlaced) and write RGBA. Anything else fails loudly.

def _png_chunks(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos = 8
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        yield ctype, data[pos + 8:pos + 8 + length]
        pos += 12 + length


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def png_decode(data):
    """Return (width, height, rgba bytearray)."""
    width = height = None
    bitdepth = colortype = interlace = None
    idat = bytearray()
    for ctype, chunk in _png_chunks(data):
        if ctype == b"IHDR":
            width, height, bitdepth, colortype, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    if width is None or height is None:
        raise ValueError("PNG missing IHDR chunk")
    if bitdepth != 8 or colortype not in (2, 6) or interlace != 0:
        raise ValueError(f"unsupported PNG (bitdepth={bitdepth} colortype={colortype} interlace={interlace})")
    channels = 3 if colortype == 2 else 4
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    out = bytearray(height * width * 4)
    prev = bytearray(stride)
    pos = 0
    for y in range(height):
        ftype = raw[pos]
        line = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        if ftype == 1:  # Sub
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                upleft = prev[i - channels] if i >= channels else 0
                line[i] = (line[i] + _paeth(left, prev[i], upleft)) & 0xFF
        elif ftype != 0:
            raise ValueError(f"bad PNG filter type {ftype}")
        prev = line
        # expand to RGBA
        o = y * width * 4
        if channels == 4:
            out[o:o + stride] = line
        else:
            for x in range(width):
                out[o + x * 4:o + x * 4 + 3] = line[x * 3:x * 3 + 3]
                out[o + x * 4 + 3] = 255
    return width, height, out


def png_encode(width, height, rgba):
    """Encode RGBA bytes as a PNG (filter 0 throughout)."""
    def chunk(ctype, body):
        return (struct.pack(">I", len(body)) + ctype + body
                + struct.pack(">I", zlib.crc32(ctype + body) & 0xFFFFFFFF))
    stride = width * 4
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 6))
            + chunk(b"IEND", b""))


def chroma_key_magenta(png_bytes, tolerance=90):
    """Key near-#FF00FF pixels to transparent. Returns new PNG bytes.

    Tolerance-based: a pixel is background when R and B are high, G is low,
    and it sits within `tolerance` of pure magenta per channel. The fringe
    pass softens only pixels that are actually magenta-hued (green well below
    both red and blue) so greys, pinks and browns on the subject stay opaque.
    """
    width, height, rgba = png_decode(png_bytes)
    n = width * height
    for i in range(n):
        o = i * 4
        r, g, b = rgba[o], rgba[o + 1], rgba[o + 2]
        if (255 - r) <= tolerance and g <= tolerance and (255 - b) <= tolerance:
            rgba[o + 3] = 0
        elif ((255 - r) <= tolerance * 2 and g <= tolerance * 2
              and (255 - b) <= tolerance * 2 and g < min(r, b) - 80):
            # fringe zone: soften halo pixels that are still magenta-hued
            rgba[o + 3] = min(rgba[o + 3], 128)
    return png_encode(width, height, rgba)


# ---------------------------------------------------------------------- main

def sniff_format(data):
    """Best-effort image-format detection from magic bytes."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return None


def numbered(path, index, count):
    if count == 1:
        return path
    root, ext = os.path.splitext(path)
    return f"{root}-{index:02d}{ext or '.png'}"


def main():
    ap = argparse.ArgumentParser(description="Generate Heddy IP images via the Gemini REST API.")
    ap.add_argument("prompt", nargs="?", help="image prompt (or use --prompt-file)")
    ap.add_argument("--prompt-file", help="read the prompt from a file")
    ap.add_argument("--output", "-o", required=True, help="output PNG path")
    ap.add_argument("--ref", "-r", action="append", default=[],
                    help=f"reference image, repeatable (max {MAX_REFS})")
    ap.add_argument("--aspect", "-a", choices=ASPECTS, default="1:1")
    ap.add_argument("--size", "-s", choices=SIZES, default="2K")
    ap.add_argument("--count", "-n", type=int, default=1, help="number of images (sequential calls)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--cutout", action="store_true",
                    help="magenta-screen the prompt, then key #FF00FF to alpha")
    ap.add_argument("--dry-run", action="store_true", help="print request JSON, make no call")
    args = ap.parse_args()

    if args.prompt and args.prompt_file:
        die("give a positional prompt OR --prompt-file, not both")
    if args.prompt_file:
        if not os.path.isfile(args.prompt_file):
            die(f"prompt file not found: {args.prompt_file}")
        with open(args.prompt_file, encoding="utf-8") as f:
            prompt = f.read().strip()
    elif args.prompt:
        prompt = args.prompt
    else:
        die("no prompt given (positional or --prompt-file)")
    if not prompt:
        die("prompt is empty")
    if len(args.ref) > MAX_REFS:
        die(f"too many reference images ({len(args.ref)} > {MAX_REFS})")
    for ref in args.ref:
        if not os.path.isfile(ref):
            die(f"reference image not found: {ref}")
    if args.count < 1:
        die("--count must be >= 1")

    if args.cutout:
        prompt += CUTOUT_INSTRUCTION

    request = build_request(prompt, args.ref, args.aspect, args.size)

    if args.dry_run:
        print(json.dumps(request, indent=2))
        return

    key = api_key()
    url = f"{API_BASE}/models/{args.model}:generateContent"
    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)

    for i in range(1, args.count + 1):
        status, body = http_json(url, request, key)
        if status == 404:
            hint = list_image_models(key)
            msg = f"model '{args.model}' not found (HTTP 404)."
            if hint:
                msg += " Image-capable models available: " + ", ".join(sorted(hint))
            else:
                msg += " Could not list models — check the model id against ai.google.dev."
            die(msg)
        if status != 200:
            die(f"Gemini API error HTTP {status}: {json.dumps(body) if not isinstance(body, str) else body}")

        image = extract_image(body)
        if image is None:
            feedback = body.get("promptFeedback") if isinstance(body, dict) else None
            die("response contained no image"
                + (f" (promptFeedback: {json.dumps(feedback)})" if feedback else ""))

        cutout_alpha = False
        if args.cutout:
            try:
                image = chroma_key_magenta(image)
                cutout_alpha = True
            except (ValueError, zlib.error, struct.error, IndexError) as e:
                print(f"warning: chroma key skipped ({e}); saving opaque image", file=sys.stderr)

        path = numbered(args.output, i, args.count)
        fmt = sniff_format(image)
        root, ext = os.path.splitext(path)
        if fmt and ext.lower() != f".{fmt}" and not (fmt == "jpg" and ext.lower() == ".jpeg"):
            path = f"{root}.{fmt}"
            print(f"warning: response is {fmt}, saving as {path}", file=sys.stderr)
        with open(path, "wb") as f:
            f.write(image)
        print(json.dumps({
            "path": path,
            "model": args.model,
            "aspect": args.aspect,
            "refs": len(args.ref),
            "format": fmt or "unknown",
            "cutout_alpha": cutout_alpha,
        }))


if __name__ == "__main__":
    main()
