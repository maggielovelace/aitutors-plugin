// content/desk.js — the Professor's desk in YouTube's suggestions column
// (PRD-v0.96.0 § 1h, D69–D74, D77 phase 8a; artifact round-8-youtube-desk.html
// #desk and #lang — the spec, matched literally).
//
// Classroom's desk, rebuilt in plain JS inside a closed shadow root: the Heddy
// header (eyes mark, Heddy, "aitutors for KS3 & GCSE", EN | 中, 📌, ✕), the
// video row with Full desk, Classroom's 48px tab row and icons (Quiz drawn
// and disabled, Jot, Digest, Insights when the site serves it), the eyes
// crest that is the Ask tab (Round 9, D80, D84: Ask {professor} is a view in
// the desk, lib/ask-view.js, never a window), the Jot tab (the "Jot the line being
// spoken" card, the label line with Save to My Jotters, the notebook list,
// the composer), the Digest (English · Bilingual · Chinese, the line being
// spoken tinted, a tap on a time seeks; Round 11: selecting words or clicking
// a line opens Pi's tray, lib/desk-tray.js) and the 32px foot with the chevron.
// The CSS values are the artifact's, which are Classroom's clip-desk.css,
// clip-jot.css and clip-digest.css.
//
// What it reads from YouTube: the video's id (the address), its title and
// channel, the player's time and length. It writes nothing to YouTube but its
// own host element, and hides YouTube's suggestions only while it is open
// (✕ and "Show YouTube's suggestions" give them back). Everything from
// aitutors.me comes through Heddy's background (lib/desk-api.js) and is set
// as text. Jots stay in chrome.storage.local, per video, until Save to My
// Jotters or Full desk (D71). The rules are lib/desk-model.js.
(function (root) {
  if (root.HeddyDesk) return;

  var D = root.HeddyDeskModel;
  var P = root.HeddyProtocol;
  var I = root.HeddyI18n;
  var FS = root.HeddyFilmStrip;
  var C = root.HeddyConfig;
  var AV = root.HeddyAskView;
  var TR = root.HeddyDeskTray;

  var TICK_MS = 250;
  var SAY_MS = 3500;
  var FOLLOW_PAUSE_MS = 4000;
  var PREF = { tall: 'deskTall', pin: 'deskPin', view: 'digestView', note: 'digestNoteOpen', fine: 'digestFineHidden' };
  // The desk's look (lib/desk-shell.js): the colours, Classroom's icons, the CSS.
  var SH = root.HeddyDeskShell;
  var SC = SH.SC;
  var SC_SOFT = SH.SC_SOFT;
  var IC = SH.IC;
  var ic = SH.ic;
  var EYES = SH.EYES;
  var CSS = SH.CSS;

  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function btn(cls, html, label) {
    var b = el('button', cls);
    b.type = 'button';
    if (html) b.insertAdjacentHTML('beforeend', html);
    if (label !== undefined && label !== null) b.appendChild(el('span', null, label));
    return b;
  }

  /**
   * deps: {
   *   chrome, sel (content/youtube-selectors.js), send(msg) → Promise,
   *   youtubeId(), title(), channel(), isDark(),
   *   onOpenChange(open)   the button's ringed state (D68)
   * }
   */
  function create(deps) {
    var chrome = deps.chrome;
    var SEL = deps.sel;
    var doc = root.document;
    var lang = 'en';
    var tr = I.translator(lang);

    var host = null;
    var shadow = null;
    var ui = null; // the parts that change
    var timer = null;
    var sayTimer = null;
    var hidden = null; // YouTube's suggestions element, while hidden: { el, display }
    var lastScroll = 0;
    var outside = null; // the page's press / Esc that closes Pi's tray
    var askAt = null; // the line's start an Ask from the tray is about

    var st = null; // the open desk's state, per video
    var prefs = { tall: false, pin: false, view: null, noteOpen: false, fineHidden: false };

    function fresh(id) {
      return {
        id: id,
        tab: 'jot',
        video: { status: 'loading', professor: null, jotterHref: null },
        transcript: { status: 'idle', lines: [] },
        // failedAt: when each stretch failed; the site retries one after
        // ZH_FAIL_RETRY_MS (Round 11), so the desk asks again after that.
        zh: { stretches: [], asked: {}, tries: {}, failedAt: {}, state: 'idle', failed: false, locked: false },
        // Insights (Round 11b, D93): the professor's paragraph per chapter,
        // from POST …/desk/keypoints. `parts` are the chapters with their text;
        // `zh` the Chinese by chapter start; asked/tries/failedAt per request.
        insights: { status: 'unknown', parts: [], zh: {}, asked: {}, tries: {}, failedAt: {}, done: {} },
        chapters: null, // [{startSec, endSec, title}], the video's own or ten-minute stretches
        chaptersKind: null, // 'yt' | 'stretch'
        jots: [],
        last: null,
        say: null,
        busy: { save: false, full: false },
        saved: null, // after Save to My Jotters: { href, n } (the Saved card, D86)
        showSuggestions: false,
        query: '',
        noteT: null,
        nowIdx: -1,
        pressed: [], // H presses waiting for the transcript: the player's seconds
        pressedByKey: false, // one of them was H (not the Jot card)
        retried: false,
        sel: null, // Pi's tray on the Digest: { i, to, parts, words, side }
        keep: 0, // the tallest the open tabs have wanted this visit (the desk never shrinks on its own)
        gone: {}, // jot ids just deleted: "Jot deleted." stands in their row
        noteOpen: null, // the Digest's insights card unfolded (per device: prefs.noteOpen)
        hit: -1, // the search match stepped to with Enter
        insightsAdded: false, // Add to my Jots was tapped
      };
    }

    // ─── storage ─────────────────────────────────────────────────────────────

    function local(keys) {
      return Promise.resolve().then(function () { return chrome.storage.local.get(keys); }).catch(function () { return {}; });
    }

    function setLocal(key, value) {
      var o = {};
      o[key] = value;
      return Promise.resolve().then(function () { return chrome.storage.local.set(o); }).catch(function () {});
    }

    function loadJots(id) {
      var key = D.storeKey(id);
      return local(key).then(function (got) { return D.parseStored(got && got[key]); });
    }

    function saveJots() {
      if (!st) return Promise.resolve();
      var key = D.storeKey(st.id);
      if (!st.jots.length) return Promise.resolve().then(function () { return chrome.storage.local.remove(key); }).catch(function () {});
      return setLocal(key, st.jots);
    }

    function newId() {
      return root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    }

    // ─── the player ──────────────────────────────────────────────────────────

    function video() {
      return doc.querySelector(SEL.video);
    }

    function now() {
      var v = video();
      return v && isFinite(v.currentTime) ? v.currentTime : 0;
    }

    function duration() {
      var v = video();
      return v && isFinite(v.duration) && v.duration > 0 ? v.duration : null;
    }

    /** A tap on a time jumps there (the one time Heddy moves the video, D11). */
    function seek(t) {
      var v = video();
      if (v && isFinite(t)) v.currentTime = Math.max(0, t);
    }

    // ─── the professor ───────────────────────────────────────────────────────

    function profName() {
      var p = st && st.video.professor;
      if (!p) return 'Mentor';
      return lang === 'zh_CN' ? p.nameZh || p.name : p.name;
    }

    function isMentor() {
      var p = st && st.video.professor;
      return !p || !p.code;
    }

    function paintColours() {
      if (!ui) return;
      var p = st && st.video.professor;
      ui.cd.style.setProperty('--sc', (p && p.sc) || SC);
      ui.cd.style.setProperty('--sc-soft', (p && p.scSoft) || SC_SOFT);
    }

    // ─── placing the desk in YouTube's page (D69) ───────────────────────────

    function flexyState() {
      var f = doc.querySelector(SEL.watchFlexy);
      return { twoColumns: !!(f && f.hasAttribute('is-two-columns_')), theater: !!(f && (f.hasAttribute('theater') || f.hasAttribute('fullscreen'))) };
    }

    function hideSuggestions(hide) {
      var rel = doc.querySelector(SEL.suggestions);
      if (hide && rel && (!hidden || hidden.el !== rel)) {
        if (hidden) restoreSuggestions();
        hidden = { el: rel, display: rel.style.display };
        rel.style.display = 'none';
      } else if (!hide) {
        restoreSuggestions();
      }
    }

    function restoreSuggestions() {
      if (!hidden) return;
      hidden.el.style.display = hidden.display;
      hidden = null;
    }

    function mastheadH() {
      var m = doc.querySelector(SEL.masthead);
      var h = m ? m.getBoundingClientRect().height : 56;
      return h > 0 && h < 200 ? h : 56;
    }

    /** Put the desk in YouTube's right column, or under the player (theatre
     *  mode, a narrow window), and size it. Called on every refresh. */
    function place() {
      if (!host || !st) return;
      var fs = flexyState();
      var col = doc.querySelector(SEL.secondaryColumn);
      var cr = col ? col.getBoundingClientRect() : null;
      fs.column = cr && cr.width ? { width: cr.width, right: cr.right } : null;
      fs.viewportW = doc.documentElement.clientWidth || root.innerWidth;
      var layout = D.layoutFor(fs);
      if (!put(layout)) return;
      // Where it actually landed: a column too narrow or running past the
      // window (YouTube's newer rail of icons) sends it under the player.
      if (layout === 'column') {
        var hr = host.getBoundingClientRect();
        if (D.layoutFor({ twoColumns: true, column: { width: hr.width, right: hr.right }, viewportW: fs.viewportW }) !== 'column') {
          layout = 'below';
          if (!put(layout)) return;
        }
      }
      host.classList.toggle('light', !deps.isDark());
      var top = mastheadH() + 12;
      host.style.setProperty('--heddy-top', top + 'px');
      hideSuggestions(!st.showSuggestions);
      size(layout, top);
    }

    function put(layout) {
      var parent = layout === 'column' ? doc.querySelector(SEL.secondaryColumn) : doc.querySelector(SEL.belowPlayer);
      if (!parent) return false;
      if (host.parentNode !== parent || parent.firstElementChild !== host) parent.insertBefore(host, parent.firstChild);
      host.classList.toggle('column', layout === 'column');
      host.classList.toggle('below', layout !== 'column');
      return true;
    }

    function size(layout, top) {
      if (!ui) return;
      var player = doc.querySelector(SEL.player);
      var h = D.deskHeight({
        layout: layout || (host.classList.contains('column') ? 'column' : 'below'),
        playerH: player ? player.getBoundingClientRect().height : null,
        viewportH: root.innerHeight,
        top: top || mastheadH() + 12,
        tall: prefs.tall,
        reserve: ui.more.getBoundingClientRect().height + 8,
        content: contentHeight(),
        keep: st ? st.keep : 0,
      });
      if (st && !prefs.tall) st.keep = Math.max(st.keep || 0, h);
      ui.cd.style.height = h + 'px';
    }

    /** What the open tab would take with nothing scrolling inside it: the
     *  desk's own rows, plus each part of the panel at its full height. */
    function contentHeight() {
      if (!ui || !ui.pn.isConnected) return 0;
      var pn = ui.pn;
      var kids = Array.prototype.slice.call(pn.children);
      var inner = 16;
      kids.forEach(function (k, n) {
        var scroller = k.classList.contains('lnwrap') ? k.firstChild : k;
        var scrolls = scroller && (scroller.classList.contains('sc') || scroller.classList.contains('talk'));
        inner += (scrolls ? scroller.scrollHeight : k.offsetHeight) + (n ? 14 : 0);
      });
      return ui.cd.offsetHeight - pn.clientHeight + inner;
    }

    // ─── drawing ─────────────────────────────────────────────────────────────

    function build() {
      host = doc.createElement('heddy-desk');
      shadow = host.attachShadow({ mode: 'closed' });
      shadow.innerHTML = '<style>' + CSS + '\n' + AV.CSS + '\n' + TR.CSS + '</style>';
      var cd = el('section', 'cd');
      cd.setAttribute('aria-label', 'Heddy');

      // The header (artifact ①).
      var hd = el('div', 'hd');
      var eyes = el('span', 'eyes');
      eyes.innerHTML = EYES;
      hd.appendChild(eyes);
      hd.appendChild(el('b', null, 'Heddy'));
      var sub = el('small');
      hd.appendChild(sub);
      var lg = el('span', 'lg2');
      lg.setAttribute('role', 'group');
      var en = btn('', null, 'EN');
      var zh = btn('', null, '中');
      zh.setAttribute('lang', 'zh-Hans');
      en.addEventListener('click', function () { pickLang('en'); });
      zh.addEventListener('click', function () { pickLang('zh_CN'); });
      lg.appendChild(en);
      lg.appendChild(zh);
      hd.appendChild(lg);
      var x = el('span', 'x');
      var pin = btn('pin', null, '📌');
      pin.addEventListener('click', function () {
        prefs.pin = !prefs.pin;
        setLocal(PREF.pin, prefs.pin);
        label();
      });
      var close = btn('', null, '✕');
      close.addEventListener('click', function () { api.close(); });
      x.appendChild(pin);
      x.appendChild(close);
      hd.appendChild(x);
      cd.appendChild(hd);

      // The video row (artifact ②): Full desk, the desk's only Save to My Clips.
      var vr = el('div', 'vr');
      var th = el('span', 'th');
      var img = el('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', function () { img.hidden = true; });
      th.appendChild(img);
      vr.appendChild(th);
      var meta = el('div');
      var vt = el('b');
      var vtime = el('small');
      meta.appendChild(vt);
      meta.appendChild(vtime);
      vr.appendChild(meta);
      var full = btn('full', ic('desk'), '');
      full.addEventListener('click', fullDesk);
      vr.appendChild(full);
      cd.appendChild(vr);

      // The tab row and the crest (artifact ③).
      var tabs = el('div', 'tabs');
      tabs.setAttribute('role', 'tablist');
      var tabEls = {};
      [['quiz', 'quiz'], ['jot', 'jot'], ['digest', 'digest'], ['insights', 'insights']].forEach(function (t) {
        var b = btn('tab', ic(t[1]));
        b.setAttribute('role', 'tab');
        b.appendChild(el('span'));
        if (t[0] === 'jot') b.appendChild(el('small'));
        b.addEventListener('click', function () { if (tabLive(t[0])) pickTab(t[0]); });
        tabEls[t[0]] = b;
        tabs.appendChild(b);
      });
      // ONE pill under the selected tab, slid from tab to tab (clip-desk.css .cp-desk__ind).
      var ind = el('span', 'ind');
      ind.setAttribute('aria-hidden', 'true');
      tabs.insertBefore(ind, tabs.firstChild);
      // The crest is the Ask tab (D80): selected while the Ask view shows.
      var crest = btn('tab crest', null);
      crest.setAttribute('role', 'tab');
      var ce = el('span', 'eyes');
      ce.innerHTML = EYES;
      crest.appendChild(ce);
      crest.addEventListener('click', function () { if (!st || st.tab !== 'ask') ask(); });
      tabs.appendChild(crest);
      cd.appendChild(tabs);

      var pn = el('div', 'pn');
      pn.setAttribute('role', 'tabpanel');
      cd.appendChild(pn);

      // The foot (artifact ⑥): Classroom's desk-and-lamp, the name, the chevron.
      var ft = el('div', 'ft');
      ft.insertAdjacentHTML('beforeend', ic('desk'));
      var fname = el('span');
      ft.appendChild(fname);
      var gr = btn('gr', ic('chev'));
      gr.addEventListener('click', function () {
        prefs.tall = !prefs.tall;
        setLocal(PREF.tall, prefs.tall);
        label();
        place();
      });
      ft.appendChild(gr);
      cd.appendChild(ft);

      shadow.appendChild(cd);
      var more = btn('more', null, '');
      more.addEventListener('click', function () {
        if (!st) return;
        st.showSuggestions = !st.showSuggestions;
        label();
        place();
      });
      shadow.appendChild(more);

      // While the child types in the desk, YouTube's keys (k, f, m, the
      // arrows…) must not reach the player.
      ['keydown', 'keypress', 'keyup'].forEach(function (type) {
        shadow.addEventListener(type, function (e) {
          var t = e.target;
          var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
          // (The Ask bar's box is an INPUT too: Enter there sends, not YouTube.)
          // A Digest line is a role=button span: Space opens its tray, never
          // YouTube's play/pause.
          var activating = t && (t.tagName === 'BUTTON' || (t.getAttribute && t.getAttribute('role') === 'button')) && (e.key === ' ' || e.key === 'Enter');
          // ←/→ on a tab move along the tab row, as Classroom's tablist does;
          // only from a desk tab, and claimed, so YouTube does not also seek.
          if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && t && t.getAttribute && t.getAttribute('role') === 'tab') {
            if (type === 'keydown') { e.preventDefault(); stepTab(e.key === 'ArrowRight' ? 1 : -1); }
            e.stopPropagation();
            return;
          }
          // Esc closes Pi's tray and claims the key, as Classroom's does.
          var closing = e.key === 'Escape' && st && st.sel;
          if (closing && type === 'keydown') { e.preventDefault(); closeSel(); }
          if (typing || activating || closing) e.stopPropagation();
        });
      });
      // A press anywhere but the chosen rows closes the tray (Classroom's
      // onDown): inside the desk here, on YouTube's page below.
      shadow.addEventListener('pointerdown', function (e) {
        if (!st || !st.sel) return;
        var path = e.composedPath ? e.composedPath() : [];
        for (var k = 0; k < path.length; k++) {
          var n = path[k];
          // A press on another line's words moves the tray there on release
          // (closing first would reflow the list under the pointer).
          if (n && n.classList && n.classList.contains('tx')) return;
          if (n && n.classList && n.classList.contains('ln')) {
            var i = Number(n.getAttribute('data-i'));
            if (i >= st.sel.i && i <= st.sel.to) return;
          }
        }
        closeSel();
      });
      outside = function (e) {
        if (!st || !st.sel || e.target === host) return;
        if (e.type === 'keydown' && e.key !== 'Escape') return;
        closeSel();
      };
      doc.addEventListener('pointerdown', outside, true);
      doc.addEventListener('keydown', outside, true);

      ui = { cd: cd, sub: sub, en: en, zh: zh, pin: pin, close: close, img: img, vt: vt, vtime: vtime, full: full, tabs: tabEls, crest: crest, pn: pn, fname: fname, gr: gr, more: more, row: tabs, ind: ind, shown: null, geo: null };
      // The row's boxes change without a tab change (a font arrives, the
      // column narrows): the pill is placed again, never animated.
      if (root.ResizeObserver) {
        var ro = new root.ResizeObserver(function () { if (ui) ui.geo = placeInd(); });
        ro.observe(tabs);
      }
    }

    // ─── the tab row's motion (ClipDesk.tsx: the pill slides 200 ms, the panel
    // slides 10 px in from the side of travel and fades, the icon tilts) ──────

    var EASE = 'cubic-bezier(.2,.7,.2,1)';
    var TAB_ORDER = ['quiz', 'jot', 'digest', 'insights', 'ask'];
    var ICON_TILT = [{ transform: 'rotate(-14deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }];

    function reducedMotion() {
      try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function selectedTab() {
      return st && (st.tab === 'ask' ? ui.crest : ui.tabs[st.tab]);
    }

    /** The pill under the selected tab; returns its geometry. */
    function placeInd() {
      var b = selectedTab();
      if (!b || !b.offsetWidth) return null;
      var g = { l: b.offsetLeft, w: b.offsetWidth };
      ui.ind.style.left = g.l + 'px';
      ui.ind.style.width = g.w + 'px';
      ui.row.setAttribute('data-ind', '');
      return g;
    }

    function play(node, frames, ms) {
      if (node && node.animate) node.animate(frames, { duration: ms, easing: EASE });
    }

    /** After a tab change: the pill slides from where it was, the panel comes
     *  in from the side of travel, the selected icon tilts. */
    function moved(from) {
      var before = ui.geo;
      var g = placeInd();
      ui.geo = g;
      if (!g || !before || !from || from === st.tab || reducedMotion()) return;
      play(ui.ind, [{ left: before.l + 'px', width: before.w + 'px' }, { left: g.l + 'px', width: g.w + 'px' }], 200);
      var dx = TAB_ORDER.indexOf(st.tab) > TAB_ORDER.indexOf(from) ? 10 : -10;
      play(ui.pn, [{ opacity: 0, transform: 'translateX(' + dx + 'px)' }, { opacity: 1, transform: 'none' }], 200);
      var icon = selectedTab().querySelector('.vi, .eyes');
      play(icon, ICON_TILT, 220);
    }

    /** Every word on the desk in Heddy's language (D73: relabels live). */
    function label() {
      if (!ui || !st) return;
      ui.cd.setAttribute('lang', lang === 'zh_CN' ? 'zh-Hans' : 'en');
      ui.sub.textContent = tr('deskSub');
      ui.en.setAttribute('aria-pressed', String(lang !== 'zh_CN'));
      ui.zh.setAttribute('aria-pressed', String(lang === 'zh_CN'));
      ui.en.parentNode.setAttribute('aria-label', tr('deskLang'));
      ui.pin.setAttribute('aria-pressed', String(prefs.pin));
      ui.pin.title = tr('deskPin');
      ui.pin.setAttribute('aria-label', tr('deskPin'));
      ui.close.title = tr('deskClose');
      ui.close.setAttribute('aria-label', tr('deskClose'));
      ui.full.lastChild.textContent = tr('deskFull');
      ui.full.title = tr('deskFullTitle');
      var names = { quiz: 'deskTabQuiz', jot: 'deskTabJot', digest: 'deskTabDigest', insights: 'deskTabInsights' };
      Object.keys(ui.tabs).forEach(function (k) {
        var b = ui.tabs[k];
        b.querySelector('span').textContent = tr(names[k]);
        b.setAttribute('aria-selected', String(st.tab === k));
        b.setAttribute('aria-disabled', String(!tabLive(k)));
        // A tab with nothing behind it says why, and is never selected (D77).
        if (!tabLive(k)) b.title = tr(k === 'quiz' ? 'deskQuizSoon' : 'deskInsightsSoon');
        else b.removeAttribute('title');
      });
      ui.tabs.jot.querySelector('small').textContent = String(st.jots.length);
      ui.tabs.jot.querySelector('small').hidden = !st.jots.length;
      ui.crest.title = tr('deskAsk', profName());
      ui.crest.setAttribute('aria-label', tr('deskAsk', profName()));
      ui.crest.setAttribute('aria-selected', String(st.tab === 'ask'));
      // Roving tabindex (WAI-ARIA tabs): only the selected tab is in the Tab order.
      Object.keys(ui.tabs).forEach(function (k) { ui.tabs[k].tabIndex = st.tab === k ? 0 : -1; });
      ui.crest.tabIndex = st.tab === 'ask' ? 0 : -1;
      var from = ui.shown;
      ui.shown = st.tab;
      if (from !== st.tab) moved(from);
      else if (!ui.geo) ui.geo = placeInd();
      ui.fname.textContent = isMentor() ? tr('deskFootMentor') : tr('deskFoot', profName());
      ui.gr.setAttribute('aria-pressed', String(prefs.tall));
      ui.gr.title = prefs.tall ? tr('deskShorter') : tr('deskTaller');
      ui.gr.setAttribute('aria-label', ui.gr.title);
      ui.more.textContent = st.showSuggestions ? tr('deskHideSuggestions') : tr('deskShowSuggestions');
      var t = deps.title() || '';
      ui.vt.textContent = t;
      ui.vt.title = t;
      paintColours();
      tick();
    }

    function tabLive(k) {
      if (k === 'quiz') return false; // 8b (D77)
      if (k === 'insights') return st.insights.status !== 'unknown' && st.insights.status !== 'unavailable';
      return true;
    }

    function pickTab(k) {
      if (!st) return;
      st.tab = k;
      st.sel = null;
      label();
      drawPanel();
      if (k === 'digest') wantZh();
    }

    /** The tabs the arrows walk, in the row's order: the ones that open, then
     *  the crest (the Ask tab, D80). */
    function shownTabs() {
      return ['quiz', 'jot', 'digest', 'insights'].filter(tabLive).concat(['ask']);
    }

    /** ←/→ (Classroom's onKey): the next or previous shown tab, wrapping,
     *  selected and focused. */
    function stepTab(dir) {
      if (!st) return;
      var shown = shownTabs();
      var i = shown.indexOf(st.tab);
      var next = shown[((i < 0 ? 0 : i) + dir + shown.length) % shown.length];
      if (next === 'ask') {
        if (askView.isOpen()) { st.tab = 'ask'; st.sel = null; label(); drawPanel(); }
        else ask();
      } else {
        pickTab(next);
      }
      var b = next === 'ask' ? ui.crest : ui.tabs[next];
      if (b) b.focus();
    }

    function signedOut() {
      return st.video.status === 'signedOut';
    }

    function signInLine(into) {
      var si = el('div', 'si');
      si.appendChild(el('span', null, tr('deskSignedOut')));
      var b = btn('', null, tr('deskSignIn'));
      b.addEventListener('click', function () { openSite('/auth/login?door=kid'); });
      si.appendChild(b);
      into.appendChild(si);
    }

    function drawPanel() {
      drawPanelBody();
      // The desk grows to what the tab now holds (never shrinking on its own).
      if (host && host.isConnected) size();
    }

    function drawPanelBody() {
      if (!ui || !st) return;
      var pn = ui.pn;
      pn.textContent = '';
      ui.lines = null;
      ui.field = null;
      ui.chip = null;
      ui.say = null;
      askView.detach();
      if (st.tab === 'ask') return askView.draw(pn);
      if (st.tab === 'jot') return drawJot(pn);
      if (st.tab === 'digest') return drawDigest(pn);
      if (st.tab === 'insights' && tabLive('insights')) return drawInsights(pn);
      var n = el('div', 'note');
      n.appendChild(el('p', 'empty', st.tab === 'quiz' ? tr('deskQuizSoon') : tr('deskInsightsSoon')));
      pn.appendChild(n);
    }

    // ─── the Jot tab (artifact ④ ⑤) ──────────────────────────────────────────

    function drawJot(pn) {
      var sc = el('div', 'sc');
      if (signedOut()) signInLine(sc);
      if (st.video.status === 'forbidden') sc.appendChild(el('div', 'si', tr('deskForbidden', chrome.runtime.id)));
      else if (!signedOut()) transcriptReason(sc);
      var jk = btn('jk', ic('jot'));
      var words = el('span', null, tr('deskJkBtn'));
      words.appendChild(el('small', null, tr('deskJkSub')));
      jk.appendChild(words);
      jk.appendChild(el('span', 'kbd', 'H'));
      jk.addEventListener('click', function () { api.pressJot(false); });
      sc.appendChild(jk);
      var say = el('p', 'say');
      say.setAttribute('aria-live', 'polite');
      say.hidden = !st.say;
      if (st.say) say.textContent = st.say;
      sc.appendChild(say);
      ui.say = say;

      if (st.saved) sc.appendChild(savedCard());

      var lb = el('div', 'lb');
      lb.appendChild(el('p', null, tr('deskJotsHead')));
      var save = btn('', null, st.busy.save ? tr('deskSaving') : tr('deskSaveJotters'));
      if (!st.busy.save) save.insertAdjacentHTML('beforeend', ' ' + ic('out'));
      if (st.busy.save) save.setAttribute('aria-busy', 'true');
      save.addEventListener('click', saveToJotters);
      lb.appendChild(save);
      sc.appendChild(lb);

      var gone = Object.keys(st.gone).map(function (k) { return st.gone[k]; });
      var rows = st.jots.concat(gone).sort(function (a, b) { return a.t - b.t; });
      if (!rows.length) {
        sc.appendChild(el('p', 'empty', tr('deskJotsEmpty')));
      } else {
        var ls = el('ul', 'ls');
        rows.forEach(function (j) {
          var li = el('li', j.by === 'professor' ? 'ins2' : null);
          if (st.gone[j.id]) {
            // "Jot deleted." stands in the row for a moment (clip-jot.css .cp-jot__gone).
            li.appendChild(el('span', 'gone', tr('deskJotDeleted')));
            ls.appendChild(li);
            return;
          }
          // The whole jot is a button that plays from its time (ClipJot's item).
          var it = el('button', 'it');
          it.type = 'button';
          it.title = tr('deskJotReplay', P.clockOf(j.t));
          it.appendChild(el('span', 'st', P.clockOf(j.t)));
          it.appendChild(j.kind === 'line' ? el('q', null, j.text) : el('span', 'tx', j.text));
          if (j.by === 'key') it.appendChild(el('span', 'byj', 'H'));
          else if (j.by === 'professor') it.appendChild(el('span', 'byj', tr('insightsFrom')));
          it.insertAdjacentHTML('beforeend', ic('play'));
          it.addEventListener('click', function () { seek(j.t); });
          li.appendChild(it);
          var del = el('button', 'del', tr('deskJotDelete'));
          del.type = 'button';
          del.addEventListener('click', function () { deleteJot(j.id); });
          li.appendChild(del);
          ls.appendChild(li);
        });
        sc.appendChild(ls);
      }
      pn.appendChild(sc);

      // The composer (ClipJot's): the time chip (a tap plays from there), a
      // field that grows to about five lines, the round Jot button. Enter
      // jots, Shift+Enter starts a new line; Jot with nothing typed jots the
      // line being spoken, as H does.
      var cp = el('div', 'cp');
      var box = el('div', 'fld');
      var chip = el('button', 'st');
      chip.type = 'button';
      chip.addEventListener('click', function () { seek(st.noteT === null ? now() : st.noteT); });
      var field = el('textarea');
      field.rows = 1;
      field.maxLength = 2000;
      field.setAttribute('aria-label', tr('deskJotPlaceholder', P.clockOf(now())));
      field.addEventListener('input', function () {
        if (st.noteT === null && field.value) st.noteT = now();
        grow(field);
      });
      field.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); addNote(); } });
      box.appendChild(chip);
      box.appendChild(field);
      var go = btn('go', ic('jot'), tr('deskJotButton'));
      go.addEventListener('click', addNote);
      cp.appendChild(box);
      cp.appendChild(go);
      pn.appendChild(cp);
      ui.field = field;
      ui.chip = chip;
      tick();
    }

    /** The composer grows with the note: one 20 px line, up to 120 px. */
    function grow(field) {
      field.style.height = '20px';
      field.style.height = Math.min(field.scrollHeight, 120) + 'px';
    }

    /** Delete (ClipJot's): "Jot deleted." for a moment, then the row goes. */
    function deleteJot(id) {
      if (!st) return;
      var j = st.jots.filter(function (x) { return x.id === id; })[0];
      st.jots = D.removeIds(st.jots, [id]);
      if (st.last && st.last.id === id) st.last = null;
      saveJots();
      // Drawn in its place, as "Jot deleted.", until UNDONE_MS has passed.
      if (j) st.gone[id] = j;
      label();
      if (st.tab === 'jot') drawPanel();
      var forId = st.id;
      setTimeout(function () {
        if (!st || st.id !== forId) return;
        delete st.gone[id];
        if (st.tab === 'jot') drawPanel();
      }, UNDONE_MS);
    }

    /** Why H cannot jot a spoken line on this video, said on the Jot tab for
     *  as long as it is true (the owner's 0.5.0 test: a 3.5 s line went
     *  unseen): reading (a long video's first read takes a while), no
     *  captions, no seat, or a read that failed, with Try again. */
    function transcriptReason(into) {
      var s = st.transcript.status;
      var key = { loading: 'deskWhyLoading', none: 'deskWhyNone', locked: 'deskWhyLocked', error: 'deskWhyError' }[s];
      if (!key || (s === 'loading' && st.video.status !== 'ok')) return;
      var si = el('div', 'si');
      si.appendChild(el('span', null, tr(key, profName())));
      if (s === 'error') {
        var again = btn('', null, tr('digestTryAgain'));
        again.addEventListener('click', function () { st.retried = false; loadTranscript(); if (st.tab === 'jot') drawPanel(); });
        si.appendChild(again);
      }
      into.appendChild(si);
    }

    /** The Saved card (D83, D86): Open my Jotter ↗ is the only tab, on tap. */
    function savedCard() {
      var c = el('div', 'okc');
      var h = el('div', 'h');
      h.appendChild(el('i', null, '✓'));
      h.appendChild(doc.createTextNode(tr('deskSavedTitle')));
      c.appendChild(h);
      c.appendChild(el('p', null, st.saved.n === 1 ? tr('deskSavedOne') : tr('deskSavedMany', String(st.saved.n))));
      var row = el('div', 'orow');
      var open = btn('o', null, tr('savedOpen'));
      var href = st.saved.href;
      open.addEventListener('click', function () { openSite(href); });
      var done = btn('n', null, tr('deskSavedDone'));
      done.addEventListener('click', function () { st.saved = null; drawPanel(); });
      row.appendChild(open);
      row.appendChild(done);
      c.appendChild(row);
      c.appendChild(el('span', 'ofine', tr('savedFine')));
      return c;
    }

    /** The line being spoken at `at` into the Jot tab (D74). `late`: from a
     *  press that waited for the transcript, so never joined to the last. */
    function jotAt(at, late, key) {
      var t = st.transcript;
      var r = D.press({ jots: st.jots, last: late ? null : st.last }, { now: Date.now(), t: at, lines: t.lines, id: newId() });
      if (r.result === 'noLine') return tell(tr('deskNoLine'), key);
      if (r.result === 'full') return tell(tr('deskJotsFull'), key);
      if (key && r.result === 'new') r.jots = r.jots.map(function (j) { return j.id === r.last.id ? Object.assign({}, j, { by: 'key' }) : j; });
      st.jots = r.jots;
      st.last = r.last;
      st.say = null;
      saveJots();
      label();
      if (st.tab === 'jot') drawPanel();
      // The pop-up after every jot (in fullscreen, Heddy's toast on the video).
      jotted(r.last.id, key);
    }

    /** say(), and for a press of H the child cannot see it from (fullscreen),
     *  the same words on the page. */
    function tell(text, key) {
      say(text, true);
      toastSay(text, key);
    }

    /** No transcript to jot from (no captions, signed out, refused): the note
     *  box takes the press's time, the cursor goes there, and the line says
     *  so until a jot is made. */
    function noteFallback(at, key) {
      if (st.tab !== 'jot') { st.tab = 'jot'; label(); drawPanel(); }
      st.noteT = at;
      tell(tr('deskNoTranscriptNote', P.clockOf(at)), key);
      if (ui.field) ui.field.placeholder = tr('deskJotPlaceholder', P.clockOf(at));
      // Never in fullscreen: a box the child cannot see would take YouTube's keys.
      if (doc.fullscreenElement) return;
      // After the key's own event: focused now, the H itself would be typed.
      setTimeout(function () { if (ui && ui.field && ui.field.isConnected) ui.field.focus(); }, 0);
    }

    /** A line under the Jot card. `stay`: it stays until the next jot, or
     *  the child closes the desk (the owner saw a 3.5 s line go unread). */
    function say(text, stay) {
      if (!st) return;
      st.say = text;
      clearTimeout(sayTimer);
      if (ui && ui.say) {
        ui.say.textContent = text || '';
        ui.say.hidden = !text;
      }
      if (text && !stay) sayTimer = setTimeout(function () { say(null); }, SAY_MS);
    }

    function addNote() {
      if (!st || !ui.field) return;
      // Nothing typed: Jot jots the line being spoken (twice joins the line before).
      if (!ui.field.value.trim()) return api.pressJot(false);
      var t = st.noteT === null ? now() : st.noteT;
      var id = newId();
      var text = ui.field.value;
      var next = D.note(st.jots, { id: id, t: t, text: text });
      if (!next) {
        if (st.jots.length >= D.MAX_JOTS) say(tr('deskJotsFull'));
        return;
      }
      st.jots = next;
      st.noteT = null;
      st.say = null;
      ui.field.value = '';
      saveJots();
      label();
      drawPanel();
      if (ui.field) ui.field.focus();
      jotted(id, false);
    }

    // ─── the jot pop-up (ClipDesk's JotToast; clip-jot.css .cp-toast) ───────
    // After every jot, on any tab: "● Note saved · 0:31 — {title}", the line
    // or the note, then Undo · Open in Jotter, for TOAST_MS. Where the desk
    // cannot be seen (YouTube fullscreen, the desk scrolled away) the same
    // jot shows Heddy's toast on the video instead (lib/toast.js desk_jot).

    var TOAST_MS = 5000;
    var UNDONE_MS = 1800;
    var toastTimer = null;

    function deskInSight() {
      if (doc.fullscreenElement || !host || !host.isConnected) return false;
      var r = host.getBoundingClientRect();
      return r.bottom > 56 && r.top < root.innerHeight - 56 && r.height > 0;
    }

    function hideToast() {
      clearTimeout(toastTimer);
      if (ui && ui.toast) ui.toast.remove();
      if (ui) ui.toast = null;
    }

    /** The pop-up's body, replacing any before it. */
    function showToast(fill, ms, anim) {
      hideToast();
      if (!ui) return;
      var t = el('div', 'jt');
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      if (anim !== false) t.setAttribute('data-anim', '');
      fill(t);
      ui.cd.appendChild(t);
      ui.toast = t;
      toastTimer = setTimeout(hideToast, ms || TOAST_MS);
    }

    /** A jot was made (`id`). `key`: with H. */
    function jotted(id, key) {
      var j = st && st.jots.filter(function (x) { return x.id === id; })[0];
      if (!j) return;
      if (!deskInSight()) {
        if (key) notify({ kind: 'desk_jot', t: j.t, quote: j.text });
        return;
      }
      showToast(function (box) {
        var hd = el('span', 'hd2');
        hd.appendChild(el('span', 'ok', tr('deskNoteSaved')));
        hd.appendChild(el('span', 'tt', P.clockOf(j.t) + ' — ' + (deps.title() || '')));
        box.appendChild(hd);
        box.appendChild(j.kind === 'line' ? el('q', null, j.text) : el('span', 'text', j.text));
        var acts = el('span', 'acts');
        var undo = el('button', 'lk', tr('deskJotUndo'));
        undo.type = 'button';
        undo.addEventListener('click', function () {
          st.jots = D.removeIds(st.jots, [id]);
          if (st.last && st.last.id === id) st.last = null;
          saveJots();
          label();
          if (st.tab === 'jot') drawPanel();
          showToast(function (b) { b.appendChild(el('span', 'msg', tr('deskJotDeleted'))); }, UNDONE_MS, false);
        });
        var open = el('button', 'jl', tr('deskOpenInJotter'));
        open.type = 'button';
        // Open in Jotter: Save to My Jotters, then the Jotter (a link that says it leaves).
        open.addEventListener('click', function () { hideToast(); saveToJotters(true); });
        acts.appendChild(undo);
        acts.appendChild(open);
        box.appendChild(acts);
      });
    }

    /** A press that jotted nothing, said in the pop-up (Classroom's noLine). */
    function toastSay(text, key) {
      if (!deskInSight()) {
        if (key) notify({ kind: 'desk_say', text: text });
        return;
      }
      showToast(function (b) { b.appendChild(el('span', 'msg', text)); });
    }

    /** Save to My Jotters. `thenOpen` (the pop-up's Open in Jotter): once
     *  saved, the Jotter opens too; the Saved card's Open is otherwise the
     *  only tab (D86). */
    function saveToJotters(thenOpen) {
      if (!st || st.busy.save) return;
      if (signedOut()) return openSite('/auth/login?door=kid');
      var href = st.video.jotterHref || '/study/jotters/v/' + st.id;
      if (!st.jots.length) return openSite(href);
      var sent = st.jots.slice();
      st.busy.save = true;
      drawPanel();
      deps.send({
        type: 'heddy-desk:save-jots',
        youtubeId: st.id,
        title: deps.title(),
        channel: deps.channel(),
        durationSec: duration(),
        jots: D.wireJots(sent),
      }).then(function (r) {
        if (!st) return;
        st.busy.save = false;
        if (r && r.ok) {
          // Saved (D86): the Saved card, and no tab until Open my Jotter ↗.
          // Jots made since stay.
          st.jots = D.removeIds(st.jots, sent.map(function (j) { return j.id; }));
          st.last = null;
          st.saved = { href: r.href, n: sent.length };
          saveJots();
          if (thenOpen === true) openSite(r.href);
        } else if (r && r.error === 'unauthenticated') {
          st.video.status = 'signedOut';
        }
        label();
        drawPanel();
        if (!(r && r.ok)) say(tr('deskSaveFailed'));
      });
    }

    /** Full desk (D71): the video to My Clips AND Classroom on aitutors.me,
     *  carrying the desk's jots; the courier pauses the video, as before. */
    function fullDesk() {
      if (!st || st.busy.full) return;
      st.busy.full = true;
      ui.full.setAttribute('aria-busy', 'true');
      var jots = st.jots.slice();
      // From Heddy's background (owner, 2026-10-31): the whole video kept, the
      // jots saved, then one tab straight to Classroom; no /capture page.
      deps.send({
        type: 'heddy-desk:full',
        youtubeId: st.id,
        title: deps.title(),
        channel: deps.channel(),
        durationSec: duration(),
        jots: D.wireJots(jots),
        t: now(),
        lang: lang === 'zh_CN' ? 'zh' : 'en',
      }).then(function (r) {
        if (!st) return;
        st.busy.full = false;
        ui.full.removeAttribute('aria-busy');
        if (r && r.ok) {
          // Only once the site says it kept them do the jots leave the desk.
          if (typeof r.jotsSaved === 'number') {
            st.jots = D.removeIds(st.jots, jots.map(function (j) { return j.id; }));
            st.last = null;
            saveJots();
            label();
            if (st.tab === 'jot') drawPanel();
          }
          return;
        }
        if (r && r.error === 'signed_out') {
          st.video.status = 'signedOut';
          st.tab = 'jot';
          label();
          drawPanel();
          return;
        }
        if (st.tab !== 'jot') { st.tab = 'jot'; label(); drawPanel(); }
        say(tr(r && r.error === 'forbidden' ? 'deskForbidden' : r && r.error === 'no_captions' ? 'toastNoCaptions' : r && r.error === 'cant_keep' ? 'toastCantKeep' : 'deskFullFailed', chrome.runtime.id), true);
      });
    }

    /** The crest (artifact ③, D80, D84): the desk's Ask view, about this
     *  video at this second. lib/desk-ask.js openAsk is the one way in. */
    function ask() {
      if (!st) return;
      // "Ask Newton · about 1:09" (the artifact's #ytask), with the line being
      // spoken then, when there is one.
      var t = now();
      var lines = st.transcript.lines;
      var i = st.transcript.status === 'ok' ? D.lineAt(lines, t) : -1;
      var ctx = { about: 'video', atLabel: P.clockOf(t) };
      if (i >= 0) ctx.attach = { kind: 'text', quote: lines[i].text };
      root.HeddyDeskAsk.openAsk(ctx, api, 'ask');
    }

    /** A small confirmation on the page (youtube.js's toaster: inside the
     *  fullscreen player while YouTube is fullscreen). */
    function notify(msg) {
      if (deps.notify) deps.notify(msg);
    }


    // The Ask view (lib/ask-view.js). The background reads the video's
    // address from this tab and adds the player's second (`t`).
    var askView = AV.create({
      doc: doc,
      tr: function () { return tr; },
      lang: function () { return lang; },
      connect: function () { return chrome.runtime.connect({ name: 'heddy-ask' }); },
      // From the tray, the chosen line's start; from the crest, the player's second.
      extra: function () { return { t: askAt !== null ? askAt : now() }; },
      site: function () { return 'youtube.com'; },
      fallbackName: profName,
      extensionId: function () { return chrome.runtime.id; },
      keepCard: function (m) { return deps.send(Object.assign({ type: 'heddy-web:card', t: now() }, m)).then(function (r) { return r || { ok: false }; }); },
      keepJot: function (m) { return deps.send(Object.assign({ type: 'heddy-web:jot', t: now() }, m)).then(function (r) { return r || { ok: false }; }); },
      undo: function (m) { return deps.send(Object.assign({ type: 'heddy-web:undo' }, m)).then(function (r) { return r || { ok: false }; }); },
      open: function (href) { deps.send({ type: 'heddy-ui:open', href: href }); },
      signIn: function () { openSite('/auth/login?door=kid'); },
      onProfessor: function (p) {
        // The video's professor stands; the stream names one only when the
        // desk had none (signed out at first, or the site did not answer).
        if (!st || (st.video.professor && st.video.professor.code)) return;
        var c = root.HeddyDeskAsk.coloursFor(p.code);
        st.video.professor = { code: p.code, name: p.name, nameZh: p.name, sc: c.sc, scSoft: c.scSoft };
        label();
      },
    });

    /** A page on aitutors.me in a new tab; the background checks the path. */
    function openSite(path) {
      local(C.DEV_KEY).then(function (got) {
        deps.send({ type: 'heddy-ui:open', href: C.captureOrigin(!!got && got[C.DEV_KEY] === true) + path });
      });
    }

    // ─── the Digest (D72, D73) ───────────────────────────────────────────────

    function viewNow() {
      return D.viewFor(lang, prefs.view);
    }

    function zhOf(line) {
      return D.zhLine(st.zh.stretches, line);
    }

    function drawDigest(pn) {
      var t = st.transcript;
      if (signedOut()) {
        signInLine(pn);
        return;
      }
      var reading = t.status === 'idle' || t.status === 'loading';
      if (t.status === 'none') {
        pn.appendChild(noteBox(tr('digestNoCaptionsTitle'), tr('digestNoCaptionsBody')));
        onlyChannel(pn);
        return;
      }
      if (t.status === 'locked') {
        pn.appendChild(lockedBlock(tr('digestLockedTitle', profName()), tr('digestLockedBody', profName())));
        return;
      }
      if (!reading && t.status !== 'ok') {
        var box = noteBox(null, tr('digestFailed', profName()));
        var again = btn('', null, tr('digestTryAgain'));
        again.addEventListener('click', function () { loadTranscript(); });
        box.appendChild(again);
        pn.appendChild(box);
        return;
      }

      // The top row stays while the transcript is read (ClipDigest W9).
      var view = viewNow();
      var dgt = el('div', 'dgt');
      var seg = el('span', 'seg3');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', tr('digestViewsLabel'));
      [['en', 'digestViewEn'], ['bi', 'digestViewBi'], ['zh', 'digestViewZh']].forEach(function (v) {
        var b = btn('', null, tr(v[1]));
        b.setAttribute('aria-pressed', String(view === v[0]));
        b.addEventListener('click', function () {
          prefs.view = v[0];
          setLocal(PREF.view, v[0]);
          retryZh();
          drawPanel();
          wantZh();
        });
        seg.appendChild(b);
      });
      dgt.appendChild(seg);
      // Search (ClipDigest): the magnifier, the matching lines, Enter steps
      // through them (Shift+Enter back), Esc clears.
      var lab = el('label', 'srch');
      var ics = el('i', 'ics');
      ics.setAttribute('aria-hidden', 'true');
      lab.appendChild(ics);
      var q = el('input');
      q.type = 'search';
      q.placeholder = tr('digestSearch');
      q.setAttribute('aria-label', tr('digestSearchLabel'));
      q.value = st.query;
      q.disabled = reading;
      q.addEventListener('input', function () { st.query = q.value; st.hit = -1; drawLines(); });
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && st.query) {
          e.preventDefault();
          e.stopPropagation();
          st.query = '';
          st.hit = -1;
          q.value = '';
          drawLines();
          return;
        }
        if (e.key !== 'Enter' || !ui.lines || !ui.lines.matches.length) return;
        e.preventDefault();
        var m = ui.lines.matches;
        st.hit = (st.hit + (e.shiftKey ? m.length - 1 : 1)) % m.length;
        drawLines();
        var row = ui.lines.rows[m[st.hit]];
        if (row) {
          var sc0 = ui.lines.sc;
          var top = row.offsetTop - sc0.offsetTop;
          if (top < sc0.scrollTop || top + row.offsetHeight > sc0.scrollTop + sc0.clientHeight) sc0.scrollTop = Math.max(0, top - sc0.clientHeight / 3);
        }
      });
      lab.appendChild(q);
      dgt.appendChild(lab);
      pn.appendChild(dgt);

      // {name}'s insights, folded to one row; a door to the Insights tab.
      pn.appendChild(insightsNote(view));

      var d = duration();
      var end = P.clockOf(d || (t.lines.length ? t.lines[t.lines.length - 1].t : 0));
      if (reading) {
        // ClipDigest W9: the clock, the skeletons, the fine line.
        var rd = el('p', 'reading');
        rd.appendChild(el('span', 'clock'));
        rd.appendChild(doc.createTextNode(tr('digestReading', profName())));
        pn.appendChild(rd);
        pn.appendChild(el('p', 'dlb', tr('digestTranscript', '0:00', d ? end : '–:––')));
        var sks = el('div', 'sks');
        ['92%', '84%', '60%', '88%', '70%'].forEach(function (w) { var k = el('span', 'sk'); k.style.width = w; sks.appendChild(k); });
        pn.appendChild(sks);
        pn.appendChild(el('p', 'fine', tr('deskReadingFine')));
        return;
      }
      pn.appendChild(el('p', 'dlb', tr('digestTranscript', '0:00', end)));
      var count = el('p', 'fine');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.hidden = true;
      pn.appendChild(count);
      if (view !== 'en') {
        if (st.zh.locked) pn.appendChild(el('p', 'empty', tr('digestLockedBody', profName())));
        else if (st.zh.failed) pn.appendChild(el('p', 'empty', tr('digestZhFailed')));
        else if (st.zh.state === 'writing') {
          var zw = el('p', 'reading');
          zw.appendChild(el('span', 'clock'));
          zw.appendChild(doc.createTextNode(tr('digestReadingZh', profName())));
          pn.appendChild(zw);
        }
      }
      var wrap = el('div', 'lnwrap');
      var sc = el('div', 'sc');
      sc.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });
      sc.addEventListener('wheel', function () { lastScroll = Date.now(); }, { passive: true });
      var lns = el('div', 'lns');
      // A drag that ends off a line's words (a stamp, a gap) still opens the
      // tray on what it selected.
      lns.addEventListener('pointerup', function (e) {
        if (e.button !== 0) return;
        var tg = e.target;
        if (tg && tg.closest && tg.closest('.tx, .pop')) return;
        var pk = pickIn();
        if (pk) openSel(pk);
      });
      sc.appendChild(lns);
      wrap.appendChild(sc);
      // Jump to now (ClipDigest): while the line being spoken is out of view.
      var jump = el('button', 'jump', tr('digestJumpNow'));
      jump.type = 'button';
      jump.hidden = true;
      jump.addEventListener('click', function () {
        var row = ui.lines && ui.lines.rows[st.nowIdx];
        if (!row) return;
        lastScroll = 0;
        sc.scrollTop = Math.max(0, row.offsetTop - sc.offsetTop - sc.clientHeight / 2 + row.offsetHeight / 2);
        jump.hidden = true;
      });
      wrap.appendChild(jump);
      pn.appendChild(wrap);
      onlyChannel(pn);
      ui.lines = { sc: sc, box: lns, rows: [], count: count, jump: jump, matches: [] };
      ui.lines.sc.dataset.view = view;
      drawLines();
    }

    /** "We only use a channel's own captions…", until the child hides it
     *  (ClipDigest's fine line; kept per device). */
    function onlyChannel(pn) {
      if (prefs.fineHidden) return;
      var p = el('p', 'fine close');
      p.appendChild(el('span', null, tr('digestOnlyChannel')));
      var x = btn('finex', ic('close'));
      x.setAttribute('aria-label', tr('digestOnlyChannelHide'));
      x.title = tr('digestOnlyChannelHide');
      x.addEventListener('click', function () {
        prefs.fineHidden = true;
        setLocal(PREF.fine, true);
        p.remove();
      });
      p.appendChild(x);
      pn.appendChild(p);
    }

    /** {name}'s insights on the Digest (ClipDigest's DigestNoteCard): one
     *  44 px row at rest, the whole row the toggle; unfolded, a brief and the
     *  door to the Insights tab. While the site serves no insights (8a), the
     *  card says so and the door is drawn disabled. */
    function insightsNote(view) {
      var s = st.insights;
      var live = tabLive('insights');
      var first = (s.parts || []).filter(function (p) { return p.text; })[0];
      var zhText = first && view !== 'en' ? first.zh || null : null;
      var text = first ? (view === 'zh' && zhText ? zhText : first.en || first.text) : '';
      var waiting = live && s.status === 'writing' && !text;
      var teaser = !live ? tr('deskInsightsSoon') : waiting ? tr('insightsWriting', profName()) : D.teaserOf(text);
      var open = prefs.noteOpen === true;
      var card = el('div', open ? 'dnote' : 'dnote closed');
      if (open) card.setAttribute('data-open', '');
      var p = st.video.professor;
      if (p && p.code) card.setAttribute('data-subj', p.code);
      var hd = el('button', 'notehd');
      hd.type = 'button';
      hd.setAttribute('aria-expanded', String(open));
      hd.setAttribute('aria-label', tr(open ? 'overviewFold' : 'overviewUnfold', profName()));
      var crest = el('span', 'eyes');
      crest.innerHTML = EYES;
      hd.appendChild(crest);
      var nt = el('span', 'nt');
      nt.appendChild(el('b', null, tr('insightsHead', profName())));
      if (!open) nt.appendChild(el('span', 'teaser', teaser));
      hd.appendChild(nt);
      hd.insertAdjacentHTML('beforeend', ic('down'));
      hd.addEventListener('click', function () {
        prefs.noteOpen = !open;
        setLocal(PREF.note, prefs.noteOpen);
        var next = insightsNote(viewNow());
        if (!open) {
          var b = next.querySelector('.notebody');
          if (b) b.setAttribute('data-anim', '');
        }
        card.replaceWith(next);
      });
      card.appendChild(hd);
      if (open) {
        var body = el('div', 'notebody');
        var brief = el('p', live && !waiting ? 'brief' : 'brief soon', !live ? tr('deskInsightsSoon') : waiting ? tr('insightsWriting', profName()) : D.briefOf(text));
        if (view === 'zh' && zhText) brief.setAttribute('lang', 'zh-Hans');
        body.appendChild(brief);
        if (view === 'bi' && zhText && live) {
          var bz = el('p', 'brief', D.briefOf(zhText));
          bz.setAttribute('lang', 'zh-Hans');
          body.appendChild(bz);
        }
        var door = el('button', 'ovlink');
        door.type = 'button';
        door.insertAdjacentHTML('beforeend', ic('insights'));
        door.appendChild(doc.createTextNode(tr('overviewOpenLink', profName())));
        door.insertAdjacentHTML('beforeend', ic('arrow'));
        if (!live) {
          door.setAttribute('aria-disabled', 'true');
          door.title = tr('deskInsightsSoon');
        } else {
          door.addEventListener('click', function () { pickTab('insights'); });
        }
        body.appendChild(door);
        card.appendChild(body);
      }
      return card;
    }

    function drawLines() {
      if (!ui.lines) return;
      var lines = st.transcript.lines;
      var box = ui.lines.box;
      box.textContent = '';
      ui.lines.rows = [];
      var filtering = !!String(st.query || '').trim();
      var only = filtering ? D.matchLines(lines, st.query, zhOf) : null;
      ui.lines.matches = only || [];
      var count = ui.lines.count;
      if (count) {
        count.hidden = !filtering;
        count.textContent = !filtering ? '' : only.length === 1 ? tr('digestMatchesOne', '1') : only.length ? tr('digestMatchesMany', String(only.length)) : tr('digestNoMatches');
      }
      if (only && !only.length) return;
      var hitAt = filtering && st.hit >= 0 ? only[st.hit] : -1;
      // The chapters as bookmarks in the list (r11b D93): a divider before each
      // chapter's first line, its title selecting the chapter's lines.
      var marks = filtering ? {} : chapterMarks();
      (only || lines.map(function (_, i) { return i; })).forEach(function (i) {
        if (marks[i] !== undefined) box.appendChild(chapterDivider(marks[i]));
        var row = makeRow(i);
        if (i === hitAt) row.setAttribute('data-hit', '');
        box.appendChild(row);
        ui.lines.rows[i] = row;
      });
      st.nowIdx = -2;
      tick();
      placeTray();
    }

    /** line index → chapter index, for each chapter's first line. */
    function chapterMarks() {
      var out = {};
      var chapters = chaptersNow();
      if (!chapters) return out;
      var lines = st.transcript.lines;
      chapters.forEach(function (c, k) {
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].t >= c.startSec && lines[i].t < c.endSec) { out[i] = k; return; }
          if (lines[i].t >= c.endSec) return;
        }
      });
      return out;
    }

    function chapterDivider(k) {
      var c = st.chapters[k];
      var d = el('button', 'div', P.clockOf(c.startSec) + ' · ' + c.title);
      d.type = 'button';
      d.setAttribute('role', 'separator');
      d.title = tr('digestSelectChapter', c.title);
      d.setAttribute('aria-label', d.title);
      d.addEventListener('click', function () { selectChapter(k, true); });
      return d;
    }

    /** A chapter's lines as one pick (Classroom's selectChapter): from its
     *  divider quietly, from the tray's › drawn. */
    function selectChapter(k, quiet) {
      var c = st.chapters && st.chapters[k];
      if (!c || !ui.lines) return;
      var lines = st.transcript.lines;
      var from = -1;
      var to = -1;
      lines.forEach(function (l, i) { if (l.t >= c.startSec && l.t < c.endSec) { if (from < 0) from = i; to = i; } });
      if (from < 0) return;
      var parts = lines.slice(from, to + 1).map(function (l) { return l.text; });
      var words = TR.pickWords(parts);
      if (!words) return;
      openSel({ from: from, to: to, parts: parts, words: words }, quiet);
      var row = ui.lines.rows[from];
      if (row) ui.lines.sc.scrollTop = Math.max(0, row.offsetTop - ui.lines.sc.offsetTop - TR.POP_ROOM_PX - 40);
    }

    /** `text` into `into`, the chosen words in a <mark> when they are in it.
     *  Returns whether it marked them. */
    function marked(into, text, picked) {
      var parts = picked ? TR.splitMark(text, picked) : null;
      if (!parts) {
        into.appendChild(doc.createTextNode(text));
        return false;
      }
      into.appendChild(doc.createTextNode(parts[0]));
      into.appendChild(el('mark', null, parts[1]));
      into.appendChild(doc.createTextNode(parts[2]));
      return true;
    }

    /** One Digest row (Classroom's .cp-dg__ln): its stamp (a tap plays from
     *  there), its line(s) (a click or a selection opens Pi's tray), and the
     *  tray above it while it is chosen. A line with no Chinese shows its
     *  English in every view. */
    function makeRow(i) {
      var l = st.transcript.lines[i];
      var view = viewNow();
      var sel = st.sel;
      var open = !!sel && sel.i === i;
      var picked = sel && !sel.quiet && i >= sel.i && i <= sel.to ? sel.parts[i - sel.i] || null : null;
      var row = el('div', 'ln');
      row.setAttribute('data-i', String(i));
      if (sel && !sel.quiet && i >= sel.i && i <= sel.to) row.setAttribute('data-sel', '');
      if (open) row.setAttribute('data-pop', sel.side);
      if (i === st.nowIdx) { row.classList.add('now'); row.setAttribute('aria-current', 'true'); }
      var ts = el('button', 'ts', P.clockOf(l.t));
      ts.type = 'button';
      ts.title = tr('digestSeek', P.clockOf(l.t));
      ts.setAttribute('aria-label', ts.title);
      ts.addEventListener('click', function () { seek(l.t); });
      row.appendChild(ts);
      var tx = el('span', 'tx');
      tx.setAttribute('role', 'button');
      tx.tabIndex = 0;
      tx.setAttribute('aria-expanded', String(open));
      if (open) tx.setAttribute('aria-controls', 'hd-pop-' + i);
      var z = view === 'en' ? null : zhOf(l);
      if (view === 'zh' && z) {
        var only2 = el('span', 'zh only');
        only2.setAttribute('lang', 'zh-Hans');
        marked(only2, z, picked);
        tx.appendChild(only2);
      } else {
        var done = marked(tx, l.text, picked);
        if (view === 'bi' && z) {
          var zz = el('span', 'zh');
          zz.setAttribute('lang', 'zh-Hans');
          marked(zz, z, done ? null : picked);
          tx.appendChild(zz);
        }
      }
      tx.addEventListener('pointerup', function (e) { if (e.button === 0) lineUp(i); });
      tx.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (st.sel && st.sel.i === i) closeSel();
        else openSel(wholeLine(i));
      });
      row.appendChild(tx);
      if (open) row.appendChild(trayFor(i).el);
      return row;
    }

    // ─── Pi's tray (Round 11; Classroom's DigestTray, lib/desk-tray.js) ─────

    /** The selection inside the desk's closed shadow root, as a Range, or null. */
    function liveRange() {
      try {
        var got = shadow.getSelection ? shadow.getSelection() : null;
        var r = null;
        if (got && !got.isCollapsed && got.rangeCount) {
          r = got.getRangeAt(0);
          return { range: r, anchor: got.anchorNode };
        }
        // Chrome without ShadowRoot.getSelection: the composed ranges.
        var g = doc.getSelection();
        if (!g || g.isCollapsed || !g.getComposedRanges) return null;
        var s = g.getComposedRanges({ shadowRoots: [shadow] })[0];
        if (!s || s.collapsed) return null;
        r = doc.createRange();
        r.setStart(s.startContainer, s.startOffset);
        r.setEnd(s.endContainer, s.endOffset);
        return { range: r, anchor: s.startContainer };
      } catch (e) {
        return null;
      }
    }

    function clearSelection() {
      try {
        var got = shadow.getSelection ? shadow.getSelection() : doc.getSelection();
        if (got) got.removeAllRanges();
      } catch (e) { /* nothing selected */ }
    }

    /** The text two ranges share (Classroom's intersectText). */
    function intersectText(a, b) {
      var r = a.cloneRange();
      if (r.compareBoundaryPoints(0, b) < 0) r.setStart(b.startContainer, b.startOffset); // START_TO_START
      if (r.compareBoundaryPoints(2, b) > 0) r.setEnd(b.endContainer, b.endOffset); // END_TO_END
      return r.collapsed ? '' : r.toString();
    }

    /** What the child selected in the list (Classroom's pickIn): the rows it
     *  runs through, each row's part, the words joined; one language only, the
     *  one the drag STARTED in. Null when nothing is selected in the list. */
    function pickIn() {
      var live = liveRange();
      if (!live || !ui.lines) return null;
      var range = live.range;
      var list = ui.lines.box;
      var lines = st.transcript.lines;
      function elOf(n) { return n && n.nodeType === 3 ? n.parentElement : n; }
      function rowOf(n) { var e = elOf(n); return e && e.closest ? e.closest('.ln[data-i]') : null; }
      var startRow = rowOf(range.startContainer);
      var endRow = rowOf(range.endContainer);
      if (!startRow || !endRow || !list.contains(startRow) || !list.contains(endRow)) return null;
      var from = Number(startRow.getAttribute('data-i'));
      var to = Number(endRow.getAttribute('data-i'));
      if (!(to >= from) || !lines[from] || !lines[to]) return null;
      var anchorEl = elOf(live.anchor);
      var anchorRow = rowOf(anchorEl);
      var anchorTx = anchorRow ? anchorRow.querySelector('.tx') : null;
      var anchorZh = anchorTx ? anchorTx.querySelector('[lang="zh-Hans"]') : null;
      var anchor = !anchorEl || !anchorTx || !anchorTx.contains(anchorEl) ? null : anchorZh && anchorZh.contains(anchorEl) ? 'zh' : 'en';
      function partOf(row) {
        var tx = row.querySelector('.tx');
        if (!tx) return { en: '', zh: '' };
        var zhEl = tx.querySelector('[lang="zh-Hans"]');
        var enRange = doc.createRange();
        enRange.selectNodeContents(tx);
        if (zhEl) enRange.setEndBefore(zhEl);
        var zh = '';
        if (zhEl) {
          var zhRange = doc.createRange();
          zhRange.selectNodeContents(zhEl);
          zh = intersectText(range, zhRange);
        }
        return { en: intersectText(range, enRange), zh: zh };
      }
      if (from === to) {
        var p = partOf(startRow);
        var w = TR.selectionForLine({ anchor: anchor, en: p.en, zh: p.zh, line: lines[from].text });
        return { from: from, to: to, parts: [w], words: w };
      }
      var parts = [];
      for (var r = from; r <= to; r++) {
        var row = r === from ? startRow : r === to ? endRow : list.querySelector('.ln[data-i="' + r + '"]');
        var part = row ? partOf(row) : { en: '', zh: '' };
        parts.push(TR.cleanSelection(anchor === 'zh' ? part.zh : part.en));
      }
      var words = TR.pickWords(parts);
      return words ? { from: from, to: to, parts: parts, words: words } : null;
    }

    function wholeLine(i) {
      var l = st.transcript.lines[i];
      return l ? { from: i, to: i, parts: [l.text], words: l.text } : null;
    }

    /** A press let go on a line (Classroom's up, for a mouse): the words
     *  selected, else the whole line; a click on the open line closes it. */
    function lineUp(i) {
      var pk = pickIn();
      if (!pk && st.sel && st.sel.i === i) return closeSel();
      openSel(pk || wholeLine(i));
    }

    function openSel(pick, quiet) {
      if (!pick || !ui.lines) return;
      var old = st.sel;
      var side = 'above';
      var row = ui.lines.rows[pick.from];
      if (row) side = TR.popSide(row.getBoundingClientRect().top - ui.lines.sc.getBoundingClientRect().top);
      st.sel = { i: pick.from, to: pick.to, parts: pick.parts, words: pick.words, side: side, quiet: quiet === true };
      // The chosen words are drawn as a <mark> in the row, as Classroom does
      // once the bar is open; the browser's own highlight goes.
      clearSelection();
      if (old) repaint(old.i, old.to);
      repaint(st.sel.i, st.sel.to);
      placeTray();
    }

    function closeSel() {
      if (!st || !st.sel) return;
      var old = st.sel;
      st.sel = null;
      repaint(old.i, old.to);
    }

    function repaint(from, to) {
      if (!ui || !ui.lines) return;
      for (var i = from; i <= to; i++) {
        var was = ui.lines.rows[i];
        if (!was || !was.parentNode) continue;
        var row = makeRow(i);
        was.parentNode.replaceChild(row, was);
        ui.lines.rows[i] = row;
      }
    }

    /** The caret on the centre of the chosen words: the <mark>'s first box,
     *  else the line's text (Classroom's layout effect + trayPlacement). */
    function placeTray() {
      if (!st || !st.sel || !ui.lines) return;
      var row = ui.lines.rows[st.sel.i];
      var tray = row && row.querySelector('.pop');
      var tx = row && row.querySelector('.tx');
      if (!tray || !tx) return;
      var rr = row.getBoundingClientRect();
      var mark = tx.querySelector('mark');
      var mr = mark ? mark.getClientRects()[0] : null;
      var sx = mr ? mr.left - rr.left : tx.offsetLeft;
      var sw = mr ? mr.width : tx.offsetWidth;
      var p = TR.trayPlacement({ sx: sx, sw: sw, bw: tray.offsetWidth, rw: row.offsetWidth });
      tray.style.setProperty('--bx', p.bx + 'px');
      tray.style.setProperty('--cx', p.cx + 'px');
    }

    /** The tray for the open line, every tool wired to the desk. */
    function trayFor(i) {
      var sel = st.sel;
      var lines = st.transcript.lines;
      var l = lines[i];
      var words = sel.words;
      return TR.build({
        doc: doc,
        id: 'hd-pop-' + i,
        below: sel.side === 'below',
        eyes: EYES,
        d: {
          actionsLabel: tr('digestActionsLabel'),
          jot: tr('digestActJot'),
          explain: tr('digestActExplain'),
          card: tr('digestActCard'),
          ask: tr('deskAsk', profName()),
          more: { open: tr('digestMoreOpen'), label: tr('digestMoreLabel'), play: tr('digestMorePlay'), copy: tr('digestMoreCopy'), copied: tr('digestMoreCopied'), copyFailed: tr('digestMoreCopyFailed'), chapter: tr('digestMoreChapter') },
        },
        playAt: P.clockOf(l.t),
        copyText: words,
        onJot: function () { jotWords(l.t, words); },
        onExplain: function () { askAbout(sel, 'explain'); },
        onCard: function () { askAbout(sel, 'card'); },
        onAsk: function () { askAbout(sel, 'ask'); },
        onPlay: function () { closeSel(); seek(l.t); },
        // Select the whole chapter (r11b: chapters for every video), unless the pick already is it.
        onChapter: chapterOfPick(sel) >= 0 ? function () { selectChapter(chapterOfPick(sel), false); } : null,
        copy: function (text) { return root.navigator.clipboard.writeText(text); },
      });
    }

    /** The chapter holding the pick's first line, unless the pick is that
     *  whole chapter already; -1 otherwise. */
    function chapterOfPick(sel) {
      var chapters = chaptersNow();
      var l = st.transcript.lines[sel.i];
      if (!chapters || !l) return -1;
      var k = D.chapterAt(chapters, l.t);
      if (k < 0) return -1;
      var c = chapters[k];
      var lines = st.transcript.lines;
      var whole = (sel.i === 0 || lines[sel.i - 1].t < c.startSec) && (!lines[sel.to + 1] || lines[sel.to + 1].t >= c.endSec) && sel.parts.every(function (p, n) { return p === lines[sel.i + n].text; });
      return whole ? -1 : k;
    }

    /** Jot it: a jot at the line's start with the chosen words (as H's). */
    function jotWords(t, words) {
      closeSel();
      var id = newId();
      var next = D.lineJot(st.jots, { id: id, t: t, text: words });
      if (!next) return toastSay(tr('deskJotsFull'), false);
      st.jots = next;
      st.last = null;
      saveJots();
      label();
      jotted(id, false);
    }

    /** Explain, Make a card, Ask {Professor}: the desk's Ask view (Round 10
     *  D88: no window, no tab) about the chosen words, at the line's start.
     *  Ask sends the words as the child's first message, as Classroom's room
     *  does; Explain and Make a card run their chip. */
    function askAbout(sel, intent) {
      var lines = st.transcript.lines;
      var at = lines[sel.i] ? lines[sel.i].t : now();
      var attach = { kind: 'text', quote: sel.words };
      if (lines[sel.i - 1]) attach.before = lines[sel.i - 1].text;
      if (lines[sel.to + 1]) attach.after = lines[sel.to + 1].text;
      closeSel();
      root.HeddyDeskAsk.openAsk({ about: 'words', attach: attach, at: at }, api, intent, intent === 'ask' ? sel.words : undefined);
    }

    function noteBox(title, body) {
      var n = el('div', 'note');
      if (title) n.appendChild(el('b', null, title));
      if (body) n.appendChild(el('span', null, body));
      return n;
    }

    function loadTranscript() {
      if (!st) return;
      var id = st.id;
      st.transcript = { status: 'loading', lines: [] };
      if (st.tab === 'digest' || st.tab === 'jot') drawPanel();
      deps.send({ type: 'heddy-desk:transcript', youtubeId: id, title: deps.title() }).then(function (r) {
        if (!st || st.id !== id) return;
        if (r && r.ok) st.transcript = { status: r.status, lines: r.lines || [] };
        else if (r && r.error === 'unauthenticated') { st.video.status = 'signedOut'; st.transcript = { status: 'error', lines: [] }; }
        else st.transcript = { status: 'error', lines: [] };
        if (st.transcript.status === 'ok' && r.zh) addStretch(r.zh);
        // H pressed while the transcript was on its way: each press is jotted
        // now, at the second it was pressed; without a transcript, the note box.
        var waiting = st.pressed;
        var key = st.pressedByKey;
        st.pressed = [];
        st.pressedByKey = false;
        label();
        drawPanel();
        wantZh();
        if (waiting.length) {
          if (st.transcript.status === 'ok') waiting.forEach(function (at) { jotAt(at, true, key); });
          else noteFallback(waiting[waiting.length - 1], key);
        }
      });
    }

    function addStretch(z) {
      st.zh.stretches = st.zh.stretches.filter(function (s) { return s.from !== z.from; }).concat([z]);
    }

    /** Round 11: a stretch that failed is asked for again once the site's
     *  window has passed, when the child switches view again. */
    function retryZh() {
      if (!st) return;
      var due = D.zhRetryDue(st.zh.failedAt, Date.now());
      if (!due.length) return;
      due.forEach(function (from) {
        delete st.zh.failedAt[from];
        delete st.zh.asked[from];
        st.zh.tries[from] = 0;
      });
      st.zh.failed = Object.keys(st.zh.failedAt).length > 0;
      if (!st.zh.failed && st.zh.state === 'failed') st.zh.state = 'idle';
    }

    /** D72: ask for the stretch the player is in, and the next one past 80%. */
    function wantZh() {
      if (!st || st.transcript.status !== 'ok' || viewNow() === 'en' || st.zh.locked) return;
      var have = Object.keys(st.zh.asked).map(function (k) { return { from: Number(k) }; });
      var from = D.zhNeed({ t: now(), have: have, duration: duration() });
      if (from === null) return;
      askZh(from);
    }

    function askZh(from) {
      var id = st.id;
      st.zh.asked[from] = true;
      st.zh.tries[from] = (st.zh.tries[from] || 0) + 1;
      deps.send({ type: 'heddy-desk:transcript', youtubeId: id, title: deps.title(), zhFrom: from }).then(function (r) {
        if (!st || st.id !== id) return;
        var state = r && r.ok ? r.zhState : 'failed';
        if (r && r.ok && r.zh) {
          addStretch(r.zh);
          state = 'ready';
        }
        if (state === 'writing' && st.zh.tries[from] < D.ZH_TRIES) {
          setTimeout(function () { if (st && st.id === id) askZh(from); }, D.ZH_RETRY_MS);
        } else if (state === 'locked') {
          st.zh.locked = true;
        } else if (state !== 'ready') {
          st.zh.failed = true;
          st.zh.failedAt[from] = Date.now();
          state = 'failed';
        }
        var before = st.zh.state;
        st.zh.state = state;
        if (st.tab === 'digest' && (state !== 'writing' || before !== 'writing')) drawPanel();
      });
    }

    // ─── Insights (contract § 3: live only when the site serves it) ─────────

    /** The video's chapters (r11b "Chapters (plugin)"): YouTube's own, read
     *  from the page as text and checked, else ten-minute stretches. Needs the
     *  video's length. */
    function chaptersNow() {
      if (!st) return null;
      if (st.chapters && (st.chaptersKind === 'yt' || st.insights.parts.length)) return st.chapters;
      var d = duration();
      if (!d) return null;
      var src = deps.chapters ? deps.chapters() : null;
      var items = src && Array.isArray(src.items) ? src.items.map(function (x) { return { t: D.secondsOf(x.time), title: x.title }; }) : [];
      var yt = D.chaptersOf(items, d) || D.chaptersFromText(src && src.text, d);
      st.chapters = yt || D.stretchChapters(d, P.clockOf);
      st.chaptersKind = yt ? 'yt' : 'stretch';
      return st.chapters;
    }

    /** Ask for the chapter at `from` (and the next one) in `lng`; the reply
     *  carries every chapter already written. */
    function loadKeypoints(from, lng) {
      var chapters = chaptersNow();
      if (!st || !chapters || st.video.status !== 'ok') return;
      var id = st.id;
      var key = lng + ':' + from;
      var k = st.insights;
      if (k.asked[key] === 'busy') return;
      k.asked[key] = 'busy';
      k.tries[key] = (k.tries[key] || 0) + 1;
      if (k.status === 'unknown') { k.status = 'writing'; label(); }
      deps.send({ type: 'heddy-desk:keypoints', youtubeId: id, title: deps.title(), lang: lng, chapters: chapters, from: from }).then(function (r) {
        if (!st || st.id !== id) return;
        var k2 = st.insights;
        k2.asked[key] = true;
        if (!r || !r.ok) {
          // Nothing from the site yet (signed out, refused, offline): the tab stays as it was before.
          if (!k2.parts.length) k2.status = 'unavailable';
          k2.failedAt[key] = Date.now();
        } else {
          if (lng === 'en') {
            k2.parts = r.chapters.map(function (c) { return { startSec: c.startSec, endSec: c.endSec, title: c.title, text: c.text, points: c.points, written: c.written }; });
            k2.status = r.status === 'writing' || r.status === 'failed' ? (k2.parts.some(function (p) { return p.text; }) ? 'ok' : r.status) : r.status;
          } else {
            r.chapters.forEach(function (c) { k2.zh[c.startSec] = c.written ? c.text : null; });
            if (r.status === 'locked' && k2.status !== 'locked') k2.zhLocked = true;
          }
          if (r.status === 'writing' && k2.tries[key] < D.ZH_TRIES) {
            k2.asked[key] = 'busy';
            setTimeout(function () { if (st && st.id === id) { st.insights.asked[key] = false; loadKeypoints(from, lng); } }, D.ZH_RETRY_MS);
          } else if (r.status === 'failed') {
            k2.failedAt[key] = Date.now();
          } else {
            k2.done[key] = true;
          }
        }
        label();
        if (st.tab === 'insights') drawPanel();
        else if (st.tab === 'digest' && ui) {
          // The Digest's insights card follows, without redrawing the list.
          var card = ui.pn.querySelector('.dnote');
          if (card) card.replaceWith(insightsNote(viewNow()));
        }
      });
    }

    /** The player's chapter, written in each language the view shows: ask
     *  for it when it has not been asked for (or failed more than the site's
     *  10-minute window ago). Called on the clock. */
    function wantKeypoints() {
      if (!st || st.video.status !== 'ok' || st.insights.status === 'locked' || st.insights.status === 'none' || st.insights.status === 'unavailable') return;
      var chapters = chaptersNow();
      if (!chapters) return;
      var i = Math.max(0, D.chapterAt(chapters, now()));
      var from = chapters[i].startSec;
      var langs = ['en'];
      if (viewNow() !== 'en' || lang === 'zh_CN') langs.push('zh');
      langs.forEach(function (lng) {
        var key = lng + ':' + from;
        var k = st.insights;
        var part = k.parts.filter(function (p) { return p.startSec === from; })[0];
        var have = lng === 'en' ? part && (part.written || k.done[key]) : k.zh[from] || k.done[key];
        if (have || k.asked[key] === 'busy') return;
        if (k.failedAt[key] && Date.now() - k.failedAt[key] < D.ZH_FAIL_RETRY_MS) return;
        if (k.asked[key] === true && !k.failedAt[key]) return;
        delete k.failedAt[key];
        loadKeypoints(from, lng);
      });
    }

    /** Write notes on a chapter the player has not reached (Classroom's). */
    function writeChapter(from) {
      var k = st.insights;
      ['en'].concat(viewNow() !== 'en' || lang === 'zh_CN' ? ['zh'] : []).forEach(function (lng) {
        delete k.failedAt[lng + ':' + from];
        k.asked[lng + ':' + from] = false;
        loadKeypoints(from, lng);
      });
      if (st.tab === 'insights') drawPanel();
    }

    /** D92, Classroom's locked block: the line, See plans ↗ (a page on
     *  aitutors.me, in a tab, and it says so), Keep watching. */
    function lockedBlock(title, body) {
      var box = noteBox(title, body);
      var row = el('span', 'btnrow');
      var plans = btn('btn', null, tr('digestLockedCta'));
      plans.insertAdjacentHTML('beforeend', ic('out'));
      plans.title = tr('digestLockedCtaTitle');
      plans.addEventListener('click', function () { openSite('/pricing'); });
      var keep = btn('lnk', null, tr('digestKeepWatching'));
      keep.addEventListener('click', function () {
        var p = doc.querySelector(SEL.player);
        if (p && p.scrollIntoView) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      row.appendChild(plans);
      row.appendChild(keep);
      box.appendChild(row);
      return box;
    }

    /** Insights (clip-digest.css .cp-dg__parts): each part's time and
     *  serif title in the subject ink, the paragraph justified, the part the
     *  player is in marked; Add to my Jots puts the parts on the Jot tab as
     *  the professor's jots (tinted), kept on this device until Save. */
    function drawInsights(pn) {
      var s = st.insights;
      if (s.status === 'writing' && !s.parts.some(function (p) { return p.text; })) {
        var w = el('p', 'reading');
        w.appendChild(el('span', 'clock'));
        w.appendChild(doc.createTextNode(tr('insightsWriting', profName())));
        pn.appendChild(w);
        pn.appendChild(el('p', 'fine', tr('insightsWritingFine')));
        return;
      }
      if (s.status === 'none') return pn.appendChild(noteBox(tr('digestNoCaptionsTitle'), tr('digestNoCaptionsBody')));
      if (s.status === 'locked') {
        // Classroom's Insights line names the subject; Mentor's video has none.
        var code = st.video.professor && st.video.professor.code;
        return pn.appendChild(lockedBlock(null, code ? tr('insightsLocked', profName(), tr('subj' + code)) : tr('digestLockedBody', profName())));
      }
      var view = viewNow();
      var sc = el('div', 'sc');
      var p0 = st.video.professor;
      if (p0 && p0.code) sc.setAttribute('data-subj', p0.code);
      sc.appendChild(el('p', 'dlb', tr('insightsHead', profName())));
      var add = el('div', 'insadd');
      var written = s.parts.filter(function (p) { return p.text; });
      var pill = el('button', 'addj');
      pill.type = 'button';
      pill.insertAdjacentHTML('beforeend', ic(st.insightsAdded ? 'tick' : 'jot'));
      pill.appendChild(doc.createTextNode(tr(st.insightsAdded ? 'insightsAdded' : 'insightsAdd')));
      if (st.insightsAdded) { pill.setAttribute('data-added', ''); pill.setAttribute('aria-disabled', 'true'); }
      else if (!written.length) pill.setAttribute('aria-disabled', 'true');
      else pill.addEventListener('click', function () { addInsights(written); });
      add.appendChild(pill);
      sc.appendChild(add);
      var list = el('ul', 'ins');
      var t = now();
      ui.insRows = [];
      s.parts.forEach(function (p, k) {
        var row = el('li');
        var next = s.parts[k + 1];
        if (t >= p.startSec && (!next || t < next.startSec)) row.setAttribute('aria-current', 'true');
        var hd = el('div', 'parthd');
        var stamp = el('button', 'ts2', P.clockOf(p.startSec));
        stamp.type = 'button';
        stamp.title = tr('digestSeek', P.clockOf(p.startSec));
        stamp.addEventListener('click', function () { seek(p.startSec); });
        hd.appendChild(stamp);
        hd.appendChild(el('span', 'pttl', p.title));
        row.appendChild(hd);
        var zh = view !== 'en' ? s.zh[p.startSec] : null;
        if (p.text) {
          var para = el('p', null, view === 'zh' && zh ? zh : p.text);
          if (view === 'zh' && zh) para.setAttribute('lang', 'zh-Hans');
          row.appendChild(para);
          if (view === 'bi' && zh) {
            var pz = el('p', 'pzh', zh);
            pz.setAttribute('lang', 'zh-Hans');
            row.appendChild(pz);
          }
        } else {
          var keyEn = 'en:' + p.startSec;
          var note = el('p', 'pnote');
          if (s.asked[keyEn] === 'busy') {
            note.appendChild(el('span', 'clock'));
            note.appendChild(doc.createTextNode(tr('insightsWriting', profName())));
          } else if (s.failedAt[keyEn]) {
            note.appendChild(doc.createTextNode(tr('insightsFailed', profName())));
          } else if (s.done[keyEn]) {
            note.appendChild(doc.createTextNode(tr('insightsNoTranscript')));
          } else {
            var wn = el('button', 'addj', tr('overviewWriteNotes'));
            wn.type = 'button';
            wn.addEventListener('click', function () { writeChapter(p.startSec); });
            note.appendChild(wn);
          }
          row.appendChild(note);
        }
        list.appendChild(row);
        ui.insRows.push({ el: row, from: p.startSec });
      });
      sc.appendChild(list);
      pn.appendChild(sc);
    }

    /** Add to my Jots (DigestInsights): each written part as the professor's
     *  jot at its time. */
    function addInsights(parts) {
      var jots = st.jots;
      parts.forEach(function (p) {
        // A jot at the chapter's start with the paragraph (r11b), "From insights".
        var text = p.text;
        var id = newId();
        var next = D.note(jots, { id: id, t: p.startSec, text: text });
        if (next) jots = next.map(function (j) { return j.id === id ? Object.assign({}, j, { by: 'professor' }) : j; });
      });
      st.jots = jots;
      st.insightsAdded = true;
      saveJots();
      label();
      drawPanel();
    }

    // ─── the clock: the time, the line being spoken, the next stretch ───────

    function tick() {
      if (!ui || !st) return;
      var t = now();
      wantKeypoints();
      // Insights: the part the player is in wears its edge.
      if (ui.insRows && ui.insRows.length && ui.insRows[0].el.isConnected) {
        ui.insRows.forEach(function (r, k) {
          var next = ui.insRows[k + 1];
          var on = t >= r.from && (!next || t < next.from);
          if ((r.el.getAttribute('aria-current') === 'true') !== on) {
            if (on) r.el.setAttribute('aria-current', 'true');
            else r.el.removeAttribute('aria-current');
          }
        });
      }
      var d = duration();
      ui.vtime.textContent = tr('deskTimeOnTab', P.clockOf(t), d ? P.clockOf(d) : '–:––');
      if (ui.field && ui.field.isConnected) {
        var at = P.clockOf(st.noteT === null ? t : st.noteT);
        var ph = tr('deskJotPlaceholder', at);
        if (ui.field.placeholder !== ph) ui.field.placeholder = ph;
        if (ui.chip && ui.chip.textContent !== at) {
          ui.chip.textContent = at;
          ui.chip.title = tr('deskJotReplay', at);
        }
      }
      if (ui.lines && ui.lines.box.isConnected) {
        var i = D.lineAt(st.transcript.lines, t);
        if (i !== st.nowIdx) {
          var old = ui.lines.rows[st.nowIdx];
          if (old) { old.classList.remove('now'); old.removeAttribute('aria-current'); }
          var row = ui.lines.rows[i];
          if (row) {
            row.classList.add('now');
            row.setAttribute('aria-current', 'true');
            // The list holds still while Pi's tray is open on a line.
            if (Date.now() - lastScroll > FOLLOW_PAUSE_MS && !st.query && !st.sel) {
              var box = ui.lines.sc;
              var top = row.offsetTop - box.offsetTop;
              if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
                box.scrollTop = Math.max(0, top - box.clientHeight / 3);
              }
            }
          }
          st.nowIdx = i;
        }
        // Jump to now while the line being spoken is out of the list's view.
        if (ui.lines.jump) {
          var nr = ui.lines.rows[st.nowIdx];
          var lb = ui.lines.sc;
          var off = !!nr && !st.query && (nr.offsetTop - lb.offsetTop + nr.offsetHeight < lb.scrollTop || nr.offsetTop - lb.offsetTop > lb.scrollTop + lb.clientHeight);
          if (ui.lines.jump.hidden === off) ui.lines.jump.hidden = !off;
        }
        wantZh();
      }
    }

    // ─── language ────────────────────────────────────────────────────────────

    /** EN | 中 is Heddy's Language setting (D73), the options page's value. */
    function pickLang(next) {
      if (next === lang) return;
      var o = {};
      o[I.STORAGE_KEY] = next;
      Promise.resolve().then(function () { return chrome.storage.sync.set(o); }).catch(function () {});
      api.setLang(next);
    }

    // ─── the API youtube.js drives ──────────────────────────────────────────

    var api = {
      isOpen: function () { return !!host && !!st; },

      /** lib/desk-ask.js openAsk: the crest selected, the Ask view drawn. */
      openAsk: function (ctx, intent, text) {
        if (!st) return;
        askAt = ctx && typeof ctx.at === 'number' && isFinite(ctx.at) ? ctx.at : null;
        askView.open(ctx);
        st.tab = 'ask';
        st.sel = null;
        label();
        drawPanel();
        askView.start(intent, text);
      },
      pinned: function () { return prefs.pin; },

      /** Load the device's choices: 📌, the chevron, the Digest's view. */
      loadPrefs: function () {
        return local([PREF.tall, PREF.pin, PREF.view, PREF.note, PREF.fine]).then(function (got) {
          prefs.noteOpen = got[PREF.note] === true;
          prefs.fineHidden = got[PREF.fine] === true;
          prefs.tall = got[PREF.tall] === true;
          prefs.pin = got[PREF.pin] === true;
          prefs.view = D.VIEWS.indexOf(got[PREF.view]) >= 0 ? got[PREF.view] : null;
          return prefs;
        });
      },

      open: function () {
        var id = deps.youtubeId();
        if (!id) return;
        if (st && st.id === id) return;
        if (st) api.close(true);
        st = fresh(id);
        if (!host) build();
        ui.shown = null; // a new video: the pill is placed, not slid
        ui.geo = null;
        ui.img.hidden = false;
        ui.img.src = FS.thumbUrl(id) || '';
        label();
        drawPanel();
        place();
        clearInterval(timer);
        timer = setInterval(tick, TICK_MS);
        deps.onOpenChange(true);
        loadJots(id).then(function (jots) {
          if (!st || st.id !== id) return;
          st.jots = jots;
          label();
          if (st.tab === 'jot') drawPanel();
        });
        deps.send({ type: 'heddy-desk:video', youtubeId: id, title: deps.title() }).then(function (r) {
          if (!st || st.id !== id) return;
          if (r && r.ok && r.signedIn === false) {
            st.video = { status: 'signedOut', professor: null, jotterHref: null };
            st.insights.status = 'unavailable';
          } else if (r && r.ok) {
            st.video = { status: 'ok', professor: r.professor, jotterHref: r.jotterHref };
            loadTranscript();
          } else {
            // 'forbidden': aitutors.me does not know this copy of Heddy (an
            // unpacked build whose id is not on the site's list). Said
            // plainly, with the id, rather than failing quietly everywhere.
            st.video.status = r && r.error === 'unauthenticated' ? 'signedOut' : r && r.error === 'forbidden' ? 'forbidden' : 'error';
            st.insights.status = 'unavailable';
            if (st.video.status === 'error') loadTranscript();
            if (st.video.status === 'forbidden') st.transcript = { status: 'error', lines: [] };
          }
          label();
          drawPanel();
          // Presses made before the site answered, with no transcript coming.
          if (st.video.status !== 'ok' && st.video.status !== 'error' && st.pressed.length) {
            var last = st.pressed[st.pressed.length - 1];
            var byKey = st.pressedByKey;
            st.pressed = [];
            st.pressedByKey = false;
            noteFallback(last, byKey);
          }
        });
      },

      /** ✕, the button again, another video: the suggestions come back. */
      close: function (quiet) {
        hideToast();
        askView.close();
        clearInterval(timer);
        timer = null;
        restoreSuggestions();
        if (host && host.parentNode) host.parentNode.removeChild(host);
        st = null;
        if (!quiet) deps.onOpenChange(false);
      },

      toggle: function () {
        if (api.isOpen()) api.close();
        else api.open();
      },

      /** On every refresh: keep the desk in place, or follow a new video. */
      refresh: function () {
        if (!st) return;
        if (deps.youtubeId() !== st.id) {
          if (prefs.pin && deps.youtubeId()) api.open();
          else api.close();
          return;
        }
        place();
      },

      /** H (D74): the line being spoken into the Jot tab. Whatever the
       *  transcript's state, a press always leaves something on the desk
       *  (the owner's 0.5.0 test: nothing visible happened). */
      /** `key`: pressed with H (Round 11: on any tab, playing, fullscreen),
       *  not the Jot card's button; the child then sees a confirmation even
       *  where the desk is out of sight. */
      pressJot: function (key) {
        if (!st) return;
        var t = st.transcript;
        var at = now();
        if (t.status === 'ok' && t.lines.length) return jotAt(at, false, key);
        if (st.tab !== 'jot') { st.tab = 'jot'; label(); drawPanel(); }
        var canRead = st.video.status !== 'signedOut' && st.video.status !== 'forbidden';
        // On its way (or failed once: read it again): the press waits for it.
        if (canRead && (t.status === 'loading' || t.status === 'idle' || (t.status === 'error' && !st.retried))) {
          st.pressed.push(at);
          if (key) st.pressedByKey = true;
          tell(tr('deskJotWaiting', P.clockOf(at)), key);
          if (t.status === 'error') { st.retried = true; loadTranscript(); }
          return;
        }
        noteFallback(at, key);
      },

      /** Is the child typing in the desk (H is then a letter, not a jot)? */
      isTyping: function () {
        var a = shadow && shadow.activeElement;
        return !!a && root.HeddyJotKey.isTypingTarget(a);
      },

      /** Jots changed in storage (the courier dropped the ones Full desk carried). */
      storageChanged: function (changes) {
        if (!st) return;
        var key = D.storeKey(st.id);
        if (!changes[key]) return;
        var next = D.parseStored(changes[key].newValue);
        if (JSON.stringify(next) === JSON.stringify(st.jots)) return;
        st.jots = next;
        if (st.last && !next.some(function (j) { return j.id === st.last.id; })) st.last = null;
        label();
        if (st.tab === 'jot') drawPanel();
      },

      setLang: function (next) {
        var changed = next !== lang;
        lang = next;
        tr = I.translator(lang);
        if (!st || !changed) return;
        // D73: the language sets the Digest's starting view.
        prefs.view = D.defaultView(lang);
        setLocal(PREF.view, prefs.view);
        retryZh();
        label();
        drawPanel();
        wantZh();
      },

      resize: function () { if (st) place(); },

      /** D76: Heddy was reloaded under the page. */
      destroy: function () {
        api.close(true);
        if (outside) {
          doc.removeEventListener('pointerdown', outside, true);
          doc.removeEventListener('keydown', outside, true);
          outside = null;
        }
        host = null;
        ui = null;
      },
    };
    return api;
  }

  root.HeddyDesk = { create: create };
})(globalThis);
