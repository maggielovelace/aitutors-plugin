// lib/tools.js — heddy:box and heddy:tool, and the window each one opens
// (PRD-v0.96.0 D15, D20 tool, D32, D33; artifact R3b · 03, R2 · 05b).
//
//   heddy:box  {v:1, cid, url, title, images:[{png, box}], context}   1–4 images → /capture/jot
//   heddy:tool {v:1, cid, tool, url, title, quote, context, images?}
//              explain → /capture/room, ask → /capture/room, card → /capture/card
//              images: exactly 1 for explain and card, 1–4 for ask; quote is ''
//              when the tool carries pictures, and required when it carries words.
//
// The builders throw on anything the site's parser would refuse, so a bad
// payload is never handed over. Page text is untrusted: it is cut to its cap
// and stripped of control characters here, and the site validates it again
// and gives it to a model only as a delimited data block (D23).
//
// createSender is the background's half (hold the payload, open the window).
// sendTool is the page's half, for the words tray: it asks the background,
// which knows the tab, to do the rest.
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var C = root.HeddyConfig || (typeof require === 'function' && require('./config.js'));
  var K = root.HeddyCrop || (typeof require === 'function' && require('./crop.js'));

  var MAX_URL = 2048;
  var MAX_TITLE = 300;
  var MAX_CONTEXT = 300;
  var MAX_QUOTE = 20000;
  var TOOLS = ['explain', 'card', 'ask'];
  // Where each payload goes (D20, D32; R2 · 05b's table).
  var PAGES = { jot: 'jot', explain: 'room', ask: 'room', card: 'card' };
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

  /** heddy:tool, for /capture/room or /capture/card: words or pictures. */
  function buildTool(input) {
    if (TOOLS.indexOf(input.tool) < 0) throw new Error('bad tool');
    var b = base(input);
    var out = { type: 'heddy:tool', v: b.v, cid: b.cid, tool: input.tool, url: b.url, title: b.title, quote: '', context: cleanText(input.context, MAX_CONTEXT) };
    if (input.images !== undefined && input.images !== null) {
      out.images = cleanImages(input.images, MAX_PICTURES[input.tool]);
    } else {
      var quote = cleanText(input.quote, MAX_QUOTE);
      if (!quote) throw new Error('bad quote');
      out.quote = quote;
    }
    return out;
  }

  /** The /capture page for 'jot' or a tool. */
  function pageFor(kind) {
    if (!Object.prototype.hasOwnProperty.call(PAGES, kind)) throw new Error('bad kind');
    return PAGES[kind];
  }

  /** The background's half: hold a payload for its window (lib/cid-store.js,
   *  the same store the courier answers heddy:ready from), then open the
   *  window, focused, where the courier opens its own.
   *  deps: {chrome, store, randomUUID, ready, sessionKey} */
  function createSender(deps) {
    var chrome = deps.chrome;
    var store = deps.store;

    function persist() {
      return Promise.resolve()
        .then(function () { var o = {}; o[deps.sessionKey] = store.toJSON(); return chrome.storage.session.set(o); })
        .catch(function () {});
    }

    function devMode() {
      return chrome.storage.local.get(C.DEV_KEY).then(
        function (got) { return !!got && got[C.DEV_KEY] === true; },
        function () { return false; }
      );
    }

    /** kind: 'box' or 'tool'. build(cid) returns the payload (and may throw).
     *  where: {tabId, windowId}. Resolves to {ok, cid?}. */
    function hold(kind, page, build, where) {
      var cid = String(deps.randomUUID()).toLowerCase();
      var w = where || {};
      return Promise.resolve(deps.ready)
        .then(devMode)
        .then(function (dev) {
          var payload = build(cid);
          var origin = C.captureOrigin(dev);
          // `then` carries the kind, so heddy:result knows this is no clip.
          store.put(cid, { payload: payload, origin: origin, tabId: w.tabId, then: kind });
          return persist()
            .then(function () {
              return (w.windowId != null ? chrome.windows.get(w.windowId) : chrome.windows.getLastFocused()).catch(function () { return null; });
            })
            .then(function (win) {
              var spec = Object.assign({ url: C.captureUrl(origin, page, cid), type: 'popup', focused: true }, C.windowBounds(win));
              return chrome.windows.create(spec);
            })
            .then(function (created) {
              if (created && created.id != null) store.setWindow(cid, created.id);
              return persist().then(function () { return { ok: true, cid: cid }; });
            });
        })
        .catch(function () {
          store.drop(cid);
          return persist().then(function () { return { ok: false }; });
        });
    }

    return {
      /** heddy:box → /capture/jot. */
      box: function (input, where) {
        return hold('box', pageFor('jot'), function (cid) { return buildBox(Object.assign({}, input, { cid: cid })); }, where);
      },
      /** heddy:tool → /capture/room or /capture/card. */
      tool: function (input, where) {
        return hold('tool', pageFor(input && input.tool), function (cid) { return buildTool(Object.assign({}, input, { cid: cid })); }, where);
      },
    };
  }

  /** The page's half, for the words tray: Explain, Make a card or Ask Heddy
   *  on a selection. words = {url, title, quote, context}. The background
   *  takes the address from the tab itself. Resolves to {ok}. */
  function sendTool(tool, words) {
    var w = words || {};
    var message = { type: 'heddy-ui:tool', tool: tool, url: w.url, title: w.title, quote: w.quote, context: w.context };
    try {
      return Promise.resolve(root.chrome.runtime.sendMessage(message)).then(
        function (reply) { return reply && reply.ok ? { ok: true } : { ok: false }; },
        function () { return { ok: false }; }
      );
    } catch (e) {
      // Heddy was reloaded under the page.
      return Promise.resolve({ ok: false });
    }
  }

  var api = {
    MAX_TITLE: MAX_TITLE,
    MAX_CONTEXT: MAX_CONTEXT,
    TOOLS: TOOLS,
    PAGES: PAGES,
    MAX_PICTURES: MAX_PICTURES,
    cleanUrl: cleanUrl,
    cleanText: cleanText,
    isWebBox: isWebBox,
    isPng: isPng,
    buildBox: buildBox,
    buildTool: buildTool,
    pageFor: pageFor,
    createSender: createSender,
    sendTool: sendTool,
  };
  root.HeddyTools = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
