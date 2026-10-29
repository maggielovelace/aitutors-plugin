// lib/crop.js — cutting boxed pictures out of a screenshot of the visible tab
// (PRD-v0.96.0 D30; artifact R3b · 00, R3b · 05 "Size").
//
// The screenshot is chrome.tabs.captureVisibleTab's, which activeTab allows
// after the child's gesture, so no image is ever fetched (D3 unchanged, no
// cross-origin canvas taint). The crop runs in the service worker with
// createImageBitmap and OffscreenCanvas, both available there; an offscreen
// document would only add a page and a permission.
//
// Limits are Jotters' D9 (lib/jotters/crop-client.ts on the site): PNG only,
// longest side at most 1600 px, at most 1 000 000 bytes. A crop that is still
// too big at 1600 steps down to 1280, then 1024, rather than changing format.
//
// Everything except cropShot is pure; cropShot takes its canvas and bitmap
// makers as arguments so the tests can drive it with a fake encoder.
(function (root) {
  var MIN_BOX = 24;
  var MAX_SIDE = 1600;
  var STEPS = [1600, 1280, 1024];
  var MAX_BYTES = 1000000;
  var MAX_IMAGES = 4;

  function finite(n) {
    return typeof n === 'number' && isFinite(n);
  }

  /** Two decimals: CSS px from getBoundingClientRect, without float noise. */
  function px(n) {
    return Math.round(n * 100) / 100;
  }

  /** A box in CSS px, cut to the viewport (only what is on screen can be
   *  boxed). Null when nothing is left or it is under 24 × 24 (ignored). */
  function clampBox(box, vw, vh) {
    if (!box || !finite(box.x) || !finite(box.y) || !finite(box.w) || !finite(box.h)) return null;
    if (!finite(vw) || !finite(vh) || vw <= 0 || vh <= 0) return null;
    // A box drawn right-to-left arrives with a negative width.
    var x0 = Math.min(box.x, box.x + box.w), x1 = Math.max(box.x, box.x + box.w);
    var y0 = Math.min(box.y, box.y + box.h), y1 = Math.max(box.y, box.y + box.h);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(vw, x1); y1 = Math.min(vh, y1);
    var w = x1 - x0, h = y1 - y0;
    if (!(w >= MIN_BOX && h >= MIN_BOX)) return null;
    return { x: px(x0), y: px(y0), w: px(w), h: px(h) };
  }

  /** The anchor box D32 records: {kind:'web', vw, vh, x, y, w, h}. */
  function webBox(rect, vw, vh) {
    return { kind: 'web', vw: px(vw), vh: px(vh), x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }

  /** Output size for a source of w × h px with the longest side at most
   *  `side`. Never scales up; never below 1 px. */
  function fitSide(w, h, side) {
    var longest = Math.max(w, h);
    var k = longest > side ? side / longest : 1;
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  /** Encode at 1600, then 1280, then 1024 until the PNG is within 1 MB.
   *  `encode(w, h)` resolves to the PNG's bytes (Uint8Array). Resolves to
   *  {bytes, w, h}, or null when even 1024 is too big. */
  function encodeUnderCap(sw, sh, encode) {
    var tried = {};
    var i = 0;
    function next() {
      if (i >= STEPS.length) return Promise.resolve(null);
      var size = fitSide(sw, sh, STEPS[i++]);
      var key = size.w + 'x' + size.h;
      // A small crop is the same size at every step: one encode is enough.
      if (tried[key]) return next();
      tried[key] = true;
      return Promise.resolve(encode(size.w, size.h)).then(function (bytes) {
        if (bytes && bytes.length <= MAX_BYTES) return { bytes: bytes, w: size.w, h: size.h };
        return next();
      });
    }
    return next();
  }

  // ─── base64, without fetch() ───────────────────────────────────────────────

  var B64 = typeof btoa === 'function' ? btoa : function (s) { return Buffer.from(s, 'binary').toString('base64'); };
  var UNB64 = typeof atob === 'function' ? atob : function (s) { return Buffer.from(s, 'base64').toString('binary'); };

  /** Bytes → base64 with no data: prefix (what heddy:box carries). */
  function base64FromBytes(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes.subarray(i, i + 0x8000)));
    }
    return B64(out);
  }

  /** The bytes of a data: URL (captureVisibleTab's answer). */
  function bytesFromDataUrl(dataUrl) {
    var comma = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1;
    if (comma < 0 || !/;base64$/.test(dataUrl.slice(0, comma))) throw new Error('not a base64 data url');
    var bin = UNB64(dataUrl.slice(comma + 1));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /** How many bytes a base64 string decodes to. */
  function base64Size(b64) {
    if (typeof b64 !== 'string') return 0;
    var pad = b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - pad;
  }

  // ─── the crop ──────────────────────────────────────────────────────────────

  /** Crop boxes out of one screenshot.
   *  shot   captureVisibleTab's data: URL (PNG)
   *  rects  [{x, y, w, h}] in CSS px of the viewport, already clamped
   *  vw, vh the viewport in CSS px when the shot was taken
   *  deps   {createImageBitmap, OffscreenCanvas, Blob}
   *  Resolves to [{png, box}] in heddy:box's shape; rejects with
   *  Error('too_big') when a crop will not fit 1 MB even at 1024 px.
   *
   *  The shot's own size fixes the scale (shot width ÷ vw), which is the
   *  devicePixelRatio times the page zoom: reading devicePixelRatio alone
   *  would miss the zoom. */
  function cropShot(shot, rects, vw, vh, deps) {
    var bytes = bytesFromDataUrl(shot);
    return deps.createImageBitmap(new deps.Blob([bytes], { type: 'image/png' })).then(function (bitmap) {
      var kx = bitmap.width / vw, ky = bitmap.height / vh;
      var out = [];
      var chain = Promise.resolve();
      rects.forEach(function (r) {
        chain = chain.then(function () {
          var sx = Math.max(0, Math.round(r.x * kx)), sy = Math.max(0, Math.round(r.y * ky));
          var sw = Math.min(bitmap.width - sx, Math.round(r.w * kx)), sh = Math.min(bitmap.height - sy, Math.round(r.h * ky));
          if (!(sw > 0 && sh > 0)) throw new Error('empty');
          return encodeUnderCap(sw, sh, function (w, h) {
            var canvas = new deps.OffscreenCanvas(w, h);
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
            return canvas.convertToBlob({ type: 'image/png' }).then(function (blob) {
              return blob.arrayBuffer();
            }).then(function (buf) {
              return new Uint8Array(buf);
            });
          }).then(function (fit) {
            if (!fit) throw new Error('too_big');
            out.push({ png: base64FromBytes(fit.bytes), box: webBox(r, vw, vh) });
          });
        });
      });
      return chain.then(
        function () { if (bitmap.close) bitmap.close(); return out; },
        function (e) { if (bitmap.close) bitmap.close(); throw e; }
      );
    });
  }

  var api = {
    MIN_BOX: MIN_BOX,
    MAX_SIDE: MAX_SIDE,
    STEPS: STEPS,
    MAX_BYTES: MAX_BYTES,
    MAX_IMAGES: MAX_IMAGES,
    clampBox: clampBox,
    webBox: webBox,
    fitSide: fitSide,
    encodeUnderCap: encodeUnderCap,
    base64FromBytes: base64FromBytes,
    bytesFromDataUrl: bytesFromDataUrl,
    base64Size: base64Size,
    cropShot: cropShot,
  };
  root.HeddyCrop = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
