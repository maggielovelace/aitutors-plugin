// content/panel.js — Heddy's panel in the page (lib/panel.js; owner,
// 2026-10-30). Injected on the toolbar click (activeTab), never declared.
//
// It draws one thing: a frame holding popup/popup.html, top right under the
// toolbar, fixed, above everything, in a closed shadow root so the page's CSS
// and scripts cannot reach it. The popup inside is the real extension page,
// so its chrome.* calls work as they did in the toolbar popup. It stays while
// the child scrolls, selects or clicks the page, and goes only on its ✕, on
// Esc (here or in the panel), or on a second click of the icon.
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
  if (root.__heddyPanel) return;

  var A = root.HeddyAutoAdd;

  var INSET = 12;
  var WIDTH = 360;
  var SELECTION_MS = 250;
  var URL_MS = 700;

  var host = null;
  var frame = null;
  var frameOrigin = '*';
  var selTimer = null;
  var urlTimer = null;
  var lastUrl = '';
  var autoTimer = null;
  var lastAuto = null; // {id, at}: the card auto-added most recently

  var CSS = [
    ':host { all: initial; }',
    '.f { display: block; box-sizing: border-box; width: ' + WIDTH + 'px; height: 0; max-height: calc(100vh - ' + 2 * INSET + 'px); border: 0; margin: 0; padding: 0;',
    '  border-radius: 12px; background: #fdfcf8; color-scheme: light; visibility: hidden;',
    '  box-shadow: 0 14px 36px rgba(0, 20, 50, .28), 0 0 0 1px rgba(0, 33, 71, .12); }',
    '.f.on { visibility: visible; }',
  ].join('\n');

  function tell(message) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(message, frameOrigin);
  }

  function onMessage(e) {
    if (!frame || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
    var m = e.data;
    if (m.heddyPanel === 'size' && typeof m.h === 'number' && isFinite(m.h) && m.h > 0) {
      frame.style.height = Math.ceil(Math.min(m.h, 2000)) + 'px';
      frame.classList.add('on');
    } else if (m.heddyPanel === 'close') {
      close();
    }
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
    host.setAttribute('style', [
      'all: initial', 'position: fixed', 'top: ' + INSET + 'px', 'right: ' + INSET + 'px', 'left: auto', 'bottom: auto',
      'z-index: 2147483647', 'display: block', 'width: ' + WIDTH + 'px', 'margin: 0', 'padding: 0',
      'transform: none', 'filter: none', 'opacity: 1', 'pointer-events: auto',
    ].map(function (d) { return d + ' !important'; }).join('; '));
    var shadow = host.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = CSS;
    frame = document.createElement('iframe');
    frame.className = 'f';
    frame.title = 'Heddy';
    frame.src = chrome.runtime.getURL('popup/popup.html') + '?tab=' + encodeURIComponent(String(tabId)) + '&host=panel';
    var o = /^[a-z-]+:\/\/[^/]+/.exec(frame.src);
    frameOrigin = o ? o[0] : '*';
    shadow.appendChild(style);
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
    host.remove();
    host = null;
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

  root.__heddyPanel = { open: open, close: close, away: away, modeChanged: modeChanged, host: function () { return host; }, isOpen: function () { return !!host; } };
})(globalThis);
