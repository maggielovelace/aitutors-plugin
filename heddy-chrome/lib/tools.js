// lib/tools.js — the checks every page-borne value passes before it leaves
// Heddy (PRD-v0.96.0 D15, D20, D32, D33): an address, a title, a WebBox, a
// PNG crop; the three tools' names; and heddy:box's builder.
//
//   heddy:box  {v:1, cid, url, title, images:[{png, box}], context}   1–4 images
//              (the builder only: since Round 5 Heddy sends pictures as cards
//              in the save, lib/cards.js; the site keeps heddy:box for older installs)
//
// Round 9 (D78, D84): the tools no longer open /capture/room or /capture/card
// windows. Ask about it and Make a card open the desk's Ask view
// (lib/desk-ask.js, lib/web-routes.js), so heddy:tool's builder and the
// window sender are gone. Page text is untrusted: it is cut to its cap and
// stripped of control characters here, and the site validates it again and
// gives it to a model only as a delimited data block (D23).
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var K = root.HeddyCrop || (typeof require === 'function' && require('./crop.js'));

  var MAX_URL = 2048;
  var MAX_TITLE = 300;
  var MAX_CONTEXT = 300;
  var TOOLS = ['explain', 'card', 'ask'];
  // How many pictures each one takes (D33: Explain and Make a card are single).
  var MAX_PICTURES = { jot: 4, ask: 4, explain: 1, card: 1 };
  // A base64 PNG starts with the PNG signature, 89 50 4E 47 0D 0A 1A 0A.
  var PNG_B64 = /^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/;

  /** An http(s) address without its #fragment (D20), or null. */
  function cleanUrl(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.hash = '';
    var s = u.href;
    return s.length <= MAX_URL ? s : null;
  }

  /** Page text: control characters out, whitespace folded, cut to `max`. */
  function cleanText(x, max) {
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function num(n, min) {
    return typeof n === 'number' && isFinite(n) && n >= min;
  }

  /** {kind:'web', vw, vh, x, y, w, h}: vw, vh > 0; x, y ≥ 0; w, h > 0. */
  function isWebBox(b) {
    if (!b || typeof b !== 'object' || b.kind !== 'web') return false;
    if (!(num(b.vw, 0) && b.vw > 0 && num(b.vh, 0) && b.vh > 0)) return false;
    if (!(num(b.x, 0) && num(b.y, 0))) return false;
    return num(b.w, 0) && b.w > 0 && num(b.h, 0) && b.h > 0;
  }

  /** A base64 PNG with no data: prefix, at most 1 MB decoded. */
  function isPng(png) {
    return typeof png === 'string' && PNG_B64.test(png) && png.length % 4 === 0 && K.base64Size(png) <= K.MAX_BYTES;
  }

  function cleanImages(images, max) {
    if (!Array.isArray(images) || images.length < 1 || images.length > max) throw new Error('bad images');
    return images.map(function (img) {
      if (!img || !isPng(img.png) || !isWebBox(img.box)) throw new Error('bad image');
      var b = img.box;
      return { png: img.png, box: { kind: 'web', vw: b.vw, vh: b.vh, x: b.x, y: b.y, w: b.w, h: b.h } };
    });
  }

  function base(input) {
    if (!P.isCaptureId(input.cid)) throw new Error('bad cid');
    var url = cleanUrl(input.url);
    if (!url) throw new Error('bad url');
    return { v: P.PROTOCOL_VERSION, cid: input.cid, url: url, title: cleanText(input.title, MAX_TITLE) };
  }

  /** heddy:box, for /capture/jot. */
  function buildBox(input) {
    var b = base(input);
    return {
      type: 'heddy:box',
      v: b.v,
      cid: b.cid,
      url: b.url,
      title: b.title,
      images: cleanImages(input.images, MAX_PICTURES.jot),
      context: cleanText(input.context, MAX_CONTEXT),
    };
  }

  var api = {
    MAX_TITLE: MAX_TITLE,
    MAX_CONTEXT: MAX_CONTEXT,
    TOOLS: TOOLS,
    MAX_PICTURES: MAX_PICTURES,
    cleanUrl: cleanUrl,
    cleanText: cleanText,
    isWebBox: isWebBox,
    isPng: isPng,
    buildBox: buildBox,
  };
  root.HeddyTools = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
