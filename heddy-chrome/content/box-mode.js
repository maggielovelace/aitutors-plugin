// content/box-mode.js — box mode on any page (PRD-v0.96.0 D30, D33; artifact
// R3b · 00 P2 "snap, then tighten", R3b · 01, R3b · 04).
//
// Injected by the background on the child's gesture (activeTab): the popup's
// Snap a picture icon, Ctrl Shift K, or "Jot this picture with Heddy" on an
// image. The page dims; pictures under the pointer get an outline and one
// click takes the whole picture; a drag draws a free box with four corner
// handles, movable and resizable until a tool is tapped; under 24 × 24 is
// ignored; Esc leaves keeping nothing. The tray under the box is the desk's:
// Jot it (the one filled button), Explain, Make a card, Ask Heddy, ›.
//
// Up to 4 pictures for one jot, from this page only (D33): "Add to this jot"
// keeps the box (green, numbered, locked) and Jot it counts them; with two or
// more, Explain and Make a card dim; if the page navigates, the kept boxes are
// dropped with a one-line notice.
//
// Nothing here reads pixels. Each kept box is cut by the background from a
// screenshot of the visible tab, taken with this overlay hidden. Every string
// from the page (a caption, alt text) is read as text and only ever sent as
// the jot's context; nothing from the page is drawn here.
(function (root) {
  var MIN_BOX = 24;
  var MIN_PICTURE = 48;
  var MAX_PICTURES = 4;
  var DRAG_PX = 4;
  var CHECK_MS = 500;
  var NOTE_MS = 4000;
  var MAX_CONTEXT = 300;
  var MAX_SCAN = 4000;
  var MAX_OUTLINES = 60;

  // ─── pure rules (tested in tests/box-mode.test.mjs) ────────────────────────

  /** What the tray shows. kept: boxes already kept; current: a box drawn and
   *  not yet kept. n is what Jot it would save. */
  function trayModel(kept, current) {
    var n = kept + (current ? 1 : 0);
    return {
      n: n,
      // "Jot it · N" once there is more than one (R3b · 04); "Jot it" alone.
      count: n >= 2 ? n : null,
      // Add keeps the current box; the 4th box hides it (R3b · 04).
      showAdd: !!current && kept < MAX_PICTURES - 1,
      // Explain and Make a card are one picture each (D33).
      single: n === 1,
      collecting: kept > 0,
    };
  }

  /** A rectangle from two corners, in either direction. */
  function rectFrom(x0, y0, x1, y1) {
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  }

  /** Big enough to keep (smaller boxes are ignored, R3b · 01). */
  function bigEnough(r) {
    return !!r && r.w >= MIN_BOX && r.h >= MIN_BOX;
  }

  /** Drag one corner ('nw', 'ne', 'sw', 'se') of r by (dx, dy). */
  function resize(r, corner, dx, dy) {
    var x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    if (corner.charAt(1) === 'w') x0 += dx; else x1 += dx;
    if (corner.charAt(0) === 'n') y0 += dy; else y1 += dy;
    return rectFrom(x0, y0, x1, y1);
  }

  /** A box moved by (dx, dy), kept inside a vw × vh viewport. */
  function moveWithin(r, dx, dy, vw, vh) {
    return {
      x: Math.max(0, Math.min(vw - r.w, r.x + dx)),
      y: Math.max(0, Math.min(vh - r.h, r.y + dy)),
      w: r.w,
      h: r.h,
    };
  }

  /** Is this element a picture P2 snaps to? info: {tag, poster, bg, w, h}.
   *  img, picture, svg, canvas, a video with a poster, or anything with a
   *  background image, at least 48 px each way (smaller ones are icons). */
  function isPicture(info) {
    if (!info || !(info.w >= MIN_PICTURE && info.h >= MIN_PICTURE)) return false;
    var tag = String(info.tag || '').toLowerCase();
    if (tag === 'img' || tag === 'picture' || tag === 'svg' || tag === 'canvas') return true;
    if (tag === 'video') return !!info.poster;
    return typeof info.bg === 'string' && /url\(/i.test(info.bg);
  }

  /** The last sentence of a run of text, at most `max` characters. */
  function lastSentence(text, max) {
    var t = String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    var parts = t.split(/(?<=[.!?。！？])\s*/).filter(function (s) { return s.trim(); });
    var s = (parts.length ? parts[parts.length - 1] : t).trim();
    return s.length > max ? s.slice(s.length - max).trim() : s;
  }

  /** The address without its #fragment: "the same page" (D33). */
  function samePageKey(href) {
    var i = String(href || '').indexOf('#');
    return i < 0 ? String(href || '') : String(href).slice(0, i);
  }

  /** The › menu's rows (owner, 2026-10-29): the whole screen instead, and
   *  Copy picture, which needs a box to copy. */
  function menuRows(kept, current) {
    return [
      { act: 'whole', label: 'menuWholeScreen' },
      { act: 'copy', label: 'menuCopyPicture', disabled: !current && !kept },
    ];
  }

  /** What Copy picture copies: the box being drawn, else the latest kept. */
  function copyTarget(kept, current) {
    return current || (kept && kept.length ? kept[kept.length - 1] : null);
  }

  /** Base64 PNG → Blob, without fetch(). */
  function pngBlob(b64, BlobCtor) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new (BlobCtor || Blob)([bytes], { type: 'image/png' });
  }

  /** Write a PNG to the clipboard. `png` is a Promise of the Blob, handed to
   *  ClipboardItem at once so the click's user activation still counts while
   *  the crop is cut. Resolves true, or false when the page has no clipboard
   *  API or the write is refused; never throws. */
  function copyPng(clipboard, ClipboardItemCtor, png) {
    try {
      if (!clipboard || typeof clipboard.write !== 'function' || typeof ClipboardItemCtor !== 'function') {
        Promise.resolve(png).catch(function () {});
        return Promise.resolve(false);
      }
      var item = new ClipboardItemCtor({ 'image/png': png });
      return Promise.resolve(clipboard.write([item])).then(function () { return true; }, function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  var pure = {
    MIN_BOX: MIN_BOX,
    MIN_PICTURE: MIN_PICTURE,
    MAX_PICTURES: MAX_PICTURES,
    trayModel: trayModel,
    rectFrom: rectFrom,
    bigEnough: bigEnough,
    resize: resize,
    moveWithin: moveWithin,
    isPicture: isPicture,
    lastSentence: lastSentence,
    samePageKey: samePageKey,
    menuRows: menuRows,
    copyTarget: copyTarget,
    pngBlob: pngBlob,
    copyPng: copyPng,
    COPIED_MS: 1500,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (typeof document === 'undefined' || !root.chrome || !root.chrome.runtime) return;

  // ─── in the page ───────────────────────────────────────────────────────────

  // Injected again on every gesture: one listener, and a restart.
  if (root.__heddyBoxMode) return;
  root.__heddyBoxMode = pure;

  var I = root.HeddyI18n;
  var M = root.HeddyMarks;
  var tr = I.translator('en');

  // The desk tray's line icons (the artifact's sprite), as constant SVG.
  var ICONS = {
    pen: '<path d="M5 19 L6 15 L15.5 5.5 a2 2 0 0 1 3 3 L9 18 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7.5 l3 3" stroke="currentColor" stroke-width="1.8"/>',
    search: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15 L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    star: '<path d="M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.5 L12 16.5 L6.7 19.5 L8 13.6 L3.5 9.6 L9.4 9 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    save: '<path d="M4 7 H15 M4 12 H15 M4 17 H11 M18 13 V21 M14 17 H22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    chev: '<path d="M8 10 L12 14 L16 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function icon(name) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }

  var SANS = 'Manrope,Roboto,Arial,sans-serif';
  var MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace';
  var CSS =
    ':host{all:initial;position:fixed;inset:0;z-index:2147483647;-webkit-font-smoothing:antialiased}' +
    ':host(.away){visibility:hidden}' +
    'svg{display:block;flex:none}' +
    '.layer{position:absolute;inset:0;cursor:crosshair;touch-action:none}' +
    '.dim{position:absolute;inset:0;background:rgba(0,20,45,.18);pointer-events:none}' +
    '.o{position:absolute;box-sizing:border-box;border:2px dashed #5b5fd6;border-radius:6px;opacity:.55;pointer-events:none}' +
    '.snap{position:absolute;box-sizing:border-box;border:2px solid #5b5fd6;box-shadow:0 0 0 9999px rgba(0,20,45,.12);pointer-events:none}' +
    '.box{position:absolute;border:2px solid #5b5fd6;box-shadow:0 0 0 9999px rgba(0,20,45,.18);background:transparent;cursor:move}' +
    '.box.free{box-shadow:none}' +
    '.box i{position:absolute;width:10px;height:10px;background:#fff;border:2px solid #5b5fd6;border-radius:2px}' +
    '.box i.nw{left:-6px;top:-6px;cursor:nwse-resize}.box i.ne{right:-6px;top:-6px;cursor:nesw-resize}' +
    '.box i.sw{left:-6px;bottom:-6px;cursor:nesw-resize}.box i.se{right:-6px;bottom:-6px;cursor:nwse-resize}' +
    '.kept{position:absolute;border:2px solid #2f8a57;pointer-events:none}' +
    '.lbl{position:absolute;font:600 11px ' + MONO + ';color:#fff;background:#5b5fd6;border-radius:5px;padding:2px 6px;pointer-events:none;white-space:nowrap}' +
    '.lbl.k{background:#2f8a57}' +
    '.hint{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:#002147;color:#fff;border-radius:999px;padding:7px 14px;font:600 12.5px ' + SANS + ';white-space:nowrap;pointer-events:none}' +
    '.hint b{font:700 11px ' + MONO + ';background:rgba(255,255,255,.18);border-radius:5px;padding:1px 6px}' +
    '.hint.bottom{bottom:14px}.hint.top{top:12px}' +
    '.tray{position:absolute;display:flex;align-items:stretch;gap:2px;padding:4px;border-radius:12px;background:#002147;color:#fff;box-shadow:0 10px 26px rgba(0,0,0,.22);white-space:nowrap;line-height:1}' +
    '.tray>button{all:unset;box-sizing:border-box;display:grid;justify-items:center;align-content:center;gap:5px;min-width:76px;height:50px;padding:0 8px;border-radius:9px;font:700 11.5px ' + SANS + ';cursor:pointer}' +
    '.tray>button:hover,.tray>button[aria-expanded="true"]{background:rgba(255,255,255,.16)}' +
    '.tray>button.pri{background:#DC9400;color:#002147}.tray>button.pri:hover{filter:brightness(1.06)}' +
    '.tray>button.more{min-width:36px}' +
    '.tray>button[aria-disabled="true"]{opacity:.45;cursor:default;background:transparent}' +
    '.tray>button:focus-visible{outline:2px solid #DC9400;outline-offset:1px}' +
    '.tray>i{width:1px;background:rgba(255,255,255,.3);margin:9px 2px}' +
    '.hf{width:22px;height:22px;border-radius:50%;background:#fff;display:grid;place-items:center}' +
    '.menu{position:absolute;display:grid;min-width:220px;padding:5px;background:#fff;border:1px solid #d6d9de;border-radius:8px;box-shadow:0 10px 26px rgba(0,0,0,.2)}' +
    '.menu button{all:unset;display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:5px;font:500 13px ' + SANS + ';color:#202124;cursor:pointer}' +
    '.menu button:hover,.menu button:focus-visible{background:#e8f0fe}' +
    '.menu button[aria-disabled="true"]{color:#9aa0a6;cursor:default;background:transparent}' +
    '[hidden]{display:none!important}';

  var host = null, shadow = null, els = null;
  var lang = 'en';
  var kept = []; // [{x, y, w, h}] in page (document) coordinates, locked
  var current = null; // the box being drawn, page coordinates
  var hover = null; // {el, rect (viewport)} the picture under the pointer
  var drag = null; // {mode, x0, y0, start, corner}
  var busy = false;
  var pageKey = '';
  var collection = ''; // the background's id for this box mode's pictures
  var checkTimer = null, noteTimer = null, scanTimer = null;

  function send(message) {
    try {
      return Promise.resolve(chrome.runtime.sendMessage(message)).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function vw() { return document.documentElement.clientWidth || window.innerWidth; }
  function vh() { return document.documentElement.clientHeight || window.innerHeight; }
  function toPage(r) { return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.w, h: r.h }; }
  function toView(r) { return { x: r.x - window.scrollX, y: r.y - window.scrollY, w: r.w, h: r.h }; }

  function place(el, r) {
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
  }

  function frames(n) {
    return new Promise(function (resolve) {
      (function step(k) { if (k <= 0) return resolve(); requestAnimationFrame(function () { step(k - 1); }); })(n);
    });
  }

  // ─── finding pictures ──────────────────────────────────────────────────────

  function infoOf(el) {
    var r = el.getBoundingClientRect();
    var bg = '';
    var tag = el.tagName;
    if (!/^(img|picture|svg|canvas|video)$/i.test(tag)) {
      try { bg = getComputedStyle(el).backgroundImage; } catch (e) { bg = ''; }
    }
    return { tag: tag, poster: tag.toLowerCase() === 'video' && el.hasAttribute('poster'), bg: bg, w: r.width, h: r.height, rect: r };
  }

  /** The element that IS the picture for an element under the pointer. */
  function pictureFor(el) {
    for (var k = 0; el && k < 6; k++, el = el.parentElement) {
      if (el === document.body || el === document.documentElement || el === host) return null;
      var target = el;
      if (el instanceof SVGElement) {
        // The outermost <svg>, not a path inside it.
        while (target.ownerSVGElement) target = target.ownerSVGElement;
      } else if (el.tagName === 'PICTURE') {
        target = el.querySelector('img') || el;
      }
      var info = infoOf(target);
      if (isPicture(info)) return { el: target, rect: info.rect };
      if (target !== el) el = target;
    }
    return null;
  }

  function pictureAt(x, y) {
    var list = document.elementsFromPoint(x, y);
    for (var i = 0; i < list.length && i < 8; i++) {
      if (list[i] === host) continue;
      var p = pictureFor(list[i]);
      if (p) return p;
    }
    return null;
  }

  /** The other pictures on screen, for the dashed outlines. */
  function visiblePictures() {
    var out = [];
    var all = document.body ? document.body.getElementsByTagName('*') : [];
    var w = vw(), h = vh();
    for (var i = 0; i < all.length && i < MAX_SCAN && out.length < MAX_OUTLINES; i++) {
      var el = all[i];
      if (el.ownerSVGElement) continue;
      var r = el.getBoundingClientRect();
      if (r.width < MIN_PICTURE || r.height < MIN_PICTURE || r.right <= 0 || r.bottom <= 0 || r.left >= w || r.top >= h) continue;
      if (el.tagName === 'PICTURE') continue; // its <img> is listed itself
      if (isPicture(infoOf(el))) out.push(r);
    }
    return out;
  }

  // ─── the context sent with the cover ───────────────────────────────────────

  function textOf(el) {
    return el ? String(el.textContent || '') : '';
  }

  /** The caption, else the alt text, else the sentence before the picture. */
  function contextFor(el) {
    if (!el) return '';
    var fig = el.closest && el.closest('figure');
    var cap = fig && fig.querySelector('figcaption');
    if (cap && textOf(cap).trim()) return lastSentence(textOf(cap), MAX_CONTEXT);
    var alt = el.getAttribute && (el.getAttribute('alt') || el.getAttribute('aria-label') || el.getAttribute('title'));
    if (alt && alt.trim()) return lastSentence(alt, MAX_CONTEXT);
    for (var a = el, k = 0; a && k < 4 && a !== document.body; a = a.parentElement, k++) {
      for (var s = a.previousElementSibling, j = 0; s && j < 3; s = s.previousElementSibling, j++) {
        var t = textOf(s).trim();
        if (t) return lastSentence(t, MAX_CONTEXT);
      }
    }
    return '';
  }

  function contextAt(viewRect) {
    var p = pictureAt(viewRect.x + viewRect.w / 2, viewRect.y + viewRect.h / 2);
    if (p) return contextFor(p.el);
    var list = document.elementsFromPoint(viewRect.x + viewRect.w / 2, viewRect.y + viewRect.h / 2).filter(function (e) { return e !== host; });
    return list[0] ? contextFor(list[0]) : '';
  }

  // ─── drawing ───────────────────────────────────────────────────────────────

  function build() {
    host = document.createElement('heddy-box-mode');
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML =
      '<style>' + CSS + '</style>' + M.sprite(['h-eyes']) +
      '<div class="layer"></div><div class="dim"></div><div class="outs"></div><div class="keeps"></div>' +
      '<div class="snap" hidden></div><span class="lbl snaplbl" hidden></span>' +
      '<div class="box" hidden><i class="nw"></i><i class="ne"></i><i class="sw"></i><i class="se"></i></div>' +
      '<span class="lbl size" hidden></span>' +
      '<span class="hint bottom" role="status"></span>' +
      '<span class="hint top note" role="status" hidden></span>' +
      '<div class="tray" role="toolbar" hidden>' +
      '<button type="button" class="pri" data-act="jot">' + icon('pen') + '<span></span></button>' +
      '<button type="button" data-act="add">' + icon('save') + '<span></span></button>' +
      '<button type="button" data-act="explain">' + icon('search') + '<span></span></button>' +
      '<button type="button" data-act="card">' + icon('star') + '<span></span></button>' +
      '<button type="button" data-act="ask"><span class="hf">' + M.use('h-eyes', 16) + '</span><span></span></button>' +
      '<i></i><button type="button" class="more" data-act="more" aria-haspopup="menu" aria-expanded="false">' + icon('chev') + '</button>' +
      '</div>' +
      '<div class="menu" role="menu" hidden><button type="button" role="menuitem" data-act="whole"></button><button type="button" role="menuitem" data-act="copy"></button></div>';
    var q = function (s) { return shadow.querySelector(s); };
    els = {
      layer: q('.layer'), dim: q('.dim'), outs: q('.outs'), keeps: q('.keeps'),
      snap: q('.snap'), snapLbl: q('.snaplbl'), box: q('.box'), size: q('.size'),
      hint: q('.hint.bottom'), note: q('.note'), tray: q('.tray'), menu: q('.menu'),
      btn: {},
    };
    Array.prototype.forEach.call(shadow.querySelectorAll('[data-act]'), function (b) { els.btn[b.getAttribute('data-act')] = b; });
    labels();
    els.layer.addEventListener('pointerdown', down);
    els.box.addEventListener('pointerdown', down);
    shadow.addEventListener('pointermove', moveEvt);
    shadow.addEventListener('pointerup', up);
    shadow.addEventListener('pointercancel', up);
    els.tray.addEventListener('click', trayClick);
    els.menu.addEventListener('click', trayClick);
    document.documentElement.appendChild(host);
  }

  function labels() {
    var b = els.btn;
    b.jot.querySelector('span').textContent = tr('trayJot');
    b.add.querySelector('span').textContent = tr('trayAdd');
    b.explain.querySelector('span').textContent = tr('trayExplain');
    b.card.querySelector('span').textContent = tr('trayCard');
    b.ask.querySelector('span:last-child').textContent = tr('trayAsk');
    b.more.setAttribute('aria-label', tr('trayMore'));
    menuRows(0, null).forEach(function (row) { b[row.act].textContent = tr(row.label); });
  }

  /** A pill made of text and one key, e.g. "Drag over a picture · [Esc] to stop". */
  function pill(el, before, key, after) {
    el.textContent = '';
    el.appendChild(document.createTextNode(before + ' '));
    var k = document.createElement('b');
    k.textContent = key;
    el.appendChild(k);
    el.appendChild(document.createTextNode(' ' + after));
  }

  function draw() {
    if (!host) return;
    var model = trayModel(kept.length, current);
    var w = vw(), h = vh();

    // The dim: everywhere until a box cuts it out; none while collecting (R3b · 04).
    els.dim.hidden = !!current || model.collecting;
    els.box.classList.toggle('free', model.collecting);

    // Kept boxes, green and numbered.
    els.keeps.textContent = '';
    kept.forEach(function (r, i) {
      var v = toView(r);
      var d = document.createElement('div');
      d.className = 'kept';
      place(d, v);
      var l = document.createElement('span');
      l.className = 'lbl k';
      l.textContent = tr('boxKeptLabel', String(i + 1));
      l.style.left = v.x + 'px';
      l.style.top = (v.y - 22) + 'px';
      els.keeps.appendChild(d);
      els.keeps.appendChild(l);
    });

    // The box being drawn.
    els.box.hidden = !current;
    els.size.hidden = !current;
    if (current) {
      var c = toView(current);
      place(els.box, c);
      if (model.collecting) {
        els.size.textContent = String(model.n);
        els.size.style.left = (c.x + c.w + 6) + 'px';
        els.size.style.top = (c.y + c.h / 2 - 9) + 'px';
      } else {
        els.size.textContent = Math.round(c.w) + ' × ' + Math.round(c.h);
        els.size.style.left = c.x + 'px';
        els.size.style.top = (c.y - 22) + 'px';
      }
    }

    // The picture under the pointer (P2), while nothing is being dragged.
    var showSnap = !!hover && !drag;
    els.snap.hidden = !showSnap;
    els.snapLbl.hidden = !showSnap;
    if (showSnap) {
      place(els.snap, { x: hover.rect.left, y: hover.rect.top, w: hover.rect.width, h: hover.rect.height });
      els.snapLbl.textContent = tr('boxWholePicture');
      els.snapLbl.style.left = hover.rect.left + 'px';
      els.snapLbl.style.top = Math.max(0, hover.rect.top - 22) + 'px';
    }

    // The hint, or the collecting pill.
    els.hint.className = 'hint ' + (model.collecting ? 'top' : 'bottom');
    if (model.collecting) pill(els.hint, tr('boxCollecting'), tr('boxKept', String(kept.length)), tr('boxEscNone'));
    else pill(els.hint, tr('boxHintBefore'), 'Esc', tr('boxHintAfter'));
    // The notice takes the top line while it shows.
    els.hint.hidden = model.collecting && !els.note.hidden;

    // The tray under the box (or under the last kept one).
    var anchor = current || kept[kept.length - 1];
    els.tray.hidden = !anchor || !!drag || busy;
    if (!els.tray.hidden) {
      var b = els.btn;
      b.jot.querySelector('span').textContent = model.count ? tr('trayJotN', String(model.count)) : tr('trayJot');
      b.add.hidden = !model.showAdd;
      [b.explain, b.card].forEach(function (x) {
        x.setAttribute('aria-disabled', String(!model.single));
        x.title = model.single ? '' : tr('trayOnePicture');
      });
      var a = toView(anchor);
      var tw = els.tray.offsetWidth || 420, th = els.tray.offsetHeight || 58;
      var left = Math.max(8, Math.min(w - tw - 8, a.x));
      var top = a.y + a.h + 10;
      if (top + th > h - 8) top = a.y - th - 10;
      if (top < 8) top = Math.max(8, h - th - 56);
      els.tray.style.left = left + 'px';
      els.tray.style.top = top + 'px';
      var copyRow = menuRows(kept.length, current)[1];
      b.copy.setAttribute('aria-disabled', String(!!copyRow.disabled));
      if (!els.menu.hidden) {
        els.menu.style.left = Math.max(8, Math.min(w - 230, left + tw - 220)) + 'px';
        els.menu.style.top = (top + th + 6 + 44 > h ? top - 50 : top + th + 6) + 'px';
      }
    } else {
      els.menu.hidden = true;
      els.btn.more.setAttribute('aria-expanded', 'false');
    }
  }

  function outline() {
    if (!host) return;
    els.outs.textContent = '';
    visiblePictures().forEach(function (r) {
      var o = document.createElement('div');
      o.className = 'o';
      place(o, { x: r.left, y: r.top, w: r.width, h: r.height });
      els.outs.appendChild(o);
    });
  }

  function note(text) {
    els.note.textContent = text;
    els.note.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { if (els) { els.note.hidden = true; draw(); } }, NOTE_MS);
    draw();
  }

  // ─── pointer ───────────────────────────────────────────────────────────────

  function viewRectOf(cur) { return cur ? toView(cur) : null; }

  function down(e) {
    if (e.button !== 0 || busy) return;
    e.preventDefault();
    closeMenu();
    var x = e.clientX, y = e.clientY;
    var corner = e.target && e.target.tagName === 'I' ? e.target.className : null;
    var c = viewRectOf(current);
    if (corner && c) drag = { mode: 'resize', corner: corner, x0: x, y0: y, start: c };
    else if (c && e.currentTarget === els.box) drag = { mode: 'move', x0: x, y0: y, start: c };
    else drag = { mode: 'pending', x0: x, y0: y };
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    draw();
  }

  function moveEvt(e) {
    var x = e.clientX, y = e.clientY;
    if (!drag) {
      // Over the tray or its menu, nothing on the page is outlined.
      var path = e.composedPath ? e.composedPath() : [];
      var p = path.indexOf(els.tray) >= 0 || path.indexOf(els.menu) >= 0 ? null : pictureAt(x, y);
      var same = hover && p && hover.el === p.el;
      hover = p;
      if (!same) draw();
      return;
    }
    var dx = x - drag.x0, dy = y - drag.y0;
    if (drag.mode === 'pending' && Math.abs(dx) + Math.abs(dy) > DRAG_PX) drag.mode = 'draw';
    if (drag.mode === 'draw') {
      current = toPage(clampView(rectFrom(drag.x0, drag.y0, x, y)));
      currentEl = null;
    }
    else if (drag.mode === 'move') current = toPage(moveWithin(drag.start, dx, dy, vw(), vh()));
    else if (drag.mode === 'resize') current = toPage(clampView(resize(drag.start, drag.corner, dx, dy)));
    else return;
    hover = null;
    draw();
  }

  function clampView(r) {
    var x0 = Math.max(0, r.x), y0 = Math.max(0, r.y);
    var x1 = Math.min(vw(), r.x + r.w), y1 = Math.min(vh(), r.y + r.h);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  }

  function up(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.mode === 'pending') {
      // A click: the whole picture under it, if there is one.
      var p = pictureAt(e.clientX, e.clientY);
      if (p) return takePicture(p.el);
      return draw();
    }
    if (current && !bigEnough(current)) current = null;
    draw();
  }

  /** The whole picture as the box, scrolled into view if it is partly off
   *  screen; a box can't reach beyond the visible tab (R3b · 01). */
  function takePicture(el) {
    var r = el.getBoundingClientRect();
    var off = r.top < 0 || r.left < 0 || r.bottom > vh() || r.right > vw();
    var ready = off ? (el.scrollIntoView({ block: 'nearest', inline: 'nearest' }), frames(2)) : Promise.resolve();
    return ready.then(function () {
      var v = clampView(rectOfEl(el));
      current = bigEnough(v) ? toPage(v) : null;
      currentEl = el;
      hover = null;
      draw();
    });
  }
  var currentEl = null;

  function rectOfEl(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  // ─── the tray ──────────────────────────────────────────────────────────────

  function closeMenu() {
    if (!els) return;
    els.menu.hidden = true;
    els.btn.more.setAttribute('aria-expanded', 'false');
  }

  function trayClick(e) {
    var b = e.target.closest && e.target.closest('button[data-act]');
    if (!b || busy) return;
    e.stopPropagation();
    var act = b.getAttribute('data-act');
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (act === 'more') {
      var open = els.menu.hidden;
      els.menu.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      return draw();
    }
    if (act !== 'copy') closeMenu();
    if (act === 'add') return addCurrent();
    if (act === 'whole') return wholeScreen();
    if (act === 'copy') return copyPicture();
    return useTool(act);
  }

  /** Cut the current box from a screenshot, with this overlay hidden so the
   *  dim and the outlines are not in the picture. */
  /** › Copy picture: the same crop the tools would send (same caps), cut
   *  with this overlay hidden, written to the clipboard from this click. */
  function copyPicture() {
    var target = copyTarget(kept, current);
    var v = target && clampView(toView(target));
    var btn = els.btn.copy;
    if (!v || !bigEnough(v) || btn.getAttribute('aria-disabled') === 'true') return failCopy();
    busy = true;
    host.classList.add('away');
    var png = frames(2)
      .then(function () { return send({ type: 'heddy-box:crop', rect: v, vw: vw(), vh: vh() }); })
      .then(function (reply) {
        busy = false;
        if (host) host.classList.remove('away');
        if (!reply || !reply.ok || typeof reply.png !== 'string') throw new Error('no crop');
        return pngBlob(reply.png);
      });
    copyPng(navigator.clipboard, root.ClipboardItem, png).then(function (ok) {
      busy = false;
      if (!host) return;
      host.classList.remove('away');
      if (!ok) return failCopy();
      btn.textContent = tr('menuCopied');
      setTimeout(function () {
        if (!els) return;
        btn.textContent = tr('menuCopyPicture');
        closeMenu();
        draw();
      }, pure.COPIED_MS);
    });
  }

  function failCopy() {
    closeMenu();
    draw();
    note(tr('copyFailed'));
  }

  function grabCurrent() {
    var v = clampView(toView(current));
    if (!bigEnough(v)) return Promise.resolve({ ok: false, error: 'too_small' });
    var ctx = currentEl && currentEl.isConnected ? contextFor(currentEl) : contextAt(v);
    busy = true;
    host.classList.add('away');
    return frames(2)
      .then(function () { return send({ type: 'heddy-box:grab', id: collection, rect: v, vw: vw(), vh: vh(), context: ctx }); })
      .then(function (reply) {
        busy = false;
        if (host) host.classList.remove('away');
        if (reply && reply.error === 'page_changed') dropKept();
        return reply || { ok: false };
      });
  }

  function addCurrent() {
    if (!current || kept.length >= MAX_PICTURES - 1) return;
    grabCurrent().then(function (reply) {
      if (!reply.ok) { draw(); if (reply.error !== 'page_changed') note(tr('boxFailed')); return; }
      kept.push(current);
      current = null;
      currentEl = null;
      draw();
    });
  }

  function useTool(act) {
    var model = trayModel(kept.length, current);
    if (!model.n || ((act === 'explain' || act === 'card') && !model.single)) return;
    var step = current ? grabCurrent() : Promise.resolve({ ok: true });
    step.then(function (reply) {
      if (!reply.ok) { draw(); if (reply.error !== 'page_changed') note(tr('boxFailed')); return null; }
      busy = true;
      draw();
      return send({ type: 'heddy-box:send', id: collection, action: act }).then(function (sent) {
        busy = false;
        if (sent && sent.ok) return close(false);
        // The kept pictures went with the failed send; start again cleanly.
        kept = [];
        current = null;
        draw();
        note(tr('boxFailed'));
      });
    });
  }

  /** › → the whole visible tab instead (the kept boxes are dropped). */
  function wholeScreen() {
    close(true);
    frames(2).then(function () { send({ type: 'heddy-box:whole' }); });
  }

  // ─── the same page only (D33) ──────────────────────────────────────────────

  function dropKept() {
    var had = kept.length;
    kept = [];
    current = null;
    currentEl = null;
    send({ type: 'heddy-box:cancel', id: collection });
    draw();
    if (had) note(tr('boxDropped'));
  }

  function checkPage() {
    var k = samePageKey(location.href);
    if (k === pageKey) return;
    pageKey = k;
    if (kept.length) dropKept();
  }

  // ─── open and close ────────────────────────────────────────────────────────

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (els && !els.menu.hidden) return closeMenu();
    close(true);
  }

  var rescan = function () {
    if (!host) return;
    draw();
    clearTimeout(scanTimer);
    scanTimer = setTimeout(outline, 120);
  };

  /** Leave box mode. cancel: Esc, keeping nothing. */
  function close(cancel) {
    if (cancel) send({ type: 'heddy-box:cancel', id: collection });
    if (host) host.remove();
    host = shadow = els = null;
    kept = [];
    current = currentEl = hover = drag = null;
    busy = false;
    clearInterval(checkTimer);
    clearTimeout(noteTimer);
    clearTimeout(scanTimer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', rescan, true);
    window.removeEventListener('resize', rescan);
    window.removeEventListener('popstate', checkPage);
    window.removeEventListener('pagehide', closeQuiet);
  }
  function closeQuiet() { close(false); }

  /** The image the child right-clicked, by its address: the most visible
   *  one when the page shows it more than once. */
  function imageBySrc(src) {
    if (!src) return null;
    var best = null, bestArea = -1;
    Array.prototype.forEach.call(document.images, function (img) {
      if (img.currentSrc !== src && img.src !== src) return;
      var r = clampView(rectOfEl(img));
      var area = r.w * r.h;
      if (area > bestArea) { best = img; bestArea = area; }
    });
    return best;
  }

  function open(opts) {
    if (host) close(true);
    return I.currentLang().then(function (l) {
      lang = l;
      tr = I.translator(lang);
      pageKey = samePageKey(location.href);
      collection = (opts && opts.id) || '';
      build();
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('scroll', rescan, true);
      window.addEventListener('resize', rescan);
      window.addEventListener('popstate', checkPage);
      window.addEventListener('pagehide', closeQuiet);
      checkTimer = setInterval(checkPage, CHECK_MS);
      draw();
      outline();
      var img = opts && imageBySrc(opts.srcUrl);
      if (img) return takePicture(img);
    });
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== 'heddy-box:start' || sender.id !== chrome.runtime.id || sender.tab) return false;
    open({ srcUrl: typeof message.srcUrl === 'string' ? message.srcUrl : '', id: typeof message.id === 'string' ? message.id : '' }).then(
      function () { sendResponse({ ok: true }); },
      function () { sendResponse({ ok: false }); }
    );
    return true;
  });
})(globalThis);
