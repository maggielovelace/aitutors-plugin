// content/box-mode.js — box mode on any page (PRD-v0.96.0 D30, D33, D55, D58;
// artifact R3b · 00 P2 "snap, then tighten", R3b · 01, R5b · C).
//
// Injected by the background on the child's gesture (activeTab): the panel's
// + Picture or Snap a picture icon, Ctrl Shift K, or "Add picture to Heddy"
// on an image (which keeps that picture as a card at once, as the whole-tab
// press keeps the whole visible tab). The page dims; pictures under the pointer get an
// outline and one click takes the whole picture; a drag draws a free box with
// four corner handles, movable and resizable until a button is tapped; under
// 24 × 24 is ignored; Esc leaves.
//
// The bar under the box has three buttons (D58, R5b · C):
//   Save to Jotters (gold)  every card in the panel, plus this box, to the
//                           Jotter's left page (lib/cards.js, heddy:save)
//   + Picture               keeps this box as the next numbered card and
//                           leaves box mode on for another; hidden at 4
//   Heddy ▾                 Explain this picture, Make a card, Ask Heddy
//                           about it, then Copy picture and Whole visible page
//
// Kept boxes are cards: the page's card layer (content/cards-layer.js) draws
// them green with their card number, and the panel stays open beside box
// mode with the same numbers. Up to 4 pictures from one page (D33's limit,
// Vercel's 4.5 MB request cap); another page clears them.
//
// Nothing here reads pixels. Each box is cut by the background from a
// screenshot of the visible tab, taken with this overlay, the panel and the
// page's numbers hidden. Every string from the page (a caption, alt text, the
// words below) is read as text and only ever sent as a card's context; nothing
// from the page is drawn here.
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

  /** What the bar shows. images: picture cards already kept from this page;
   *  current: a box drawn and not yet kept. */
  function barModel(images, current) {
    return {
      // + Picture keeps the current box; at 4 pictures it is hidden (D58).
      showPlus: !!current && images < MAX_PICTURES,
      // At 4 pictures no fifth box is drawn.
      canDraw: images < MAX_PICTURES,
      // The bar shows under the box, or under the last kept one.
      showBar: !!current || images > 0,
      collecting: images > 0,
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

  /** The first `max` characters of a run of text, as one line. */
  function firstWords(text, max) {
    return String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /** The address without its #fragment: "the same page" (D33). */
  function samePageKey(href) {
    var i = String(href || '').indexOf('#');
    return i < 0 ? String(href || '') : String(href).slice(0, i);
  }

  /** The Heddy ▾ menu (D58, R5b · C): the three ways to understand the
   *  picture, a rule, then Copy picture and Whole visible page. Copy needs a
   *  box; Whole visible page needs room for one more picture. */
  function menuRows(images, current) {
    var any = !!current || images > 0;
    return [
      { act: 'explain', label: 'menuExplainPicture', icon: 'search', disabled: !any },
      { act: 'card', label: 'trayCard', icon: 'star', disabled: !any },
      { act: 'ask', label: 'menuAskAbout', icon: 'quill', disabled: !any },
      { sep: true },
      { act: 'copy', label: 'menuCopyPicture', icon: 'page', disabled: !any },
      { act: 'whole', label: 'menuWholePage', icon: 'crop', disabled: images >= MAX_PICTURES },
    ];
  }

  /** What Copy picture and the Heddy menu act on: the box being drawn, else
   *  the last picture kept. `kept` are rects (page coordinates). */
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
    barModel: barModel,
    rectFrom: rectFrom,
    bigEnough: bigEnough,
    resize: resize,
    moveWithin: moveWithin,
    isPicture: isPicture,
    lastSentence: lastSentence,
    firstWords: firstWords,
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
  var POS = root.HeddyPos;
  var tr = I.translator('en');

  // The bar's line icons (the artifact's sprite: i-save, i-crop, i-search,
  // i-star, i-quill, i-page), as constant SVG.
  var ICONS = {
    save: '<path d="M4 7 H15 M4 12 H15 M4 17 H11 M18 13 V21 M14 17 H22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    crop: '<path d="M7 2.5 V17 H21.5 M2.5 7 H17 V21.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    search: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15 L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    star: '<path d="M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.5 L12 16.5 L6.7 19.5 L8 13.6 L3.5 9.6 L9.4 9 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    quill: '<path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M5.5 19.5 14 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="15.4" cy="9.2" r="1.1" fill="currentColor"/>',
    page: '<path d="M6 3.5 H14 L18.5 8 V20.5 H6 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3.5 V8 H18.5 M9 12 H15.5 M9 15.5 H15.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  };
  function icon(name) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }

  var SANS = '"Heddy Manrope",Manrope,Roboto,Arial,sans-serif';
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
    '.box i{position:absolute;width:10px;height:10px;background:#fff;border:2px solid #5b5fd6;border-radius:2px}' +
    '.box i.nw{left:-6px;top:-6px;cursor:nwse-resize}.box i.ne{right:-6px;top:-6px;cursor:nesw-resize}' +
    '.box i.sw{left:-6px;bottom:-6px;cursor:nesw-resize}.box i.se{right:-6px;bottom:-6px;cursor:nwse-resize}' +
    '.lbl{position:absolute;font:600 11px ' + MONO + ';color:#fff;background:#5b5fd6;border-radius:5px;padding:2px 6px;pointer-events:none;white-space:nowrap}' +
    '.hint{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:#002147;color:#fff;border-radius:999px;padding:7px 14px;font:600 12.5px ' + SANS + ';white-space:nowrap;pointer-events:none}' +
    '.hint b{font:700 11px ' + MONO + ';background:rgba(255,255,255,.18);border-radius:5px;padding:1px 6px}' +
    '.hint.bottom{bottom:14px}.hint.top{top:12px}' +
    '.tray{position:absolute;display:flex;align-items:stretch;gap:2px;padding:4px;border-radius:12px;background:#002147;color:#fff;box-shadow:0 10px 26px rgba(0,0,0,.22);white-space:nowrap;line-height:1}' +
    '.tray>button{all:unset;box-sizing:border-box;display:grid;justify-items:center;align-content:center;gap:5px;min-width:76px;height:50px;padding:0 8px;border-radius:9px;font:700 11.5px ' + SANS + ';cursor:pointer}' +
    '.tray>button:hover,.tray>button[aria-expanded="true"]{background:rgba(255,255,255,.16)}' +
    '.tray>button.pri{background:#DC9400;color:#002147}.tray>button.pri:hover{filter:brightness(1.06)}' +
    '.tray>button[aria-disabled="true"]{opacity:.45;cursor:default;background:transparent}' +
    '.tray>button:focus-visible{outline:2px solid #DC9400;outline-offset:1px}' +
    '.tray>i{width:1px;background:rgba(255,255,255,.3);margin:9px 2px}' +
    '.hf{width:22px;height:22px;border-radius:50%;background:#fff;display:grid;place-items:center}' +
    '.menu{position:absolute;display:grid;min-width:210px;padding:5px;background:#fff;border:1px solid #d6d9de;border-radius:8px;box-shadow:0 10px 26px rgba(0,0,0,.2)}' +
    '.menu button{all:unset;display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:6px;font:500 13px ' + SANS + ';color:#202124;cursor:pointer}' +
    '.menu button svg{color:#5d6878}' +
    '.menu button:hover,.menu button:focus-visible{background:#eef0fb}' +
    '.menu button[aria-disabled="true"]{color:#9aa0a6;cursor:default;background:transparent}' +
    '.menu hr{all:unset;display:block;height:1px;background:#e3e5e8;margin:3px 4px}' +
    '[hidden]{display:none!important}';

  var host = null, shadow = null, els = null;
  var lang = 'en';
  var kept = []; // [{id, n, rect}] picture cards from this page, rect in page coordinates
  var current = null; // the box being drawn, page coordinates
  var hover = null; // {el, rect (viewport)} the picture under the pointer
  var drag = null; // {mode, x0, y0, start, corner}
  var busy = false;
  var pageKey = '';
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

  /** Box mode, the panel and the page's card numbers leave the screen for a
   *  screenshot, and come back after it. */
  function away(on) {
    if (host) host.classList.toggle('away', on);
    if (root.__heddyCards) root.__heddyCards.away(on);
    if (root.__heddyPanel && root.__heddyPanel.away) root.__heddyPanel.away(on);
  }

  /** The right edge of the page left free: the panel's left edge while it
   *  is open beside box mode, else the window's. The bar, its menu and the
   *  pill keep left of it, so the panel never covers them. */
  function freeRight() {
    var panel = root.__heddyPanel && root.__heddyPanel.host && root.__heddyPanel.host();
    var r = panel && panel.isConnected ? panel.getBoundingClientRect() : null;
    return r && r.width > 0 && r.left > 240 ? r.left - 4 : vw();
  }

  function rects() {
    return kept.map(function (k) { return k.rect; });
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

  // ─── where a picture sits on the page (lib/pos.js) ─────────────────────────

  /** A kept box's place: pos (the last text block starting above its top
   *  edge, offset 0), the words before it (its caption, alt text, or the
   *  sentence before) and after it (the first block below it). */
  function placeOf(pageRect, el, viewRect) {
    var body = document.body || document.documentElement;
    var blocks = POS.textBlocks(body);
    var sy = window.scrollY;
    var tops = blocks.map(function (b) { return b.getBoundingClientRect().top + sy; });
    var next = POS.imageAfterIndex(tops, pageRect.y + pageRect.h);
    return {
      pos: { block: POS.imageBlock(tops, pageRect.y), offset: 0 },
      before: el && el.isConnected ? contextFor(el) : contextAt(viewRect),
      after: next >= 0 ? firstWords(blocks[next].textContent, MAX_CONTEXT) : '',
    };
  }

  // ─── drawing ───────────────────────────────────────────────────────────────

  function build() {
    host = document.createElement('heddy-box-mode');
    shadow = host.attachShadow({ mode: 'closed' });
    var menu = menuRows(0, null).map(function (row) {
      if (row.sep) return '<hr>';
      return '<button type="button" role="menuitem" data-act="' + row.act + '">' + icon(row.icon) + '<span></span></button>';
    }).join('');
    shadow.innerHTML =
      '<style>' + CSS + '</style>' + M.sprite(['h-eyes']) +
      '<div class="layer"></div><div class="dim"></div><div class="outs"></div>' +
      '<div class="snap" hidden></div><span class="lbl snaplbl" hidden></span>' +
      '<div class="box" hidden><i class="nw"></i><i class="ne"></i><i class="sw"></i><i class="se"></i></div>' +
      '<span class="lbl size" hidden></span>' +
      '<span class="hint bottom" role="status"></span>' +
      '<span class="hint top note" role="status" hidden></span>' +
      '<div class="tray" role="toolbar" hidden>' +
      '<button type="button" class="pri" data-act="save">' + icon('save') + '<span></span></button>' +
      '<button type="button" data-act="plus">' + icon('crop') + '<span></span></button>' +
      '<i></i><button type="button" data-act="heddy" aria-haspopup="menu" aria-expanded="false"><span class="hf">' + M.use('h-eyes', 16) + '</span><span></span></button>' +
      '</div>' +
      '<div class="menu" role="menu" hidden>' + menu + '</div>';
    var q = function (s) { return shadow.querySelector(s); };
    els = {
      layer: q('.layer'), dim: q('.dim'), outs: q('.outs'),
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
    // Under the panel, so the panel stays usable beside box mode (R5b);
    // above the page's card numbers, which it dims like the page.
    var de = document.documentElement;
    var panel = root.__heddyPanel && root.__heddyPanel.host && root.__heddyPanel.host();
    de.insertBefore(host, panel && panel.parentNode === de ? panel : null);
  }

  function labels() {
    var b = els.btn;
    b.save.querySelector('span').textContent = tr('saveToJotters');
    b.plus.querySelector('span').textContent = tr('addPicture');
    b.heddy.querySelector('span:last-child').textContent = tr('barHeddy');
    menuRows(0, null).forEach(function (row) { if (!row.sep) b[row.act].querySelector('span').textContent = tr(row.label); });
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
    var model = barModel(kept.length, current);
    var w = freeRight(), h = vh();

    // The dim: everywhere until a box cuts it out (the box's own shadow
    // dims around it); none while collecting with no box drawn.
    els.dim.hidden = !!current || model.collecting;

    // The box being drawn, with its size above it (R5b).
    els.box.hidden = !current;
    els.size.hidden = !current;
    if (current) {
      var c = toView(current);
      place(els.box, c);
      els.size.textContent = Math.round(c.w) + ' × ' + Math.round(c.h);
      els.size.style.left = c.x + 'px';
      els.size.style.top = (c.y - 22) + 'px';
    }

    // The picture under the pointer (P2), while nothing is being dragged.
    var showSnap = !!hover && !drag && model.canDraw;
    els.snap.hidden = !showSnap;
    els.snapLbl.hidden = !showSnap;
    if (showSnap) {
      place(els.snap, { x: hover.rect.left, y: hover.rect.top, w: hover.rect.width, h: hover.rect.height });
      els.snapLbl.textContent = tr('boxWholePicture');
      els.snapLbl.style.left = hover.rect.left + 'px';
      els.snapLbl.style.top = Math.max(0, hover.rect.top - 22) + 'px';
    }

    // The hint, or the collecting pill: "Box mode · [1 kept] · Esc to stop".
    els.hint.className = 'hint ' + (model.collecting ? 'top' : 'bottom');
    els.hint.style.left = (w / 2) + 'px';
    if (model.collecting) pill(els.hint, tr('boxCollecting'), tr('boxKept', String(kept.length)), tr('boxEscDone'));
    else pill(els.hint, tr('boxHintBefore'), 'Esc', tr('boxHintAfter'));
    // The notice takes the top line while it shows.
    els.hint.hidden = model.collecting && !els.note.hidden;

    // The bar under the box (or under the last kept one).
    var anchor = current || (kept.length ? kept[kept.length - 1].rect : null);
    els.tray.hidden = !anchor || !!drag || busy;
    if (!els.tray.hidden) {
      var b = els.btn;
      b.plus.hidden = !model.showPlus;
      var a = toView(anchor);
      var tw = els.tray.offsetWidth || 260, th = els.tray.offsetHeight || 58;
      var left = Math.max(8, Math.min(w - tw - 8, a.x));
      var top = a.y + a.h + 10;
      if (top + th > h - 8) top = a.y - th - 10;
      if (top < 8) top = Math.max(8, h - th - 56);
      els.tray.style.left = left + 'px';
      els.tray.style.top = top + 'px';
      menuRows(kept.length, current).forEach(function (row) {
        if (!row.sep) b[row.act].setAttribute('aria-disabled', String(!!row.disabled));
      });
      if (!els.menu.hidden) {
        // Under the Heddy button, its left edge on the button's (R5b · C).
        var mh = els.menu.offsetHeight || 230, mw = els.menu.offsetWidth || 220;
        var mx = left + b.heddy.offsetLeft;
        els.menu.style.left = Math.max(8, Math.min(w - mw - 8, mx)) + 'px';
        els.menu.style.top = (top + th + 6 + mh > h ? top - mh - 6 : top + th + 6) + 'px';
      }
    } else {
      els.menu.hidden = true;
      els.btn.heddy.setAttribute('aria-expanded', 'false');
    }
  }

  function outline() {
    if (!host) return;
    els.outs.textContent = '';
    if (!barModel(kept.length, current).canDraw) return;
    visiblePictures().forEach(function (r) {
      var o = document.createElement('div');
      o.className = 'o';
      place(o, { x: r.left, y: r.top, w: r.width, h: r.height });
      els.outs.appendChild(o);
    });
  }

  function note(text) {
    els.note.textContent = text;
    els.note.style.left = (freeRight() / 2) + 'px';
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
    else if (!barModel(kept.length, current).canDraw) { note(tr('cardsFullPictures')); return; }
    else drag = { mode: 'pending', x0: x, y0: y };
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    draw();
  }

  function moveEvt(e) {
    var x = e.clientX, y = e.clientY;
    if (!drag) {
      // Over the tray or its menu, nothing on the page is outlined.
      var path = e.composedPath ? e.composedPath() : [];
      var p = path.indexOf(els.tray) >= 0 || path.indexOf(els.menu) >= 0 || !barModel(kept.length, current).canDraw ? null : pictureAt(x, y);
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

  // ─── the bar ───────────────────────────────────────────────────────────────

  function closeMenu() {
    if (!els) return;
    els.menu.hidden = true;
    els.btn.heddy.setAttribute('aria-expanded', 'false');
  }

  function trayClick(e) {
    var b = e.target.closest && e.target.closest('button[data-act]');
    if (!b || busy) return;
    e.stopPropagation();
    var act = b.getAttribute('data-act');
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (act === 'heddy') {
      var open = els.menu.hidden;
      els.menu.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      return draw();
    }
    if (act !== 'copy') closeMenu();
    if (act === 'plus') return keepCurrent();
    if (act === 'save') return saveAll();
    if (act === 'whole') return wholePage();
    if (act === 'copy') return copyPicture();
    return useTool(act);
  }

  /** The box being drawn, as box mode sends it: the viewport rect to cut,
   *  its page rect, and where it sits on the page. Null if too small. */
  function boxMessage() {
    var v = clampView(toView(current));
    if (!bigEnough(v)) return null;
    var page = toPage(v);
    var at = placeOf(page, currentEl, v);
    return { rect: v, vw: vw(), vh: vh(), page: page, pos: at.pos, before: at.before, after: at.after, context: at.before };
  }

  /** Send a message that cuts a screenshot, with box mode, the panel and
   *  the page's numbers off the screen while it is taken. */
  function withShot(message) {
    busy = true;
    away(true);
    return frames(2)
      .then(function () { return send(message); })
      .then(function (reply) {
        busy = false;
        away(false);
        return reply || { ok: false };
      });
  }

  function failed(reply) {
    draw();
    if (reply && reply.error === 'full_images') note(tr('cardsFullPictures'));
    else note(tr('boxFailed'));
  }

  /** + Picture: this box becomes the next numbered card; box mode stays on. */
  function keepCurrent() {
    if (!current || kept.length >= MAX_PICTURES) return Promise.resolve();
    var m = boxMessage();
    if (!m) return Promise.resolve();
    return withShot(Object.assign({ type: 'heddy-box:keep' }, m)).then(function (reply) {
      if (!host) return;
      if (!reply.ok) return failed(reply);
      kept.push({ id: reply.id, n: reply.n, rect: m.page });
      current = null;
      currentEl = null;
      draw();
      outline();
    });
  }

  /** Save to Jotters (gold): every card, plus this box, in one heddy:save.
   *  Box mode leaves once the window is open; the panel clears when the
   *  site says they are saved. */
  function saveAll() {
    var m = current ? boxMessage() : null;
    var message = { type: 'heddy-box:save', box: m && kept.length < MAX_PICTURES ? m : null };
    var go = message.box ? withShot(message) : send(message).then(function (r) { return r || { ok: false }; });
    busy = true;
    draw();
    go.then(function (reply) {
      busy = false;
      if (!host) return;
      if (reply.ok) return close();
      failed(reply);
    });
  }

  /** Explain this picture, Make a card, Ask Heddy about it: on the box being
   *  drawn (cut now, kept nowhere), else on the last picture kept. */
  function useTool(act) {
    var m = current ? boxMessage() : null;
    var last = kept[kept.length - 1];
    if (!m && !last) return;
    var message = { type: 'heddy-box:tool', tool: act, box: m, cardId: m ? null : last.id };
    var go = m ? withShot(message) : send(message).then(function (r) { return r || { ok: false }; });
    busy = true;
    draw();
    go.then(function (reply) {
      busy = false;
      if (!host) return;
      if (reply.ok) return close();
      failed(reply);
    });
  }

  /** Whole visible page: the box becomes the whole visible tab, to keep,
   *  save or ask about like any other. */
  function wholePage() {
    if (kept.length >= MAX_PICTURES) return;
    current = toPage({ x: 0, y: 0, w: vw(), h: vh() });
    currentEl = null;
    hover = null;
    draw();
  }

  /** Copy picture: the same crop the tools would send (same caps), cut
   *  with box mode off the screen, written to the clipboard from this click. */
  function copyPicture() {
    var target = copyTarget(rects(), current);
    var v = target && clampView(toView(target));
    var btn = els.btn.copy;
    var label = btn.querySelector('span');
    if (!v || !bigEnough(v) || btn.getAttribute('aria-disabled') === 'true') return failCopy();
    busy = true;
    away(true);
    var png = frames(2)
      .then(function () { return send({ type: 'heddy-box:crop', rect: v, vw: vw(), vh: vh() }); })
      .then(function (reply) {
        busy = false;
        away(false);
        if (!reply || !reply.ok || typeof reply.png !== 'string') throw new Error('no crop');
        return pngBlob(reply.png);
      });
    copyPng(navigator.clipboard, root.ClipboardItem, png).then(function (ok) {
      busy = false;
      away(false);
      if (!host) return;
      if (!ok) return failCopy();
      label.textContent = tr('menuCopied');
      setTimeout(function () {
        if (!els) return;
        label.textContent = tr('menuCopyPicture');
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

  // ─── the same page only (D33, D55) ─────────────────────────────────────────

  function checkPage() {
    var k = samePageKey(location.href);
    if (k === pageKey) return;
    pageKey = k;
    // The background clears the cards; box mode forgets the boxes it kept.
    kept = [];
    current = null;
    currentEl = null;
    draw();
  }

  // ─── open and close ────────────────────────────────────────────────────────

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (els && !els.menu.hidden) return closeMenu();
    close();
  }

  var rescan = function () {
    if (!host) return;
    draw();
    clearTimeout(scanTimer);
    scanTimer = setTimeout(outline, 120);
  };

  /** Leave box mode. The pictures kept are cards: they stay in the panel. */
  function close() {
    if (host) host.remove();
    host = shadow = els = null;
    kept = [];
    current = currentEl = hover = drag = null;
    busy = false;
    away(false);
    if (root.__heddyCards) root.__heddyCards.boxMode(false);
    clearInterval(checkTimer);
    clearTimeout(noteTimer);
    clearTimeout(scanTimer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', rescan, true);
    window.removeEventListener('resize', rescan);
    window.removeEventListener('popstate', checkPage);
    window.removeEventListener('pagehide', close);
  }

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
    if (host) close();
    return Promise.all([I.currentLang(), send({ type: 'heddy-box:state' })]).then(function (got) {
      lang = got[0];
      tr = I.translator(lang);
      var st = got[1] && got[1].ok ? got[1] : { images: [] };
      kept = (st.images || []).map(function (x) { return { id: x.id, n: x.n, rect: x.rect }; });
      pageKey = samePageKey(location.href);
      build();
      if (root.__heddyCards) root.__heddyCards.boxMode(true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('scroll', rescan, true);
      window.addEventListener('resize', rescan);
      window.addEventListener('popstate', checkPage);
      window.addEventListener('pagehide', close);
      checkTimer = setInterval(checkPage, CHECK_MS);
      draw();
      outline();
      // "Add picture to Heddy" on an image, and the whole-tab press: the box
      // is drawn for the child, and with `keep` it is kept as a card at once.
      var wants = opts && (opts.whole || opts.srcUrl);
      if (wants && kept.length >= MAX_PICTURES) return note(tr('cardsFullPictures'));
      if (opts && opts.whole) {
        wholePage();
        return opts.keep ? keepCurrent() : null;
      }
      var img = opts && imageBySrc(opts.srcUrl);
      if (img) return takePicture(img).then(function () { if (opts.keep && current) return keepCurrent(); });
    });
  }

  // The panel's ✕ on a picture card: box mode lets go of that box too.
  if (root.__heddyCards && root.__heddyCards.onSync) {
    root.__heddyCards.onSync(function (list) {
      if (!host) return;
      var ids = {};
      list.forEach(function (c) { ids[c.id] = c.n; });
      kept = kept.filter(function (k) { return ids[k.id]; }).map(function (k) { return { id: k.id, n: ids[k.id], rect: k.rect }; });
      draw();
      outline();
    });
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== 'heddy-box:start' || sender.id !== chrome.runtime.id || sender.tab) return false;
    open({ srcUrl: typeof message.srcUrl === 'string' ? message.srcUrl : '', whole: message.whole === true, keep: message.keep === true }).then(
      function () { sendResponse({ ok: true }); },
      function () { sendResponse({ ok: false }); }
    );
    return true;
  });
})(globalThis);
