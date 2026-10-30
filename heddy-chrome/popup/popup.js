// popup/popup.js — the toolbar popup (artifact R2 · 03, round 2c, R3b · 05).
//
// The states, showing only what already works (D25, Direction A):
//   first time      the one line, what Heddy does, Open aitutors.me (primary)
//   YouTube watch   the video row, Whole video / From m:ss, Watch with Heddy
//                   (primary), Add to My Clips (outlined), the H row
//   aitutors.me     one line of help, no primary, no footer
//   words selected  the quote, Jot it (primary), "Clip the whole page instead"
//   nothing selected the page, Clip this page (primary), the shortcut row
//                   (the child's binding, else "Set a shortcut")
//   can't read      a page Heddy may not script (chrome://, the Web Store)
// Phase 3 adds Explain, Make a card and Ask Heddy after Jot it, from
// lib/tray-tools.js. Every string from a page (the video's title and channel,
// the selection, the page's title) is set as text.
//
// Where it is drawn (owner, 2026-10-30; lib/panel.js): ?host=panel is the
// frame content/panel.js puts in the page, ?host=window the small window on a
// page Chrome keeps from extensions. Both stay until closed (✕, Esc, or the
// toolbar icon again), and ?tab= names the tab the popup acts on. Where the
// toolbar popup closed itself after an action, closeUi() closes either.
(function () {
  var P = HeddyProtocol, C = HeddyConfig, I = HeddyI18n, M = HeddyMarks, SEL = HeddyYouTube.SELECTORS;
  var tr = I.translator('en');

  var $ = function (id) { return document.getElementById(id); };

  var params = new URLSearchParams(location.search);
  var HOST = params.get('host') === 'panel' || params.get('host') === 'window' ? params.get('host') : 'popup';
  var TAB_ID = /^\d+$/.test(params.get('tab') || '') ? Number(params.get('tab')) : null;

  /** Close the panel (its host page removes the frame) or the window. */
  function closeUi() {
    if (HOST === 'panel') window.parent.postMessage({ heddyPanel: 'close' }, '*');
    else window.close();
  }

  /** The panel's frame is as tall as its content; the window is too. */
  function reportSize() {
    var h = Math.ceil(document.getElementById('pop').getBoundingClientRect().height);
    if (!h) return;
    if (HOST === 'panel') {
      window.parent.postMessage({ heddyPanel: 'size', h: h }, '*');
    } else if (HOST === 'window' && chrome.windows && chrome.windows.getCurrent) {
      chrome.windows.getCurrent().then(function (w) {
        var chromeH = (w && typeof w.height === 'number') ? w.height - window.innerHeight : 0;
        return chrome.windows.update(w.id, { height: Math.min(h + Math.max(chromeH, 0), 900) });
      }).catch(function () {});
    }
  }

  function watchSize() {
    var last = 0;
    var ro = new ResizeObserver(function () {
      var h = Math.ceil($('pop').getBoundingClientRect().height);
      if (h !== last) { last = h; reportSize(); }
    });
    ro.observe($('pop'));
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closeUi(); }
  });

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  /** A button with a constant mark before its label. */
  function button(cls, mark, markSize, label) {
    var b = el('button', cls);
    b.type = 'button';
    if (mark) b.insertAdjacentHTML('beforeend', M.use(mark, markSize));
    b.appendChild(el('span', null, label));
    return b;
  }

  function hostLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function isSite(url, dev) {
    var u;
    try { u = new URL(url); } catch (e) { return false; }
    if (u.protocol === 'https:' && (u.hostname === 'aitutors.me' || /\.aitutors\.me$/.test(u.hostname))) return true;
    return dev && u.origin === C.DEV_ORIGIN;
  }

  function openSite(url) {
    chrome.tabs.create({ url: url }).then(closeUi, function () {});
  }

  function drawChrome() {
    $('mark').innerHTML = M.sprite(['h-eyes', 'h-film', 'h-clock', 'h-lock', 'h-open', 'h-cog', 'h-quill', 'h-page', 'h-explain', 'h-cardt']) + M.use('h-eyes', 22);
    $('lock').innerHTML = M.use('h-lock', 14);
    $('lockLine').textContent = tr('footerLock');
    var cog = $('settings');
    cog.innerHTML = M.use('h-cog', 21);
    cog.title = tr('settings');
    cog.setAttribute('aria-label', tr('settings'));
    cog.addEventListener('click', function () { chrome.runtime.openOptionsPage(); closeUi(); });
    var x = $('close');
    x.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    x.title = tr('close');
    x.setAttribute('aria-label', tr('close'));
    x.addEventListener('click', closeUi);
  }

  // ─── states ────────────────────────────────────────────────────────────────

  function renderFirstTime(body, origin, lang) {
    $('ctx').textContent = tr('ctxFirstTime');
    body.appendChild(el('p', 'lead big', tr('firstTimeLead')));
    var three = el('div', 'three');
    var line = el('span');
    line.insertAdjacentHTML('beforeend', M.use('h-film', 16));
    line.appendChild(document.createTextNode(tr('firstTimeYouTube')));
    three.appendChild(line);
    var line2 = el('span');
    line2.insertAdjacentHTML('beforeend', M.use('h-quill', 16));
    line2.appendChild(document.createTextNode(tr('firstTimePage')));
    three.appendChild(line2);
    body.appendChild(three);
    var open = button('btn wide', 'h-open', 16, tr('openSite'));
    // The same first-run page a fresh install opens (PRD D8).
    open.addEventListener('click', function () { openSite(C.welcomeUrl(origin, lang)); });
    body.appendChild(open);
    $('foot').hidden = false;
  }

  /** A row: a label, a line under it, a key hint at the right (a supplement, D17). */
  function keyRow(mark, title, line, keys) {
    var row = el('div', 'row');
    if (mark) {
      var ic = el('span', 'ico');
      ic.insertAdjacentHTML('beforeend', M.use(mark, 18));
      row.appendChild(ic);
    }
    var t = el('span', 't');
    t.appendChild(el('b', null, title));
    if (line) t.appendChild(el('span', null, line));
    row.appendChild(t);
    row.appendChild(el('span', 'r kbd', keys));
    return row;
  }

  /** The jot-selection shortcut the child set in Chrome, or null. There is no
   *  default (owner, 2026-10-29): the obvious keys are Chrome's own. */
  function commandKeys() {
    if (!chrome.commands || !chrome.commands.getAll) return Promise.resolve(null);
    return chrome.commands.getAll().then(function (all) {
      var c = (all || []).filter(function (x) { return x.name === HeddyCourier.COMMAND; })[0];
      // As Chrome prints it: "Ctrl+Shift+Y", "⇧⌘Y".
      return c && c.shortcut ? c.shortcut.replace(/\+/g, ' ') : null;
    }, function () { return null; });
  }

  /** "Set a shortcut": Chrome's own page for extension shortcuts. */
  function shortcutLink() {
    var a = el('button', 'lk', tr('setShortcut'));
    a.type = 'button';
    a.addEventListener('click', function () {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).then(closeUi, function () {});
    });
    return a;
  }

  function fail(err, key) {
    err.textContent = tr(key);
    err.hidden = false;
  }

  /** Clip this page: the readable Markdown, made in the tab (content/extract.js).
   *  A page past 200 KB is cut by the courier, and the toast after the save says so. */
  function clipPage(tab, btn, err) {
    btn.setAttribute('aria-busy', 'true');
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: function () { return globalThis.__heddyPage.extract(); } })
      .then(function (res) {
        var page = res && res[0] && res[0].result;
        if (!page || !page.markdown || !page.markdown.trim()) throw new Error('empty');
        return chrome.runtime.sendMessage({ type: 'heddy-ui:page', url: tab.url, title: page.title || tab.title || '', markdown: page.markdown, tabId: tab.id, windowId: tab.windowId });
      })
      .then(function (reply) {
        if (reply && reply.ok) return closeUi();
        throw new Error((reply && reply.error) || 'no window');
      })
      .catch(function (e) {
        btn.removeAttribute('aria-busy');
        var m = e && e.message;
        fail(err, m === 'empty' ? 'pageEmpty' : 'captureFailed');
      });
  }

  function renderSelection(body, tab, sel) {
    var quote = el('div', 'quote', sel.quote.replace(/\s+/g, ' ').trim());
    quote.appendChild(el('small', null, [sel.title.trim(), hostLabel(tab.url)].filter(Boolean).join(' · ')));
    body.appendChild(quote);
    var err = el('p', 'err');
    err.hidden = true;
    var jot = button('btn wide', 'h-quill', 18, tr('popupJotIt'));
    jot.addEventListener('click', function () {
      jot.setAttribute('aria-busy', 'true');
      chrome.runtime.sendMessage({ type: 'heddy-ui:jot', url: tab.url, title: sel.title, quote: sel.quote, before: sel.before, after: sel.after, tabId: tab.id, windowId: tab.windowId })
        .then(function (reply) {
          if (reply && reply.ok) return closeUi();
          throw new Error('no window');
        })
        .catch(function () { jot.removeAttribute('aria-busy'); fail(err, 'captureFailed'); });
    });
    body.appendChild(jot);
    body.appendChild(toolRow(tab, sel, err));
    var clip = el('button', 'lk');
    clip.type = 'button';
    clip.insertAdjacentHTML('beforeend', M.use('h-page', 16));
    clip.appendChild(el('span', null, tr('clipWholePageInstead')));
    clip.addEventListener('click', function () { clipPage(tab, clip, err); });
    body.appendChild(clip);
    body.appendChild(err);
    $('foot').hidden = false;
  }

  /** Explain · Make a card · Ask Heddy under Jot it (R3b · 05 "Words
   *  selected", round 2c): outlined, never filled; Jot it stays the one
   *  primary. The free-rounds line is printed only inside the aitutors.me
   *  windows (owner, 2026-10-29), so not here. */
  function toolRow(tab, sel, err) {
    var row = el('div', 'tools');
    HeddyTrayTools.TOOLS.filter(function (t) { return !t.primary; }).forEach(function (t) {
      var b = el('button', 'tool');
      b.type = 'button';
      if (t.badge) {
        var hf = el('span', 'hf');
        hf.insertAdjacentHTML('beforeend', M.use(t.popupMark, 18));
        b.appendChild(hf);
      } else {
        b.insertAdjacentHTML('beforeend', M.use(t.popupMark, 15));
      }
      b.appendChild(el('span', null, tr(t.label)));
      b.addEventListener('click', function () {
        b.setAttribute('aria-busy', 'true');
        var c = P.contextOf(sel.before, sel.after);
        chrome.runtime.sendMessage({ type: 'heddy-ui:tool', tool: t.id, quote: sel.quote, context: c.before && c.after ? c.before + ' … ' + c.after : c.before || c.after, tabId: tab.id })
          .then(function (reply) {
            if (reply && reply.ok) return closeUi();
            throw new Error('no window');
          })
          .catch(function () { b.removeAttribute('aria-busy'); fail(err, 'captureFailed'); });
      });
      row.appendChild(b);
    });
    return row;
  }

  function renderNothingSelected(body, tab) {
    var pg = el('div', 'pg');
    pg.appendChild(el('b', null, (tab.title || hostLabel(tab.url)).slice(0, 200)));
    pg.appendChild(el('span', null, shortUrl(tab.url)));
    body.appendChild(pg);
    var err = el('p', 'err');
    err.hidden = true;
    var clip = button('btn wide', 'h-page', 16, tr('clipThisPage'));
    clip.addEventListener('click', function () { clipPage(tab, clip, err); });
    body.appendChild(clip);
    var row = keyRow(null, tr('selectSomeWords'), tr('selectSomeWordsFor'), '');
    body.appendChild(row);
    commandKeys().then(function (k) {
      var slot = row.querySelector('.kbd');
      if (k) slot.textContent = k;
      else slot.replaceWith(Object.assign(shortcutLink(), { className: 'lk r' }));
    });
    body.appendChild(err);
    $('foot').hidden = false;
  }

  function renderCantRead(body) {
    body.appendChild(el('p', 'lead big', tr('cantReadPage')));
    $('foot').hidden = false;
  }

  /** host/…/last-segment, as the artifact prints a page's address. */
  function shortUrl(url) {
    try {
      var u = new URL(url);
      var parts = u.pathname.split('/').filter(Boolean);
      var host = u.hostname.replace(/^www\./, '');
      if (!parts.length) return host;
      return host + (parts.length > 1 ? '/…/' : '/') + parts[parts.length - 1];
    } catch (e) {
      return '';
    }
  }

  /** The page's selection, read in the tab (content/extract.js), or null. */
  function readSelection(tab) {
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: function () { return globalThis.__heddyPage.selection(); } })
      .then(function (res) {
        var sel = res && res[0] && res[0].result;
        return sel && sel.quote && sel.quote.trim() ? sel : null;
      });
  }

  // What the page state shows, so a new selection redraws it (below).
  var shown = null;

  function drawPage(body, tab, sel) {
    shown = { tab: tab, quote: sel ? sel.quote : null };
    if (sel) return renderSelection(body, tab, sel);
    return renderNothingSelected(body, tab);
  }

  /** Any other page: the icon click is the gesture (activeTab), so Heddy
   *  may now read the selection. Pages Chrome keeps from extensions refuse. */
  function renderPage(body, tab) {
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: HeddyCourier.PAGE_FILES })
      .then(function () { return readSelection(tab); })
      .then(function (sel) { return drawPage(body, tab, sel); }, function () { return renderCantRead(body); });
  }

  /** The panel stays open while the child selects more (owner, 2026-10-30):
   *  on the page's hint, read the selection again and redraw the words or
   *  the nothing-selected state if it changed. Never while an action is on
   *  its way, and only on the two page states. A cleared selection keeps the
   *  quote until the next one, so clicking the panel never loses it. */
  function refreshSelection() {
    if (!shown || document.querySelector('[aria-busy="true"]')) return;
    var tab = shown.tab;
    readSelection(tab).then(function (sel) {
      if (!shown || document.querySelector('[aria-busy="true"]')) return;
      if (!sel || sel.quote === shown.quote) return;
      var body = $('body');
      body.textContent = '';
      drawPage(body, tab, sel);
    }, function () {});
  }

  function renderSite(body) {
    body.appendChild(el('p', 'here', tr('sitePageLine')));
  }

  /** Runs in the YouTube tab (activeTab, granted by opening this popup). */
  function readVideo(sel) {
    var v = document.querySelector(sel.video);
    var title = document.querySelector(sel.title);
    var channel = document.querySelector(sel.channel);
    return {
      t: v ? v.currentTime : null,
      duration: v && isFinite(v.duration) ? v.duration : null,
      title: title ? title.textContent.trim().slice(0, 200) : null,
      channel: channel ? channel.textContent.trim().slice(0, 100) : null,
    };
  }

  function videoInfo(tab) {
    var fallback = { t: null, duration: null, title: (tab.title || '').replace(/\s*-\s*YouTube\s*$/, '').slice(0, 200) || null, channel: null };
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readVideo, args: [SEL] }).then(
      function (res) {
        var got = res && res[0] && res[0].result;
        if (!got) return fallback;
        return { t: got.t, duration: got.duration, title: got.title || fallback.title, channel: got.channel };
      },
      function () { return fallback; }
    );
  }

  function renderYouTube(body, tab, youtubeId, info, stored) {
    $('ctx').textContent = 'youtube.com';
    var canFrom = P.startSecFor('from', info.t) !== null;
    var choice = stored === 'from' && canFrom ? 'from' : 'whole';

    var vid = el('div', 'vid');
    var th = el('span', 'th');
    th.insertAdjacentHTML('beforeend', M.use('h-film', 24));
    vid.appendChild(th);
    var meta = el('div');
    meta.appendChild(el('b', null, info.title || tr('thisVideo')));
    var sub = [info.channel, info.duration ? P.clockOf(info.duration) : null].filter(Boolean).join(' · ');
    if (sub) meta.appendChild(el('span', 'sub', sub));
    vid.appendChild(meta);
    body.appendChild(vid);

    var seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    var whole = button('', null, 0, tr('wholeVideo'));
    var from = button('', 'h-clock', 14, tr('fromTime', P.clockOf(canFrom ? info.t : 0)));
    from.disabled = !canFrom;
    function paint() {
      whole.setAttribute('aria-pressed', String(choice === 'whole'));
      from.setAttribute('aria-pressed', String(choice === 'from'));
    }
    function pick(c) {
      choice = c;
      paint();
      var o = {};
      o[C.START_KEY] = c;
      chrome.storage.local.set(o).catch(function () {});
    }
    whole.addEventListener('click', function () { pick('whole'); });
    from.addEventListener('click', function () { if (canFrom) pick('from'); });
    seg.appendChild(whole);
    seg.appendChild(from);
    paint();
    body.appendChild(seg);

    var err = el('p', 'err');
    err.hidden = true;
    function go(then, btn) {
      btn.setAttribute('aria-busy', 'true');
      chrome.runtime.sendMessage({
        type: 'heddy-ui:capture',
        youtubeId: youtubeId,
        startSec: choice === 'from' ? P.startSecFor('from', info.t) : null,
        then: then,
        tabId: tab.id,
        windowId: tab.windowId,
      }).then(function (reply) {
        if (reply && reply.ok) return closeUi();
        throw new Error('no window');
      }).catch(function () {
        btn.removeAttribute('aria-busy');
        err.textContent = tr('captureFailed');
        err.hidden = false;
      });
    }
    var watch = button('btn wide', 'h-eyes', 18, tr('watchWithHeddy'));
    var add = button('btn ghost wide', 'h-film', 16, tr('addToMyClips'));
    watch.addEventListener('click', function () { go('classroom', watch); });
    add.addEventListener('click', function () { go('keep', add); });
    body.appendChild(watch);
    body.appendChild(add);
    body.appendChild(keyRow('h-quill', tr('jotLineSpoken'), tr('jotLineSpokenSub'), 'H'));
    body.appendChild(err);
    $('foot').hidden = false;
  }

  // ─── start ─────────────────────────────────────────────────────────────────

  // Hints from the page that holds the panel (content/panel.js), and only
  // from it: they carry no data, the popup reads the page itself.
  window.addEventListener('message', function (e) {
    if (HOST !== 'panel' || e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    if (e.data.heddyPanel === 'selection') refreshSelection();
    else if (e.data.heddyPanel === 'moved') location.reload();
  });

  function theTab() {
    if (TAB_ID != null) return chrome.tabs.get(TAB_ID).then(function (t) { return t || null; }, function () { return null; });
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0] || null; }, function () { return null; });
  }

  watchSize();

  Promise.all([
    I.currentLang(),
    theTab(),
    chrome.storage.local.get([C.DEV_KEY, C.START_KEY, C.FIRST_RUN_KEY]).catch(function () { return {}; }),
  ]).then(function (got) {
    var lang = got[0], tab = got[1], local = got[2] || {};
    tr = I.translator(lang);
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    drawChrome();
    var dev = local[C.DEV_KEY] === true;
    var origin = C.captureOrigin(dev);
    var body = $('body');
    var url = tab && tab.url;
    $('ctx').textContent = url ? hostLabel(url) : '';

    if (!local[C.FIRST_RUN_KEY]) {
      var o = {};
      o[C.FIRST_RUN_KEY] = true;
      chrome.storage.local.set(o).catch(function () {});
      return renderFirstTime(body, origin, lang);
    }
    // Snap a picture (R3b · 05): every popup but the first-time one and
    // aitutors.me's, and only on a web page Heddy can draw box mode on.
    if (url && /^https?:/.test(url) && !isSite(url, dev)) HeddySnap.mountButton($('snap'), { chrome: chrome, tr: tr, tab: tab, close: closeUi });
    var youtubeId = url ? P.youtubeIdFromUrl(url) : null;
    if (youtubeId) {
      return videoInfo(tab).then(function (info) { renderYouTube(body, tab, youtubeId, info, local[C.START_KEY]); });
    }
    if (url && isSite(url, dev)) return renderSite(body);
    if (tab && /^https?:/.test(url || '')) return renderPage(body, tab);
    return renderCantRead(body);
  });
})();
