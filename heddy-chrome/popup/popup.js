// popup/popup.js — the toolbar popup (artifact R2 · 03, round 2c, R3b · 05).
//
// The states, showing only what already works (D25, Direction A):
//   first time      the one line, what Heddy does, Open aitutors.me (primary)
//   YouTube watch   the video row, Whole video / From m:ss, Watch with Heddy
//                   (primary), Add to My Clips (outlined), the H row
//   aitutors.me     one line of help, no primary, no footer
//   any other page  the numbered cards (Round 5, D54, D55): "In this save ·
//                   2 snippets · 1 picture", the cards with ✕, + Text and
//                   + Picture, Save to Jotters (primary) and Save and jot now,
//                   the line naming the Jotter, Explain · Make a card · Ask
//                   Heddy on card 1, and Save the whole page too. With no
//                   card: the page, + Text and + Picture, and Save page to
//                   Jotters (primary)
//   can't read      a page Heddy may not script (chrome://, the Web Store)
// Every string from a page (the video's title and channel, a card's quote,
// the page's title) is set as text.
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
  function fail(err, key) {
    err.textContent = tr.apply(null, [key].concat(Array.prototype.slice.call(arguments, 2)));
    err.hidden = false;
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

  /** The page's selection, read in the tab (content/page-tray.js), or null. */
  function readSelection(tab) {
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: function () { return globalThis.__heddyPage.selection(); } })
      .then(function (res) {
        var sel = res && res[0] && res[0].result;
        return sel && sel.quote && sel.quote.trim() ? sel : null;
      });
  }

  // ─── the page: numbered cards (D54, D55; R4 · B, R5 · Chrome, R5b) ────────
  //
  // One numbered list of snippets and pictures from this page, each with ✕;
  // + Text keeps the words selected now, + Picture starts box mode beside the
  // panel. Save to Jotters sends them all to the left page of this page's
  // Jotter; Save and jot now opens the notebook at them. Explain, Make a card
  // and Ask Heddy act on card 1. With no card, the page itself is the thing
  // to save. The list lives in the background (lib/cards.js); this draws it.

  var view = null; // { tab, state } while the page state shows

  function cardsCall(message, tab) {
    return Promise.resolve()
      .then(function () { return chrome.runtime.sendMessage(Object.assign({ tabId: tab.id }, message)); })
      .then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
  }

  /** "In this save · 2 snippets · 1 picture" (R5b), leaving out a zero. */
  function countLine(c) {
    var parts = [tr('cardsHeading')];
    if (c.text) parts.push(c.text === 1 ? tr('cardsSnippet') : tr('cardsSnippets', String(c.text)));
    if (c.image) parts.push(c.image === 1 ? tr('cardsPicture') : tr('cardsPictures', String(c.image)));
    return parts.join(' · ');
  }

  function busyNow() {
    return !!document.querySelector('[aria-busy="true"]');
  }

  function cardRow(card, tab) {
    var row = el('div', 'c');
    row.appendChild(el('b', null, String(card.n)));
    if (card.kind === 'image') {
      var th = el('img', 'th');
      th.alt = '';
      // The crop Heddy cut itself, as a data: URL; nothing is fetched.
      if (/^[A-Za-z0-9+/=]+$/.test(card.png || '')) th.src = 'data:image/png;base64,' + card.png;
      row.appendChild(th);
      row.appendChild(el('span', 'pl', tr('cardPictureLabel')));
    } else {
      row.appendChild(el('q', null, card.quote.replace(/\s+/g, ' ').trim()));
    }
    var x = el('button', 'cx');
    x.type = 'button';
    x.setAttribute('aria-label', tr('cardRemove', String(card.n)));
    x.title = tr('cardRemove', String(card.n));
    x.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>');
    x.addEventListener('click', function () {
      x.setAttribute('aria-busy', 'true');
      cardsCall({ type: 'heddy-cards:remove', id: card.id }, tab).then(function (r) {
        if (r.ok) setState(r);
        else x.removeAttribute('aria-busy');
      });
    });
    row.appendChild(x);
    return row;
  }

  /** Save to Jotters, Save and jot now, Save page to Jotters: one heddy:save
   *  (lib/cards.js), in /capture/save; the panel closes once it is open. */
  function save(btn, err, then, withPage) {
    btn.setAttribute('aria-busy', 'true');
    cardsCall({ type: 'heddy-cards:save', then: then, page: withPage }, view.tab).then(function (r) {
      if (r.ok) return closeUi();
      btn.removeAttribute('aria-busy');
      fail(err, r.error === 'empty' ? 'pageEmpty' : 'captureFailed');
    });
  }

  function drawCards() {
    var body = $('body');
    var tab = view.tab, st = view.state;
    var cards = st.cards || [];
    var c = st.counts || { text: 0, image: 0 };
    body.textContent = '';
    body.classList.add('cardsv');

    if (cards.length) {
      body.appendChild(el('span', 'cnt', countLine(c)));
      var list = el('div', 'cards');
      cards.forEach(function (card) { list.appendChild(cardRow(card, tab)); });
      body.appendChild(list);
    } else {
      var pg = el('div', 'pg');
      pg.appendChild(el('b', null, (tab.title || hostLabel(tab.url)).slice(0, 200)));
      pg.appendChild(el('span', null, shortUrl(tab.url)));
      body.appendChild(pg);
    }

    var err = el('p', 'err');
    err.hidden = true;

    // + Text · + Picture (R5b's dashed pair).
    var adds = el('div', 'adds');
    var addText = el('button', null, tr('addText'));
    addText.type = 'button';
    var addPic = el('button', null, tr('addPicture'));
    addPic.type = 'button';
    addText.addEventListener('click', function () {
      if (c.text >= HeddyCards.MAX_TEXT) return fail(err, 'cardsFullText');
      addText.setAttribute('aria-busy', 'true');
      cardsCall({ type: 'heddy-cards:add-text' }, tab).then(function (r) {
        addText.removeAttribute('aria-busy');
        if (r.ok) return setState(r);
        if (r.error === 'no_selection') return fail(err, 'cardsSelectFirst');
        if (r.error === 'same') return fail(err, 'cardsSame', String(r.n));
        if (r.error === 'full_text') return fail(err, 'cardsFullText');
        fail(err, 'captureFailed');
      });
    });
    addPic.addEventListener('click', function () {
      if (c.image >= HeddyCards.MAX_IMAGES) return fail(err, 'cardsFullPictures');
      // Box mode beside the panel; its + Picture adds the cards here.
      cardsCall({ type: 'heddy-ui:snap', mode: 'box' }, tab);
    });
    adds.appendChild(addText);
    adds.appendChild(addPic);
    body.appendChild(adds);
    body.appendChild(err);

    var title = (tab.title || '').replace(/\s+/g, ' ').trim();
    if (cards.length) {
      var primary = button('btn wide', null, 0, tr('saveToJotters'));
      primary.addEventListener('click', function () { save(primary, err, 'save', false); });
      body.appendChild(primary);
      var jot = el('button', 'lk go', tr('saveAndJot'));
      jot.type = 'button';
      jot.addEventListener('click', function () { save(jot, err, 'jot', false); });
      body.appendChild(jot);
    } else {
      var page = button('btn wide', 'h-page', 16, tr('clipThisPage'));
      page.addEventListener('click', function () { save(page, err, 'save', true); });
      body.appendChild(page);
    }
    body.appendChild(el('p', 'fine', title ? tr('saveGoesTo', title) : tr('saveGoesToNoTitle')));

    if (cards.length) {
      // Explain · Make a card · Ask Heddy, small, on card 1 (D55).
      var ln = el('div', 'ln');
      ln.title = tr('toolsOnCard1');
      HeddyTrayTools.TOOLS.filter(function (t) { return !t.primary; }).forEach(function (t, i) {
        if (i) ln.appendChild(el('span', 'dot', '·'));
        var b = el('button', null, tr(t.label));
        b.type = 'button';
        b.addEventListener('click', function () {
          b.setAttribute('aria-busy', 'true');
          cardsCall({ type: 'heddy-cards:tool', tool: t.id }, tab).then(function (r) {
            if (r.ok) return closeUi();
            b.removeAttribute('aria-busy');
            fail(err, 'captureFailed');
          });
        });
        ln.appendChild(b);
      });
      body.appendChild(ln);
      var whole = el('button', 'lk');
      whole.type = 'button';
      whole.insertAdjacentHTML('beforeend', M.use('h-page', 16));
      whole.appendChild(el('span', null, tr('savePageToo')));
      whole.addEventListener('click', function () { save(whole, err, 'save', true); });
      body.appendChild(whole);
    }
    $('foot').hidden = false;
  }

  function setState(st) {
    if (!view || !st || !Array.isArray(st.cards)) return;
    view.state = st;
    drawCards();
  }

  /** Any other page: the icon click is the gesture (activeTab), so Heddy
   *  may now read it. Words already selected when the panel opens, with no
   *  card yet, become card 1. Pages Chrome keeps from extensions refuse. */
  function renderPage(body, tab) {
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: HeddyCourier.PAGE_FILES })
      .then(function () { return cardsCall({ type: 'heddy-cards:get' }, tab); })
      .then(function (st) {
        if (!st.ok) throw new Error('no cards');
        if (st.cards.length) return st;
        return readSelection(tab).then(function (sel) {
          if (!sel) return st;
          return cardsCall({ type: 'heddy-cards:add-text' }, tab).then(function (r) { return r.ok ? r : st; });
        }, function () { return st; });
      })
      .then(function (st) {
        view = { tab: tab, state: st };
        drawCards();
      }, function () { return renderCantRead(body); });
  }

  /** The background changed the list (box mode kept a picture, the site
   *  saved some): draw it again, unless an action is on its way. */
  function refreshCards() {
    if (!view || busyNow()) return;
    cardsCall({ type: 'heddy-cards:get' }, view.tab).then(function (st) { if (st.ok && !busyNow()) setState(st); });
  }

  chrome.runtime.onMessage.addListener(function (m) {
    if (m && m.type === 'heddy-cards:changed' && view && m.tabId === view.tab.id) refreshCards();
  });

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
  // A new selection changes nothing until + Text; another page, everything.
  window.addEventListener('message', function (e) {
    if (HOST !== 'panel' || e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    if (e.data.heddyPanel === 'moved') location.reload();
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
