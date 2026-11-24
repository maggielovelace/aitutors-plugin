// content/panel.js — Heddy's panel in the page (lib/panel.js; owner,
// 2026-10-30). Injected on the toolbar click (activeTab), never declared.
//
// It draws one thing: a frame holding popup/popup.html, fixed, above
// everything, in a closed shadow root so the page's CSS and scripts cannot
// reach it. The popup inside is the real extension page, so its chrome.*
// calls work as they did in the toolbar popup. It stays while the child
// scrolls, selects or clicks the page, and goes only on its ✕, on Esc (here
// or in the panel), or on a second click of the icon.
//
// Round 9 (D79): on an ordinary web page the frame is the desk
// (popup/web-desk.js), docked on the right, full height, 410 px with the
// artifact's 12 px gutter, and the page is narrowed by the same 410 px so the
// desk never covers what the child is selecting. Elsewhere (the first-time
// state, YouTube's Add to My Clips) it floats top right as before.
//
// On a phone (2026-11-24, owner, after Obsidian Web Clipper on iPhone) it is a BOTTOM SHEET instead: full width
// inside a 10 px margin, rounded, sitting on the bottom edge, growing with its content up to most of the screen,
// the page dimmed behind it. A 360 px box pinned top right hung off the left of a 375 px iPhone. The dimming is
// paint only (pointer-events: none): the child still selects words on the page, and they still become cards.
// iPad and desktop are untouched.
//
// Box mode (content/box-mode.js) runs beside it: it draws itself just under
// this frame and hides the frame (away) only while a screenshot is taken.
// Box mode is the panel's Picture mode; without it the panel is in Text mode
// (Round 7, D64), and Esc in Picture mode switches to Text rather than
// closing the panel.
//
// In Text mode a finished selection on the page becomes the next card by
// itself (D65, lib/auto-add.js): this script watches for it while the panel
// is open, and only then, and asks the background to add it.
//
// Between this script and the frame only hints travel, by postMessage: the
// frame says how tall it is and when to close; this script says "the
// selection changed" (the frame reads it again itself), "the page moved on"
// and which mode is on. A message is taken only from the frame's own window.
(function (root) {
  // Stamped with the build: a copy left in the tab by another build (an update with the tab open) is replaced,
  // never obeyed — Safari keeps the old marker while its listeners are dead (2026-11-14).
  var BUILD = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '');
  var prev = root.__heddyPanel;
  if (prev && prev.v === BUILD) return;
  if (prev && typeof prev.close === 'function') { try { prev.close(); } catch (e) { /* its page is ours no longer */ } }

  var A = root.HeddyAutoAdd;

  var INSET = 12;
  var WIDTH = 360;
  // The docked desk's column (artifact .web .dock: 410 px, 12 px around the card).
  var DOCK = 410;
  var SELECTION_MS = 250;
  // The phone: a narrow screen held in the hand (the same test the desk's own phone rule has always used).
  var PHONE = '(max-width: 700px) and (pointer: coarse)';
  var SHEET_GAP = 10;
  var URL_MS = 700;

  var host = null;
  var frame = null;
  var frameOrigin = '*';
  var selTimer = null;
  var urlTimer = null;
  var lastUrl = '';
  var autoTimer = null;
  var lastAuto = null; // {id, at}: the card auto-added most recently
  var docked = null; // while docked: the page's own margin-right, to give back
  var sheet = false; // a phone: the panel is a bottom sheet (fixed at open)

  function isPhone() {
    try { return !!(root.matchMedia && root.matchMedia(PHONE).matches); } catch (e) { return false; }
  }

  var CSS = [
    ':host { all: initial; }',
    '.f { display: block; box-sizing: border-box; width: ' + WIDTH + 'px; height: 0; max-height: calc(100vh - ' + 2 * INSET + 'px); border: 0; margin: 0; padding: 0;',
    '  border-radius: 12px; background: #fdfcf8; color-scheme: light; visibility: hidden;',
    '  box-shadow: 0 14px 36px rgba(0, 20, 50, .28), 0 0 0 1px rgba(0, 33, 71, .12); }',
    '.f.on { visibility: visible; }',
    '.f { max-width: calc(100vw - 24px); }',
    // Docked: the card fills the column, inside its 12 px gutter (the desk
    // draws its own 1 px border and 16 px corners).
    '.f.dock { position: absolute; top: ' + INSET + 'px; right: ' + INSET + 'px; bottom: ' + INSET + 'px; width: ' + (DOCK - INSET) + 'px !important;',
    // A frame is a replaced element: top + bottom alone leave it 150 px tall.
    '  height: calc(100vh - ' + 2 * INSET + 'px) !important; max-height: none; border-radius: 16px; box-shadow: none; background: transparent; }',
    '@media (max-width: 700px) and (pointer: coarse) { .f.dock { top: auto; width: calc(100vw - 24px) !important; height: min(70dvh, 560px) !important; } }',
    // The phone's bottom sheet (Obsidian Web Clipper's shape): the frame fills the host, which the script pins to the
    // bottom edge; the page behind is dimmed by paint alone.
    '.s { position: fixed; inset: 0; background: rgba(0, 21, 50, .22); pointer-events: none; }',
    '.f.sheet { position: relative; width: 100% !important; max-width: none; max-height: min(86dvh, 760px); border-radius: 24px;',
    '  box-shadow: 0 -10px 40px rgba(0, 20, 50, .22), 0 0 0 1px rgba(0, 33, 71, .10); }',
    '.f.sheet.dock { position: relative; top: auto; right: auto; bottom: auto; width: 100% !important; height: min(78dvh, 680px) !important;',
    '  max-height: none; border-radius: 16px; box-shadow: 0 -10px 40px rgba(0, 20, 50, .22); }',
  ].join('\n');

  function tell(message) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(message, frameOrigin);
  }

  function onMessage(e) {
    if (!frame || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
    var m = e.data;
    if (m.heddyPanel === 'size' && m.dock === true) {
      dock(true);
      frame.classList.add('on');
    } else if (m.heddyPanel === 'size' && typeof m.h === 'number' && isFinite(m.h) && m.h > 0) {
      dock(false);
      frame.style.height = Math.ceil(Math.min(m.h, 2000)) + 'px';
      // 400 on a YouTube video (Add to My Clips, artifact P2), 380 for the
      // Can't read / aitutors.me / first-time screens (PRD-v0.146.0 B8), else 360.
      if (!sheet) {
        var w = (m.w === 400 || m.w === 380 ? m.w : WIDTH) + 'px';
        frame.style.width = w;
        host.style.setProperty('width', w, 'important');
      }
      frame.classList.add('on');
    } else if (m.heddyPanel === 'close') {
      close();
    }
  }

  /** The desk docked on the right, and the page narrowed beside it (D79);
   *  or back to floating, with the page's own margin given back. */
  function dock(on) {
    if (!host || !frame || on === !!docked) return;
    var html = document.documentElement;
    frame.classList.toggle('dock', on);
    if (sheet) {
      // The sheet stays where it is; only its height changes (the CSS). The page is never narrowed on a phone.
      docked = on ? { value: null, priority: '' } : null;
      try { root.dispatchEvent(new Event('resize')); } catch (e) { /* no matter */ }
      return;
    }
    if (on) {
      docked = { value: html.style.getPropertyValue('margin-right'), priority: html.style.getPropertyPriority('margin-right') };
      var touch = root.matchMedia && root.matchMedia('(pointer: coarse)').matches;
      var margin = touch ? 'clamp(0px, (100vw - 700px) * 410, ' + DOCK + 'px)' : DOCK + 'px';
      html.style.setProperty('margin-right', margin, 'important');
      ['top: 0', 'right: 0', 'bottom: 0', 'height: 100vh', 'width: ' + DOCK + 'px'].forEach(function (d) {
        var kv = d.split(': ');
        host.style.setProperty(kv[0], kv[1], 'important');
      });
    } else {
      undock();
      host.style.setProperty('top', INSET + 'px', 'important');
      host.style.setProperty('right', INSET + 'px', 'important');
      host.style.setProperty('bottom', 'auto', 'important');
      host.style.setProperty('height', 'auto', 'important');
    }
    // The page reflowed: box mode and the card numbers follow.
    try { root.dispatchEvent(new Event('resize')); } catch (e) { /* no matter */ }
  }

  function undock() {
    if (!docked) return;
    if (docked.value === null) { docked = null; return; }
    var html = document.documentElement;
    if (docked.value) html.style.setProperty('margin-right', docked.value, docked.priority);
    else html.style.removeProperty('margin-right');
    docked = null;
  }

  /** 'picture' while box mode is drawing, else 'text'. */
  function mode() {
    var b = root.__heddyBoxMode;
    return b && b.mode ? b.mode() : 'text';
  }

  function onKey(e) {
    // In Picture mode Esc is box mode's: it switches to Text (D64).
    if (e.key !== 'Escape' || e.defaultPrevented || mode() === 'picture') return;
    close();
  }

  // ─── selected words add themselves (D65) ──────────────────────────────────

  function elementOf(node) {
    return node && node.nodeType === 1 ? node : node && node.parentElement;
  }

  /** From an element up to the root: what lib/auto-add.js placeOf reads. */
  function chainOf(node) {
    var out = [];
    for (var el = elementOf(node), k = 0; el && k < 60; el = el.parentElement, k++) {
      out.push({ tag: el.tagName, editable: !!el.isContentEditable });
    }
    return out;
  }

  /** The selection as auto-add sees it, with a key that changes when it
   *  does; null with nothing selected. */
  function selectionNow() {
    var sel = root.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    var where = A.placeOf(chainOf(range.startContainer).concat(chainOf(range.endContainer)));
    var active = document.activeElement;
    return {
      range: range.cloneRange(),
      text: sel.toString(),
      inHeddy: where.inHeddy,
      editable: where.editable,
      activeTag: active && active !== document.body ? active.tagName : '',
    };
  }

  function sameRange(a, b) {
    return a.startContainer === b.startContainer && a.startOffset === b.startOffset && a.endContainer === b.endContainer && a.endOffset === b.endOffset;
  }

  /** The mouse or a key let go: if the selection then holds still for
   *  400 ms, it is offered to the background as the next card. */
  function onRelease(e) {
    if (!host || !A) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.some(function (n) { return n && n.tagName && /^HEDDY-/.test(n.tagName); })) return;
    clearTimeout(autoTimer);
    var first = selectionNow();
    if (!first) return;
    autoTimer = setTimeout(function () {
      if (!host || mode() !== 'text') return;
      var now = selectionNow();
      if (!now || !sameRange(now.range, first.range) || !A.acceptable(now)) return;
      // The same bar as under a picture, under the words (D85).
      if (root.__heddyPage && root.__heddyPage.showBar) root.__heddyPage.showBar();
      var layer = root.__heddyCards;
      var t = Date.now();
      var replace = A.replaceTarget(lastAuto, t, !!(lastAuto && layer && layer.overlaps(lastAuto.id, now.range)));
      Promise.resolve()
        .then(function () { return chrome.runtime.sendMessage({ type: 'heddy-cards:auto', replace: replace }); })
        .then(function (r) {
          // A replaced card is the one just added, again: its 5 s start over.
          if (r && r.ok && r.id) lastAuto = { id: r.id, at: Date.now() };
        })
        .catch(function () {});
    }, A.STABLE_MS);
  }

  /** Box mode says which mode is on; the frame draws its switch from it. */
  function modeChanged(m) {
    tell({ heddyPanel: 'mode', mode: m === 'picture' ? 'picture' : 'text' });
  }

  function onSelection() {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () { tell({ heddyPanel: 'selection' }); }, SELECTION_MS);
  }

  /** YouTube (and other single-page sites) change page without a load: the
   *  frame draws the new one rather than keep showing the old. */
  function watchUrl() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    tell({ heddyPanel: 'moved' });
  }

  function open(tabId) {
    if (host) return;
    host = document.createElement('heddy-panel');
    sheet = isPhone();
    var place = sheet
      ? ['top: auto', 'left: ' + SHEET_GAP + 'px', 'right: ' + SHEET_GAP + 'px', 'bottom: calc(' + SHEET_GAP + 'px + env(safe-area-inset-bottom, 0px))', 'width: auto', 'max-width: none']
      : ['top: ' + INSET + 'px', 'right: ' + INSET + 'px', 'left: auto', 'bottom: auto', 'width: ' + WIDTH + 'px', 'max-width: 100vw'];
    host.setAttribute('style', ['all: initial', 'position: fixed'].concat(place, [
      'z-index: 2147483647', 'display: block', 'margin: 0', 'padding: 0',
      'transform: none', 'filter: none', 'opacity: 1', 'pointer-events: auto',
    ]).map(function (d) { return d + ' !important'; }).join('; '));
    var shadow = host.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = CSS;
    frame = document.createElement('iframe');
    frame.className = sheet ? 'f sheet' : 'f';
    frame.title = 'Heddy';
    // Copy on the YouTube state copies the video's link (D76).
    frame.allow = 'clipboard-write';
    // The address is kept, never read back from frame.src: Safari masks an extension page's address in the
    // page (webkit-masked-url://hidden/), so an origin taken from frame.src sent every message to nowhere
    // and the panel never started (2026-11-14, Mac).
    var src = chrome.runtime.getURL('popup/popup.html') + '?tab=' + encodeURIComponent(String(tabId)) + '&host=panel';
    frame.src = src;
    var o = /^[a-z-]+:\/\/[^/]+/.exec(src);
    frameOrigin = o ? o[0] : '*';
    shadow.appendChild(style);
    if (sheet) {
      var scrim = document.createElement('div');
      scrim.className = 's';
      shadow.appendChild(scrim);
    }
    shadow.appendChild(frame);
    // On <html>, last: box mode puts itself just before it, so the panel
    // stays above box mode and usable beside it (R5b).
    document.documentElement.appendChild(host);
    // Shown once it says how tall it is; this is the fallback.
    setTimeout(function () { if (frame) frame.classList.add('on'); }, 1500);
    lastUrl = location.href;
    root.addEventListener('message', onMessage);
    root.addEventListener('keydown', onKey, true);
    document.addEventListener('selectionchange', onSelection);
    document.addEventListener('pointerup', onRelease, true);
    document.addEventListener('keyup', onRelease, true);
    urlTimer = setInterval(watchUrl, URL_MS);
  }

  function close() {
    if (!host) return;
    root.removeEventListener('message', onMessage);
    root.removeEventListener('keydown', onKey, true);
    document.removeEventListener('selectionchange', onSelection);
    document.removeEventListener('pointerup', onRelease, true);
    document.removeEventListener('keyup', onRelease, true);
    clearTimeout(selTimer);
    clearTimeout(autoTimer);
    clearInterval(urlTimer);
    undock();
    host.remove();
    host = null;
    sheet = false;
    frame = null;
    lastAuto = null;
    // Text mode's small bar says words are added; with the panel gone they
    // are not, so it goes too. Picture mode carries on.
    if (root.__heddyBoxMode && root.__heddyBoxMode.panelClosed) root.__heddyBoxMode.panelClosed();
  }

  /** Resolves after the browser has painted a frame without the panel, so a
   *  screenshot taken next does not hold it. */
  function painted() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(resolve, 30); }); });
    });
  }

  chrome.runtime.onMessage.addListener(function (message, sender, reply) {
    if (!message || typeof message !== 'object' || sender.id !== chrome.runtime.id || sender.tab) return undefined;
    if (message.type === 'heddy-panel:toggle') {
      if (host) close();
      else open(message.tabId);
      reply({ open: !!host });
      return undefined;
    }
    if (message.type === 'heddy-panel:open') {
      if (!host) open(message.tabId);
      reply({ open: !!host });
      return undefined;
    }
    // Safari: the cards changed (lib/cards.js relay). A hint for the frame, which reads the list itself.
    if (message.type === 'heddy-panel:cards') {
      tell({ heddyPanel: 'cards', note: message.note === 'full_text' ? 'full_text' : null });
      return undefined;
    }
    if (message.type === 'heddy-panel:close') {
      var was = !!host;
      close();
      (was ? painted() : Promise.resolve()).then(function () { reply({ ok: true, was: was }); });
      return true;
    }
    return undefined;
  });

  /** Off the screen for a screenshot (box mode), then back. Made
   *  transparent, not removed: a frame moved or removed would load again,
   *  and the frame sets its own visibility, which would win over the host's. */
  function away(on) {
    if (host) host.style.setProperty('opacity', on ? '0' : '1', 'important');
  }

  root.__heddyPanel = { v: BUILD, open: open, close: close, away: away, modeChanged: modeChanged, host: function () { return host; }, isOpen: function () { return !!host; } };
})(globalThis);
