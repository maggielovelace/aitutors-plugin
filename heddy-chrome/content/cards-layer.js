// content/cards-layer.js — the panel's card numbers, drawn on the page
// (PRD-v0.96.0 D55; artifact R4 · B, R5b).
//
// Injected on a gesture with the page tray or box mode, never declared. It
// keeps each text card's Range and draws it highlighted, with the card's
// number in a navy disc before it; each picture card is a green outline with
// its number on a tab above (R4 · B). In box mode the tab reads "3 · kept",
// as R5b draws it. The list itself lives in the background (lib/cards.js),
// which sends the numbers here after every change.
//
// The highlight is the CSS Custom Highlight API: nothing in the page's own
// DOM changes but one <style> for ::highlight. The numbers and outlines sit
// in a closed shadow root that takes no pointer events. Everything is hidden
// for the moment a screenshot is taken (box mode calls away()), so neither
// lands in a picture.
//
// A different address (not a #fragment) clears it all: the background clears
// the list too (D55, "going to another page clears the list").
(function (root) {
  if (root.__heddyCards) return;

  var I = root.HeddyI18n;
  var POS = root.HeddyPos;
  var HIGHLIGHT = 'heddy-cards';
  var CHECK_MS = 700;
  var SANS = '"Heddy Manrope",Manrope,Roboto,Arial,sans-serif';
  var MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace';
  var STYLE =
    ':host{all:initial;position:absolute;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483646;pointer-events:none}' +
    ':host(.away){visibility:hidden}' +
    '.n{position:absolute;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#002147;color:#fff;font:800 10.5px ' + SANS + ';box-shadow:0 0 0 2px #fff}' +
    '.b{position:absolute;box-sizing:border-box;border:2px solid #2f8a57;border-radius:6px}' +
    '.b b{position:absolute;left:-2px;top:-22px;background:#2f8a57;color:#fff;font:800 10.5px ' + SANS + ';padding:2px 7px;border-radius:5px 5px 5px 0;white-space:nowrap}' +
    // In box mode the tab is R5b's: "3 · kept", the size label's type.
    ':host(.box) .b{border-radius:0}' +
    ':host(.box) .b b{font:600 11px ' + MONO + ';padding:2px 6px;border-radius:5px}';

  var tr = I ? I.translator('en') : function (k) { return k; };
  if (I) I.currentLang().then(function (l) { tr = I.translator(l); draw(); }, function () {});

  var host = null, shadow = null, style = null;
  var ranges = {}; // id → Range, text cards the background knows
  var pending = {}; // id → Range, taken and not yet confirmed by a sync
  var list = []; // [{id, n, kind, rect?}] from the background
  var isAway = false, inBox = false;
  var pageKey = keyOf(location.href);
  var frame = 0;
  var listeners = []; // box mode, told when the numbers change

  function keyOf(href) {
    var i = String(href || '').indexOf('#');
    return i < 0 ? String(href || '') : String(href).slice(0, i);
  }

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('heddy-cards');
    shadow = host.attachShadow({ mode: 'closed' });
    var s = document.createElement('style');
    s.textContent = STYLE;
    shadow.appendChild(s);
    // Right after <body>: box mode and the panel, drawn later, sit above it.
    var de = document.documentElement;
    de.insertBefore(host, document.body ? document.body.nextSibling : null);
    host.classList.toggle('box', inBox);
    host.classList.toggle('away', isAway);
  }

  function ensureStyle() {
    if (style && style.isConnected) return;
    style = document.createElement('style');
    style.setAttribute('data-heddy', 'cards');
    style.textContent = '::highlight(' + HIGHLIGHT + '){background-color:#fdf0b8}';
    (document.head || document.documentElement).appendChild(style);
  }

  function highlights(on) {
    var api = root.CSS && root.CSS.highlights;
    if (!api || typeof root.Highlight !== 'function') return;
    var live = Object.keys(ranges).map(function (id) { return ranges[id]; });
    if (!on || !live.length) { api.delete(HIGHLIGHT); return; }
    ensureStyle();
    var h = new root.Highlight();
    live.forEach(function (r) { h.add(r); });
    api.set(HIGHLIGHT, h);
  }

  function draw() {
    frame = 0;
    if (!list.length) {
      highlights(false);
      if (host) { host.remove(); host = null; }
      return;
    }
    highlights(!isAway);
    ensureHost();
    while (shadow.childNodes.length > 1) shadow.removeChild(shadow.lastChild);
    var sx = root.scrollX, sy = root.scrollY;
    list.forEach(function (c) {
      if (c.kind === 'text') {
        var r = ranges[c.id];
        var rects = r ? r.getClientRects() : [];
        if (!rects.length) return;
        var first = rects[0];
        var n = document.createElement('span');
        n.className = 'n';
        n.textContent = String(c.n);
        // In the margin of the snippet's block, level with its first line: an
        // overlay cannot take space in the line as R4 · B's inline number
        // does, and at the range's own start it would cover the words before.
        n.style.left = Math.max(2, Math.min(first.left, blockLeft(r)) + sx - 23) + 'px';
        n.style.top = (first.top + sy + Math.max(0, (first.height - 18) / 2)) + 'px';
        shadow.appendChild(n);
      } else if (c.kind === 'image' && c.rect) {
        var b = document.createElement('div');
        b.className = 'b';
        b.style.left = c.rect.x + 'px';
        b.style.top = c.rect.y + 'px';
        b.style.width = c.rect.w + 'px';
        b.style.height = c.rect.h + 'px';
        var tab = document.createElement('b');
        tab.textContent = inBox ? tr('boxKeptLabel', String(c.n)) : String(c.n);
        b.appendChild(tab);
        shadow.appendChild(b);
      }
    });
  }

  /** The left edge of the block a range starts in (its nearest non-inline
   *  ancestor). */
  function blockLeft(range) {
    var el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    for (var k = 0; el && el !== document.body && k < 8; k++, el = el.parentElement) {
      var d = '';
      try { d = getComputedStyle(el).display; } catch (e) { d = ''; }
      if (d && d.indexOf('inline') !== 0 && d !== 'contents') return el.getBoundingClientRect().left;
    }
    return Infinity;
  }

  function later() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function clear() {
    ranges = {};
    pending = {};
    list = [];
    draw();
  }

  function checkPage() {
    var k = keyOf(location.href);
    if (k === pageKey) return;
    pageKey = k;
    clear();
  }

  /** The words selected now, as a text card for `id`: {quote, before,
   *  after, pos, url, title}, or null. The Range is kept, unconfirmed,
   *  until the background's next sync says whether the card was added. */
  function take(id) {
    var sel = root.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var page = root.__heddyPage && root.__heddyPage.selection();
    if (!page || !page.quote || !page.quote.trim()) return null;
    var range = sel.getRangeAt(0).cloneRange();
    var raw = range.toString();
    var lead = raw.length - raw.replace(/^\s+/, '').length;
    var pos = POS.textPos(document.body || document.documentElement, range.startContainer, range.startOffset, lead);
    pending[id] = range;
    // The words are now a card: the highlight shows instead of the selection.
    sel.removeAllRanges();
    return { quote: page.quote, before: page.before, after: page.after, pos: pos, url: location.href, title: page.title };
  }

  /** The background's list: numbers for every card, rects for pictures. */
  function sync(next) {
    checkPage();
    list = Array.isArray(next) ? next.filter(function (c) { return c && typeof c.id === 'string' && c.n > 0; }) : [];
    var keep = {};
    list.forEach(function (c) {
      if (c.kind !== 'text') return;
      var r = ranges[c.id] || pending[c.id];
      if (r) keep[c.id] = r;
    });
    ranges = keep;
    pending = {};
    draw();
    listeners.forEach(function (fn) { try { fn(list.slice()); } catch (e) { /* a listener's own fault */ } });
  }

  /** Hidden for a screenshot (box mode), then back. */
  function away(on) {
    isAway = !!on;
    if (host) host.classList.toggle('away', isAway);
    highlights(!isAway && list.length > 0);
  }

  function boxMode(on) {
    inBox = !!on;
    if (host) host.classList.toggle('box', inBox);
    draw();
  }

  root.addEventListener('scroll', later, true);
  root.addEventListener('resize', later);
  setInterval(checkPage, CHECK_MS);

  function onSync(fn) {
    if (typeof fn === 'function' && listeners.indexOf(fn) < 0) listeners.push(fn);
  }

  root.__heddyCards = { take: take, sync: sync, away: away, boxMode: boxMode, clear: clear, onSync: onSync, count: function () { return list.length; } };
})(globalThis);
