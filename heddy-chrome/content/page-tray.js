// content/page-tray.js — the bar under selected words on any page (PRD-v0.96.0
// § 1i, D85; artifact round-8-youtube-desk.html #web, frame r9f1t).
//
// Injected only on a gesture: the toolbar icon (the desk), the jot-selection
// command (no default key; the child binds one), or the selection's "Save to
// Jotters" menu item. That is activeTab (D3): Heddy may run on a page only
// after the child asks.
//
// Selected words get the same bar and the same drop-down as a picture
// (lib/tray-tools.js): [Text view | Picture view] · Heddy ▾, and Heddy ▾ is
// Ask {professor} about this · Make a card (each "in Heddy's desk"), then
// Copy words · Select the whole paragraph. With the desk closed the menu
// starts with Add to Sources, which opens the desk; with it open the words
// were already added by themselves (D65). The old tray (+ Add · Explain ·
// Make a card · Ask Heddy ›) is gone, and nothing here opens a window (D78).
//
// It reads the selection (the quote, at most 300 characters of the words
// either side) and sends it only to Heddy's background. Everything from the
// page is read as text and only ever set as textContent.
(function () {
  if (globalThis.__heddyPage) return;

  var I = globalThis.HeddyI18n;
  var M = globalThis.HeddyMarks;
  var T = globalThis.HeddyToast;
  var P = globalThis.HeddyProtocol;
  var X = globalThis.HeddyExtract;
  var TT = globalThis.HeddyTrayTools;

  var CONTEXT_SIDE = 300;
  var lang = 'en';
  var tr = I.translator(lang);
  var tray = null; // { host, shadow, sel }
  var langReady = I.currentLang().then(function (l) { lang = l; tr = I.translator(l); }, function () {});

  function send(message) {
    try {
      return chrome.runtime.sendMessage(message).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // The toasts the background sends this page (an Undo's answer; a toast's
  // Open is the one tap that leaves the page, D78).
  var toaster = T.createToaster({
    document: document,
    marks: M,
    onOpen: function (href) { send({ type: 'heddy-ui:open', href: href }); },
    onUndoCards: function (cardIds) { send({ type: 'heddy-ui:undo-card', cardIds: cardIds }); },
    onUndo: function (jotId, jotterId) { send({ type: 'heddy-ui:undo', jotId: jotId, jotterId: jotterId }); },
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

  /** An ancestor with enough words around the selection for its context
   *  (the fallback below only: it reads textContent up the tree). */
  function contextRoot(range) {
    var el = blockOf(range.commonAncestorContainer);
    while (el && el !== document.body && (el.textContent || '').length < range.toString().length + 2 * CONTEXT_SIDE) el = el.parentElement;
    return el || document.body;
  }

  /** How the page's CSS sets elements apart, for the words around a quote
   *  (lib/pos.js wordsBefore / wordsAfter): links laid out as boxes, list items and
   *  blocks are read with a space between them, never run together. */
  function readerKind() {
    var POS = globalThis.HeddyPos;
    return POS && POS.styleKind(function (el) { return getComputedStyle(el); });
  }

  /** The words either side of the selection, apart where the page sets them
   *  apart, nav, header, footer and aside left out. Each side walks outward
   *  from the selection and stops at 600 characters, so it costs the same
   *  on any page: auto-add (D65) runs it on every selection. */
  function contextOf(range) {
    var POS = globalThis.HeddyPos;
    var side = CONTEXT_SIDE * 2;
    var body = document.body || document.documentElement;
    if (POS && POS.wordsBefore) {
      var kind = readerKind();
      return {
        before: POS.wordsBefore(body, { node: range.startContainer, offset: range.startOffset }, side, kind),
        after: POS.wordsAfter(body, { node: range.endContainer, offset: range.endOffset }, side, kind),
      };
    }
    // lib/pos.js is in every injection with this file; this is a fallback.
    var rootEl = contextRoot(range);
    return {
      before: slice(rootEl, 0, range.startContainer, range.startOffset).slice(-side),
      after: slice(range.endContainer, range.endOffset, rootEl, rootEl.childNodes.length).slice(0, side),
    };
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

  /** The selection the tray acts on, or null with nothing selected. The courier caps it
   *  again (lib/protocol.js buildJot). */
  function readSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    var quote = sel.toString();
    if (!quote.trim()) return null;
    var around = contextOf(range);
    return {
      quote: quote,
      before: around.before,
      after: around.after,
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

  /** Add to Sources (D85, the desk closed): the words become the next card
   *  and the desk opens on them. The selection is put back first: the
   *  background reads it from the page (content/cards-layer.js). */
  function add(s) {
    hideTray();
    if (!s) return Promise.resolve({ ok: false });
    try {
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(s.range);
    } catch (e) { /* the words may have left the page */ }
    return send({ type: 'heddy-cards:collect' });
  }

  /** Ask {professor} about this, Make a card (D84): the desk opens its Ask
   *  view on these words. The background knows the tab, its address and
   *  its title; only the words travel. */
  function ask(intent, s) {
    hideTray();
    if (!s) return Promise.resolve({ ok: false });
    return send({ type: 'heddy-page:ask', intent: intent, quote: s.quote, before: s.before, after: s.after });
  }

  /** Picture view: box mode on this page (the desk's Picture mode, D64). */
  function pictureView() {
    hideTray();
    var b = globalThis.__heddyBoxMode;
    if (b && b.start) return b.start();
    return send({ type: 'heddy-page:picture' });
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

  // ─── the bar (artifact .hbar / .hmenu, frame r9f1t) ────────────────────────

  var CSS = ':host{all:initial;position:absolute;z-index:2147483647}' + TT.CSS +
    '.hmenu{left:0;top:56px}';

  var professor = 'Mentor';

  function hideTray() {
    if (!tray) return;
    tray.host.remove();
    tray = null;
  }

  function deskOpen() {
    var p = globalThis.__heddyPanel;
    return !!(p && p.isOpen && p.isOpen());
  }

  /** The bar under the selection. Returns false with nothing selected. */
  function showTray() {
    var s = readSelection();
    hideTray();
    if (!s) return false;
    var host = document.createElement('heddy-tray');
    var shadow = host.attachShadow({ mode: 'closed' });
    // Constant markup only; labels go in as text below.
    shadow.innerHTML = '<style>' + CSS + '</style><div class="hbar" role="toolbar"><span class="sg" role="group"></span>' +
      '<button type="button" class="hd2" aria-haspopup="menu" aria-expanded="false"><span class="eyes">' + M.use('h-eyes', 20) + '</span><span></span></button></div>' +
      '<div class="hmenu" role="menu" hidden></div>' + M.sprite(['h-eyes']);
    var bar = shadow.querySelector('.hbar');
    bar.setAttribute('aria-label', tr('trayLabel'));
    var sg = shadow.querySelector('.sg');
    sg.setAttribute('aria-label', tr('modeSwitchLabel'));
    TT.switchRows('text').forEach(function (row) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(row.pressed));
      b.insertAdjacentHTML('beforeend', TT.sv(row.icon));
      b.appendChild(document.createTextNode(tr(row.label)));
      if (row.mode === 'picture') b.addEventListener('click', pictureView);
      sg.appendChild(b);
    });
    var heddy = shadow.querySelector('.hd2');
    heddy.lastChild.textContent = tr('barHeddyMenu');
    var menu = shadow.querySelector('.hmenu');
    function drawMenu() {
      menu.textContent = '';
      TT.menuFor('words', { deskOpen: deskOpen() }).forEach(function (row) {
        if (row.sep) return menu.appendChild(document.createElement('hr'));
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.insertAdjacentHTML('beforeend', TT.sv(row.icon));
        b.appendChild(document.createTextNode(tr(row.label, professor)));
        if (row.tag) {
          var k = document.createElement('small');
          k.textContent = tr('menuInDesk');
          b.appendChild(k);
        }
        b.addEventListener('click', function () { run(row.act, s); });
        menu.appendChild(b);
      });
    }
    drawMenu();
    heddy.addEventListener('click', function () {
      var open = menu.hidden;
      if (open) drawMenu();
      // Under Heddy ▾, its left edge on the button's (the artifact's r9f1t).
      menu.style.left = heddy.offsetLeft + 'px';
      menu.hidden = !open;
      heddy.setAttribute('aria-expanded', String(open));
    });
    shadow.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); hideTray(); }
    });
    // The professor's name, once the background knows it for this page.
    send({ type: 'heddy-page:professor' }).then(function (r) {
      if (r && typeof r.name === 'string' && r.name && r.name !== professor) {
        professor = r.name;
        if (tray && tray.host === host) drawMenu();
      }
    });

    // Under the selection, 8 px below its last line, kept inside the window.
    var left = Math.max(8, Math.min(s.rect.left, document.documentElement.clientWidth - 320));
    host.style.left = Math.round(left + window.scrollX) + 'px';
    host.style.top = Math.round(s.rect.bottom + window.scrollY + 8) + 'px';
    document.documentElement.appendChild(host);
    tray = { host: host, shadow: shadow, sel: s };
    return true;
  }

  function run(id, s) {
    if (id === 'add') return add(s);
    if (id === 'ask' || id === 'card') return ask(id, s);
    if (id === 'copy') return copy(s);
    if (id === 'paragraph') return selectParagraph(s);
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
    if (msg.type === 'heddy-ui:toast') {
      // On a YouTube watch page content/youtube.js shows every toast (same
      // module, same isolated world), so the tray stays quiet: one toast, not two.
      if (globalThis.__heddyYouTube) return undefined;
      langReady.then(function () { toaster.show(T.model(msg, lang, tr)); });
      return undefined;
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
    // The desk's selection watcher (content/panel.js) shows the bar under
    // words it has just added (D85).
    showBar: function () {
      return langReady.then(showTray);
    },
    extract: function () {
      return langReady.then(extract);
    },
  };
})();
