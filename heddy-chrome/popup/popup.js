// popup/popup.js — the toolbar popup (artifact R2 · 03, round 2c, R3b · 05).
//
// The states, showing only what already works (D25, Direction A):
//   first time      the one line, what Heddy does, Open aitutors.me (primary)
//   YouTube watch   Add to My Clips (D75, artifact P2): the real thumbnail,
//                   the exact link with Copy, the film strip with its gold
//                   window, Whole · The last 30 s · From now, the range, the
//                   button; a faint eyes icon in the header opens the desk
//   aitutors.me     one line of help, no primary, no footer
//   any other page  the web desk (Round 9, D79–D84; popup/web-desk.js): the
//                   Sources tab with the numbered cards and one save, the
//                   crest that is the Ask tab
//   can't read      a page Heddy may not script (chrome://, the Web Store)
// Every string from a page (the video's title and channel, a card's quote,
// the page's title) is set as text.
//
// Where it is drawn (owner, 2026-10-30; lib/panel.js): ?host=panel is the
// frame content/panel.js puts in the page (docked on the right for the web
// desk), ?host=popup the toolbar popup on a page Chrome keeps from
// extensions (Round 9, D79: no window). Both stay until closed (✕, Esc, or the
// toolbar icon again), and ?tab= names the tab the popup acts on. Where the
// toolbar popup closed itself after an action, closeUi() closes either.
(function () {
  var P = HeddyProtocol, C = HeddyConfig, I = HeddyI18n, M = HeddyMarks, SEL = HeddyYouTube.SELECTORS;
  var tr = I.translator('en');

  var $ = function (id) { return document.getElementById(id); };

  var params = new URLSearchParams(location.search);
  var HOST = params.get('host') === 'panel' ? 'panel' : 'popup';
  var TAB_ID = /^\d+$/.test(params.get('tab') || '') ? Number(params.get('tab')) : null;
  // The kind of page, from the background, for when Chrome hides the address.
  var HINT_KIND = (function (k) {
    var K = HeddyPageKind.KINDS;
    return Object.prototype.hasOwnProperty.call(K, k) ? { kind: k, chip: K[k].chip, line: K[k].line, sub: K[k].sub } : null;
  })(params.get('kind'));

  /** Close the panel (its host page removes the frame) or the popup. */
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
      // The hk screens are the design's 380 (PRD-v0.146.0 B8).
      var b = document.body.classList;
      window.parent.postMessage({ heddyPanel: 'size', h: h, w: b.contains('yt') ? 400 : b.contains('hk') ? 380 : 360 }, '*');
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

  // ─── Can't read, On aitutors.me, First time (PRD-v0.146.0 B8, B9) ─────────
  //
  // Design 1, "Tools first", in the desk's own look: the header (the eyes,
  // Heddy, "aitutors for KS3 & GCSE", EN | 中, ✕), the page row, the cream
  // panel with one primary action, and the "Mentor's desk" footer with the
  // cog. Every word is Heddy's catalog or set as text; the only HTML is the
  // constant icons below. The web page and YouTube screens are untouched (B7).

  var ORIGIN = C.PROD_ORIGIN;
  var BROWSER = C.detectBrowser();
  var BROWSER_NAME = { chrome: 'Chrome', edge: 'Edge', 'safari-mac': 'Safari', 'safari-ios': 'Safari' }[BROWSER];
  var YOUTUBE_HOME = 'https://www.youtube.com/';
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  // The design's icons (Classroom's ClipIcons and the artifact's IC).
  var IC = {
    jot: '<path class="f" d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M5.5 19.5 14 11"/><circle class="d" cx="15.4" cy="9.2" r="1.1"/>',
    desk: '<path d="M3.5 15h17M6.5 15v5M17.5 15v5"/><path class="f" d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M13 11.5V15"/><circle class="d" cx="13" cy="13.3" r="1.1"/>',
    play: '<path class="f" d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/><path d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    arrow: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    cap: '<path d="M2 9.5l10-5 10 5-10 5z"/><path d="M6 11.5v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    layers: '<path class="f" d="M12 3l9 5-9 5-9-5z"/><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    page: '<path d="M6 3.5h8l4 4V20a.5.5 0 01-.5.5h-11.5A.5.5 0 015.5 20V4a.5.5 0 01.5-.5z"/><path d="M14 3.5V8h4M8.5 12h7M8.5 15.5h7"/>',
  };
  function ic(name, cls) {
    return '<svg class="hi' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + IC[name] + '</svg>';
  }
  var EYES = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + M.SYMBOLS['h-eyes'].body + '</svg>';
  // The settings tile behind a browser page, as the design draws it.
  var GEAR_TILE = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect width="16" height="16" rx="4" fill="#5f6368"/><circle cx="8" cy="8" r="2.4" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 2.8v1.6M8 11.6v1.6M2.8 8h1.6M11.6 8h1.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var SITE_TILE = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect width="16" height="16" rx="4" fill="#002147"/><text x="7.6" y="11.6" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="700" font-size="10" fill="#f2ead8">a</text><path d="M12 3.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="#2f8a57"/></svg>';

  /** Heddy's owl (the design's), puzzled on a page it can't read. */
  function owl(size, puzzled) {
    var dx = puzzled ? 1.8 : 0, dy = puzzled ? -1.6 : 0;
    return '<svg class="owl" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="30" fill="#fff" stroke="#e2ddd1" stroke-width="2"/><circle cx="22.5" cy="29" r="9.5" fill="#d3a84c"/><circle cx="41.5" cy="29" r="9.5" fill="#d3a84c"/><circle cx="' + (22.5 + dx) + '" cy="' + (29 + dy) + '" r="5" fill="#002147"/><circle cx="' + (41.5 + dx) + '" cy="' + (29 + dy) + '" r="5" fill="#002147"/><circle cx="' + (21 + dx) + '" cy="' + (27.3 + dy) + '" r="1.6" fill="#fff"/><circle cx="' + (40 + dx) + '" cy="' + (27.3 + dy) + '" r="1.6" fill="#fff"/><path d="M32 37.5l-4 4.3 4 4.3 4-4.3z" fill="#d3a84c"/>' + (puzzled ? '<path d="M34.5 15.5l12-2.6" stroke="#14253f" stroke-width="2.4" stroke-linecap="round"/>' : '') + '</svg>';
  }

  function openAndClose(url) {
    chrome.tabs.create({ url: url }).then(closeUi, function () {});
  }

  function hkButton(cls, icon, label, onClick) {
    var b = el('button', cls);
    b.type = 'button';
    if (icon) b.insertAdjacentHTML('beforeend', ic(icon));
    b.appendChild(el('span', null, label));
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /** A sentence with key caps where its $KEY$ goes. */
  function withKeys(parent, key, keys) {
    var parts = tr(key, '\u0000').split('\u0000');
    parent.appendChild(document.createTextNode(parts[0]));
    if (parts.length > 1) {
      keys.forEach(function (k) { parent.appendChild(el('span', 'kbd', k)); });
      parent.appendChild(document.createTextNode(parts.slice(1).join('')));
    }
    return parent;
  }

  /** The snap shortcut as the browser has it bound (chrome.commands), in key
   *  caps: "⇧⌘K" → ⇧ ⌘ K, "Ctrl+Shift+K" → Ctrl Shift K. */
  function keyCaps(shortcut) {
    var s = String(shortcut || '');
    if (!s) return [];
    return s.indexOf('+') >= 0 ? s.split('+') : Array.from(s);
  }
  function snapKeys() {
    var fallback = MAC ? ['⌘', '⇧', 'K'] : ['Ctrl', 'Shift', 'K'];
    if (!chrome.commands || typeof chrome.commands.getAll !== 'function') return Promise.resolve(fallback);
    return Promise.resolve().then(function () { return chrome.commands.getAll(); }).then(function (all) {
      var c = (all || []).filter(function (x) { return x && x.name === 'snap-picture'; })[0];
      return c && c.shortcut ? keyCaps(c.shortcut) : c ? [] : fallback;
    }, function () { return fallback; });
  }

  // Who is signed in: /me (lib/who.js), asked once per open.
  var whoAsked = null;
  function loadWho() {
    if (!whoAsked) whoAsked = HeddyWho.loadMe(window.fetch.bind(window), ORIGIN);
    return whoAsked;
  }

  /** The address as the page row prints it; never another extension's id. */
  function rowAddress(url, desc) {
    var u;
    try { u = new URL(url); } catch (e) { return ''; }
    if (u.protocol === 'chrome-extension:' || u.protocol === 'safari-web-extension:' || u.protocol === 'moz-extension:') return '';
    if (u.protocol === 'file:') return decodeURIComponent(u.pathname.split('/').pop() || '');
    if (/^https?:$/.test(u.protocol)) return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
    if (/^view-source:/.test(url)) return url.slice(0, 80);
    // The browser's own pages by their address; any other scheme (Safari's
    // favorites://, for one) means nothing to a learner.
    if (!/^(chrome|edge|about|chrome-search|devtools):$/.test(u.protocol)) return '';
    return (u.protocol + '//' + u.hostname + u.pathname).replace(/\/$/, '');
  }

  /** "My Study · aitutors.me" → "My Study". */
  function siteTitle(title) {
    return String(title || '').replace(/\s*[·|—–-]\s*aitutors\.me.*$/i, '').trim() || 'aitutors.me';
  }

  var hk = { state: null, tab: null, url: '', cant: null, me: null, step: 0, why: false, jotters: null, next: null };

  /** Draw (or redraw, after EN | 中) the screen in hk.state. */
  function paintHk() {
    var body = $('body');
    $('pop').classList.add('hk');
    document.body.classList.add('hk');
    body.textContent = '';
    var lang = document.documentElement.lang === 'zh-CN' ? 'zh_CN' : 'en';
    var card = el('div', 'hkc');
    card.setAttribute('lang', lang === 'zh_CN' ? 'zh-Hans' : 'en-GB');

    // The header.
    var hd = el('div', 'hd');
    var eyes = el('span', 'eyes');
    eyes.innerHTML = EYES;
    hd.appendChild(eyes);
    hd.appendChild(el('b', null, 'Heddy'));
    hd.appendChild(el('small', null, tr('deskSub')));
    var pill = el('div', 'lg2');
    pill.setAttribute('role', 'group');
    pill.setAttribute('aria-label', tr('hkLangLabel'));
    [['en', 'EN'], ['zh_CN', '中']].forEach(function (l) {
      var b = el('button', null, l[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(lang === l[0]));
      if (l[0] === 'zh_CN') b.setAttribute('lang', 'zh-CN');
      b.addEventListener('click', function () {
        if (lang === l[0]) return;
        var o = {};
        o[I.STORAGE_KEY] = l[0];
        Promise.resolve().then(function () { return chrome.storage.sync.set(o); }).catch(function () {});
        tr = I.translator(l[0]);
        document.documentElement.lang = l[0] === 'zh_CN' ? 'zh-CN' : 'en';
        paintHk();
      });
      pill.appendChild(b);
    });
    hd.appendChild(pill);
    var hx = el('div', 'hx');
    var x = el('button');
    x.type = 'button';
    x.innerHTML = ic('close');
    x.title = tr('close');
    x.setAttribute('aria-label', tr('close'));
    x.addEventListener('click', closeUi);
    hx.appendChild(x);
    hd.appendChild(hx);
    card.appendChild(hd);

    // The page row.
    var s = hk.state;
    var prw = el('div', 'prw');
    var th = el('span', 'th');
    var title, tag = null, ok = false;
    if (s === 'cant') {
      var d = hk.cant;
      th.innerHTML = d.kind === 'heddy' ? EYES : d.kind === 'chrome' ? GEAR_TILE : ic('page');
      title = tr(d.chip, BROWSER_NAME);
      tag = tr('hkCantTag');
    } else if (s === 'site') {
      th.innerHTML = SITE_TILE;
      title = siteTitle(hk.tab && hk.tab.title);
      tag = tr('hkHomeTag');
      ok = true;
    } else {
      th.innerHTML = ic('page');
      title = (hk.tab && hk.tab.title) || hostLabel(hk.url);
      if (s === 'intro') { tag = tr('hkNewTag'); ok = true; }
    }
    prw.appendChild(th);
    var words = el('div');
    words.appendChild(el('b', null, title));
    var addr = rowAddress(hk.url, hk.cant);
    if (addr) words.appendChild(el('small', null, addr));
    prw.appendChild(words);
    if (tag) prw.appendChild(el('span', 'tag' + (ok ? ' ok' : ''), tag));
    card.appendChild(prw);

    var pn = el('div', 'pn');
    card.appendChild(pn);

    // The footer: Mentor's desk, and the cog.
    var ft = el('div', 'ft');
    ft.insertAdjacentHTML('beforeend', ic('desk'));
    ft.appendChild(el('span', null, tr('hkDesk')));
    var gr = el('button', 'gr');
    gr.type = 'button';
    gr.innerHTML = ic('gear');
    gr.title = tr('settings');
    gr.setAttribute('aria-label', tr('settings'));
    gr.addEventListener('click', function () { chrome.runtime.openOptionsPage(); closeUi(); });
    ft.appendChild(gr);
    card.appendChild(ft);
    body.appendChild(card);

    if (s === 'intro') return paintIntro(pn);
    if (s === 'first-out') return paintFirstOut(pn);
    // Can't read and aitutors.me follow who is signed in: drawn when /me answers.
    loadWho().then(function (me) {
      hk.me = me;
      if (!pn.isConnected) return;
      if (s === 'cant') paintCant(pn, me);
      else paintSite(pn, me);
    });
  }

  function eyebrow(text, link) {
    var lb = el('div', 'lb');
    lb.appendChild(el('p', null, text));
    if (link) lb.appendChild(link);
    return lb;
  }

  function hello(head, line, puzzled) {
    var h = el('div', 'hello');
    h.insertAdjacentHTML('beforeend', owl(46, puzzled));
    var note = el('div', 'note');
    note.appendChild(el('b', null, head));
    if (line) note.appendChild(el('p', null, line));
    h.appendChild(note);
    return h;
  }

  /** My Jotters · My Clips · My Study, the quiet row. */
  function doors() {
    var L = HeddyWho.links(ORIGIN);
    var row = el('div', 'doors');
    row.appendChild(hkButton(null, 'jot', tr('tileJotters'), function () { openAndClose(L.jotters); }));
    row.appendChild(hkButton(null, 'play', tr('tileClips'), function () { openAndClose(L.clips); }));
    row.appendChild(hkButton(null, 'cap', tr('tileStudy'), function () { openAndClose(L.study); }));
    return row;
  }

  /** Signed out: the line, Sign in (the primary), I'm new · I'm a parent. */
  function signBlock(line) {
    var L = HeddyWho.links(ORIGIN);
    var si = el('div', 'si');
    si.appendChild(el('p', null, line));
    si.appendChild(hkButton('save', 'user', tr('whoSignIn'), function () { openAndClose(L.signIn); }));
    var row = el('div', 'acts');
    row.appendChild(hkButton('ghost', null, tr('passMakeAccount'), function () { openAndClose(L.signUp); }));
    row.appendChild(hkButton('lnk', null, tr('passParent'), function () { openAndClose(L.parent); }));
    si.appendChild(row);
    return si;
  }

  /** A grown-up is signed in: Heddy saves for a child, so their dashboard. */
  function grownUpBlock() {
    var L = HeddyWho.links(ORIGIN);
    var si = el('div', 'si');
    si.appendChild(el('p', null, tr('whoGrownUp') + '. ' + tr('passGrownUpLine')));
    si.appendChild(hkButton('save', 'user', tr('whoOpenDashboard'), function () { openAndClose(L.dashboard); }));
    var row = el('div', 'acts');
    row.appendChild(hkButton('lnk', null, tr('passSwitch'), function () { openAndClose(L.signIn); }));
    si.appendChild(row);
    return si;
  }

  function fine(icon, text) {
    var p = el('p', 'fine');
    p.insertAdjacentHTML('beforeend', ic(icon));
    p.appendChild(el('span', null, text));
    return p;
  }

  function steps(items) {
    var ol = el('ol', 'steps');
    items.forEach(function (fill, i) {
      var li = el('li');
      li.appendChild(el('span', 'n', String(i + 1)));
      var t = el('span');
      fill(t);
      li.appendChild(t);
      ol.appendChild(li);
    });
    return ol;
  }

  /** Why Heddy can't read this page, for this browser and kind of page. */
  function whyLine(d) {
    var safari = /^safari/.test(BROWSER);
    if (d.kind === 'chrome') return safari ? tr('hkWhySafari') : tr('hkWhyBrowser', BROWSER_NAME);
    if (d.kind === 'store') return tr('hkWhyStore', BROWSER_NAME);
    if (d.kind === 'other') return safari ? tr('hkWhySafari') : tr('hkWhyOther');
    return tr(d.line) + ' ' + tr(d.sub);
  }

  // ─── 3 · Can't read ───────────────────────────────────────────────────────

  function paintCant(pn, me) {
    pn.textContent = '';
    var d = hk.cant;
    var h = hello(tr('hkCantHead'), whyLine(d), true);
    var tg = hkButton('tg', 'chev', hk.why ? tr('hkHideList') : tr('hkWhichPages'), function () { hk.why = !hk.why; paintCant(pn, me); });
    tg.setAttribute('aria-expanded', String(hk.why));
    h.querySelector('.note').appendChild(tg);
    pn.appendChild(h);
    if (hk.why) {
      var whyb = el('div', 'whyb');
      whyb.appendChild(el('b', null, tr('hkWhyHead')));
      var ul = el('ul');
      ['hkWhy1', 'hkWhy2', 'hkWhy3', 'hkWhy4'].forEach(function (k) { ul.appendChild(el('li', null, tr(k))); });
      whyb.appendChild(ul);
      pn.appendChild(whyb);
    }
    pn.appendChild(eyebrow(tr('hkTryThis')));
    var tries = [
      function (t) { t.textContent = tr('hkTry1'); },
      function (t) { t.textContent = tr('hkTry2'); },
    ];
    // A phone has no keys to press.
    if (BROWSER !== 'safari-ios') tries.push(function (t) { snapKeys().then(function (k) { if (k.length) withKeys(t, 'hkTry3', k); else t.closest('li').remove(); }); });
    pn.appendChild(steps(tries));
    var L = HeddyWho.links(ORIGIN);
    if (me.signedIn && me.role === 'child') {
      // Your latest jots (GET /api/learn/heddy/recent-jots, from the
      // background): drawn only when the read worked and found some. A failed
      // read says nothing, never "no jots".
      var latest = el('div', 'carry');
      pn.appendChild(latest);
      bgRead('heddy-web:recent-jots').then(function (r) {
        if (!r || !r.ok || !r.signedIn || !r.jots || !r.jots.length || !latest.isConnected) return;
        var all = hkButton(null, 'arrow', tr('hkAll'), function () { openAndClose(L.jotters); });
        all.insertBefore(all.lastChild, all.firstChild);
        latest.appendChild(eyebrow(tr('hkLatest', String(r.jots.length)), all));
        var ul = el('ul', 'ls');
        r.jots.forEach(function (j) {
          var li = el('li');
          var it = el('button', 'it');
          it.type = 'button';
          it.appendChild(el('q', null, j.text));
          it.insertAdjacentHTML('beforeend', ic('out'));
          it.appendChild(el('span', 'src q', [j.host, j.jotter, ago(j.at)].filter(Boolean).join(' · ')));
          it.addEventListener('click', function () { openAndClose(ORIGIN + j.href); });
          li.appendChild(it);
          ul.appendChild(li);
        });
        latest.appendChild(ul);
      });
      pn.appendChild(hkButton('save', 'jot', tr('hkOpenJotters'), function () { openAndClose(L.jotters); }));
    } else if (me.signedIn && me.role === 'parent') {
      pn.appendChild(grownUpBlock());
    } else {
      pn.appendChild(signBlock(tr('hkSignLine')));
    }
    pn.appendChild(doors());
    pn.appendChild(fine('lock', tr('footerLock')));
  }

  // ─── 4 · On aitutors.me ───────────────────────────────────────────────────

  /** "saved today", "saved yesterday", "saved 3 November". */
  function whenSaved(at) {
    if (typeof at !== 'number' || !isFinite(at)) return '';
    var day = function (t) { var x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
    var days = Math.round((day(Date.now()) - day(at)) / 86400000);
    if (days <= 0) return tr('hkWhenToday');
    if (days === 1) return tr('hkWhenYesterday');
    var lang = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en-GB';
    return tr('hkWhenOn', new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(new Date(at)));
  }

  function paintSite(pn, me) {
    pn.textContent = '';
    var L = HeddyWho.links(ORIGIN);
    if (!(me.signedIn && me.role === 'child')) {
      pn.appendChild(hello(tr('hkYouHere'), tr('hkHomeOut'), false));
      pn.appendChild(me.signedIn ? grownUpBlock() : signBlock(tr('hkHomeOutLine')));
      pn.appendChild(doors());
      pn.appendChild(fine('lock', tr('footerLock')));
      return;
    }
    var lang = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en-GB';
    var today = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    pn.appendChild(eyebrow(tr('hkToday', today)));
    // The primary: "Review N cards" when the count was read and is above
    // zero (GET /api/learn/heddy/cards-due); else, or when it could not be
    // read, Open my Study. A failed count is never drawn as "0 due".
    var primary = el('div', 'carry');
    pn.appendChild(primary);
    bgRead('heddy-web:cards-due').then(function (r) {
      if (!primary.isConnected) return;
      if (r && r.ok && r.signedIn && r.due > 0) {
        var due = el('div', 'due');
        var stack = el('span', 'stack');
        stack.appendChild(el('i'));
        stack.appendChild(el('i'));
        stack.appendChild(el('i', null, r.due > 99 ? '99+' : String(r.due)));
        due.appendChild(stack);
        var dw = el('div');
        dw.appendChild(el('b', null, r.due === 1 ? tr('hkCardsDueOne') : tr('hkCardsDue', String(r.due))));
        due.appendChild(dw);
        primary.appendChild(due);
        primary.appendChild(hkButton('save', 'layers', r.due === 1 ? tr('hkReviewOne') : tr('hkReview', String(r.due)), function () { openAndClose(ORIGIN + r.href); }));
        return;
      }
      primary.appendChild(hkButton('save', 'cap', tr('whoOpenStudy'), function () { openAndClose(L.study); }));
    });
    // Carry on: the Jotter saved into last (GET /api/learn/heddy/jotters,
    // newest-saved first, from the background). Nothing if it can't say.
    var carry = el('div', 'carry');
    pn.appendChild(carry);
    jottersOnce().then(function (r) {
      var j = r && r.show && r.jotters && r.jotters[0];
      if (!j || !carry.isConnected) return;
      carry.appendChild(eyebrow(tr('hkCarryOn')));
      var ul = el('ul', 'ls');
      var li = el('li');
      var it = el('button', 'it');
      it.type = 'button';
      it.appendChild(el('span', 'tx', j.title || tr('intoUntitled')));
      it.insertAdjacentHTML('beforeend', ic('out'));
      it.appendChild(el('span', 'src', tr('hkJotterSub', [j.key, whenSaved(j.at)].filter(Boolean).join(' · '))));
      it.addEventListener('click', function () { openAndClose(C.jotterById(ORIGIN, j.id)); });
      li.appendChild(it);
      ul.appendChild(li);
      carry.appendChild(ul);
    });
    pn.appendChild(eyebrow(tr('hkElsewhere')));
    var jk = el('div', 'jk');
    jk.insertAdjacentHTML('beforeend', ic('play'));
    var jw = el('div', 'jkw');
    jw.appendChild(el('span', null, tr('hkWatchWith')));
    jw.appendChild(el('small', null, tr('hkWatchWithSub')));
    var row = el('div', 'acts');
    row.appendChild(hkButton('go', 'play', tr('hkTryYouTube'), function () { openAndClose(YOUTUBE_HOME); }));
    jw.appendChild(row);
    jk.appendChild(jw);
    pn.appendChild(jk);
    pn.appendChild(fine('jot', tr('hkSelectJot')));
  }

  /** One of the background's popup reads (lib/web-routes.js), or null. */
  function bgRead(type) {
    return Promise.resolve()
      .then(function () { return chrome.runtime.sendMessage({ type: type, tabId: hk.tab && hk.tab.id }); })
      .catch(function () { return null; });
  }

  /** "12 min ago", "today", "yesterday", "3 November". */
  function ago(at) {
    if (typeof at !== 'number' || !isFinite(at)) return '';
    var mins = Math.floor((Date.now() - at) / 60000);
    if (mins < 1) return tr('hkAgoJust');
    if (mins < 60) return tr('hkAgoMins', String(mins));
    var day = function (t) { var x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
    var days = Math.round((day(Date.now()) - day(at)) / 86400000);
    if (days <= 0) return tr('hkAgoToday');
    if (days === 1) return tr('hkAgoYesterday');
    var lang = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en-GB';
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(new Date(at));
  }

  var jottersAsked = null;
  function jottersOnce() {
    if (!jottersAsked) {
      jottersAsked = Promise.resolve()
        .then(function () { return chrome.runtime.sendMessage({ type: 'heddy-web:jotters', tabId: hk.tab && hk.tab.id }); })
        .catch(function () { return null; });
    }
    return jottersAsked;
  }

  // ─── 5 · First time ───────────────────────────────────────────────────────

  function paintFirstOut(pn) {
    pn.appendChild(hello(tr('hkHello'), tr('firstTimeLead'), false));
    pn.appendChild(signBlock(tr('hkSignFirst')));
    pn.appendChild(eyebrow(tr('hkWhatDo')));
    var gap = document.documentElement.lang === 'zh-CN' ? '' : ' ';
    pn.appendChild(steps([
      function (t) { t.appendChild(el('b', null, tr('hkDo1h'))); t.appendChild(document.createTextNode(gap + tr('hkDo1'))); },
      function (t) { withKeys(t.appendChild(el('b')), 'hkDo2h', ['H']); t.appendChild(document.createTextNode(gap + tr('hkDo2'))); },
      function (t) { t.appendChild(el('b', null, tr('hkDo3h'))); t.appendChild(document.createTextNode(gap + tr('hkDo3'))); },
    ]));
    pn.appendChild(fine('lock', tr('footerLock')));
  }

  // The three cards: the real desk (Sources, Jot, Ask), cropped as the design shows them.
  var INTRO = [['s1', 'hkI1h', 'hkI1'], ['s2', 'hkI2h', 'hkI2'], ['s3', 'hkI3h', 'hkI3']];

  function paintIntro(pn) {
    pn.textContent = '';
    var c = INTRO[hk.step];
    var last = hk.step === INTRO.length - 1;
    var box = el('div', 'intro');
    var skip = el('button', null, tr('hkSkip'));
    skip.type = 'button';
    skip.addEventListener('click', introDone);
    box.appendChild(eyebrow(tr('hkWelcome', hk.me.firstName, String(hk.step + 1)), skip));
    var shot = el('div', 'shot ' + c[0]);
    shot.setAttribute('role', 'img');
    shot.setAttribute('aria-label', tr(c[1]));
    box.appendChild(shot);
    box.appendChild(el('h3', null, tr(c[1])));
    box.appendChild(el('p', null, tr(c[2])));
    var f = el('div', 'introf');
    var dots = el('div', 'dots');
    INTRO.forEach(function (_, i) { dots.appendChild(el('i', i === hk.step ? 'on' : null)); });
    f.appendChild(dots);
    f.appendChild(el('span', 'sp'));
    if (hk.step > 0) f.appendChild(hkButton('ghost', null, tr('hkBack'), function () { hk.step--; paintIntro(pn); }));
    var go = el('button', 'go');
    go.type = 'button';
    go.appendChild(el('span', null, last ? tr('hkStart') : tr('hkNext')));
    go.insertAdjacentHTML('beforeend', ic('arrow'));
    go.addEventListener('click', function () {
      if (last) return introDone();
      hk.step++;
      paintIntro(pn);
    });
    f.appendChild(go);
    box.appendChild(f);
    pn.appendChild(box);
  }

  /** Skip, or the last card: never again (chrome.storage.local), then the
   *  page's own screen. */
  function introDone() {
    var done = HeddyPopupState.remember(HeddyPopupState.INTRO_DONE);
    Promise.resolve().then(function () { return chrome.storage.local.set(done); }).catch(function () {});
    if (hk.next) hk.next();
  }

  /** Leave the hk look, for the page's own screen after the intro. */
  function leaveHk() {
    $('pop').classList.remove('hk');
    document.body.classList.remove('hk');
    $('body').textContent = '';
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

  // ─── any other page: the web desk (Round 9, D79–D84) ──────────────────────
  //
  // The panel on an ordinary page is the desk, docked on the right
  // (popup/web-desk.js draws it; content/panel.js docks it). Its Sources tab
  // holds the numbered cards, which live in the background (lib/cards.js).

  var desk = null;

  function cardsCall(message, tab) {
    return Promise.resolve()
      .then(function () { return chrome.runtime.sendMessage(Object.assign({ tabId: tab.id }, message)); })
      .then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
  }

  /** The page's mode: 'picture' while box mode draws there, else 'text'. */
  function readMode(tab) {
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () { var b = globalThis.__heddyBoxMode; return b && b.mode ? b.mode() : 'text'; },
    }).then(function (res) { return res && res[0] && res[0].result === 'picture' ? 'picture' : 'text'; }, function () { return 'text'; });
  }

  /** Any other page: the icon click is the gesture (activeTab), so Heddy
   *  may now read it. Words already selected when the desk opens, with no
   *  card yet, become card 1. Pages Chrome keeps from extensions refuse. */
  function renderPage(body, tab, lang, origin) {
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
          desk = HeddyWebDesk.mount({ tab: tab, lang: lang, origin: origin, host: HOST, state: st, mode: mode, closeUi: closeUi });
          // Docked on the right, full height, the page narrowed (D79).
          if (HOST === 'panel') window.parent.postMessage({ heddyPanel: 'size', dock: true }, '*');
        });
      }, function () { return showHk('cant', null); });
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
    var adding = false;
    go.addEventListener('click', function () {
      if (adding) return;
      adding = true;
      go.setAttribute('aria-busy', 'true');
      go.textContent = '';
      go.appendChild(el('span', 'spin'));
      go.appendChild(el('span', null, tr('clipAdding')));
      err.hidden = true;
      var m = { type: 'heddy-ui:capture', youtubeId: youtubeId, startSec: null, then: 'keep', tabId: tab.id, windowId: tab.windowId };
      if (range && duration) Object.assign(m, F.captureFields(range, duration));
      // A request from Heddy's background, no tab (D86, owner: C1 + C3's
      // toast): the popup stays and shows the Added card, and at the same
      // moment the toast shows on the video. One Undo undoes both.
      chrome.runtime.sendMessage(m).then(function (reply) {
        if (reply && reply.ok) {
          // Everything under the video gives way to the Added card.
          [chips, film, lens, go, hint, err].forEach(function (x) { x.remove(); });
          body.appendChild(addedCard(reply, { tab: tab, duration: duration }));
          return;
        }
        adding = false;
        go.removeAttribute('aria-busy');
        paint();
        var why = reply && reply.error;
        err.textContent = tr(why === 'signed_out' ? 'clipSignedOut' : why === 'no_captions' ? 'toastNoCaptions' : why === 'cant_keep' ? 'toastCantKeep' : why === 'limit' ? 'clipLimit' : 'clipFailed');
        err.hidden = false;
      }).catch(function () {
        adding = false;
        go.removeAttribute('aria-busy');
        paint();
        err.textContent = tr('clipFailed');
        err.hidden = false;
      });
    });
    body.appendChild(go);
    var hint = el('p', 'hint', tr('addsToMyClips'));
    body.appendChild(hint);
    body.appendChild(err);

    function secWord(n) { return tr('spanSec', n); }

    function paint() {
      if (adding) return;
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

  // ─── Add to My Clips: the Added card (owner's pick C1, 2026-10-31) ────────
  //
  // Kept in this one function so the design can change without touching the
  // request: "✓ Added to My Clips", the range pill, the checks (plays on
  // aitutors.me; a new channel is told to the grown-up), Open in My Clips ↗
  // (a tab only on tap) · Undo, and "Heddy didn't open anything. Keep
  // watching." The toast on the video says the same, and its Undo is this one
  // (lib/web-routes.js undoClip): either undoes both.

  /** "1:09 → 2:04 · 55 s", "From 1:09", "Whole video · 2:55". */
  function rangeText(r, duration) {
    var F = HeddyFilmStrip;
    var secWord = function (n) { return tr('spanSec', n); };
    var s = typeof r.startSec === 'number' ? r.startSec : 0;
    var e = typeof r.endSec === 'number' ? r.endSec : null;
    var len = typeof r.durationSec === 'number' ? r.durationSec : duration;
    if (e !== null) return tr('rangePart', P.clockOf(s), P.clockOf(e), F.spanText(e - s, secWord));
    if (s > 0) return tr('rangeFrom', P.clockOf(s));
    return len ? tr('rangeWhole', P.clockOf(len)) : tr('rangeWholeNoLen');
  }

  function addedCard(r, ctx) {
    var box = el('div', 'added');
    var ok = el('div', 'ok');
    ok.setAttribute('role', 'status');
    var h = el('div', 'h');
    h.appendChild(el('i', null, '✓'));
    h.appendChild(document.createTextNode(r.duplicate ? tr('toastAlreadyInClips') : tr('toastAddedToClips')));
    ok.appendChild(h);
    ok.appendChild(el('span', 'rangepill', rangeText(r, ctx.duration)));
    var checks = el('ul', 'chk2');
    var part = typeof r.endSec === 'number' || (typeof r.startSec === 'number' && r.startSec > 0);
    checks.appendChild(el('li', null, part ? tr('chkPlaysPart') : tr('chkPlays')));
    if (Array.isArray(r.notices) && r.notices.indexOf('new_channel') >= 0) checks.appendChild(el('li', 'w', tr('toastNoticeNewChannel')));
    ok.appendChild(checks);
    var row = el('div', 'row2');
    var open = el('button', 'o', tr('openInMyClips'));
    open.type = 'button';
    open.addEventListener('click', function () {
      Promise.resolve(chrome.runtime.sendMessage({ type: 'heddy-ui:open', href: r.href })).catch(function () {});
    });
    row.appendChild(open);
    // A library video is adopted, not a clip of the child's own: nothing to undo.
    var undo = null;
    if (r.momentId && !r.duplicate) {
      undo = el('button', 'n', tr('toastUndo'));
      undo.type = 'button';
      undo.addEventListener('click', function () {
        if (undo.getAttribute('aria-busy') === 'true') return;
        undo.setAttribute('aria-busy', 'true');
        chrome.runtime.sendMessage({ type: 'heddy-web:undo', kind: 'clip', momentId: r.momentId, tabId: ctx.tab.id }).then(function (x) {
          undo.removeAttribute('aria-busy');
          if (x && x.ok) undone();
        }, function () { undo.removeAttribute('aria-busy'); });
      });
      row.appendChild(undo);
    }
    ok.appendChild(row);
    box.appendChild(ok);
    var hint = el('p', 'hint', tr('addedHint'));
    box.appendChild(hint);
    function undone() {
      if (!ok.isConnected) return;
      h.lastChild.textContent = tr('toastClipUndone');
      ok.classList.add('gone');
      checks.remove();
      row.remove();
      hint.textContent = '';
    }
    // The toast's Undo did it: the card says so too.
    chrome.runtime.onMessage.addListener(function (m) {
      if (m && m.type === 'heddy-clip:undone' && m.momentId === r.momentId) undone();
    });
    return box;
  }

  // ─── start ─────────────────────────────────────────────────────────────────

  // Hints from the page that holds the panel (content/panel.js), and only
  // from it: they carry no data, the popup reads the page itself.
  // A new selection changes nothing until + Text; another page, everything.
  window.addEventListener('message', function (e) {
    if (HOST !== 'panel' || e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    if (e.data.heddyPanel === 'moved') location.reload();
    // Box mode started or ended in the page (D64): + Text / + Picture follow.
    if (e.data.heddyPanel === 'mode' && desk) desk.setMode(e.data.mode === 'picture' ? 'picture' : 'text');
  });

  function theTab() {
    if (TAB_ID != null) return chrome.tabs.get(TAB_ID).then(function (t) { return t || null; }, function () { return null; });
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0] || null; }, function () { return null; });
  }

  watchSize();

  /** One of the hk screens (cant, site, first-out, intro). */
  function showHk(state, cant) {
    hk.state = state;
    if (state === 'cant') hk.cant = cant || { kind: 'other', chip: 'kindOther', line: 'kindOtherLine', sub: 'kindOtherSub' };
    paintHk();
  }

  Promise.all([
    I.currentLang(),
    theTab(),
    chrome.storage.local.get([C.DEV_KEY, C.FIRST_RUN_KEY, C.INTRO_KEY]).catch(function () { return {}; }),
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
    var youtubeId = url ? P.youtubeIdFromUrl(url) : null;
    hk.tab = tab;
    hk.url = url || '';
    // The screen (lib/popup-state.js): the first time, then the page's own.
    var input = { url: url, cant: cant, site: !!url && isSite(url, dev), youtube: !!youtubeId, local: local, me: null };

    /** The page's own screen. */
    function ownScreen() {
      var state = HeddyPopupState.pageState(input);
      // Snap a picture (R3b · 05): only on a web page Heddy can draw box mode on.
      if (url && !cant && /^https?:/.test(url) && !isSite(url, dev)) HeddySnap.mountButton($('snap'), { chrome: chrome, tr: tr, tab: tab, close: closeUi });
      if (state === 'youtube') return videoInfo(tab).then(function (info) { renderYouTube(body, tab, youtubeId, info); });
      if (state === 'page') return renderPage(body, tab, lang, origin);
      return showHk(state, cant);
    }
    hk.next = function () { leaveHk(); ownScreen(); };

    function begin(state) {
      if (state === 'wait') {
        return loadWho().then(function (me) {
          input.me = me;
          hk.me = me;
          begin(HeddyPopupState.choose(input));
        });
      }
      if (state === 'first-out' || state === 'intro') {
        var keep = HeddyPopupState.remember(state);
        if (keep) chrome.storage.local.set(keep).catch(function () {});
        return showHk(state);
      }
      return ownScreen();
    }
    return begin(HeddyPopupState.choose(input));
  });
})();
