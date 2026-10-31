// popup/web-desk.js — the desk on any web page (PRD-v0.96.0 § 1i, D79–D84;
// artifact round-8-youtube-desk.html #web "the web desk, as decided", #collect
// "Decided", #saving — the spec, matched literally).
//
// Drawn in the panel's frame (content/panel.js docks it on the right and
// narrows the page; D79), or in the toolbar popup where a page is closed to
// Heddy. The same desk as on YouTube: the header (eyes, Heddy, "aitutors for
// KS3 & GCSE", EN | 中, ✕), the tab row, the 32 px foot "Mentor's desk".
// Its tabs (D80): one text tab, Sources, with the count, then the Heddy crest,
// which is the Ask tab.
//
// Sources (D81–D83):
//   "In this save · 1 snippet · 2 pictures", today's cards exactly (⠿, the
//   number, ↑ ↓ ✕, the child's order), + Text / + Picture under the list.
//   The save block: "Also keep the article's text ⓘ" (the ⓘ on hover or
//   tap), "Save 3 to my Jotters", Read it · Jot it · Get it.
//   Nothing picked: the empty box, + Text / + Picture, the page card, and
//   "Save this page to my Jotters" (the article; no checkbox).
//   Saving: the cards dimmed, the spinner. Saved: the green card with Open my
//   Jotter ↗ (the only tab, on tap) and Undo. A failure keeps the sources;
//   signed out offers Sign in.
//
// Ask (D84): lib/ask-view.js, opened by the crest or by Heddy ▾ on the
// page (lib/web-routes.js leaves a pending ask for this tab and says so).
//
// The list lives in Heddy's background (lib/cards.js); every page string (a
// card's quote, the page's title) is set as text.
(function (root) {
  var A = root.HeddyDeskAsk;
  var AV = root.HeddyAskView;
  var DK = root.HeddyDeskShell;
  var TT = root.HeddyTrayTools;
  var I = root.HeddyI18n;
  var CARDS = root.HeddyCards;

  var SANS = 'Manrope,Roboto,Arial,sans-serif';
  var SERIF = '"Source Serif 4",Georgia,"Times New Roman",serif';
  var MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace';

  function ic(n) {
    return '<svg class="vi" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + DK.IC[n] + '</svg>';
  }

  // The artifact's R9 web-desk CSS, on top of the desk's own (lib/desk-shell.js)
  // and the Ask view's (lib/ask-view.js).
  var CSS = [
    'html,body{height:100%}',
    'body.webdesk{width:auto;height:100vh;margin:0;background:transparent;overflow:hidden}',
    'body.webdesk.inpopup{width:410px;height:600px;background:#fdfcf8}',
    'body.webdesk > .pop{display:none}',
    '.cd.web{height:100%;--sc:#0d7565;--sc-soft:#dcf1ec}',
    'body.inpopup .cd.web{border:0;border-radius:0}',
    '.cd.web .hd .x{margin-left:10px}',
    '.cd.web .sc{gap:14px}',
    // the cards (the artifact's .cl)
    '.cd .cl{list-style:none;margin:0;padding:0;display:grid;gap:8px}',
    '.cd .cl li{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:8px 10px;outline:0}',
    '.cd .cl li:focus-visible{box-shadow:0 0 0 2px var(--sc)}',
    '.cd .cl li.drag{box-shadow:0 8px 20px rgba(0,20,50,.18);position:relative;z-index:1}',
    '.cd .cl .gp{color:#a0a7b1;font:700 14px ' + MONO + ';cursor:grab;touch-action:none;user-select:none;flex:none}',
    '.cd .cl .n{width:22px;height:22px;border-radius:50%;background:#2f8a57;color:#fff;font:800 11px ' + SANS + ';display:grid;place-items:center;flex:none}',
    '.cd .cl .t{flex:1;min-width:0;font:500 13.5px/1.35 ' + SERIF + ';color:var(--ink);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}',
    '.cd .cl .th{width:58px;height:34px;border-radius:6px;background:linear-gradient(135deg,#dbe6f5,#9fb4d6);flex:none;object-fit:cover;display:block}',
    '.cd .cl .ar{display:flex;gap:2px;flex:none}',
    '.cd .cl .ar button{width:18px;height:22px;display:grid;place-items:center;color:#9aa1ab;font:700 12px ' + SANS + ';border-radius:5px}',
    '.cd .cl .ar button:hover:not(:disabled){color:var(--ink-deep);background:var(--sunk)}',
    '.cd .cl .ar button:disabled{opacity:.35;cursor:default}',
    '.cd .cl.dim li{opacity:.55}',
    '.cd .cl[aria-busy="true"] li{pointer-events:none}',
    // + Text / + Picture (the artifact's .pr2)
    '.cd .pr2{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:none}',
    '.cd .pr2 button{height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;font:700 13px ' + SANS + ';color:#1f6a40;border:1.5px dashed #c9c0ad;background:#fdfcf8}',
    '.cd .pr2 button[aria-pressed="true"]{border:1.5px solid #b9dcc6;background:#eef7f1}',
    '.cd .pr2 svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    // nothing picked (.empty, .pgcard)
    '.cd.web .empty{border:1.5px dashed var(--line-strong);border-radius:12px;padding:16px 14px;display:grid;gap:6px;text-align:center;color:var(--muted);font:500 13px/1.45 ' + SANS + ';flex:none;margin:0}',
    '.cd.web .empty b{font:700 14px ' + SANS + ';color:var(--ink-deep)}',
    '.cd .pgcard{border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px 12px;display:grid;gap:4px;flex:none}',
    '.cd .pgcard small{font:600 10.5px ' + MONO + ';letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}',
    '.cd .pgcard b{font:600 14px/1.35 ' + SERIF + ';color:var(--ink-deep);overflow-wrap:anywhere}',
    '.cd .pgcard span{font:500 12.5px/1.45 ' + SANS + ';color:var(--ink-soft)}',
    // the save block (.svb, .chk, .inf, .steps)
    '.cd .svb{margin-top:auto;margin-inline:-18px;padding:12px 18px 14px;border-top:1px solid var(--line);display:grid;gap:9px;flex:none;background:var(--surface)}',
    '.cd .svb .sgo{height:42px;border-radius:12px;background:var(--ink-deep);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 14px ' + SANS + '}',
    '.cd .svb .sgo.busy{background:#3a5070;gap:10px;cursor:progress}',
    '.cd .spin{width:16px;height:16px;border-radius:50%;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;box-sizing:border-box;animation:heddy-spin .8s linear infinite;flex:none}',
    '@keyframes heddy-spin{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion:reduce){.cd .spin{animation-duration:2.4s}}',
    '.cd .chk{display:flex;align-items:center;gap:9px;font:600 12.5px/1.4 ' + SANS + ';color:var(--ink);cursor:pointer;position:relative}',
    '.cd .chk input{position:absolute;opacity:0;width:16px;height:16px;margin:0;left:0;top:50%;transform:translateY(-50%)}',
    '.cd .chk i{width:16px;height:16px;border:1.5px solid var(--line-strong);border-radius:4px;flex:none;background:#fff;box-sizing:border-box;display:grid;place-items:center;color:#fff;font:800 11px/1 ' + SANS + ';font-style:normal}',
    '.cd .chk input:checked + i{background:var(--ink-deep);border-color:var(--ink-deep)}',
    '.cd .chk input:focus-visible + i{outline:2px solid var(--sc);outline-offset:2px}',
    '.cd .inf{position:relative;display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--muted);color:var(--muted);font:800 10px/1 ' + SERIF + ';font-style:italic;vertical-align:1px;margin-left:4px;cursor:help;box-sizing:border-box}',
    '.cd .inf em{display:none;position:absolute;bottom:24px;left:50%;transform:translateX(-50%);width:230px;background:#14253f;color:#fff;font:500 12px/1.45 ' + SANS + ';font-style:normal;border-radius:9px;padding:8px 10px;box-shadow:0 8px 20px rgba(0,0,0,.25);z-index:3;text-align:left}',
    '.cd .inf:hover em,.cd .inf:focus-visible em,.cd .inf.show em{display:block}',
    '.cd .steps{display:flex;justify-content:center;gap:16px;font:600 12px ' + SANS + ';color:var(--muted)}',
    '.cd .steps span{display:flex;align-items:center;gap:5px}.cd .steps b{color:var(--ink-deep)}',
    '.cd .steps svg{width:15px;height:15px;fill:none;stroke:var(--sc);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.cd .svb .faded{opacity:.55}',
    '.cd .serr{margin:0;display:flex;gap:10px;align-items:center;font:600 12.5px/1.4 ' + SANS + ';color:#a33a1c}',
    '.cd .serr span{flex:1}',
    '.cd .serr button{font:700 12.5px ' + SANS + ';color:var(--ink-deep);text-decoration:underline;text-decoration-color:var(--sc);text-underline-offset:3px;white-space:nowrap}',
    '.cd .okc .orow button{cursor:pointer}',
  ].join('\n');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
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

  /** "deeplearning.ai" from the page's address. */
  function hostLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /**
   * o: { tab, lang, origin, host ('panel' | 'popup'), state (heddy-cards:get),
   *      mode ('text' | 'picture'), closeUi() }
   * Returns { setMode(m), refresh(note) }.
   */
  function mount(o) {
    var tab = o.tab;
    var lang = o.lang;
    var tr = I.translator(lang);
    var st = {
      cards: (o.state && o.state.cards) || [],
      counts: (o.state && o.state.counts) || { text: 0, image: 0 },
      mode: o.mode === 'picture' ? 'picture' : 'text',
      tab: 'sources',
      article: false,
      saving: false,
      saved: null, // { jotterTitle, href, saveId, counts, undoing }
      error: null, // { key, args, signIn }
      professor: null, // { code, name } once the Ask view's stream names one
      focus: null,
    };
    var ui = {};

    function call(message) {
      return Promise.resolve()
        .then(function () { return chrome.runtime.sendMessage(Object.assign({ tabId: tab.id }, message)); })
        .then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
    }

    /** A page on aitutors.me in a new tab, on the child's tap only (D78);
     *  the background checks the address. */
    function openSite(href) {
      var url = /^https?:/.test(href) ? href : o.origin + href;
      Promise.resolve(chrome.runtime.sendMessage({ type: 'heddy-ui:open', href: url })).catch(function () {});
    }

    function profName() {
      return (st.professor && st.professor.name) || 'Mentor';
    }

    // ─── the shell ───────────────────────────────────────────────────────

    function build() {
      var style = el('style');
      style.textContent = DK.CSS + '\n' + AV.CSS + '\n' + CSS;
      document.head.appendChild(style);
      document.body.classList.add('webdesk');
      if (o.host !== 'panel') document.body.classList.add('inpopup');

      var cd = el('section', 'cd web');
      cd.setAttribute('aria-label', 'Heddy');
      var hd = el('div', 'hd');
      var eyes = el('span', 'eyes');
      eyes.innerHTML = DK.EYES;
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
      var close = btn('', null, '✕');
      close.addEventListener('click', o.closeUi);
      x.appendChild(close);
      hd.appendChild(x);
      cd.appendChild(hd);

      var tabs = el('div', 'tabs');
      tabs.setAttribute('role', 'tablist');
      var sources = btn('tab', ic('jot'));
      sources.setAttribute('role', 'tab');
      sources.appendChild(el('span'));
      sources.appendChild(el('small'));
      sources.addEventListener('click', function () { pickTab('sources'); });
      tabs.appendChild(sources);
      var crest = btn('tab crest', null);
      crest.setAttribute('role', 'tab');
      var ce = el('span', 'eyes');
      ce.innerHTML = DK.EYES;
      crest.appendChild(ce);
      crest.addEventListener('click', function () {
        if (st.tab === 'ask') return;
        if (askView.isOpen()) return pickTab('ask');
        A.openAsk({ about: 'page' }, api, 'ask');
      });
      tabs.appendChild(crest);
      cd.appendChild(tabs);

      var pn = el('div', 'pn');
      pn.setAttribute('role', 'tabpanel');
      cd.appendChild(pn);

      var ft = el('div', 'ft');
      ft.insertAdjacentHTML('beforeend', ic('desk'));
      var fname = el('span');
      ft.appendChild(fname);
      cd.appendChild(ft);

      document.body.appendChild(cd);
      ui = { cd: cd, sub: sub, en: en, zh: zh, close: close, sources: sources, crest: crest, pn: pn, fname: fname };
    }

    function paintColours() {
      var c = A.coloursFor(st.professor && st.professor.code);
      ui.cd.style.setProperty('--sc', c.sc);
      ui.cd.style.setProperty('--sc-soft', c.scSoft);
    }

    /** Every word on the desk in Heddy's language (D73). */
    function label() {
      ui.cd.setAttribute('lang', lang === 'zh_CN' ? 'zh-Hans' : 'en');
      document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
      ui.sub.textContent = tr('deskSub');
      ui.en.setAttribute('aria-pressed', String(lang !== 'zh_CN'));
      ui.zh.setAttribute('aria-pressed', String(lang === 'zh_CN'));
      ui.en.parentNode.setAttribute('aria-label', tr('deskLang'));
      ui.close.title = tr('webDeskClose');
      ui.close.setAttribute('aria-label', tr('webDeskClose'));
      ui.sources.querySelector('span').textContent = tr('webTabSources');
      ui.sources.setAttribute('aria-selected', String(st.tab === 'sources'));
      var n = st.cards.length;
      ui.sources.querySelector('small').textContent = String(n);
      ui.sources.querySelector('small').hidden = !n;
      ui.crest.title = tr('deskAsk', profName());
      ui.crest.setAttribute('aria-label', tr('deskAsk', profName()));
      ui.crest.setAttribute('aria-selected', String(st.tab === 'ask'));
      var mentor = !(st.professor && st.professor.code);
      ui.fname.textContent = mentor ? tr('deskFootMentor') : tr('deskFoot', profName());
      paintColours();
    }

    function pickTab(k) {
      st.tab = k;
      label();
      draw();
    }

    function pickLang(next) {
      if (next === lang) return;
      var s = {};
      s[I.STORAGE_KEY] = next;
      Promise.resolve().then(function () { return chrome.storage.sync.set(s); }).catch(function () {});
      lang = next;
      tr = I.translator(lang);
      label();
      draw();
    }

    function draw() {
      var pn = ui.pn;
      pn.textContent = '';
      askView.detach();
      if (st.tab === 'ask') return askView.draw(pn);
      drawSources(pn);
    }

    // ─── Sources ─────────────────────────────────────────────────────────

    /** "In this save · 1 snippet · 2 pictures" (R5b), or "· nothing picked yet". */
    function countLine() {
      var c = st.counts;
      var parts = [tr('cardsHeading')];
      if (c.text) parts.push(c.text === 1 ? tr('cardsSnippet') : tr('cardsSnippets', String(c.text)));
      if (c.image) parts.push(c.image === 1 ? tr('cardsPicture') : tr('cardsPictures', String(c.image)));
      if (!c.text && !c.image) parts.push(tr('cardsNothingYet'));
      return parts.join(' · ');
    }

    function drawSources(pn) {
      var sc = el('div', 'sc');
      if (st.saved) sc.appendChild(savedCard());
      sc.appendChild(el('p', 'dlb', countLine()));
      var cards = st.cards;
      if (cards.length) {
        var list = el('ul', 'cl' + (st.saving ? ' dim' : ''));
        list.setAttribute('aria-label', tr('webCardsLabel'));
        cards.forEach(function (card, i) { list.appendChild(cardRow(card, i, cards.length)); });
        sc.appendChild(list);
        ui.list = list;
      } else {
        ui.list = null;
        if (!st.saved) {
          var empty = el('div', 'empty');
          empty.appendChild(el('b', null, tr('webEmptyTitle')));
          empty.appendChild(document.createTextNode(tr('webEmptyBody')));
          sc.appendChild(empty);
        }
      }
      sc.appendChild(pair());
      if (!cards.length && !st.saved) {
        var pg = el('div', 'pgcard');
        pg.appendChild(el('small', null, tr('webPageCardHead')));
        pg.appendChild(el('b', null, String(tab.title || hostLabel(tab.url)).replace(/\s+/g, ' ').trim().slice(0, 200)));
        pg.appendChild(el('span', null, tr('webPageCardLine')));
        sc.appendChild(pg);
      }
      pn.appendChild(sc);
      if (!st.saved || cards.length) pn.appendChild(saveBlock());
      refocus();
    }

    /** + Text / + Picture (the R5b pair, D81): the mode that is on is filled. */
    function pair() {
      var pr = el('div', 'pr2');
      pr.setAttribute('role', 'group');
      pr.setAttribute('aria-label', tr('modeSwitchLabel'));
      var t = btn('', TT.sv('plus'), tr('webAddText'));
      var p = btn('', TT.sv('plus'), tr('webAddPicture'));
      t.setAttribute('aria-pressed', String(st.mode === 'text'));
      p.setAttribute('aria-pressed', String(st.mode === 'picture'));
      t.addEventListener('click', function () {
        if (st.saving) return;
        // In Picture mode: back to Text. Box mode ends; its pictures stay.
        if (st.mode === 'picture') return toText();
        if (st.counts.text >= CARDS.MAX_TEXT) return fail('cardsFullText');
        call({ type: 'heddy-cards:add-text' }).then(function (r) {
          if (r.ok) return setState(r);
          if (r.error === 'no_selection') return fail('cardsSelectFirst');
          if (r.error === 'same') return fail('cardsSame', [String(r.n)]);
          if (r.error === 'full_text') return fail('cardsFullText');
          fail('webAddFailed');
        });
      });
      p.addEventListener('click', function () {
        if (st.saving || st.mode === 'picture') return;
        if (st.counts.image >= CARDS.MAX_IMAGES) return fail('cardsFullPictures');
        // Box mode beside the desk; its + Picture adds the cards here.
        call({ type: 'heddy-ui:snap', mode: 'box' });
        setMode('picture');
      });
      pr.appendChild(t);
      pr.appendChild(p);
      return pr;
    }

    function toText() {
      setMode('text');
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () { var b = globalThis.__heddyBoxMode; if (b && b.stop) b.stop(); return true; },
      }).catch(function () {});
    }

    function cardRow(card, i, total) {
      var li = el('li');
      li.setAttribute('data-id', card.id);
      var many = total > 1;
      if (many) {
        // Alt+↑ / Alt+↓ on a focused card, for children who cannot drag (D62).
        li.tabIndex = 0;
        li.addEventListener('keydown', function (e) {
          if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || busy()) return;
          e.preventDefault();
          var to = i + (e.key === 'ArrowUp' ? -1 : 1);
          if (to >= 0 && to < total) moveTo(card, to, 'row');
        });
      }
      var gp = el('span', 'gp', '⠿');
      gp.title = tr('cardDrag');
      gp.setAttribute('aria-hidden', 'true');
      if (many) gp.addEventListener('pointerdown', function (e) { dragFrom(e, li, card); });
      else gp.style.visibility = 'hidden';
      li.appendChild(gp);
      li.appendChild(el('span', 'n', String(card.n)));
      if (card.kind === 'image') {
        var th = el('img', 'th');
        th.alt = '';
        // The crop Heddy cut itself, as a data: URL; nothing is fetched.
        if (/^[A-Za-z0-9+/=]+$/.test(card.png || '')) th.src = 'data:image/png;base64,' + card.png;
        li.appendChild(th);
        li.appendChild(el('span', 't', tr('cardPictureLabel')));
      } else {
        li.appendChild(el('span', 't', String(card.quote || '').replace(/\s+/g, ' ').trim()));
      }
      var ar = el('span', 'ar');
      [['up', -1, 'cardMoveUp', '⌃'], ['down', 1, 'cardMoveDown', '⌄']].forEach(function (m) {
        var b = btn('', null, null);
        b.textContent = m[3];
        b.setAttribute('data-move', m[0]);
        b.setAttribute('aria-label', tr(m[2]));
        b.title = tr(m[2]);
        var to = i + m[1];
        b.disabled = !many || to < 0 || to >= total;
        var then = to === 0 ? 'down' : to === total - 1 ? 'up' : m[0];
        b.addEventListener('click', function () { if (!b.disabled && !busy()) moveTo(card, to, then); });
        ar.appendChild(b);
      });
      var x = btn('', null, null);
      x.textContent = '✕';
      x.setAttribute('aria-label', tr('cardRemove', String(card.n)));
      x.title = tr('cardRemove', String(card.n));
      x.addEventListener('click', function () {
        if (busy()) return;
        call({ type: 'heddy-cards:remove', id: card.id }).then(function (r) { if (r.ok) setState(r); });
      });
      ar.appendChild(x);
      li.appendChild(ar);
      return li;
    }

    function busy() {
      return st.saving || !!(ui.list && ui.list.getAttribute('aria-busy') === 'true');
    }

    /** Card `card` to index `to` (D62); the page renumbers too. */
    function moveTo(card, to, focus) {
      if (ui.list) ui.list.setAttribute('aria-busy', 'true');
      st.focus = { id: card.id, what: focus || 'row' };
      call({ type: 'heddy-cards:move', id: card.id, to: to }).then(function (r) {
        if (r.ok) setState(r);
        else if (ui.list) ui.list.removeAttribute('aria-busy');
      });
    }

    /** ⠿: the card follows the pointer from slot to slot and lands where it
     *  is let go. */
    function dragFrom(e, row, card) {
      var list = ui.list;
      if (e.button !== 0 || busy() || !list) return;
      e.preventDefault();
      var from = Array.prototype.indexOf.call(list.children, row);
      var handle = e.currentTarget;
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      row.classList.add('drag');
      list.setAttribute('aria-busy', 'true');
      function onMove(ev) {
        var rest = Array.prototype.filter.call(list.children, function (r) { return r !== row; });
        var mids = rest.map(function (r) { var b = r.getBoundingClientRect(); return b.top + b.height / 2; });
        var before = rest[CARDS.dropIndex(mids, ev.clientY)] || null;
        if (row.nextSibling !== before) list.insertBefore(row, before);
        Array.prototype.forEach.call(list.children, function (r, k) { r.querySelector('.n').textContent = String(k + 1); });
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

    function refocus() {
      var f = st.focus;
      st.focus = null;
      if (!f || !ui.list) return;
      var row = ui.list.querySelector('li[data-id="' + f.id + '"]');
      if (!row) return;
      var target = f.what === 'row' ? row : row.querySelector('[data-move="' + f.what + '"]');
      (target && !target.disabled ? target : row).focus();
    }

    // ─── the save (D82, D83) ─────────────────────────────────────────────

    function steps() {
      var s = el('div', 'steps');
      [['read', 'stepRead'], ['jot', 'stepJot'], ['get', 'stepGet']].forEach(function (x) {
        var sp = el('span');
        sp.insertAdjacentHTML('beforeend', TT.sv(x[0]));
        sp.appendChild(el('b', null, tr(x[1])));
        s.appendChild(sp);
      });
      return s;
    }

    function saveBlock() {
      var n = st.cards.length;
      var svb = el('div', 'svb');
      if (st.error) {
        var e = el('p', 'serr');
        e.setAttribute('role', 'alert');
        e.appendChild(el('span', null, tr.apply(null, [st.error.key].concat(st.error.args || []))));
        if (st.error.signIn) {
          var si = btn('', null, tr('deskSignIn'));
          si.addEventListener('click', function () { openSite('/auth/login?door=kid'); });
          e.appendChild(si);
        }
        svb.appendChild(e);
      }
      if (n) {
        var chk = el('label', 'chk' + (st.saving ? ' faded' : ''));
        var box = el('input');
        box.type = 'checkbox';
        box.checked = st.article;
        box.disabled = st.saving;
        box.addEventListener('change', function () { st.article = box.checked; });
        chk.appendChild(box);
        chk.appendChild(el('i', null, st.article ? '✓' : ''));
        box.addEventListener('change', function () { chk.querySelector('i').textContent = box.checked ? '✓' : ''; });
        var words = el('span', null, tr('saveArticle') + ' ');
        var inf = el('span', 'inf', 'i');
        inf.tabIndex = 0;
        inf.setAttribute('role', 'button');
        inf.setAttribute('aria-label', tr('saveArticleWhy'));
        inf.appendChild(el('em', null, tr('saveArticleWhy')));
        // Tap shows it (a touch screen has no hover); it never ticks the box.
        inf.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          inf.classList.toggle('show');
        });
        words.appendChild(inf);
        chk.appendChild(words);
        svb.appendChild(chk);
      }
      var go = btn('sgo' + (st.saving ? ' busy' : ''), null, null);
      if (st.saving) {
        go.setAttribute('aria-busy', 'true');
        go.appendChild(el('span', 'spin'));
        go.appendChild(el('span', null, n ? tr('savingN', String(n)) : tr('savingPage')));
      } else {
        go.appendChild(el('span', null, n ? (n === 1 ? tr('saveOne') : tr('saveN', String(n))) : tr('savePage')));
        go.addEventListener('click', save);
      }
      svb.appendChild(go);
      var s = steps();
      if (st.saving) s.classList.add('faded');
      svb.appendChild(s);
      return svb;
    }

    function fail(key, args) {
      st.error = { key: key, args: args || [] };
      if (st.tab === 'sources') draw();
    }

    function save() {
      if (st.saving) return;
      var n = st.cards.length;
      st.saving = true;
      st.error = null;
      draw();
      call({ type: 'heddy-web:save', article: n ? st.article : true }).then(function (r) {
        st.saving = false;
        if (r.ok) {
          st.saved = { jotterTitle: r.jotterTitle, href: r.href, saveId: r.saveId, counts: r.counts || {}, dropped: r.dropped };
          st.article = false;
          // The background emptied the list; ask for it again to be sure.
          return call({ type: 'heddy-cards:get' }).then(function (g) { if (g.ok) setState(g, true); else draw(); });
        }
        if (r.error === 'signed_out') st.error = { key: 'saveSignedOut', signIn: true };
        else if (r.error === 'forbidden') st.error = { key: 'deskForbidden', args: [chrome.runtime.id] };
        else if (r.error === 'too_big') st.error = { key: 'saveTooBig' };
        else if (r.error === 'empty') st.error = { key: 'pageEmpty' };
        else st.error = n ? { key: n === 1 ? 'saveFailedOne' : 'saveFailedN', args: [String(n)] } : { key: 'saveFailedPage' };
        draw();
      });
    }

    /** "1 snippet and 2 pictures are on its left page, in your order." */
    function savedWhat(c) {
      var parts = [];
      if (c.snippets) parts.push(c.snippets === 1 ? tr('cardsSnippet') : tr('cardsSnippets', String(c.snippets)));
      if (c.pictures) parts.push(c.pictures === 1 ? tr('cardsPicture') : tr('cardsPictures', String(c.pictures)));
      if (c.article) parts.push(tr('savedArticle'));
      if (!parts.length) return tr('savedSomething');
      var many = parts.length > 1 || c.snippets > 1 || c.pictures > 1;
      var list = parts.length > 1 ? parts.slice(0, -1).join(tr('savedComma')) + tr('savedAnd') + parts[parts.length - 1] : parts[0];
      return tr(many ? 'savedAre' : 'savedIs', list);
    }

    function savedCard() {
      var s = st.saved;
      var c = el('div', 'okc');
      c.setAttribute('role', 'status');
      var h = el('div', 'h');
      h.appendChild(el('i', null, '✓'));
      h.appendChild(document.createTextNode(s.jotterTitle ? tr('savedTo', s.jotterTitle) : tr('savedToJotter')));
      c.appendChild(h);
      c.appendChild(el('p', null, savedWhat(s.counts) + ' ' + tr('savedNext')));
      // The site kept the cards but not the article (contract Changes, site 9).
      if (s.dropped) c.appendChild(el('p', null, tr('savedNoArticle')));
      var row = el('div', 'orow');
      var open = btn('o', null, tr('savedOpen'));
      open.addEventListener('click', function () { openSite(s.href); });
      var undo = btn('n', null, tr('savedUndo'));
      if (s.undoing) undo.setAttribute('aria-busy', 'true');
      undo.addEventListener('click', function () {
        if (s.undoing) return;
        s.undoing = true;
        undo.setAttribute('aria-busy', 'true');
        call({ type: 'heddy-web:undo-save', saveId: s.saveId }).then(function (r) {
          s.undoing = false;
          if (r.ok) {
            st.saved = null;
            st.error = null;
            if (Array.isArray(r.cards)) return setState(r);
          } else {
            st.error = { key: 'savedUndoFailed' };
          }
          draw();
        });
      });
      row.appendChild(open);
      // Nothing new was saved (only an article already there): no Undo.
      if (s.saveId) row.appendChild(undo);
      c.appendChild(row);
      c.appendChild(el('span', 'ofine', tr('savedFine')));
      return c;
    }

    // ─── the list from the background ────────────────────────────────────

    function setState(r, keepSaved) {
      if (!r || !Array.isArray(r.cards)) return;
      st.cards = r.cards;
      st.counts = r.counts || CARDS.counts(r.cards);
      // A new card after a save: the Saved card has done its job.
      if (!keepSaved && st.saved && st.cards.length) st.saved = null;
      if (st.error && st.error.key !== 'saveSignedOut') st.error = null;
      label();
      if (st.tab === 'sources') draw();
    }

    function setMode(m) {
      if (st.mode === m) return;
      st.mode = m;
      if (st.tab === 'sources' && !busy()) draw();
    }

    /** The background changed the list (box mode kept a picture, selected
     *  words added themselves): draw it again, unless a save is on its way. */
    function refresh(note) {
      if (st.saving) return;
      call({ type: 'heddy-cards:get' }).then(function (r) {
        if (!r.ok || st.saving) return;
        setState(r);
        if (note === 'full_text') fail('cardsFullText');
      });
    }

    // ─── Ask (D84) ───────────────────────────────────────────────────────

    var askView = AV.create({
      doc: document,
      tr: function () { return tr; },
      lang: function () { return lang; },
      connect: function () { return chrome.runtime.connect({ name: 'heddy-ask' }); },
      extra: function () { return { tabId: tab.id }; },
      site: function () { return hostLabel(tab.url); },
      fallbackName: profName,
      extensionId: function () { return chrome.runtime.id; },
      keepCard: function (m) { return call(Object.assign({ type: 'heddy-web:card' }, m)); },
      keepJot: function (m) { return call(Object.assign({ type: 'heddy-web:jot' }, m)); },
      undo: function (m) { return call(Object.assign({ type: 'heddy-web:undo' }, m)); },
      open: openSite,
      signIn: function () { openSite('/auth/login?door=kid'); },
      onProfessor: function (p) {
        st.professor = { code: p.code, name: p.name };
        label();
      },
    });

    /** lib/desk-ask.js openAsk: the crest selected, the Ask view drawn. */
    function openAsk(ctx, intent) {
      askView.open(ctx);
      st.tab = 'ask';
      label();
      draw();
      askView.start(intent);
    }

    /** Heddy ▾ on the page left an ask for this tab (lib/web-routes.js). */
    function takePending() {
      return call({ type: 'heddy-web:ask-pending' }).then(function (r) {
        var p = r && r.ok && r.pending;
        if (p && p.ctx) A.openAsk(p.ctx, api, p.intent);
      });
    }

    var api = { openAsk: openAsk };

    build();
    label();
    draw();

    chrome.runtime.onMessage.addListener(function (m) {
      if (!m || m.tabId !== tab.id) return;
      if (m.type === 'heddy-cards:changed') refresh(m.note);
      else if (m.type === 'heddy-web:ask') takePending();
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync' || !changes[I.STORAGE_KEY]) return;
      var next = changes[I.STORAGE_KEY].newValue === 'zh_CN' ? 'zh_CN' : 'en';
      if (next === lang) return;
      lang = next;
      tr = I.translator(lang);
      label();
      draw();
    });
    takePending();

    return { setMode: setMode, refresh: refresh, openAsk: openAsk };
  }

  root.HeddyWebDesk = { mount: mount, CSS: CSS };
})(globalThis);
