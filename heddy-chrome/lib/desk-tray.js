// lib/desk-tray.js — Pi's tray in the desk's Digest (Round 11; Classroom's
// components/videos/DigestTray.tsx, DigestTrayMore.tsx, digest-helpers.ts and
// clip-digest.css "Pi's tray" — the spec, matched literally, px only).
//
// Selecting words in a Digest line, or clicking a line, opens the tray above
// it in the subject colour, its 12 px caret on the centre of the chosen words:
//
//   Jot it · Explain · Make a card · (1 px hairline) · Ask {name} · ›
//
// Each tool is an icon over its word (64 × 42 px, 18 px icon, 11 px / 700) in
// a 50 px bar that floats 8 px off the line; the line reserves those 58 px on
// the side the bar opens. The › opens a menu holding only what the bar does
// not show: Play from here · Copy · Select the whole chapter (Round 11b: the
// video's own chapters, else ten-minute stretches; drawn when the words are
// not the whole chapter already). Ask's icon is the desk's crest (Heddy's eyes, the Ask tab's
// own mark) where Classroom draws the professor's crest.
//
// The rules (where the bar sits, which words a selection gives, the mark) are
// pure and exported for tests; build() draws the bar with every action a
// callback, as DigestTray does. Constant markup only: every word goes in as
// text.
(function (root) {
  var SH = root.HeddyDeskShell || (typeof require === 'function' && require('./desk-shell.js'));

  // clip-digest.css --cp-dg-pop-h / --cp-dg-pop-gap: the row reserves 58 px.
  var POP_H = 50;
  var POP_GAP = 8;
  var POP_ROOM_PX = POP_H + POP_GAP;
  // digest-helpers.ts PICK_MAX_CHARS: the server's own limit for a pick.
  var PICK_MAX_CHARS = 600;
  // DigestTrayMore.tsx: how long Copy says "Copied" before the menu closes.
  var COPIED_MS = 1200;

  /** A selection, whitespace squashed, capped (digest-helpers cleanSelection). */
  function cleanSelection(raw) {
    return String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, PICK_MAX_CHARS);
  }

  /** The words of a pick across several rows (digest-helpers pickWords). */
  function pickWords(parts) {
    return cleanSelection((parts || []).map(cleanSelection).filter(Boolean).join(' '));
  }

  /** One row's words: only the language the selection STARTED in; started in
   *  neither, or empty there, the whole English line (selectionForLine). */
  function selectionForLine(o) {
    var part = o.anchor === 'en' ? o.en : o.anchor === 'zh' ? o.zh : '';
    return cleanSelection(part) || o.line;
  }

  /** The chosen words cut out of a text so they can be marked; null when they
   *  are not in it, or are the whole of it (splitMark). */
  function splitMark(text, chosen) {
    var c = String(chosen || '').trim();
    var t = String(text || '');
    if (!c || c === t.trim()) return null;
    var at = t.indexOf(c);
    if (at === -1) return null;
    return [t.slice(0, at), c, t.slice(at + c.length)];
  }

  /** Where the bar sits in its row (bx) and where its caret points (cx), so the
   *  caret lands on the centre of the chosen words; 4 px inside the row, the
   *  caret 18 px inside the bar (trayPlacement). */
  function trayPlacement(o) {
    var mid = o.sx + o.sw / 2;
    var bx = Math.max(4, Math.min(mid - o.bw / 2, o.rw - o.bw - 4));
    var cx = Math.max(18, Math.min(mid - bx, o.bw - 18));
    return { bx: Math.round(bx), cx: Math.round(cx) };
  }

  /** Above its line, unless the line is too near the list's top (popSide). */
  function popSide(rowTopInList) {
    return rowTopInList < POP_ROOM_PX ? 'below' : 'above';
  }

  // ─── the look ─────────────────────────────────────────────────────────

  // DigestTray's TrayGlyph (Explain: a lit bulb; Make a card: a card over its
  // tilted twin) and ClipIcons' jot, chev, play, copy, tick: 24-unit, 1.7.
  var GLYPH = {
    explain: '<path class="f" d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3.5z"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3.5z"/><path d="M9.8 20.5h4.4" stroke-width="2"/><path class="s" d="M12 7.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>',
    card: '<rect class="f" x="5.5" y="7" width="13" height="10" rx="2"/><rect x="5.5" y="7" width="13" height="10" rx="2" transform="rotate(-6 12 12)"/><rect x="5.5" y="7" width="13" height="10" rx="2"/><path d="M8.5 11h7M8.5 14h4.5" stroke-width="1.5"/>',
    play: '<path class="f" d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/><path d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/>',
    copy: '<rect class="f" x="8.5" y="8.5" width="11" height="11" rx="2"/><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.1"/>',
  };

  function glyph(name) {
    var body = GLYPH[name] || (SH && SH.IC[name]) || '';
    return '<svg class="vp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  var SANS = (SH && SH.SANS) || 'Manrope,Roboto,Arial,sans-serif';
  var MONO = (SH && SH.MONO) || '"JetBrains Mono",ui-monospace,Menlo,monospace';

  // clip-digest.css, "Pi's tray" and "The ›", in the desk's .cd (light, so
  // --cp-on-sc is #fff). The Digest's rows (.ln) are Classroom's .cp-dg__ln.
  var CSS = [
    '.cd{--cp-on-sc:#fff}',
    '.ln{position:relative}',
    '.ln[data-pop="above"]{margin-top:' + POP_ROOM_PX + 'px}',
    '.ln[data-pop="below"]{margin-bottom:' + POP_ROOM_PX + 'px}',
    '.ln .tx{min-width:0;cursor:text;overflow-wrap:anywhere;-webkit-user-select:text;user-select:text}',
    '.ln .tx:focus-visible{outline:2px solid var(--sc);outline-offset:2px;border-radius:4px}',
    '.ln[data-sel] .tx{outline:2px solid var(--sc);outline-offset:2px;border-radius:4px}',
    '.ln mark{background:rgb(176 138 46 / .34);color:inherit;border-radius:3px;padding:0 1px}',
    '.ln .ts,.pop{-webkit-user-select:none;user-select:none}',
    '.ln button.ts{cursor:pointer;justify-self:start;align-self:start;text-align:left}',
    '.ln button.ts:hover{text-decoration:underline}',
    '.pop{box-sizing:border-box;height:' + POP_H + 'px;position:absolute;left:var(--bx,8px);bottom:calc(100% + ' + POP_GAP + 'px);display:flex;align-items:center;gap:2px;padding:4px;border-radius:14px;background:var(--sc);color:var(--cp-on-sc);box-shadow:0 10px 26px color-mix(in srgb,var(--sc) 38%,transparent);z-index:3;white-space:nowrap;transform-origin:var(--cx,30px) 100%;animation:hd-tray .2s ease both;cursor:default}',
    '.pop[data-below]{bottom:auto;top:calc(100% + ' + POP_GAP + 'px);transform-origin:var(--cx,30px) 0;animation-name:hd-tray-below}',
    '.pop::after{content:"";position:absolute;left:calc(var(--cx,30px) - 6px);bottom:-6px;width:12px;height:12px;background:var(--sc);border-radius:2px;transform:rotate(45deg)}',
    '.pop[data-below]::after{bottom:auto;top:-6px}',
    '@keyframes hd-tray{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@keyframes hd-tray-below{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}',
    '.pop > button{position:relative;z-index:1;display:grid;justify-items:center;align-content:center;gap:4px;box-sizing:border-box;height:42px;min-width:64px;padding:0 8px;border:0;border-radius:10px;background:none;font:700 11px/1 ' + SANS + ';color:inherit;white-space:nowrap;cursor:pointer}',
    '.pop > button .vp-ic{width:18px;height:18px;display:block}',
    '.pop > button .vp-ic .f{fill:color-mix(in srgb,currentColor 28%,transparent);stroke:none}',
    '.pop > button .vp-ic .s{fill:currentColor;stroke:none}',
    '.pop > button:hover,.pop > button:focus-visible{background:color-mix(in srgb,var(--cp-on-sc) 16%,transparent);outline:none}',
    '.pop .askcrest{display:flex;width:22px;height:22px}',
    '.pop .askcrest .eyes{width:22px;height:22px;border-radius:50%}',
    '.pop .sep2{width:1px;height:26px;margin:0 2px;flex:none;background:color-mix(in srgb,var(--cp-on-sc) 30%,transparent)}',
    '.pop > .more2{min-width:34px;padding:0 4px}',
    '.pop > .more2 .vp-ic{stroke-width:2.2}',
    '.pop > .more2[aria-expanded="true"]{background:color-mix(in srgb,var(--cp-on-sc) 16%,transparent)}',
    '.menu{position:absolute;right:0;top:calc(100% + 6px);z-index:4;box-sizing:border-box;width:236px;max-width:calc(100vw - 32px);display:grid;gap:1px;padding:6px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 18px 40px -12px rgb(0 33 71 / .35);white-space:normal;animation:hd-tray-below .16s ease both;cursor:default}',
    '.mi{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:44px;padding:0 10px;border:0;border-radius:10px;background:none;font:600 14px/1.2 ' + SANS + ';color:var(--ink-deep);text-align:left;cursor:pointer}',
    '.mi .vp-ic{width:20px;height:20px;color:var(--sc);display:block}',
    '.mi .vp-ic .f{fill:color-mix(in srgb,currentColor 22%,transparent);stroke:none}',
    '.mi:hover,.mi:focus-visible{background:var(--sc-soft);outline:none}',
    '.mi small{font:600 11px/1 ' + MONO + ';color:var(--muted);font-variant-numeric:tabular-nums}',
    '@media (prefers-reduced-motion:reduce){.pop,.menu{animation:none}}',
    // A narrow YouTube column (330–400 px) cannot hold five 64 px tools: the
    // tools shrink as Classroom's phone bar does (clip-digest.css ≤ 900.99 px).
    '@container (max-width:400px){.pop{max-width:calc(100% - 8px)}.pop > button{flex:0 1 auto;min-width:54px;padding:0 4px}.pop > .more2{min-width:32px}.pop > .sep2{flex:none}}',
  ].join('\n');

  /**
   * The bar, as DigestTray draws it. o: {
   *   doc, d: the strings ({actionsLabel, jot, explain, card, ask(name),
   *   more: {open, label, play, copy, copied, copyFailed}}), eyes (the crest's
   *   markup), below, playAt ("1:47"), copyText, onJot, onExplain, onCard,
   *   onAsk, onPlay, copy(text) → Promise, later(fn, ms)
   * }
   */
  function build(o) {
    var doc = o.doc;
    var d = o.d;
    var pop = doc.createElement('div');
    pop.className = 'pop';
    pop.setAttribute('role', 'toolbar');
    pop.setAttribute('aria-label', d.actionsLabel);
    if (o.id) pop.id = o.id;
    if (o.below) pop.setAttribute('data-below', '');
    // A press on the bar must not collapse the child's selection.
    ['pointerdown', 'mousedown'].forEach(function (t) { pop.addEventListener(t, function (e) { e.preventDefault(); }); });

    function tool(cls, icon, word, fn) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.insertAdjacentHTML('beforeend', icon);
      var s = doc.createElement('span');
      s.textContent = word;
      b.appendChild(s);
      b.addEventListener('click', fn);
      pop.appendChild(b);
      return b;
    }
    tool('t-jot', glyph('jot'), d.jot, o.onJot);
    tool('t-explain', glyph('explain'), d.explain, o.onExplain);
    tool('t-card', glyph('card'), d.card, o.onCard);
    var sep = doc.createElement('span');
    sep.className = 'sep2';
    sep.setAttribute('aria-hidden', 'true');
    pop.appendChild(sep);
    tool('t-ask', '<span class="askcrest" aria-hidden="true"><span class="eyes">' + o.eyes + '</span></span>', d.ask, o.onAsk);

    // The › and its menu (DigestTrayMore): Play from here · Copy.
    var more = doc.createElement('button');
    more.type = 'button';
    more.className = 'more2';
    more.setAttribute('aria-label', d.more.open);
    more.title = d.more.open;
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.insertAdjacentHTML('beforeend', glyph('chev'));
    pop.appendChild(more);
    var menu = null;
    var copied = null;
    var later = o.later || setTimeout;

    function item(cls, icon, word, small, fn) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'mi ' + cls;
      b.setAttribute('role', 'menuitem');
      b.insertAdjacentHTML('beforeend', icon);
      var s = doc.createElement('span');
      s.textContent = word;
      b.appendChild(s);
      if (small) {
        var sm = doc.createElement('small');
        sm.textContent = small;
        b.appendChild(sm);
      }
      b.addEventListener('click', fn);
      menu.appendChild(b);
      return b;
    }

    function close() {
      if (menu) menu.remove();
      menu = null;
      more.setAttribute('aria-expanded', 'false');
      more.removeAttribute('aria-controls');
    }

    function open() {
      menu = doc.createElement('div');
      menu.className = 'menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', d.more.label);
      if (o.id) {
        menu.id = o.id + '-more';
        more.setAttribute('aria-controls', menu.id);
      }
      if (o.onPlay) item('mi-play', glyph('play'), d.more.play, o.playAt || null, function () { close(); o.onPlay(); });
      var chapter = o.onChapter;
      var cp = item('mi-copy', glyph('copy'), d.more.copy, null, function () {
        if (copied) return;
        // Inside the click, so the browser lets the page write the clipboard.
        var p;
        try { p = Promise.resolve(o.copy(o.copyText)); } catch (e) { p = Promise.reject(e); }
        p.then(function () { say('done'); }, function () { say('failed'); });
      });
      function say(how) {
        copied = how;
        cp.textContent = '';
        cp.insertAdjacentHTML('beforeend', glyph(how === 'done' ? 'tick' : 'copy'));
        var s = doc.createElement('span');
        s.setAttribute('role', 'status');
        s.textContent = how === 'done' ? d.more.copied : d.more.copyFailed;
        cp.appendChild(s);
        later(function () { copied = null; close(); }, COPIED_MS);
      }
      if (chapter) item('mi-chapter', glyph('digest'), d.more.chapter, null, function () { close(); chapter(); });
      pop.appendChild(menu);
      more.setAttribute('aria-expanded', 'true');
    }

    more.addEventListener('click', function () { if (menu) close(); else open(); });
    return { el: pop, openMenu: open, closeMenu: close };
  }

  var api = {
    POP_H: POP_H,
    POP_GAP: POP_GAP,
    POP_ROOM_PX: POP_ROOM_PX,
    PICK_MAX_CHARS: PICK_MAX_CHARS,
    COPIED_MS: COPIED_MS,
    cleanSelection: cleanSelection,
    pickWords: pickWords,
    selectionForLine: selectionForLine,
    splitMark: splitMark,
    trayPlacement: trayPlacement,
    popSide: popSide,
    glyph: glyph,
    CSS: CSS,
    build: build,
  };
  root.HeddyDeskTray = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
