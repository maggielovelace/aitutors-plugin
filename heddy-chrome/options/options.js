// options/options.js — Heddy's settings (PRD-v0.146.0 B10, Design 1 "Tools
// first"; earlier PRD-v0.96.0 D36, D60).
//
// One column in the desk's look: the header (the eyes, "Heddy settings",
// "aitutors for KS3 & GCSE · {browser}", EN | 中), the status chips (signed
// in, pinned, version), then Account, Heddy in {browser} (pinned or switched
// on, and how), Shortcuts (each with this browser's "Change"), Language, What
// Heddy can do, About Heddy (version, privacy, the help guide), and two folded
// sections: For school IT (the three store ids with Copy; no id is shown
// anywhere else) and For developers.
//
// Who is signed in comes from aitutors.me's /me (lib/who.js), drawn signed out
// until it answers; nothing it says is stored. Whether Heddy is pinned comes
// from chrome.action.getUserSettings (Chrome, Edge); Safari cannot say, so
// it shows the steps instead. Every word is set as text; the only HTML is the
// constant icons.
(function () {
  var C = HeddyConfig, I = HeddyI18n, M = HeddyMarks, W = HeddyWho;
  var $ = function (id) { return document.getElementById(id); };
  var tr = I.translator('en');
  var lang = 'en';
  var me = W.SIGNED_OUT;
  var origin = C.PROD_ORIGIN;
  var dev = false;
  var BROWSER = C.detectBrowser();
  var BROWSER_NAME = { chrome: 'Chrome', edge: 'Edge', 'safari-mac': 'Safari', 'safari-ios': 'Safari' }[BROWSER];
  var SAFARI = /^safari/.test(BROWSER);
  var STORE = SAFARI ? 'safari' : BROWSER;
  var VERSION = chrome.runtime.getManifest().version;
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  // What the page knows and what is open: chrome.action's pin, the bound
  // shortcuts, and which "Show me how", "Change" and folded section is open.
  var ui = { pinned: null, keys: { snap: null, open: null }, pinHelp: false, sc: null, it: false, copied: null };
  var savedTimer = null;

  var IC = {
    jot: '<path class="f" d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M5.5 19.5 14 11"/><circle class="d" cx="15.4" cy="9.2" r="1.1"/>',
    desk: '<path d="M3.5 15h17M6.5 15v5M17.5 15v5"/><path class="f" d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M13 11.5V15"/><circle class="d" cx="13" cy="13.3" r="1.1"/>',
    play: '<path class="f" d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/><path d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/>',
    chat: '<path class="f" d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/>',
  };
  function ic(name) {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + IC[name] + '</svg>';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function open(url) {
    chrome.tabs.create({ url: url }).catch(function () {});
  }

  function btn(cls, icon, label, onClick) {
    var b = el('button', cls);
    b.type = 'button';
    if (icon) b.insertAdjacentHTML('beforeend', ic(icon));
    b.appendChild(el('span', null, label));
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function chip(kind, icon, label) {
    var c = el('span', kind);
    if (icon) c.insertAdjacentHTML('beforeend', ic(icon));
    c.appendChild(el('span', null, label));
    return c;
  }

  function kbd(text) {
    return el('span', 'kbd', text);
  }

  /** "⇧⌘K" → ⇧ ⌘ K, "Ctrl+Shift+K" → Ctrl Shift K. */
  function keyCaps(shortcut) {
    var s = String(shortcut || '');
    if (!s) return [];
    return s.indexOf('+') >= 0 ? s.split('+') : Array.from(s);
  }

  /** A row: its words on the left (k), what it holds on the right (v). */
  function row(head, sub) {
    var r = el('div', 'srow');
    var k = el('div', 'k');
    if (head) k.appendChild(el('b', null, head));
    if (sub) k.appendChild(el('small', null, sub));
    r.appendChild(k);
    var v = el('div', 'v');
    r.appendChild(v);
    return { row: r, v: v };
  }

  function section(title, rows) {
    var s = el('section', 'sc2');
    var lb = el('div', 'lb');
    lb.appendChild(el('p', null, title));
    s.appendChild(lb);
    rows.forEach(function (r) { s.appendChild(r); });
    return s;
  }

  function howto(lines, extra) {
    var h = el('div', 'howto');
    var ol = el('ol');
    lines.forEach(function (fill) {
      var li = el('li');
      if (typeof fill === 'string') li.textContent = fill;
      else fill(li);
      ol.appendChild(li);
    });
    h.appendChild(ol);
    if (extra) h.appendChild(extra);
    return h;
  }

  function langPill(big) {
    var pill = el('div', 'lg2');
    pill.setAttribute('role', 'group');
    pill.setAttribute('aria-label', tr('optionsLanguage'));
    // Each language named in itself, so neither catalog carries the other's script.
    [['en', big ? 'English' : 'EN', 'en'], ['zh_CN', big ? '简体中文' : '中', 'zh-CN']].forEach(function (l) {
      var b = el('button', null, l[1]);
      b.type = 'button';
      b.setAttribute('lang', l[2]);
      b.setAttribute('aria-pressed', String(lang === l[0]));
      b.addEventListener('click', function () {
        if (lang === l[0]) return;
        var o = {};
        o[I.STORAGE_KEY] = l[0];
        chrome.storage.sync.set(o).then(function () { lang = l[0]; paint(); saved(); });
      });
      pill.appendChild(b);
    });
    return pill;
  }

  // ─── the page ─────────────────────────────────────────────────────────────

  function paint() {
    tr = I.translator(lang);
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    document.title = tr('optionsTitle');
    var L = W.links(origin);
    var app = $('app');
    app.setAttribute('lang', lang === 'zh_CN' ? 'zh-Hans' : 'en-GB');
    app.textContent = '';
    var inner = el('div', 'set-in');
    var child = me.signedIn && me.role === 'child';
    var parent = me.signedIn && me.role === 'parent';

    // The header.
    var sh = el('header', 'sh');
    var eyes = el('span', 'eyes');
    eyes.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + M.SYMBOLS['h-eyes'].body + '</svg>';
    sh.appendChild(eyes);
    var t = el('div', 't');
    t.appendChild(el('h1', null, tr('optionsTitle')));
    t.appendChild(el('small', null, tr('deskSub') + ' · ' + BROWSER_NAME));
    sh.appendChild(t);
    sh.appendChild(langPill(false));
    inner.appendChild(sh);

    // The status chips: signed in, pinned (where the browser can say), version.
    var chips = el('div', 'chips');
    if (child) chips.appendChild(chip('chipok', 'tick', tr('setSignedAs', me.firstName)));
    else if (parent) chips.appendChild(chip('chipok', 'tick', tr('whoGrownUp')));
    else chips.appendChild(chip('chipwarn', 'alert', tr('passNotSignedIn')));
    if (ui.pinned === true) chips.appendChild(chip('chipok', 'tick', tr('setPinned')));
    else if (ui.pinned === false) chips.appendChild(chip('chipwarn', 'alert', tr('setNotPinned')));
    chips.appendChild(chip('chipn', null, 'v' + VERSION));
    inner.appendChild(chips);

    // Account.
    var acct;
    if (child) {
      acct = row(me.firstName + (me.yearGroup ? ' · ' + tr('whoYear', String(me.yearGroup)) : ''), tr('setAcctLine', me.firstName));
      acct.row.insertBefore(el('span', 'bigav', W.initial(me.firstName)), acct.row.firstChild);
      acct.v.appendChild(btn('save', null, tr('whoOpenStudy'), function () { open(L.study); }));
      acct.v.appendChild(btn('lnk', null, tr('passSwitch'), function () { open(L.signIn); }));
      inner.appendChild(section(tr('setAccount'), [acct.row]));
    } else if (parent) {
      acct = row(tr('whoGrownUp'), tr('passGrownUpLine'));
      var pav = el('span', 'bigav off');
      pav.innerHTML = ic('user');
      acct.row.insertBefore(pav, acct.row.firstChild);
      acct.v.appendChild(btn('save', null, tr('whoOpenDashboard'), function () { open(L.dashboard); }));
      acct.v.appendChild(btn('lnk', null, tr('passSwitch'), function () { open(L.signIn); }));
      inner.appendChild(section(tr('setAccount'), [acct.row]));
    } else {
      acct = row(tr('passNotSignedIn'), tr('setAcctOut'));
      var av = el('span', 'bigav off');
      av.innerHTML = ic('user');
      acct.row.insertBefore(av, acct.row.firstChild);
      var acts = row(null, null);
      acts.row.firstChild.remove();
      acts.v.appendChild(btn('save', null, tr('whoSignIn'), function () { open(L.signIn); }));
      acts.v.appendChild(btn('ghost', null, tr('passMakeAccount'), function () { open(L.signUp); }));
      acts.v.appendChild(btn('lnk', null, tr('passParent'), function () { open(L.parent); }));
      inner.appendChild(section(tr('setAccount'), [acct.row, acts.row]));
    }

    // Heddy in {browser}: pinned (Chrome, Edge) or website access (Safari), and how.
    var place;
    if (SAFARI) {
      place = row(tr('setSiteAccess'), tr('setSiteAccessSub'));
      place.v.appendChild(btn('lnk', null, tr('setShowHow'), function () { ui.pinHelp = !ui.pinHelp; paint(); }));
      if (ui.pinHelp) {
        place.row.appendChild(howto(BROWSER === 'safari-ios' ? [tr('setPinIos1'), tr('setPinIos2')] : [tr('setPinSafari1'), tr('setPinSafari2')]));
      }
    } else {
      place = row(tr('setToolbar'), tr('setToolbarSub'));
      if (ui.pinned === true) place.v.appendChild(chip('chipok', 'tick', tr('setPinned')));
      else {
        if (ui.pinned === false) place.v.appendChild(chip('chipwarn', 'alert', tr('setNotPinned')));
        place.v.appendChild(btn('lnk', null, tr('setShowHow'), function () { ui.pinHelp = !ui.pinHelp; paint(); }));
        if (ui.pinHelp) {
          var done = btn('save', 'tick', tr('setDone'), function () { checkPinned().then(function () { if (ui.pinned) ui.pinHelp = false; paint(); }); });
          place.row.appendChild(howto(BROWSER === 'edge' ? [tr('setPinEdge1'), tr('setPinEdge2')] : [tr('setPinChrome1'), tr('setPinChrome2')], done));
        }
      }
    }
    var on = row(tr('setInstalled'), tr('setInstalledSub', VERSION, BROWSER_NAME + (BROWSER === 'safari-mac' ? ' (Mac)' : BROWSER === 'safari-ios' ? ' (iPhone, iPad)' : '')));
    on.v.appendChild(chip('chipok', 'tick', tr('setOn')));
    inner.appendChild(section(tr('setInBrowser', BROWSER_NAME), [place.row, on.row]));

    // Shortcuts: H on YouTube; Snap a picture and Open Heddy as the browser has them bound.
    function change(which, r) {
      r.v.appendChild(btn('lnk', null, tr('setChange'), function () { ui.sc = ui.sc === which ? null : which; paint(); }));
      if (ui.sc !== which) return;
      if (SAFARI) {
        var h = el('div', 'howto');
        h.appendChild(el('p', null, tr('setScSafari')));
        r.row.appendChild(h);
        return;
      }
      var url = C.SHORTCUTS_URL[BROWSER] || C.SHORTCUTS_URL.chrome;
      var lead = el('p', null, tr('setScHow', BROWSER_NAME));
      var go = btn('ghost', 'out', tr('setOpenSc'), function () { open(url); });
      var box = howto([
        function (li) { var parts = tr('setScStep1', '\u0000').split('\u0000'); li.appendChild(document.createTextNode(parts[0])); li.appendChild(el('code', null, url)); li.appendChild(document.createTextNode(parts[1] || '')); },
        tr('setScStep2'),
        tr('setScStep3'),
      ], go);
      box.insertBefore(lead, box.firstChild);
      r.row.appendChild(box);
    }
    function keysOf(r, caps) {
      var k = el('span', 'keys');
      if (caps && caps.length) caps.forEach(function (c) { k.appendChild(kbd(c)); });
      else k.appendChild(el('span', 'chipn', tr('setNotSet')));
      r.v.appendChild(k);
    }
    var kJot = row(tr('setKJot'), tr('setKJotSub'));
    keysOf(kJot, ['H']);
    var kSnap = row(tr('setKSnap'), tr('setKSnapSub'));
    keysOf(kSnap, ui.keys.snap);
    change('snap', kSnap);
    var kOpen = row(tr('setKOpen'), tr('setKOpenSub'));
    keysOf(kOpen, ui.keys.open);
    change('open', kOpen);
    inner.appendChild(section(tr('setShortcuts'), [kJot.row, kSnap.row, kOpen.row]));

    // Language.
    var lr = row(null, tr('optionsLanguageHint'));
    lr.v.appendChild(langPill(true));
    inner.appendChild(section(tr('optionsLanguage'), [lr.row]));

    // What Heddy can do.
    var cando = el('ul', 'cando');
    [['jot', 'setCd1h', 'setCd1'], ['play', 'setCd2h', 'setCd2'], ['chat', 'setCd3h', 'setCd3'], ['lock', 'setCd4h', 'footerLock']].forEach(function (c) {
      var li = el('li');
      var ri = el('span', 'ri');
      ri.innerHTML = ic(c[0]);
      li.appendChild(ri);
      var d = el('div');
      d.appendChild(el('b', null, tr(c[1])));
      d.appendChild(el('small', null, tr(c[2])));
      li.appendChild(d);
      cando.appendChild(li);
    });
    inner.appendChild(section(tr('setCanDo'), [cando]));

    // About Heddy.
    var ver = row(tr('aboutVersion'));
    ver.v.appendChild(chip('chipn', null, VERSION));
    var priv = row(tr('aboutPrivacy'), tr('footerLock'));
    priv.v.appendChild(btn('lnk', null, tr('aboutPrivacyLink'), function () { open(C.PRIVACY_URL); }));
    var help = row(tr('setHelp'), tr('setHelpSub'));
    help.v.appendChild(btn('lnk', null, tr('setGuide'), function () { open(C.helpUrl(origin, lang)); }));
    inner.appendChild(section(tr('aboutHeading'), [ver.row, priv.row, help.row]));

    // For school IT, folded: the store ids, this browser's marked.
    var it = el('div', 'it2');
    var itb = btn(null, 'chev', tr('setSchoolIT'), function () { ui.it = !ui.it; paint(); });
    itb.setAttribute('aria-expanded', String(ui.it));
    it.appendChild(itb);
    if (ui.it) {
      var ib = el('div', 'body');
      ib.appendChild(el('p', null, tr('setItLine')));
      [['chrome', 'setIdChrome'], ['edge', 'setIdEdge'], ['safari', 'setIdSafari']].forEach(function (s) {
        var id = C.STORE_IDS[s[0]];
        var cur = s[0] === STORE;
        var r = el('div', 'idr' + (cur ? ' cur' : ''));
        var name = el('span', null, tr(s[1]));
        if (cur) name.appendChild(el('small', null, tr('setThisBrowser')));
        r.appendChild(name);
        var code = el('code', null, id);
        r.appendChild(code);
        var copied = ui.copied === s[0];
        var cp = btn('cp' + (copied ? ' done' : ''), copied ? 'tick' : 'copy', copied ? tr('aboutCopied') : tr('aboutCopy'), function () { copy(s[0], id, code); });
        r.appendChild(cp);
        ib.appendChild(r);
      });
      it.appendChild(ib);
    }
    inner.appendChild(it);

    // For developers, folded (captures to localhost:3000; leave it off).
    var dv = el('details', 'dev');
    var sum = el('summary', null, tr('optionsDevHeading'));
    dv.appendChild(sum);
    var tg = el('label', 'toggle');
    var cb = el('input');
    cb.type = 'checkbox';
    cb.id = 'dev';
    cb.checked = dev;
    tg.appendChild(cb);
    tg.appendChild(el('span', null, tr('optionsDevToggle')));
    dv.appendChild(tg);
    dv.appendChild(el('p', 'hint', tr('optionsDevHint')));
    cb.addEventListener('change', function () {
      var o = {};
      o[C.DEV_KEY] = cb.checked;
      chrome.storage.local.set(o).then(function () {
        // The pass asks the site the captures now go to.
        dev = cb.checked;
        origin = C.captureOrigin($('dev').checked);
        me = W.SIGNED_OUT;
        paint();
        ask();
        saved();
      });
    });
    inner.appendChild(dv);

    var foot = el('div', 'setfoot');
    foot.insertAdjacentHTML('beforeend', ic('desk'));
    foot.appendChild(el('span', null, tr('hkDesk')));
    inner.appendChild(foot);
    app.appendChild(inner);
  }

  function copy(which, id, code) {
    Promise.resolve()
      .then(function () { return navigator.clipboard.writeText(id); })
      .then(function () {
        ui.copied = which;
        paint();
        setTimeout(function () { if (ui.copied === which) { ui.copied = null; paint(); } }, 1800);
      }, function () {
        // No clipboard: select the id so it can be copied by hand.
        var r = document.createRange();
        r.selectNodeContents(code);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      });
  }

  function saved() {
    $('saved').textContent = tr('optionsSaved');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { $('saved').textContent = ''; }, 2000);
  }

  function ask() {
    W.loadMe(window.fetch.bind(window), origin).then(function (answer) {
      me = answer;
      paint();
    });
  }

  /** Is Heddy pinned? (chrome.action.getUserSettings; null where the browser can't say.) */
  function checkPinned() {
    var a = chrome.action;
    if (SAFARI || !a || typeof a.getUserSettings !== 'function') { ui.pinned = null; return Promise.resolve(); }
    return Promise.resolve()
      .then(function () { return a.getUserSettings(); })
      .then(function (s) { ui.pinned = s && typeof s.isOnToolbar === 'boolean' ? s.isOnToolbar : null; }, function () { ui.pinned = null; });
  }

  /** The bound shortcuts (chrome.commands): Snap a picture and Open Heddy. */
  function readKeys() {
    if (!chrome.commands || typeof chrome.commands.getAll !== 'function') {
      ui.keys = { snap: MAC ? ['⌘', '⇧', 'K'] : ['Ctrl', 'Shift', 'K'], open: [] };
      return Promise.resolve();
    }
    return Promise.resolve().then(function () { return chrome.commands.getAll(); }).then(function (all) {
      var by = {};
      (all || []).forEach(function (c) { if (c && c.name) by[c.name] = c.shortcut; });
      ui.keys = { snap: keyCaps(by['snap-picture']), open: keyCaps(by._execute_action) };
    }, function () {});
  }

  Promise.all([I.currentLang(), chrome.storage.local.get(C.DEV_KEY).catch(function () { return {}; }), checkPinned(), readKeys()]).then(function (got) {
    dev = !!got[1] && got[1][C.DEV_KEY] === true;
    origin = C.captureOrigin(dev);
    lang = got[0];
    paint();
    ask();
  });

  // Pinned or unpinned while the page is open (Chrome 130+).
  var a = chrome.action;
  if (a && a.onUserSettingsChanged && typeof a.onUserSettingsChanged.addListener === 'function') {
    a.onUserSettingsChanged.addListener(function () { checkPinned().then(paint); });
  }
})();
