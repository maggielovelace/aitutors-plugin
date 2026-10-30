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
// Between this script and the frame only hints travel, by postMessage: the
// frame says how tall it is and when to close; this script says "the
// selection changed" (the frame reads it again itself) and "the page moved
// on". A message is taken only from the frame's own window.
(function (root) {
  if (root.__heddyPanel) return;

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

  function onKey(e) {
    if (e.key === 'Escape') close();
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
    (document.body || document.documentElement).appendChild(host);
    // Shown once it says how tall it is; this is the fallback.
    setTimeout(function () { if (frame) frame.classList.add('on'); }, 1500);
    lastUrl = location.href;
    root.addEventListener('message', onMessage);
    root.addEventListener('keydown', onKey, true);
    document.addEventListener('selectionchange', onSelection);
    urlTimer = setInterval(watchUrl, URL_MS);
  }

  function close() {
    if (!host) return;
    root.removeEventListener('message', onMessage);
    root.removeEventListener('keydown', onKey, true);
    document.removeEventListener('selectionchange', onSelection);
    clearTimeout(selTimer);
    clearInterval(urlTimer);
    host.remove();
    host = null;
    frame = null;
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
    if (message.type === 'heddy-panel:close') {
      var was = !!host;
      close();
      (was ? painted() : Promise.resolve()).then(function () { reply({ ok: true, was: was }); });
      return true;
    }
    return undefined;
  });

  root.__heddyPanel = { open: open, close: close, isOpen: function () { return !!host; } };
})(globalThis);
