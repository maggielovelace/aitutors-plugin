// The crop (D30, R3b · 05 "Size"): a box is cut to the viewport and ignored
// under 24 × 24, the PNG's longest side is at most 1600 and it steps down to
// 1280 then 1024 until it is within 1 MB, and the scale comes from the shot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const K = load('./lib/crop.js');

test('the limits are Jotters’ D9', () => {
  assert.equal(K.MIN_BOX, 24);
  assert.equal(K.MAX_SIDE, 1600);
  assert.deepEqual(K.STEPS, [1600, 1280, 1024]);
  assert.equal(K.MAX_BYTES, 1000000);
  assert.equal(K.MAX_IMAGES, 4);
});

test('a box is clamped to the viewport', () => {
  assert.deepEqual(K.clampBox({ x: -40, y: 100, w: 300, h: 200 }, 1280, 800), { x: 0, y: 100, w: 260, h: 200 });
  assert.deepEqual(K.clampBox({ x: 1200, y: 700, w: 300, h: 300 }, 1280, 800), { x: 1200, y: 700, w: 80, h: 100 });
  // drawn right to left, bottom to top
  assert.deepEqual(K.clampBox({ x: 500, y: 400, w: -200, h: -100 }, 1280, 800), { x: 300, y: 300, w: 200, h: 100 });
  assert.equal(K.clampBox({ x: 1300, y: 0, w: 100, h: 100 }, 1280, 800), null, 'wholly off screen');
});

test('under 24 × 24 is ignored, 24 × 24 is kept', () => {
  assert.equal(K.clampBox({ x: 10, y: 10, w: 23.9, h: 200 }, 1280, 800), null);
  assert.equal(K.clampBox({ x: 10, y: 10, w: 200, h: 23 }, 1280, 800), null);
  assert.deepEqual(K.clampBox({ x: 10, y: 10, w: 24, h: 24 }, 1280, 800), { x: 10, y: 10, w: 24, h: 24 });
  // a 30 px box that is only 20 px on screen is too small
  assert.equal(K.clampBox({ x: 1260, y: 10, w: 30, h: 100 }, 1280, 800), null);
});

test('bad numbers are refused', () => {
  assert.equal(K.clampBox({ x: NaN, y: 0, w: 100, h: 100 }, 1280, 800), null);
  assert.equal(K.clampBox({ x: 0, y: 0, w: 100, h: 100 }, 0, 800), null);
  assert.equal(K.clampBox(null, 1280, 800), null);
});

test('the longest side is at most 1600 and never scaled up', () => {
  assert.deepEqual(K.fitSide(2880, 1800, 1600), { w: 1600, h: 1000 });
  assert.deepEqual(K.fitSide(1800, 2880, 1600), { w: 1000, h: 1600 });
  assert.deepEqual(K.fitSide(540, 272, 1600), { w: 540, h: 272 });
  assert.deepEqual(K.fitSide(2880, 1800, 1024), { w: 1024, h: 640 });
});

/** A fake PNG encoder: `perPixel` bytes per output pixel. */
function fakeEncoder(perPixel) {
  const sizes = [];
  return {
    sizes,
    encode: async (w, h) => { sizes.push([w, h]); return new Uint8Array(Math.round(w * h * perPixel)); },
  };
}

test('within 1 MB at 1600: one encode', async () => {
  const e = fakeEncoder(0.3); // 1600 × 1000 × 0.3 = 480 000
  const r = await K.encodeUnderCap(2880, 1800, e.encode);
  assert.deepEqual(e.sizes, [[1600, 1000]]);
  assert.equal(r.w, 1600);
});

test('over 1 MB steps down to 1280, then 1024', async () => {
  const e = fakeEncoder(0.9); // 1 440 000 → 921 600 at 1280 × 800
  const r = await K.encodeUnderCap(2880, 1800, e.encode);
  assert.deepEqual(e.sizes, [[1600, 1000], [1280, 800]]);
  assert.deepEqual([r.w, r.h], [1280, 800]);
  assert.ok(r.bytes.length <= K.MAX_BYTES);

  const f = fakeEncoder(1.3); // 1 331 200 at 1280, 851 968 at 1024
  const s = await K.encodeUnderCap(2880, 1800, f.encode);
  assert.deepEqual(f.sizes, [[1600, 1000], [1280, 800], [1024, 640]]);
  assert.deepEqual([s.w, s.h], [1024, 640]);
});

test('exactly 1 000 000 bytes is within the cap; one more is not', async () => {
  const at = await K.encodeUnderCap(1000, 1000, async () => new Uint8Array(1000000));
  assert.ok(at);
  const over = await K.encodeUnderCap(1000, 1000, async () => new Uint8Array(1000001));
  assert.equal(over, null);
});

test('still too big at 1024 → null, never another format', async () => {
  const e = fakeEncoder(2);
  assert.equal(await K.encodeUnderCap(2880, 1800, e.encode), null);
  assert.equal(e.sizes.length, 3);
});

test('a small crop is encoded once, not three times at the same size', async () => {
  const e = fakeEncoder(100);
  assert.equal(await K.encodeUnderCap(300, 200, e.encode), null);
  assert.deepEqual(e.sizes, [[300, 200]]);
});

test('base64 helpers: no data: prefix, and the decoded size', () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);
  const b64 = K.base64FromBytes(bytes);
  assert.ok(!b64.startsWith('data:'));
  assert.ok(b64.startsWith('iVBORw0KGgo'));
  assert.equal(K.base64Size(b64), bytes.length);
  assert.deepEqual([...K.bytesFromDataUrl('data:image/png;base64,' + b64)], [...bytes]);
  assert.throws(() => K.bytesFromDataUrl('data:image/png,abc'));
  // big enough to cross the 32 KB chunk boundary
  const big = new Uint8Array(100000).map((_, i) => i % 251);
  assert.deepEqual([...K.bytesFromDataUrl('data:image/png;base64,' + K.base64FromBytes(big))], [...big]);
});

/** Fake makers for cropShot: a bitmap of the shot's size, a canvas that
 *  records drawImage and "encodes" to a PNG-signed byte array. */
function fakeMakers(shotW, shotH, bytesPerPixel = 0.1) {
  const draws = [];
  return {
    draws,
    makers: {
      Blob: class { constructor(parts, o) { this.parts = parts; this.type = o.type; } },
      createImageBitmap: async () => ({ width: shotW, height: shotH, close() { this.closed = true; } }),
      OffscreenCanvas: class {
        constructor(w, h) { this.width = w; this.height = h; }
        getContext() { const c = this; return { drawImage: (...a) => draws.push({ args: a, w: c.width, h: c.height }) }; }
        async convertToBlob(o) {
          assert.equal(o.type, 'image/png', 'PNG only');
          const n = Math.max(8, Math.round(this.width * this.height * bytesPerPixel));
          const b = new Uint8Array(n);
          b.set([137, 80, 78, 71, 13, 10, 26, 10]);
          return { arrayBuffer: async () => b.buffer };
        }
      },
    },
  };
}

const SHOT = 'data:image/png;base64,' + K.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

test('cropShot scales by the shot (devicePixelRatio and zoom), and returns heddy:box images', async () => {
  // A 2× display: the shot of a 1280 × 800 viewport is 2560 × 1600.
  const f = fakeMakers(2560, 1600);
  const out = await K.cropShot(SHOT, [{ x: 200, y: 166, w: 270, h: 136 }], 1280, 800, f.makers);
  assert.equal(out.length, 1);
  assert.deepEqual(f.draws[0].args.slice(1), [400, 332, 540, 272, 0, 0, 540, 272]);
  assert.deepEqual(out[0].box, { kind: 'web', vw: 1280, vh: 800, x: 200, y: 166, w: 270, h: 136 });
  assert.equal(typeof out[0].png, 'string');
  assert.ok(out[0].png.startsWith('iVBORw0KGgo'), 'a base64 PNG with no prefix');
});

test('a whole Retina screen is scaled to 1600 on the longest side', async () => {
  const f = fakeMakers(2880, 1800);
  await K.cropShot(SHOT, [{ x: 0, y: 0, w: 1440, h: 900 }], 1440, 900, f.makers);
  assert.deepEqual([f.draws[0].w, f.draws[0].h], [1600, 1000]);
});

test('cropShot rejects with too_big when 1024 is still over 1 MB', async () => {
  const f = fakeMakers(2880, 1800, 2);
  await assert.rejects(K.cropShot(SHOT, [{ x: 0, y: 0, w: 1440, h: 900 }], 1440, 900, f.makers), /too_big/);
});
