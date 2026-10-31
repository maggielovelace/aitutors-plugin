// lib/ask-view.js — the desk's Ask view (PRD-v0.96.0 § 1i, D80, D84;
// artifact round-8-youtube-desk.html #web, frame r9f3 — the spec).
//
// One view for both desks: the YouTube desk (content/desk.js, in YouTube's
// page) and the web desk (popup/web-desk.js, in the panel's frame). The
// crest is the Ask tab; tapping it, or Heddy ▾'s Ask about it / Make a card,
// fills the desk with this view:
//
//   ASK MENTOR · ABOUT PICTURE 2              the header line
//   the conversation                          the child's bubbles (navy,
//                                             right), the tutor's (white,
//                                             left), card drafts (gold) with
//                                             Keep card · Change it; an
//                                             Explain answer offers Keep as
//                                             a jot
//   Explain · Make a card                     the chips
//   [Ask Mentor about picture 2…]  [Ask]      the Ask bar
//
// No pop-up and no window (D78). The conversation is a Port to Heddy's
// background ('heddy-ask'), which asks aitutors.me and streams the lines
// back (lib/web-routes.js); the rules are lib/desk-ask.js. Every word from
// the site or the page is set as text.
(function (root) {
  if (root.HeddyAskView) return;
  var A = root.HeddyDeskAsk;

  var SANS = (root.HeddyFonts && root.HeddyFonts.SANS) || 'Manrope,Roboto,Arial,sans-serif';
  var SERIF = '"Source Serif 4",Georgia,"Times New Roman",serif';
  var MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace';

  // The artifact's .askhd, .talk/.room bubbles, .kc and .askb, in the desk's .cd.
  var CSS = [
    '.askhd{display:flex;align-items:center;gap:8px;font:600 10.5px/1.3 ' + MONO + ';letter-spacing:.12em;text-transform:uppercase;color:var(--muted);flex:none;margin:0}',
    '.talk{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:10px;margin-inline:-18px;padding:0 18px 12px}',
    '.talk > *{flex:none}',
    '.talk .me{align-self:flex-end;max-width:82%;background:#002147;color:#fff;border-radius:14px 14px 4px 14px;padding:8px 11px;display:grid;gap:6px;overflow-wrap:anywhere;white-space:pre-wrap}',
    '.talk .me img{display:block;width:100%;height:58px;object-fit:cover;border-radius:8px;background:linear-gradient(135deg,#dbe6f5,#9fb4d6)}',
    '.talk .me small{font:600 10.5px ' + MONO + ';opacity:.75;white-space:normal}',
    '.talk .tu{align-self:flex-start;max-width:90%;background:#fff;border:1px solid var(--line);border-radius:14px 14px 14px 4px;padding:9px 11px;overflow-wrap:anywhere;white-space:pre-wrap}',
    '.talk .tu.wait{color:var(--muted);letter-spacing:.2em}',
    '.talk .kc{align-self:stretch;border:1.5px solid #a87f17;border-radius:12px;background:#fffaf0;padding:10px 12px;display:grid;gap:5px}',
    '.talk .kc small{font:700 10px ' + MONO + ';letter-spacing:.12em;color:#a87f17;text-transform:uppercase}',
    '.talk .kc b{font:600 14px/1.35 ' + SERIF + ';color:#002147;overflow-wrap:anywhere}',
    '.talk .kc span{font:500 13px/1.4 ' + SANS + ';color:#4b5b73;overflow-wrap:anywhere;white-space:pre-wrap}',
    '.talk .ka{display:flex;gap:8px;margin-top:4px;align-items:center;flex-wrap:wrap}',
    '.talk .ka button{height:30px;border-radius:999px;padding:0 12px;display:inline-grid;place-items:center;font:800 12px ' + SANS + ';border:1px solid #c9c0ad;color:#002147;background:#fff}',
    '.talk .ka button.p{background:#a87f17;border-color:#a87f17;color:#fff}',
    '.talk .ka button[aria-busy="true"]{opacity:.6;cursor:progress}',
    '.talk .ka em{font:700 12px ' + SANS + ';font-style:normal;color:#1f6a40}',
    '.talk .ka .lnk{height:auto;padding:0;border:0;background:none;font:700 12px ' + SANS + ';color:var(--ink-deep);text-decoration:underline;text-decoration-color:var(--sc);text-underline-offset:3px}',
    '.talk .kj{align-self:flex-start;margin-top:-4px}',
    '.talk .aerr{align-self:stretch;display:flex;gap:10px;align-items:center;margin:0;padding:9px 12px;border-radius:12px;background:var(--sunk);font:600 12.5px/1.35 ' + SANS + ';color:var(--ink-deep)}',
    '.talk .aerr span{flex:1}',
    '.talk .aerr button{font:700 12.5px ' + SANS + ';color:var(--ink-deep);text-decoration:underline;text-decoration-color:var(--sc);text-underline-offset:3px;white-space:nowrap}',
    '.talk .aerr.safe{display:block;background:#fff;border:1.5px solid var(--ink-deep);font:600 13px/1.45 ' + SANS + '}',
    '.talk .subj{align-self:stretch;display:grid;gap:8px;padding:10px 12px;border-radius:12px;background:var(--sunk)}',
    '.talk .subj p{margin:0;font:600 12.5px/1.35 ' + SANS + ';color:var(--ink-deep)}',
    '.talk .subj .chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.talk .subj .chips button{height:28px;border-radius:999px;border:1px solid var(--line);background:var(--surface);padding:0 11px;font:700 12px ' + SANS + ';color:var(--ink-deep)}',
    '.talk .left{align-self:center;font:600 11px ' + MONO + ';color:var(--muted)}',
    '.askb{margin-top:auto;margin-inline:-18px;padding:10px 18px 12px;border-top:1px solid var(--line);display:grid;gap:8px;flex:none;background:var(--surface)}',
    '.askb .chips{display:flex;gap:6px}',
    '.askb .chips button{height:28px;border-radius:999px;border:1px solid var(--line);background:var(--sunk);padding:0 11px;display:flex;align-items:center;font:700 12px ' + SANS + ';color:var(--ink-soft)}',
    '.askb .chips button:hover{color:var(--ink-deep)}',
    '.askb .arow{display:flex;gap:8px}',
    '.askb .fl{all:unset;box-sizing:border-box;flex:1;min-width:0;height:40px;border:1px solid var(--line-strong);border-radius:12px;background:var(--bgc);color:var(--ink);padding:0 12px;font:500 13px ' + SANS + '}',
    '.askb .fl::placeholder{color:var(--muted);opacity:1}',
    '.askb .go{height:40px;padding:0 14px;border-radius:999px;background:var(--sc);border:0;color:#fff;display:flex;align-items:center;font:800 13px ' + SANS + '}',
    '.askb [aria-disabled="true"]{opacity:.55;cursor:default}',
    // The crest as the Ask tab, selected (the artifact's .tab.crest.on).
    '.tab.crest[aria-selected="true"]{margin-left:auto;width:auto;padding:0 10px;align-self:stretch;height:auto;border-radius:0}',
    '.tab.crest[aria-selected="true"] .eyes{box-shadow:none}',
  ].join('\n');

  var PLACE = { picture: 'askPhPicture', words: 'askPhWords', video: 'askPhVideo', page: 'askPhPage' };

  function el(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function btn(doc, cls, text) {
    var b = el(doc, 'button', cls, text);
    b.type = 'button';
    return b;
  }

  /**
   * opts: {
   *   doc, tr() → the translator now, lang() → 'en' | 'zh_CN',
   *   connect() → a chrome.runtime Port named 'heddy-ask',
   *   extra() → fields every turn carries ({tabId} or {t}),
   *   site() → the page's short name, for the picture's line,
   *   keepCard({front, back, draftToken, png?}) → Promise<{ok, deckHref?, cardIds?}>,
   *   keepJot({text, draftToken, quote?, png?}) → Promise<{ok, jotId?, jotterId?}>,
   *   undo({kind, ...}) → Promise<{ok}>, open(href), signIn(),
   *   onProfessor({code, name})   the desk takes the professor's colours and name,
   *   fallbackName() → the name before the stream names one (YouTube's video professor)
   * }
   */
  function create(opts) {
    var doc = opts.doc;
    var state = null;
    var port = null;
    var nextIntent = 'ask';
    var ui = null; // { hd, talk, field, go, chips }
    var kept = {}; // index → the kept answer ({cardIds, deckHref} | {jotId, jotterId})

    function tr() { return opts.tr().apply(null, arguments); }

    function name() {
      return (state && state.professor && state.professor.name) || (opts.fallbackName && opts.fallbackName()) || 'Mentor';
    }

    function header() {
      var h = A.headerFor(state, name());
      return tr.apply(null, [h.key].concat(h.args));
    }

    function placeholder() {
      if (state.about === 'picture' && state.n) return tr('askPhPictureN', name(), String(state.n));
      return tr(PLACE[state.about] || 'askPhPage', name());
    }

    function stop() {
      if (port) { try { port.disconnect(); } catch (e) { /* gone */ } }
      port = null;
    }

    // ─── drawing ──────────────────────────────────────────────────────────

    /** The view, into `pn` (the desk's panel). */
    function draw(pn) {
      if (!state) return;
      var hd = el(doc, 'p', 'askhd', header());
      var talk = el(doc, 'div', 'talk');
      talk.setAttribute('aria-live', 'polite');
      var askb = el(doc, 'div', 'askb');
      var chips = el(doc, 'div', 'chips');
      var explain = btn(doc, '', tr('askExplain'));
      var card = btn(doc, '', tr('askMakeCard'));
      explain.addEventListener('click', function () { chip('explain'); });
      card.addEventListener('click', function () { chip('card'); });
      chips.appendChild(explain);
      chips.appendChild(card);
      var row = el(doc, 'div', 'arow');
      var field = el(doc, 'input', 'fl');
      field.type = 'text';
      field.maxLength = A.MAX_TYPED;
      field.placeholder = placeholder();
      field.setAttribute('aria-label', placeholder());
      field.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); typed(); }
      });
      var go = btn(doc, 'go', tr('askSend'));
      go.addEventListener('click', typed);
      row.appendChild(field);
      row.appendChild(go);
      askb.appendChild(chips);
      askb.appendChild(row);
      pn.appendChild(hd);
      pn.appendChild(talk);
      pn.appendChild(askb);
      ui = { hd: hd, talk: talk, field: field, go: go, chips: [explain, card] };
      drawTalk();
      busyLook();
    }

    function busyLook() {
      if (!ui) return;
      var busy = !!(state && state.busy);
      ui.chips.concat([ui.go]).forEach(function (b) { b.setAttribute('aria-disabled', String(busy)); });
    }

    function nearBottom() {
      var t = ui && ui.talk;
      return !t || t.scrollHeight - t.scrollTop - t.clientHeight < 60;
    }

    function drawTalk() {
      if (!ui || !state) return;
      var stick = nearBottom();
      var talk = ui.talk;
      talk.textContent = '';
      var site = opts.site ? opts.site() : '';
      state.items.forEach(function (it, i) {
        if (it.who === 'me') {
          var me = el(doc, 'div', 'me');
          if (it.pic) {
            var img = el(doc, 'img');
            img.alt = '';
            img.src = 'data:image/png;base64,' + it.pic;
            me.appendChild(img);
          }
          me.appendChild(el(doc, 'span', null, it.text));
          if (it.pic) me.appendChild(el(doc, 'small', null, state.n ? tr('askPicSmall', String(state.n), site) : tr('askPicSmallNoN', site)));
          talk.appendChild(me);
        } else if (it.who === 'tu') {
          var waiting = !it.text && state.busy && i === state.items.length - 1;
          talk.appendChild(el(doc, 'div', waiting ? 'tu wait' : 'tu', waiting ? '•••' : it.text));
          if (it.token) talk.appendChild(keepJotRow(it, i));
        } else if (it.who === 'card') {
          talk.appendChild(cardDraft(it, i));
        }
      });
      if (state.error) talk.appendChild(errorLine(state.error));
      if (!state.busy && typeof state.turnsLeft === 'number') talk.appendChild(el(doc, 'span', 'left', tr('askTurnsLeft', String(state.turnsLeft))));
      if (stick) talk.scrollTop = talk.scrollHeight;
    }

    function cardDraft(it, i) {
      var kc = el(doc, 'div', 'kc');
      kc.appendChild(el(doc, 'small', null, tr('askCardDraft')));
      kc.appendChild(el(doc, 'b', null, it.front));
      if (it.back) kc.appendChild(el(doc, 'span', null, it.back));
      var ka = el(doc, 'div', 'ka');
      if (it.kept) {
        ka.appendChild(el(doc, 'em', null, tr('askKept')));
        var done = kept[i];
        if (done && done.deckHref) {
          var open = btn(doc, 'lnk', tr('askOpen'));
          open.addEventListener('click', function () { opts.open(done.deckHref); });
          ka.appendChild(open);
        }
        if (done && done.cardIds) ka.appendChild(undoButton(i, { kind: 'card', cardIds: done.cardIds }));
      } else {
        var keep = btn(doc, 'p', tr('askKeepCard'));
        keep.addEventListener('click', function () {
          if (keep.getAttribute('aria-busy') === 'true') return;
          keep.setAttribute('aria-busy', 'true');
          var png = state.attach && state.attach.kind === 'image' ? state.attach.png : null;
          opts.keepCard({ front: it.front, back: it.back, draftToken: it.token, png: png }).then(function (r) {
            if (r && r.ok) {
              kept[i] = { cardIds: r.cardIds, deckHref: r.deckHref };
              state = A.markKept(state, i);
            } else {
              state = Object.assign({}, state, { error: r && r.error === 'signed_out' ? 'signed_out' : 'keep' });
            }
            drawTalk();
          });
        });
        var change = btn(doc, '', tr('askChangeIt'));
        change.addEventListener('click', function () {
          state = A.changeCard(state, i);
          nextIntent = 'card';
          drawTalk();
          if (ui) {
            ui.field.value = tr('askChangePrefix');
            ui.field.focus();
          }
        });
        ka.appendChild(keep);
        ka.appendChild(change);
      }
      kc.appendChild(ka);
      return kc;
    }

    function keepJotRow(it, i) {
      var ka = el(doc, 'div', 'ka kj');
      if (it.kept) {
        ka.appendChild(el(doc, 'em', null, tr('askKeptJot')));
        var done = kept[i];
        if (done && done.jotId) ka.appendChild(undoButton(i, { kind: 'jot', jotId: done.jotId, jotterId: done.jotterId }));
        return ka;
      }
      var b = btn(doc, '', tr('askKeepJot'));
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-busy') === 'true') return;
        b.setAttribute('aria-busy', 'true');
        // The paragraph exactly as the site signed it, and the words it
        // explained (contract Changes, site 6); a picture goes as itself.
        var a = state.attach;
        var m = { text: it.text, draftToken: it.token };
        if (a && a.kind === 'image') m.png = a.png;
        else m.quote = A.jotQuote(state, i);
        opts.keepJot(m).then(function (r) {
          if (r && r.ok) {
            kept[i] = { jotId: r.jotId, jotterId: r.jotterId };
            state = A.markKept(state, i);
          } else {
            state = Object.assign({}, state, { error: r && r.error === 'signed_out' ? 'signed_out' : 'keep' });
          }
          drawTalk();
        });
      });
      ka.appendChild(b);
      return ka;
    }

    function undoButton(i, body) {
      var u = btn(doc, 'lnk', tr('askUndo'));
      u.addEventListener('click', function () {
        u.setAttribute('aria-busy', 'true');
        opts.undo(body).then(function (r) {
          if (r && r.ok) {
            delete kept[i];
            var items = state.items.slice();
            items[i] = Object.assign({}, items[i], { kept: false });
            state = Object.assign({}, state, { items: items });
          }
          drawTalk();
        });
      });
      return u;
    }

    function errorLine(code) {
      // The room's Childline line, exactly as the site sent it, and nothing to tap.
      if (code === 'safeguarding') return el(doc, 'p', 'aerr safe', state.message || tr('askErrFailed', name()));
      if (code === 'no_subject') return subjectChips();
      var p = el(doc, 'p', 'aerr');
      var key = { signed_out: 'askErrSignedOut', no_seat: 'askErrNoSeat', cap: 'askErrCap', keep: 'askKeepFailed' }[code] || 'askErrFailed';
      p.appendChild(el(doc, 'span', null, tr(key, name())));
      if (code === 'signed_out') {
        var b = btn(doc, '', tr('askSignIn'));
        b.addEventListener('click', function () { opts.signIn(); });
        p.appendChild(b);
      }
      return p;
    }

    /** Explain and Make a card need a professor (site 3): the child picks
     *  the subject and the same turn goes again. */
    function subjectChips() {
      var box = el(doc, 'div', 'subj');
      box.appendChild(el(doc, 'p', null, tr('askPickSubject')));
      var row = el(doc, 'div', 'chips');
      A.SUBJECTS.forEach(function (code) {
        var b = btn(doc, '', tr('subj' + code));
        b.addEventListener('click', function () {
          if (state.busy) return;
          state = A.pickSubject(state, code);
          var r = state.retry;
          state = Object.assign({}, state, { retry: null });
          if (r) send(r.intent, r.text);
          else drawTalk();
        });
        row.appendChild(b);
      });
      box.appendChild(row);
      return box;
    }

    // ─── a turn ───────────────────────────────────────────────────────────

    function chip(intent) {
      if (!state || state.busy) return;
      send(intent, tr(A.chipKey(intent, state.about)));
    }

    function typed() {
      if (!ui || !state || state.busy) return;
      var text = ui.field.value.trim();
      if (!text) return ui.field.focus();
      var intent = nextIntent;
      nextIntent = 'ask';
      ui.field.value = '';
      send(intent, text);
    }

    function send(intent, text) {
      var next = A.start(state, intent, text);
      if (!next) return;
      state = next;
      drawTalk();
      busyLook();
      stop();
      var p;
      try {
        p = opts.connect();
      } catch (e) {
        state = A.apply(state, { type: 'error', code: 'failed', message: '' });
        drawTalk();
        busyLook();
        return;
      }
      port = p;
      var items = state.items.map(function (it) {
        return it.who === 'card' ? { who: 'card', front: it.front, back: it.back } : { who: it.who, text: it.text };
      });
      p.onMessage.addListener(function (m) {
        if (port !== p || !m || !m.event) return;
        var ev = m.event;
        var before = state;
        state = A.apply(state, ev);
        if (ev.type === 'professor') {
          if (opts.onProfessor) opts.onProfessor(ev);
          if (ui) {
            ui.hd.textContent = header();
            ui.field.placeholder = placeholder();
            ui.field.setAttribute('aria-label', placeholder());
          }
          return;
        }
        if (ev.type === 'delta' && ui && ui.talk.lastChild && before.items.length === state.items.length) {
          // Just the answer being written: its words, not the whole list.
          var stick = nearBottom();
          var last = ui.talk.lastChild;
          if (last.classList && last.classList.contains('tu')) {
            last.className = 'tu';
            last.textContent = state.items[state.items.length - 1].text;
            if (stick) ui.talk.scrollTop = ui.talk.scrollHeight;
            return;
          }
        }
        drawTalk();
        if (ev.type === 'done' || ev.type === 'error') {
          stop();
          busyLook();
        }
      });
      p.onDisconnect.addListener(function () {
        if (port !== p) return;
        port = null;
        state = A.ended(state);
        drawTalk();
        busyLook();
      });
      p.postMessage(Object.assign({ intent: intent, state: { about: state.about, n: state.n, attach: state.attach, subject: state.subject, items: items }, lang: opts.lang() }, opts.extra ? opts.extra() : {}));
    }

    return {
      CSS: CSS,
      /** Open on a context (a new conversation); the desk then draws the
       *  view and calls start(). */
      open: function (ctx) {
        stop();
        kept = {};
        nextIntent = 'ask';
        var prof = state && state.professor;
        state = A.fresh(ctx);
        if (prof) state.professor = prof;
      },
      /** After draw(): a 'card' or 'explain' intent starts that turn; 'ask'
       *  puts the cursor in the box. */
      start: function (intent) {
        if (intent === 'card' || intent === 'explain') chip(intent);
        else if (ui) ui.field.focus();
      },
      draw: draw,
      focus: function () { if (ui) ui.field.focus(); },
      isOpen: function () { return !!state; },
      name: name,
      professor: function () { return state && state.professor; },
      /** The desk drew another tab: the view's parts are gone, the
       *  conversation stays until the desk closes. */
      detach: function () { ui = null; },
      close: function () {
        stop();
        state = null;
        ui = null;
        kept = {};
      },
    };
  }

  root.HeddyAskView = { create: create, CSS: CSS };
})(globalThis);
