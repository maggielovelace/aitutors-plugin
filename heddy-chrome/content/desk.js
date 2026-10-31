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
// spoken tinted, a tap on a line seeks) and the 32px foot with the chevron.
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

  var TICK_MS = 250;
  var SAY_MS = 3500;
  var FOLLOW_PAUSE_MS = 4000;
  var PREF = { tall: 'deskTall', pin: 'deskPin', view: 'digestView' };
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

    var st = null; // the open desk's state, per video
    var prefs = { tall: false, pin: false, view: null };

    function fresh(id) {
      return {
        id: id,
        tab: 'jot',
        video: { status: 'loading', professor: null, jotterHref: null },
        transcript: { status: 'idle', lines: [] },
        zh: { stretches: [], asked: {}, tries: {}, state: 'idle', failed: false, locked: false },
        insights: { status: 'unknown', parts: [], tries: 0 },
        jots: [],
        last: null,
        say: null,
        busy: { save: false, full: false },
        saved: null, // after Save to My Jotters: { href, n } (the Saved card, D86)
        showSuggestions: false,
        query: '',
        noteT: null,
        nowIdx: -1,
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
      var layout = D.layoutFor(flexyState());
      var parent = layout === 'column' ? doc.querySelector(SEL.secondaryColumn) : doc.querySelector(SEL.belowPlayer);
      if (!parent) return;
      if (host.parentNode !== parent || parent.firstElementChild !== host) parent.insertBefore(host, parent.firstChild);
      host.classList.toggle('column', layout === 'column');
      host.classList.toggle('below', layout !== 'column');
      host.classList.toggle('light', !deps.isDark());
      var top = mastheadH() + 12;
      host.style.setProperty('--heddy-top', top + 'px');
      hideSuggestions(!st.showSuggestions);
      size(layout, top);
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
      });
      ui.cd.style.height = h + 'px';
    }

    // ─── drawing ─────────────────────────────────────────────────────────────

    function build() {
      host = doc.createElement('heddy-desk');
      shadow = host.attachShadow({ mode: 'closed' });
      shadow.innerHTML = '<style>' + CSS + '\n' + AV.CSS + '</style>';
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
        b.addEventListener('click', function () { pickTab(t[0]); });
        tabEls[t[0]] = b;
        tabs.appendChild(b);
      });
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
          var typing = t && t.tagName === 'INPUT';
          // (The Ask bar's box is an INPUT too: Enter there sends, not YouTube.)
          var activating = t && t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter');
          if (typing || activating) e.stopPropagation();
        });
      });

      ui = { cd: cd, sub: sub, en: en, zh: zh, pin: pin, close: close, img: img, vt: vt, vtime: vtime, full: full, tabs: tabEls, crest: crest, pn: pn, fname: fname, gr: gr, more: more };
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
      });
      ui.tabs.jot.querySelector('small').textContent = String(st.jots.length);
      ui.tabs.jot.querySelector('small').hidden = !st.jots.length;
      ui.crest.title = tr('deskAsk', profName());
      ui.crest.setAttribute('aria-label', tr('deskAsk', profName()));
      ui.crest.setAttribute('aria-selected', String(st.tab === 'ask'));
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
      label();
      drawPanel();
      if (k === 'digest') wantZh();
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
      if (!ui || !st) return;
      var pn = ui.pn;
      pn.textContent = '';
      ui.lines = null;
      ui.field = null;
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
      var jk = btn('jk', ic('jot'));
      var words = el('span', null, tr('deskJkBtn'));
      words.appendChild(el('small', null, tr('deskJkSub')));
      jk.appendChild(words);
      jk.appendChild(el('span', 'kbd', 'H'));
      jk.addEventListener('click', function () { api.pressJot(); });
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

      if (!st.jots.length) {
        sc.appendChild(el('p', 'empty', tr('deskJotsEmpty')));
      } else {
        var ls = el('ul', 'ls');
        st.jots.forEach(function (j) {
          var li = el('li');
          var stamp = btn('st', null, P.clockOf(j.t));
          stamp.title = tr('deskJotReplay', P.clockOf(j.t));
          stamp.addEventListener('click', function () { seek(j.t); });
          li.appendChild(stamp);
          li.appendChild(j.kind === 'line' ? el('q', null, j.text) : el('span', 'tx', j.text));
          var del = btn('del', null, '✕');
          del.setAttribute('aria-label', tr('deskJotDelete'));
          del.title = tr('deskJotDelete');
          del.addEventListener('click', function () {
            st.jots = D.removeIds(st.jots, [j.id]);
            if (st.last && st.last.id === j.id) st.last = null;
            saveJots();
            label();
            drawPanel();
          });
          li.appendChild(del);
          ls.appendChild(li);
        });
        sc.appendChild(ls);
      }
      pn.appendChild(sc);

      // The composer: "Jot at m:ss…" and the round Jot button.
      var cp = el('div', 'cp');
      var field = el('input', 'fld');
      field.type = 'text';
      field.maxLength = 2000;
      field.setAttribute('aria-label', tr('deskJotPlaceholder', P.clockOf(now())));
      field.addEventListener('input', function () { if (st.noteT === null && field.value) st.noteT = now(); });
      field.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addNote(); } });
      var go = btn('go', ic('jot'), tr('deskJotButton'));
      go.addEventListener('click', addNote);
      cp.appendChild(field);
      cp.appendChild(go);
      pn.appendChild(cp);
      ui.field = field;
      tick();
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

    function say(text) {
      if (!st) return;
      st.say = text;
      clearTimeout(sayTimer);
      if (ui && ui.say) {
        ui.say.textContent = text || '';
        ui.say.hidden = !text;
      }
      if (text) sayTimer = setTimeout(function () { say(null); }, SAY_MS);
    }

    function addNote() {
      if (!st || !ui.field) return;
      var t = st.noteT === null ? now() : st.noteT;
      var next = D.note(st.jots, { id: newId(), t: t, text: ui.field.value });
      if (!next) {
        if (st.jots.length >= D.MAX_JOTS) say(tr('deskJotsFull'));
        return;
      }
      st.jots = next;
      st.noteT = null;
      ui.field.value = '';
      saveJots();
      label();
      drawPanel();
      if (ui.field) ui.field.focus();
    }

    function saveToJotters() {
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
      deps.send({
        type: 'heddy-ui:capture',
        youtubeId: st.id,
        startSec: null,
        then: 'classroom',
        jots: D.wireJots(jots),
        jotIds: jots.map(function (j) { return j.id; }),
      }).then(function () {
        if (!st) return;
        st.busy.full = false;
        ui.full.removeAttribute('aria-busy');
      });
    }

    /** The crest (artifact ③, D80, D84): the desk's Ask view, about this
     *  video at this second. lib/desk-ask.js openAsk is the one way in. */
    function ask() {
      if (!st) return;
      root.HeddyDeskAsk.openAsk({ about: 'video' }, api, 'ask');
    }

    // The Ask view (lib/ask-view.js). The background reads the video's
    // address from this tab and adds the player's second (`t`).
    var askView = AV.create({
      doc: doc,
      tr: function () { return tr; },
      lang: function () { return lang; },
      connect: function () { return chrome.runtime.connect({ name: 'heddy-ask' }); },
      extra: function () { return { t: now() }; },
      site: function () { return 'youtube.com'; },
      fallbackName: profName,
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
      if (t.status === 'idle' || t.status === 'loading') {
        pn.appendChild(noteBox(null, tr('digestReading', profName())));
        return;
      }
      if (t.status === 'none') {
        pn.appendChild(noteBox(tr('digestNoCaptionsTitle'), tr('digestNoCaptionsBody')));
        return;
      }
      if (t.status === 'locked') {
        pn.appendChild(noteBox(tr('digestLockedTitle', profName()), tr('digestLockedBody', profName())));
        return;
      }
      if (t.status !== 'ok') {
        var box = noteBox(null, tr('digestFailed', profName()));
        var again = btn('', null, tr('digestTryAgain'));
        again.addEventListener('click', function () { loadTranscript(); });
        box.appendChild(again);
        pn.appendChild(box);
        return;
      }

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
          drawPanel();
          wantZh();
        });
        seg.appendChild(b);
      });
      dgt.appendChild(seg);
      var q = el('input', 'srch2');
      q.type = 'search';
      q.placeholder = tr('digestSearch');
      q.setAttribute('aria-label', tr('digestSearchLabel'));
      q.value = st.query;
      q.addEventListener('input', function () { st.query = q.value; drawLines(); });
      dgt.appendChild(q);
      pn.appendChild(dgt);

      var d = duration();
      pn.appendChild(el('p', 'dlb', tr('digestTranscript', '0:00', P.clockOf(d || (t.lines.length ? t.lines[t.lines.length - 1].t : 0)))));
      if (view !== 'en') {
        if (st.zh.locked) pn.appendChild(el('p', 'empty', tr('digestLockedBody', profName())));
        else if (st.zh.failed) pn.appendChild(el('p', 'empty', tr('digestZhFailed')));
        else if (st.zh.state === 'writing') pn.appendChild(el('p', 'empty', tr('digestReadingZh', profName())));
      }
      var sc = el('div', 'sc');
      sc.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });
      sc.addEventListener('wheel', function () { lastScroll = Date.now(); }, { passive: true });
      var lns = el('div', 'lns');
      sc.appendChild(lns);
      pn.appendChild(sc);
      ui.lines = { sc: sc, box: lns, rows: [] };
      ui.lines.sc.dataset.view = view;
      drawLines();
    }

    function drawLines() {
      if (!ui.lines) return;
      var lines = st.transcript.lines;
      var view = viewNow();
      var box = ui.lines.box;
      box.textContent = '';
      ui.lines.rows = [];
      var only = D.matches(lines, st.query, zhOf);
      if (only && !only.length) {
        box.appendChild(el('p', 'empty', tr('digestNoMatches')));
        return;
      }
      (only || lines.map(function (_, i) { return i; })).forEach(function (i) {
        var l = lines[i];
        var row = btn('ln');
        row.title = tr('digestSeek', P.clockOf(l.t));
        row.appendChild(el('span', 'ts', P.clockOf(l.t)));
        var body = el('span');
        var z = view === 'en' ? null : zhOf(l);
        if (view === 'zh' && z) {
          var only2 = el('span', 'zh only', z);
          only2.setAttribute('lang', 'zh-Hans');
          body.appendChild(only2);
        } else {
          body.appendChild(doc.createTextNode(l.text));
          if (view === 'bi' && z) {
            var zz = el('span', 'zh', z);
            zz.setAttribute('lang', 'zh-Hans');
            body.appendChild(zz);
          }
        }
        row.appendChild(body);
        row.addEventListener('click', function () { seek(l.t); });
        box.appendChild(row);
        ui.lines.rows[i] = row;
      });
      st.nowIdx = -2;
      tick();
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
      if (st.tab === 'digest') drawPanel();
      deps.send({ type: 'heddy-desk:transcript', youtubeId: id, title: deps.title() }).then(function (r) {
        if (!st || st.id !== id) return;
        if (r && r.ok) st.transcript = { status: r.status, lines: r.lines || [] };
        else if (r && r.error === 'unauthenticated') { st.video.status = 'signedOut'; st.transcript = { status: 'error', lines: [] }; }
        else st.transcript = { status: 'error', lines: [] };
        if (st.transcript.status === 'ok' && r.zh) addStretch(r.zh);
        label();
        drawPanel();
        wantZh();
      });
    }

    function addStretch(z) {
      st.zh.stretches = st.zh.stretches.filter(function (s) { return s.from !== z.from; }).concat([z]);
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
          state = 'failed';
        }
        var before = st.zh.state;
        st.zh.state = state;
        if (st.tab === 'digest' && (state !== 'writing' || before !== 'writing')) drawPanel();
      });
    }

    // ─── Insights (contract § 3: live only when the site serves it) ─────────

    function loadInsights() {
      var id = st.id;
      deps.send({ type: 'heddy-desk:insights', youtubeId: id, lang: lang === 'zh_CN' ? 'zh' : 'en' }).then(function (r) {
        if (!st || st.id !== id) return;
        if (!r || !r.ok) {
          st.insights = { status: 'unavailable', parts: [], tries: st.insights.tries };
        } else {
          st.insights = { status: r.status, parts: r.parts || [], tries: st.insights.tries + 1 };
          if (r.status === 'writing' && st.insights.tries < D.ZH_TRIES) setTimeout(function () { if (st && st.id === id) loadInsights(); }, D.ZH_RETRY_MS);
        }
        label();
        if (st.tab === 'insights') drawPanel();
      });
    }

    function drawInsights(pn) {
      var s = st.insights;
      if (s.status === 'writing' && !s.parts.some(function (p) { return p.text; })) return pn.appendChild(noteBox(null, tr('insightsWriting', profName())));
      if (s.status === 'none') return pn.appendChild(noteBox(tr('digestNoCaptionsTitle'), tr('digestNoCaptionsBody')));
      if (s.status === 'locked') return pn.appendChild(noteBox(tr('digestLockedTitle', profName()), tr('digestLockedBody', profName())));
      var sc = el('div', 'sc');
      sc.appendChild(el('p', 'dlb', tr('insightsHead', profName())));
      var list = el('div', 'ins');
      s.parts.forEach(function (p) {
        var row = el('div');
        var stamp = btn('st', null, P.clockOf(p.startSec));
        stamp.addEventListener('click', function () { seek(p.startSec); });
        row.appendChild(stamp);
        row.appendChild(el('b', null, p.title || (p.minutes ? tr('insightsBand', String(p.minutes.from), String(p.minutes.to)) : '')));
        row.appendChild(el('p', null, p.text || tr('insightsFailed', profName())));
        list.appendChild(row);
      });
      sc.appendChild(list);
      pn.appendChild(sc);
    }

    // ─── the clock: the time, the line being spoken, the next stretch ───────

    function tick() {
      if (!ui || !st) return;
      var t = now();
      var d = duration();
      ui.vtime.textContent = tr('deskTimeOnTab', P.clockOf(t), d ? P.clockOf(d) : '–:––');
      if (ui.field && ui.field.isConnected) {
        var ph = tr('deskJotPlaceholder', P.clockOf(st.noteT === null ? t : st.noteT));
        if (ui.field.placeholder !== ph) ui.field.placeholder = ph;
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
            if (Date.now() - lastScroll > FOLLOW_PAUSE_MS && !st.query) {
              var box = ui.lines.sc;
              var top = row.offsetTop - box.offsetTop;
              if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
                box.scrollTop = Math.max(0, top - box.clientHeight / 3);
              }
            }
          }
          st.nowIdx = i;
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
      openAsk: function (ctx, intent) {
        if (!st) return;
        askView.open(ctx);
        st.tab = 'ask';
        label();
        drawPanel();
        askView.start(intent);
      },
      pinned: function () { return prefs.pin; },

      /** Load the device's choices: 📌, the chevron, the Digest's view. */
      loadPrefs: function () {
        return local([PREF.tall, PREF.pin, PREF.view]).then(function (got) {
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
            loadInsights();
          } else {
            st.video.status = r && r.error === 'unauthenticated' ? 'signedOut' : 'error';
            st.insights.status = 'unavailable';
            if (st.video.status === 'error') loadTranscript();
          }
          label();
          drawPanel();
        });
      },

      /** ✕, the button again, another video: the suggestions come back. */
      close: function (quiet) {
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

      /** H (D74): the line being spoken into the Jot tab. */
      pressJot: function () {
        if (!st) return;
        var t = st.transcript;
        if (t.status !== 'ok' || !t.lines.length) {
          say(t.status === 'loading' ? tr('digestReading', profName()) : tr('deskNoTranscript'));
          return;
        }
        var r = D.press({ jots: st.jots, last: st.last }, { now: Date.now(), t: now(), lines: t.lines, id: newId() });
        if (r.result === 'noLine') return say(tr('deskNoLine'));
        if (r.result === 'full') return say(tr('deskJotsFull'));
        st.jots = r.jots;
        st.last = r.last;
        saveJots();
        label();
        if (st.tab === 'jot') drawPanel();
      },

      /** Is the child typing in the desk (H is then a letter, not a jot)? */
      isTyping: function () {
        var a = shadow && shadow.activeElement;
        return !!a && a.tagName === 'INPUT';
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
        label();
        drawPanel();
        wantZh();
      },

      resize: function () { if (st) place(); },

      /** D76: Heddy was reloaded under the page. */
      destroy: function () {
        api.close(true);
        host = null;
        ui = null;
      },
    };
    return api;
  }

  root.HeddyDesk = { create: create };
})(globalThis);
