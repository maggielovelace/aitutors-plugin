// content/page-tray.js — Jot it on any page (PRD-v0.96.0 D5, D7 as amended by
// D17, D16, D25; artifact Round 3 · Direction A "Selection · Phase 2").
//
// Injected only on a gesture: the context-menu item "Jot it with Heddy", the
// Ctrl Shift J command (⌘⇧J on a Mac), or the toolbar popup. That is activeTab
// (D3): Heddy may run on a page only after the child asks, so there is no
// bubble waiting over a selection before that first gesture. Round 1's
// always-on bubble (D7) is a deliberate casualty of D3, not an omission.
//
// Once here it reads the selection (the quote, at most 300 characters of the
// words either side, the page's title and address) and draws the tray under
// it: Jot it (filled amber) and › (Copy · Select the whole paragraph · Clip the
// whole page). The tools come from lib/tray-tools.js, which Phase 3 extends.
// Everything from the page is read as text and only ever set as textContent.
(function () {
  if (globalThis.__heddyPage) return;

  var I = globalThis.HeddyI18n;
  var M = globalThis.HeddyMarks;
  var T = globalThis.HeddyToast;
  var X = globalThis.HeddyExtract;
  var TOOLS = globalThis.HeddyTrayTools.TOOLS;
  var MENU = globalThis.HeddyTrayTools.MENU;

  var CONTEXT_SIDE = 300;
  var lang = 'en';
  var tr = I.translator(lang);
  var tray = null; // { host, shadow, sel }
  var langReady = I.currentLang().then(function (l) { lang = l; tr = I.translator(l); }, function () {});
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  function send(message) {
    try {
      return chrome.runtime.sendMessage(message).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  var toaster = T.createToaster({
    document: document,
    marks: M,
    onOpen: function () {},
    onUndo: function () {},
  });

  // ─── reading the selection ─────────────────────────────────────────────────

  var BLOCKS = /^(P|LI|TD|TH|DD|DT|BLOCKQUOTE|PRE|H[1-6]|FIGCAPTION|ARTICLE|SECTION|MAIN|DIV|BODY)$/;

  function elementOf(node) {
    return node && node.nodeType === 1 ? node : node && node.parentElement;
  }

  /** The nearest block around a node (the paragraph the words are in). */
  function blockOf(node) {
    var el = elementOf(node);
    while (el && el !== document.body && !BLOCKS.test(el.nodeName)) el = el.parentElement;
    return el || document.body;
  }

  /** An ancestor with enough words around the selection for its context. */
  function contextRoot(range) {
    var el = blockOf(range.commonAncestorContainer);
    while (el && el !== document.body && (el.textContent || '').length < range.toString().length + 2 * CONTEXT_SIDE) el = el.parentElement;
    return el || document.body;
  }

  function slice(startNode, startOffset, endNode, endOffset) {
    try {
      var r = document.createRange();
      r.setStart(startNode, startOffset);
      r.setEnd(endNode, endOffset);
      return r.toString();
    } catch (e) {
      return '';
    }
  }

  /** What Jot it sends, or null with nothing selected. The courier caps it
   *  again (lib/protocol.js buildJot). */
  function readSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    var quote = sel.toString();
    if (!quote.trim()) return null;
    var rootEl = contextRoot(range);
    var before = slice(rootEl, 0, range.startContainer, range.startOffset);
    var after = slice(range.endContainer, range.endOffset, rootEl, rootEl.childNodes.length);
    return {
      quote: quote,
      before: before.slice(-CONTEXT_SIDE * 2),
      after: after.slice(0, CONTEXT_SIDE * 2),
      title: document.title || '',
      url: location.href,
      rect: range.getBoundingClientRect(),
      range: range.cloneRange(),
    };
  }

  function payloadOf(s) {
    return { quote: s.quote, before: s.before, after: s.after, title: s.title, url: s.url };
  }

  // ─── the actions ───────────────────────────────────────────────────────────

  function jot(s) {
    hideTray();
    if (!s) return Promise.resolve({ ok: false });
    var p = payloadOf(s);
    p.type = 'heddy-ui:jot';
    return send(p);
  }

  function hidden(el) {
    try {
      var cs = getComputedStyle(el);
      return cs.display === 'none' || cs.visibility === 'hidden';
    } catch (e) {
      return false;
    }
  }

  /** The readable page as Markdown (content/extract.js). */
  function extract() {
    var page = X.extractPage(document, { base: location.href, isHidden: hidden, imageLabel: tr('imageLabel') });
    return { url: location.href, title: page.title, markdown: page.markdown, images: page.images };
  }

  function clipPage() {
    hideTray();
    var page = extract();
    return send({ type: 'heddy-ui:page', url: page.url, title: page.title, markdown: page.markdown }).then(function (reply) {
      if (reply && reply.error === 'too_long') toaster.show({ title: tr('pageTooLong'), ms: T.NOTE_MS });
      else if (reply && reply.error === 'empty') toaster.show({ title: tr('pageEmpty'), ms: T.NOTE_MS });
      return reply;
    });
  }

  function selectParagraph(s) {
    var el = blockOf(s.range.startContainer);
    var sel = window.getSelection();
    var r = document.createRange();
    r.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(r);
    showTray();
  }

  function copy(s) {
    hideTray();
    try {
      navigator.clipboard.writeText(s.quote).catch(function () {});
    } catch (e) { /* the page can still copy with ⌘C */ }
  }

  // ─── the tray (artifact .r2tray / .r3menu, Direction A) ────────────────────

  var CSS =
    ':host{all:initial;position:absolute;z-index:2147483647}' +
    '.bar{display:flex;align-items:stretch;gap:2px;padding:4px;border-radius:12px;background:#002147;color:#fff;' +
    'box-shadow:0 10px 26px rgba(0,0,0,.22);white-space:nowrap;line-height:1;font-family:Manrope,Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.bar button{all:unset;box-sizing:border-box;display:grid;justify-items:center;align-content:center;gap:5px;min-width:76px;height:50px;padding:0 8px;' +
    'border-radius:9px;font:700 11.5px Manrope,Roboto,Arial,sans-serif;color:#fff;cursor:pointer}' +
    '.bar button.pri{background:#DC9400;color:#002147}' +
    '.bar button.more{min-width:36px}' +
    '.bar button.more[aria-expanded="true"],.bar button:not(.pri):hover{background:rgba(255,255,255,.16)}' +
    '.bar button.pri:hover{filter:brightness(1.06)}' +
    '.bar button:focus-visible{outline:2px solid #f2ead8;outline-offset:1px}' +
    'svg{display:block;flex:none}' +
    '.menu{position:absolute;left:0;top:64px;display:grid;gap:1px;min-width:220px;padding:5px;border-radius:11px;background:#fdfcf8;' +
    'border:1px solid #d9d2c3;box-shadow:0 12px 30px rgba(0,0,0,.18);font:600 13px/1.2 Manrope,Roboto,Arial,sans-serif;color:#002147}' +
    '.menu[hidden]{display:none}' +
    '.menu button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:7px;cursor:pointer;font:inherit;color:inherit;white-space:nowrap}' +
    '.menu button:hover,.menu button:focus-visible{background:#efe9dc}' +
    '.menu small{margin-left:auto;font:600 11px "JetBrains Mono",ui-monospace,Menlo,monospace;color:#80868b}' +
    '.menu i{height:1px;background:#e3dccd;margin:3px 4px;display:block}';

  function hideTray() {
    if (!tray) return;
    tray.host.remove();
    tray = null;
  }

  function showTray() {
    var s = readSelection();
    hideTray();
    if (!s) return false;
    var host = document.createElement('heddy-tray');
    var shadow = host.attachShadow({ mode: 'closed' });
    var marks = TOOLS.map(function (t) { return t.mark; }).concat(['h-chev']).concat(MENU.filter(function (m) { return m.mark; }).map(function (m) { return m.mark; }));
    // Constant markup only; labels go in as text below.
    shadow.innerHTML = '<style>' + CSS + '</style>' + M.sprite(marks) + '<div class="bar" role="toolbar"></div><div class="menu" role="menu" hidden></div>';
    var bar = shadow.querySelector('.bar');
    bar.setAttribute('aria-label', tr('trayLabel'));
    TOOLS.forEach(function (tool) {
      var b = document.createElement('button');
      b.type = 'button';
      if (tool.primary) b.className = 'pri';
      b.insertAdjacentHTML('beforeend', M.use(tool.mark, 18));
      b.appendChild(document.createTextNode(tr(tool.label)));
      b.addEventListener('click', function () { run(tool.id, s); });
      bar.appendChild(b);
    });
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'more';
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', tr('trayMore'));
    more.insertAdjacentHTML('beforeend', M.use('h-chev', 18));
    bar.appendChild(more);

    var menu = shadow.querySelector('.menu');
    MENU.forEach(function (item) {
      if (item.ruleBefore) menu.appendChild(document.createElement('i'));
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      if (item.mark) b.insertAdjacentHTML('beforeend', M.use(item.mark, 16));
      b.appendChild(document.createTextNode(tr(item.label)));
      if (item.kbd) {
        var k = document.createElement('small');
        k.textContent = isMac ? '⌘C' : 'Ctrl C';
        b.appendChild(k);
      }
      b.addEventListener('click', function () { run(item.id, s); });
      menu.appendChild(b);
    });
    more.addEventListener('click', function () {
      var open = menu.hidden;
      menu.hidden = !open;
      more.setAttribute('aria-expanded', String(open));
    });
    shadow.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); hideTray(); }
    });

    // Under the selection, 8 px below its last line, kept inside the window.
    var left = Math.max(8, Math.min(s.rect.left, document.documentElement.clientWidth - 300));
    host.style.left = Math.round(left + window.scrollX) + 'px';
    host.style.top = Math.round(s.rect.bottom + window.scrollY + 8) + 'px';
    document.documentElement.appendChild(host);
    tray = { host: host, shadow: shadow, sel: s };
    var first = bar.querySelector('button');
    if (first) first.focus({ preventScroll: true });
    return true;
  }

  function run(id, s) {
    if (id === 'jot') return jot(s);
    if (id === 'copy') return copy(s);
    if (id === 'paragraph') return selectParagraph(s);
    if (id === 'clip') return clipPage();
    return null;
  }

  // The tray goes when the child clicks elsewhere or presses Escape.
  document.addEventListener('mousedown', function (e) {
    if (tray && e.composedPath().indexOf(tray.host) < 0) hideTray();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (tray && e.key === 'Escape') hideTray();
  }, true);

  chrome.runtime.onMessage.addListener(function (msg, _sender, reply) {
    if (!msg || typeof msg !== 'object') return undefined;
    if (msg.type === 'heddy-ui:tray') {
      langReady.then(function () { reply({ ok: showTray() }); });
      return true;
    }
    if (msg.type === 'heddy-ui:jot-selection') {
      jot(readSelection()).then(function (r) { reply(r || { ok: false }); });
      return true;
    }
    return undefined;
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync' && changes[I.STORAGE_KEY]) I.currentLang().then(function (l) { lang = l; tr = I.translator(l); });
  });

  // For the popup, which runs these in the tab through chrome.scripting.
  globalThis.__heddyPage = {
    selection: function () {
      var s = readSelection();
      return s ? payloadOf(s) : null;
    },
    extract: function () {
      return langReady.then(extract);
    },
  };
})();
