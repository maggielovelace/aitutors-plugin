// popup/popup.js — the toolbar popup (artifact R2 · 03, round 2c, R3b · 05).
//
// The states, showing only what already works (D25, Direction A):
//   first time      the one line, what Heddy does, Open aitutors.me (primary)
//   YouTube watch   Add to My Clips (D75, artifact P2): the real thumbnail,
//                   the exact link with Copy, the film strip with its gold
//                   window, Whole · The last 30 s · From now, the range, the
//                   button; a faint eyes icon in the header opens the desk
//   aitutors.me     one line of help, no primary, no footer
//   any other page  the numbered cards (Round 5, D54, D55): "In this save ·
//                   2 snippets · 1 picture", the cards with ⠿, ↑ / ↓ and ✕
//                   in the child's order (Round 7, D62), the + Text / + Picture
//                   switch (D64), Save to Jotters (primary) and Save and jot now,
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
  // The kind of page, from the background, for when Chrome hides the address.
  var HINT_KIND = (function (k) {
    var K = HeddyPageKind.KINDS;
    return Object.prototype.hasOwnProperty.call(K, k) ? { kind: k, chip: K[k].chip, line: K[k].line, sub: K[k].sub } : null;
  })(params.get('kind'));

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
      // The YouTube state is the artifact's 400 px popup (P2); the rest are 360.
      window.parent.postMessage({ heddyPanel: 'size', h: h, w: document.body.classList.contains('yt') ? 400 : 360 }, '*');
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
    $('mark').innerHTML = M.sprite(['h-eyes', 'h-film', 'h-clock', 'h-lock', 'h-open', 'h-cog', 'h-quill', 'h-page', 'h-explain', 'h-cardt', 'h-face', 'h-pen', 'h-school']) + M.use('h-eyes', 22);
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

  /** The jot-selection shortcut the child set in Chrome, or null. There is no
   *  default (owner, 2026-10-29): the obvious keys are Chrome's own. */
  function fail(err, key) {
    err.textContent = tr.apply(null, [key].concat(Array.prototype.slice.call(arguments, 2)));
    err.hidden = false;
  }

  // ─── a page Heddy can't add to Jotters (D61; R6 · owner's pick) ──────────
  //
  // Heddy's face and a line saying why; the account row from /me (lib/who.js);
  // My Jotters · My Clips · My Study. The header's chip names the kind of
  // page (lib/page-kind.js) and never prints the raw extension id. The same
  // body shows in D49's small window.

  var ORIGIN = C.PROD_ORIGIN;

  function openAndClose(url) {
    chrome.tabs.create({ url: url }).then(closeUi, function () {});
  }

  function linkButton(cls, label, url) {
    var b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', function () { openAndClose(url); });
    return b;
  }

  /** The account row: "S  Shan · Year 8 · Open my Study", "Signed in as a
   *  grown-up · Open my dashboard", or "Sign in to save with Heddy · Sign in
   *  · I'm new". Signed out until /me says otherwise; no error is shown. */
  function accountRow(row, me) {
    var L = HeddyWho.links(ORIGIN);
    row.textContent = '';
    row.className = 'acc';
    if (me.signedIn && me.role === 'child') {
      row.appendChild(el('span', 'av', HeddyWho.initial(me.firstName)));
      row.appendChild(el('span', 'who', [me.firstName, me.yearGroup ? tr('whoYear', String(me.yearGroup)) : null].filter(Boolean).join(' · ')));
      row.appendChild(linkButton('ln1', tr('whoOpenStudy'), L.study));
    } else if (me.signedIn && me.role === 'parent') {
      row.appendChild(el('span', 'who', tr('whoGrownUp')));
      row.appendChild(linkButton('ln1', tr('whoOpenDashboard'), L.dashboard));
    } else {
      row.classList.add('out');
      row.appendChild(el('span', 'who', tr('whoSignInToSave')));
      row.appendChild(linkButton('ln1', tr('whoSignIn'), L.signIn));
      row.appendChild(linkButton('ln1', tr('whoImNew'), L.signUp));
    }
    row.hidden = false;
  }

  function tile(mark, label, url) {
    var b = el('button', 'tile');
    b.type = 'button';
    b.insertAdjacentHTML('beforeend', M.use(mark, 18));
    b.appendChild(el('span', null, label));
    b.addEventListener('click', function () { openAndClose(url); });
    return b;
  }

  /** desc: lib/page-kind.js describe(), or the 'other' kind. */
  function renderCantSave(body, desc) {
    var d = desc || { kind: 'other', chip: 'kindOther', line: 'kindOtherLine', sub: 'kindOtherSub' };
    var ctx = $('ctx');
    ctx.textContent = tr(d.chip);
    ctx.classList.add('chip');
    $('pop').classList.add('cs');
    var why = el('div', 'why');
    why.insertAdjacentHTML('beforeend', M.use('h-face', 60));
    var words = el('div');
    words.appendChild(el('p', null, tr(d.line)));
    words.appendChild(el('small', null, tr(d.sub)));
    why.appendChild(words);
    body.appendChild(why);
    var row = el('div', 'acc');
    row.hidden = true;
    body.appendChild(row);
    var L = HeddyWho.links(ORIGIN);
    var tiles = el('div', 'tiles');
    tiles.appendChild(tile('h-pen', tr('tileJotters'), L.jotters));
    tiles.appendChild(tile('h-film', tr('tileClips'), L.clips));
    tiles.appendChild(tile('h-school', tr('tileStudy'), L.study));
    body.appendChild(tiles);
    $('foot').hidden = false;
    HeddyWho.loadMe(window.fetch.bind(window), ORIGIN).then(function (me) { accountRow(row, me); });
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

  // ─── the page: numbered cards (D54, D55, D62, D64, D65) ───────────────────
  //
  // One numbered list of snippets and pictures from this page, each with ✕,
  // in the order the child sets: drag a card by ⠿, or use ↑ / ↓ (Alt+↑ /
  // Alt+↓ on a focused card). + Text and + Picture are a switch: Text is the
  // page as it is, where selected words add themselves (content/panel.js);
  // Picture is box mode beside the panel. Tapping + Text with words selected
  // adds them too. Save to Jotters sends them all, in that order, to the left
  // page of this page's Jotter; Save and jot now opens the notebook at them.
  // Explain, Make a card and Ask Heddy act on card 1. With no card, the page
  // itself is the thing to save. The list lives in the background
  // (lib/cards.js); this draws it.

  var view = null; // { tab, state, mode, err, focus } while the page state shows

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

  var CHEVRON = {
    up: '<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 8.5L7 5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 5.5L7 9l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /** Card `card` to index `to` (D62); the panel and the page renumber. The
   *  focus goes back to `focus` ('row', 'up' or 'down') on the moved card. */
  function moveTo(card, to, focus) {
    var list = document.querySelector('.cards');
    if (list) list.setAttribute('aria-busy', 'true');
    view.focus = { id: card.id, what: focus || 'row' };
    cardsCall({ type: 'heddy-cards:move', id: card.id, to: to }, view.tab).then(function (r) {
      if (list) list.removeAttribute('aria-busy');
      if (r.ok) setState(r);
    });
  }

  /** ⠿: the card follows the pointer from slot to slot inside the list, and
   *  lands where it is let go. The list scrolls near its edges. */
  function dragFrom(e, row, card, list) {
    if (e.button !== 0 || busyNow()) return;
    e.preventDefault();
    var from = Array.prototype.indexOf.call(list.children, row);
    var handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    row.classList.add('drag');
    list.setAttribute('aria-busy', 'true');
    function others() {
      return Array.prototype.filter.call(list.children, function (r) { return r !== row; });
    }
    function onMove(ev) {
      var box = list.getBoundingClientRect();
      if (ev.clientY < box.top + 24) list.scrollTop -= 8;
      else if (ev.clientY > box.bottom - 24) list.scrollTop += 8;
      var rest = others();
      var mids = rest.map(function (r) { var b = r.getBoundingClientRect(); return b.top + b.height / 2; });
      var at = HeddyCards.dropIndex(mids, ev.clientY);
      var before = rest[at] || null;
      if (row.nextSibling !== before) list.insertBefore(row, before);
      // The numbers follow while it moves.
      Array.prototype.forEach.call(list.children, function (r, i) { r.querySelector('b').textContent = String(i + 1); });
    }
    function onUp() {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      row.classList.remove('drag');
      list.removeAttribute('aria-busy');
      var to = Array.prototype.indexOf.call(list.children, row);
      if (to !== from) moveTo(card, to, 'row');
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function cardRow(card, tab, i, total) {
    var row = el('div', 'c');
    row.setAttribute('data-id', card.id);
    var many = total > 1;
    if (many) {
      // Alt+↑ / Alt+↓ on a focused card, for children who cannot drag (D62).
      row.tabIndex = 0;
      row.addEventListener('keydown', function (e) {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || busyNow()) return;
        e.preventDefault();
        var to = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (to >= 0 && to < total) moveTo(card, to, 'row');
      });
      var dh = el('span', 'dh', '⠿');
      dh.title = tr('cardDrag');
      dh.setAttribute('aria-hidden', 'true');
      dh.addEventListener('pointerdown', function (e) { dragFrom(e, row, card, row.parentNode); });
      row.appendChild(dh);
    }
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
    if (many) {
      [['up', -1, 'cardMoveUp'], ['down', 1, 'cardMoveDown']].forEach(function (m) {
        var b = el('button', 'cm');
        b.type = 'button';
        b.setAttribute('data-move', m[0]);
        b.setAttribute('aria-label', tr(m[2]));
        b.title = tr(m[2]);
        b.insertAdjacentHTML('beforeend', CHEVRON[m[0]]);
        var to = i + m[1];
        b.disabled = to < 0 || to >= total;
        // At the top (or the bottom) the focus moves to the other arrow.
        var then = to === 0 ? 'down' : to === total - 1 ? 'up' : m[0];
        b.addEventListener('click', function () { if (!b.disabled && !busyNow()) moveTo(card, to, then); });
        row.appendChild(b);
      });
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
      cards.forEach(function (card, i) { list.appendChild(cardRow(card, tab, i, cards.length)); });
      body.appendChild(list);
    } else {
      var pg = el('div', 'pg');
      pg.appendChild(el('b', null, (tab.title || hostLabel(tab.url)).slice(0, 200)));
      pg.appendChild(el('span', null, shortUrl(tab.url)));
      body.appendChild(pg);
    }

    var err = el('p', 'err');
    err.hidden = true;
    view.err = err;

    // + Text · + Picture (R5b's dashed pair), now the Text / Picture switch
    // (D64): the one that is on is filled.
    var adds = el('div', 'adds');
    adds.setAttribute('role', 'group');
    adds.setAttribute('aria-label', tr('modeSwitchLabel'));
    var picture = view.mode === 'picture';
    var addText = el('button', null, tr('addText'));
    addText.type = 'button';
    addText.setAttribute('aria-pressed', String(!picture));
    var addPic = el('button', null, tr('addPicture'));
    addPic.type = 'button';
    addPic.setAttribute('aria-pressed', String(picture));
    addText.addEventListener('click', function () {
      // In Picture mode: back to Text. Box mode ends; its pictures stay.
      if (view.mode === 'picture') return toTextMode(tab);
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
      if (view.mode === 'picture') return;
      if (c.image >= HeddyCards.MAX_IMAGES) return fail(err, 'cardsFullPictures');
      // Box mode beside the panel; its + Picture adds the cards here.
      cardsCall({ type: 'heddy-ui:snap', mode: 'box' }, tab);
      setMode('picture');
    });
    adds.appendChild(addText);
    adds.appendChild(addPic);
    body.appendChild(adds);
    // With nothing collected yet: selecting words is how to add them (D65).
    if (!cards.length && !picture) body.appendChild(el('p', 'fine hint', tr('cardsEmptyHint')));
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
    // A redraw keeps the focus where it was: on the card that moved, or on
    // the card (or its arrow) that had it.
    var keep = view.focus || focusNow();
    view.state = st;
    drawCards();
    view.focus = keep;
    refocus();
  }

  function focusNow() {
    var a = document.activeElement;
    var row = a && a.closest && a.closest('.c[data-id]');
    if (!row) return null;
    return { id: row.getAttribute('data-id'), what: a === row ? 'row' : a.getAttribute('data-move') || 'row' };
  }

  /** After a move, the focus goes back to the card that moved. */
  function refocus() {
    var f = view.focus;
    view.focus = null;
    if (!f) return;
    var row = document.querySelector('.c[data-id="' + f.id + '"]');
    if (!row) return;
    var target = f.what === 'row' ? row : row.querySelector('[data-move="' + f.what + '"]');
    (target && !target.disabled ? target : row).focus();
  }

  function setMode(m) {
    if (!view || view.mode === m) return;
    view.mode = m;
    if (!busyNow()) drawCards();
  }

  /** The page's mode: 'picture' while box mode draws there, else 'text'. */
  function readMode(tab) {
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () { var b = globalThis.__heddyBoxMode; return b && b.mode ? b.mode() : 'text'; },
    }).then(function (res) { return res && res[0] && res[0].result === 'picture' ? 'picture' : 'text'; }, function () { return 'text'; });
  }

  /** + Text in Picture mode: box mode ends and leaves its small Text bar. */
  function toTextMode(tab) {
    setMode('text');
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () { var b = globalThis.__heddyBoxMode; if (b && b.stop) b.stop(); return true; },
    }).catch(function () {});
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
        return readMode(tab).then(function (mode) {
          view = { tab: tab, state: st, mode: mode, err: null, focus: null };
          drawCards();
        });
      }, function () { return renderCantSave(body, null); });
  }

  /** The background changed the list (box mode kept a picture, selected
   *  words added themselves, the site saved some): draw it again, unless an
   *  action is on its way. `note` 'full_text': ten snippets, said once. */
  function refreshCards(note) {
    if (!view || busyNow()) return;
    cardsCall({ type: 'heddy-cards:get' }, view.tab).then(function (st) {
      if (!st.ok || busyNow()) return;
      setState(st);
      if (note === 'full_text' && view.err) fail(view.err, 'cardsFullText');
    });
  }

  chrome.runtime.onMessage.addListener(function (m) {
    if (m && m.type === 'heddy-cards:changed' && view && m.tabId === view.tab.id) refreshCards(m.note);
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

  /** Runs in the page's own world: YouTube's storyboard spec for the film
   *  strip (D75), from the player. Text only; lib/film-strip.js checks it. */
  function readStoryboard() {
    try {
      var p = document.getElementById('movie_player');
      var r = p && typeof p.getPlayerResponse === 'function' ? p.getPlayerResponse() : null;
      var s = r && r.storyboards && r.storyboards.playerStoryboardSpecRenderer;
      return s && typeof s.spec === 'string' ? s.spec.slice(0, 4000) : null;
    } catch (e) {
      return null;
    }
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

  function storyboard(tab) {
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: readStoryboard }).then(
      function (res) { return HeddyFilmStrip.parseStoryboard(res && res[0] && res[0].result); },
      function () { return null; }
    );
  }

  /** Dragging the strip moves the video to that frame (D75). */
  function seekTab(tab, t) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function (sel, s) { var v = document.querySelector(sel); if (v && isFinite(s)) v.currentTime = s; return true; },
      args: [SEL.video, t],
    }).catch(function () {});
  }

  function copyText(text) {
    var ok = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'));
    return ok.catch(function () {
      var ta = el('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var done = document.execCommand('copy');
      ta.remove();
      if (!done) throw new Error('copy');
    });
  }

  // How many frames the strip shows (the artifact's 46 px rhythm on 372 px).
  var FRAMES = 8;
  var SEEK_MS = 120;

  /** The film strip's frames, from YouTube's storyboard (else a plain bar). */
  function drawFrames(film, level, duration) {
    film.classList.toggle('plain', !level);
    if (!level) return;
    var reel = film.querySelector('.reel');
    var w = film.clientWidth || 372;
    var h = film.clientHeight || 46;
    var cell = w / FRAMES;
    var scale = h / level.h;
    var tw = level.w * scale;
    for (var i = 0; i < FRAMES; i++) {
      var f = HeddyFilmStrip.frameAt(level, ((i + 0.5) / FRAMES) * duration, duration);
      if (!f) continue;
      var c = el('span', 'fr');
      c.style.left = i * cell + 'px';
      c.style.width = Math.ceil(cell) + 'px';
      c.style.backgroundImage = 'url("' + f.url.replace(/["\\]/g, '') + '")';
      c.style.backgroundSize = f.cols * tw + 'px ' + f.rows * h + 'px';
      c.style.backgroundPosition = -(f.col * tw + (tw - cell) / 2) + 'px ' + -(f.row * h) + 'px';
      reel.appendChild(c);
    }
  }

  /** The popup on a YouTube video (D75, artifact #popup P2): Add to My Clips,
   *  the real thumbnail, the exact link with Copy, the film strip with its
   *  gold window, Whole · The last 30 s · From now, the range, and the button.
   *  The faint eyes in the header opens the desk on the video. */
  function renderYouTube(body, tab, youtubeId, info) {
    var F = HeddyFilmStrip;
    $('pop').classList.add('yt');
    document.body.classList.add('yt');
    $('ctx').hidden = true;
    $('title').textContent = tr('addToMyClips');
    $('mark').innerHTML = $('mark').innerHTML.replace(/width="22" height="22"/, 'width="28" height="28"');
    var lite = el('button', 'watchlite');
    lite.type = 'button';
    lite.title = tr('watchWithHeddy');
    lite.setAttribute('aria-label', tr('watchWithHeddy'));
    lite.insertAdjacentHTML('beforeend', M.use('h-eyes', 22));
    lite.addEventListener('click', function () {
      chrome.tabs.sendMessage(tab.id, { type: 'heddy-ui:open-desk' }).catch(function () {}).then(closeUi);
    });
    $('close').parentNode.insertBefore(lite, $('close'));

    var duration = info.duration && info.duration >= F.MIN_SPAN ? info.duration : null;
    var nowT = info.t;
    var range = duration ? F.chipRange('whole', nowT, duration) : null;

    // The video: the thumbnail with its length, the title, the channel, the link.
    var vid = el('div', 'vid');
    var th = el('span', 'th');
    var img = el('img');
    img.alt = '';
    img.addEventListener('error', function () { img.remove(); th.classList.add('none'); });
    img.src = F.thumbUrl(youtubeId);
    th.appendChild(img);
    if (duration) th.appendChild(el('em', null, P.clockOf(duration)));
    vid.appendChild(th);
    var meta = el('div');
    meta.appendChild(el('b', null, info.title || tr('thisVideo')));
    if (info.channel) meta.appendChild(el('small', null, info.channel));
    var url = el('div', 'url');
    var link = el('span');
    url.appendChild(link);
    var copy = el('button', 'cpy', tr('clipCopy'));
    copy.type = 'button';
    copy.addEventListener('click', function () {
      copyText(F.linkFor(youtubeId, range ? range.start : 0).href).then(function () {
        copy.textContent = tr('clipCopied');
        setTimeout(function () { copy.textContent = tr('clipCopy'); }, 1500);
      }, function () {});
    });
    url.appendChild(copy);
    meta.appendChild(url);
    vid.appendChild(meta);
    body.appendChild(vid);

    // The chips.
    var chips = el('div', 'chips');
    var chipEls = {};
    [['whole', 'chipWhole'], ['last30', 'chipLast30'], ['fromNow', 'chipFromNow']].forEach(function (c) {
      var b = el('button', null, tr(c[1]));
      b.type = 'button';
      b.addEventListener('click', function () {
        var r = F.chipRange(c[0], nowT, duration);
        if (!r) return;
        range = r;
        paint();
        if (c[0] !== 'whole') seekTab(tab, r.start);
      });
      chipEls[c[0]] = b;
      chips.appendChild(b);
    });
    body.appendChild(chips);

    // The film strip: frames, the dimmed outside, the gold window with two
    // handles (dragging seeks the video), the playhead.
    var film = el('div', 'film plain');
    film.setAttribute('role', 'group');
    film.setAttribute('aria-label', tr('filmLabel'));
    var reel = el('span', 'reel');
    var dimL = el('span', 'dim l');
    var dimR = el('span', 'dim r');
    var win = el('span', 'win');
    var hs = el('span', 'hdl s');
    var he = el('span', 'hdl e');
    var head = el('span', 'ph2');
    [hs, he].forEach(function (h, k) {
      h.tabIndex = 0;
      h.setAttribute('role', 'slider');
      h.setAttribute('aria-label', tr(k ? 'filmEnd' : 'filmStart'));
      h.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 10 : 1;
        var d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : 0;
        if (!d || !range) return;
        e.preventDefault();
        var which = k ? 'end' : 'start';
        range = F.dragTo(range, which, range[which] + d, duration);
        paint();
        seekTab(tab, range[which]);
      });
    });
    win.appendChild(hs);
    win.appendChild(he);
    film.appendChild(reel);
    film.appendChild(dimL);
    film.appendChild(dimR);
    film.appendChild(win);
    film.appendChild(head);
    body.appendChild(film);

    var lens = el('div', 'lens');
    var lensL = el('span');
    var lensM = el('em');
    var lensR = el('span');
    lens.appendChild(lensL);
    lens.appendChild(lensM);
    lens.appendChild(lensR);
    body.appendChild(lens);

    var err = el('p', 'err');
    err.hidden = true;
    var go = el('button', 'go');
    go.type = 'button';
    go.addEventListener('click', function () {
      go.setAttribute('aria-busy', 'true');
      var m = { type: 'heddy-ui:capture', youtubeId: youtubeId, startSec: null, then: 'keep', tabId: tab.id, windowId: tab.windowId };
      if (range && duration) Object.assign(m, F.captureFields(range, duration));
      chrome.runtime.sendMessage(m).then(function (reply) {
        if (reply && reply.ok) return closeUi();
        throw new Error('no window');
      }).catch(function () {
        go.removeAttribute('aria-busy');
        err.textContent = tr('captureFailed');
        err.hidden = false;
      });
    });
    body.appendChild(go);
    body.appendChild(el('p', 'hint', tr('opensInMyClips')));
    body.appendChild(err);

    function secWord(n) { return tr('spanSec', n); }

    function paint() {
      var isWhole = !range || !duration || (range.start === 0 && range.end >= Math.floor(duration));
      var chip = range && duration ? F.chipOf(range, nowT, duration) : 'whole';
      Object.keys(chipEls).forEach(function (k) {
        chipEls[k].setAttribute('aria-pressed', String(chip === k));
        chipEls[k].disabled = !F.chipRange(k, nowT, duration);
      });
      link.textContent = F.linkFor(youtubeId, range ? range.start : 0).shown;
      link.title = link.textContent;
      win.hidden = dimL.hidden = dimR.hidden = lens.hidden = !range;
      if (range) {
        var p = F.windowPct(range, duration);
        win.style.left = p.left + '%';
        win.style.width = p.width + '%';
        dimL.style.width = p.left + '%';
        dimR.style.left = p.left + p.width + '%';
        hs.setAttribute('aria-valuenow', String(range.start));
        hs.setAttribute('aria-valuetext', P.clockOf(range.start));
        he.setAttribute('aria-valuenow', String(range.end));
        he.setAttribute('aria-valuetext', P.clockOf(range.end));
        lensL.textContent = P.clockOf(range.start);
        lensR.textContent = P.clockOf(range.end);
        lensM.textContent = tr('clipRange', P.clockOf(range.start), P.clockOf(range.end), F.spanText(range.end - range.start, secWord));
      }
      head.hidden = !(duration && typeof nowT === 'number' && isFinite(nowT));
      if (!head.hidden) head.style.left = (Math.min(nowT, duration) / duration) * 100 + '%';
      go.textContent = isWhole ? tr('addToMyClips') : tr('addPart', F.spanText(range.end - range.start, secWord));
    }

    // Drag either end of the window (the nearer one to the pointer).
    var dragging = null;
    var lastSeek = 0;
    film.addEventListener('pointerdown', function (e) {
      if (!range || !duration) return;
      var box = film.getBoundingClientRect();
      var sec = F.secAt(e.clientX - box.left, box.width, duration);
      dragging = Math.abs(sec - range.start) <= Math.abs(sec - range.end) ? 'start' : 'end';
      film.setPointerCapture(e.pointerId);
      move(e);
    });
    film.addEventListener('pointermove', function (e) { if (dragging) move(e); });
    function end() {
      if (!dragging) return;
      seekTab(tab, range[dragging]);
      dragging = null;
    }
    film.addEventListener('pointerup', end);
    film.addEventListener('pointercancel', end);
    function move(e) {
      var box = film.getBoundingClientRect();
      range = F.dragTo(range, dragging, F.secAt(e.clientX - box.left, box.width, duration), duration);
      paint();
      if (Date.now() - lastSeek > SEEK_MS) {
        lastSeek = Date.now();
        seekTab(tab, range[dragging]);
      }
    }

    // The playhead and the chips follow the player while the popup is open.
    setInterval(function () {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: function (sel) { var v = document.querySelector(sel); return v ? v.currentTime : null; }, args: [SEL.video] })
        .then(function (res) {
          var t = res && res[0] && res[0].result;
          if (typeof t === 'number' && isFinite(t) && !dragging) { nowT = t; paint(); }
        }, function () {});
    }, 1000);

    paint();
    $('foot').hidden = false;
    if (duration) {
      storyboard(tab).then(function (levels) {
        drawFrames(film, HeddyFilmStrip.pickLevel(levels, 40), duration);
      });
    }
  }

  // ─── start ─────────────────────────────────────────────────────────────────

  // Hints from the page that holds the panel (content/panel.js), and only
  // from it: they carry no data, the popup reads the page itself.
  // A new selection changes nothing until + Text; another page, everything.
  window.addEventListener('message', function (e) {
    if (HOST !== 'panel' || e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    if (e.data.heddyPanel === 'moved') location.reload();
    // Box mode started or ended in the page (D64): the switch follows.
    if (e.data.heddyPanel === 'mode') setMode(e.data.mode === 'picture' ? 'picture' : 'text');
  });

  function theTab() {
    if (TAB_ID != null) return chrome.tabs.get(TAB_ID).then(function (t) { return t || null; }, function () { return null; });
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0] || null; }, function () { return null; });
  }

  watchSize();

  Promise.all([
    I.currentLang(),
    theTab(),
    chrome.storage.local.get([C.DEV_KEY, C.FIRST_RUN_KEY]).catch(function () { return {}; }),
  ]).then(function (got) {
    var lang = got[0], tab = got[1], local = got[2] || {};
    tr = I.translator(lang);
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    drawChrome();
    var dev = local[C.DEV_KEY] === true;
    var origin = C.captureOrigin(dev);
    ORIGIN = origin;
    var body = $('body');
    var url = tab && tab.url;
    // A page Heddy can't add to Jotters (D61). Chrome may hide such a tab's
    // address from the panel's window; the background then names the kind.
    var cant = url ? HeddyPageKind.describe(url, chrome.runtime.id) : HINT_KIND;
    // The site's name for a web page; never an extension's id.
    $('ctx').textContent = url && /^https?:/.test(url) ? hostLabel(url) : '';

    if (!local[C.FIRST_RUN_KEY]) {
      var o = {};
      o[C.FIRST_RUN_KEY] = true;
      chrome.storage.local.set(o).catch(function () {});
      return renderFirstTime(body, origin, lang);
    }
    // Snap a picture (R3b · 05): every popup but the first-time one and
    // aitutors.me's, and only on a web page Heddy can draw box mode on.
    if (url && !cant && /^https?:/.test(url) && !isSite(url, dev)) HeddySnap.mountButton($('snap'), { chrome: chrome, tr: tr, tab: tab, close: closeUi });
    var youtubeId = url ? P.youtubeIdFromUrl(url) : null;
    if (youtubeId) {
      return videoInfo(tab).then(function (info) { renderYouTube(body, tab, youtubeId, info); });
    }
    if (cant) return renderCantSave(body, cant);
    if (url && isSite(url, dev)) return renderSite(body);
    if (tab && /^https?:/.test(url || '')) return renderPage(body, tab);
    return renderCantSave(body, null);
  });
})();
