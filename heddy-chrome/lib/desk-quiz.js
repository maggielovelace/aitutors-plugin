// lib/desk-quiz.js — the desk's Quiz tab (Round 13, PRD-v0.96.0 § 1l, D104;
// Classroom's components/videos/VideoQuizCard.tsx in its Classroom face,
// ClassroomQuizRest, QuizPiHead, QuizSteps, QuizDots, QuizResults, and
// video-quiz.css's Classroom rules — the spec, matched literally, px only).
//
// The tab exists only when aitutors.me says this video, in the child's My
// Clips, has a quiz `ready` (content/desk.js). It runs inside the desk: no
// tab, no window. The professor's ring with Heddy's eyes in it and the
// bubble beside it, the step row, then the step:
//
//   rest      "Let {name} ask first" (the breathing button) and the free line
//   prep      the ring turns; the changing line, the honest seconds counter,
//             Try again past 30 s
//   predict   the before-you-watch question (when the site sends one)
//   watch     "Watch m:ss to m:ss", the player plays from the part's start;
//             Replay the bit; Done · ask me three more
//   check     three dots, the options with letters, Hint, Check my answer;
//             after the marking, Right / Your pick and the explanation
//   results   the score, a row per question, Quizzed ✓, the revision line,
//             Add n cards, Back to My Clips
//
// Like Classroom's card it holds no answers: the site marks each answer,
// counts the score and mints the cards (POST /api/learn/heddy/desk/quiz,
// lib/desk-api.js). Every word from the site is set as text.
(function (root) {
  if (root.HeddyDeskQuiz) return;
  var SH = root.HeddyDeskShell || (typeof require === 'function' && require('./desk-shell.js'));
  var SANS = SH.SANS;
  var SERIF = SH.SERIF;
  var MONO = SH.MONO;

  // VideoQuizCard's preparing clock.
  var PREP_SENTENCE_S = 3;
  var PREP_SLOW_S = 20;
  var PREP_RETRY_S = 30;
  var STEPS = ['predict', 'watch', 'check', 'results'];
  var STEP_INDEX = { predict: 0, watch: 1, check: 2, results: 3 };

  /** How full the ring is: a fifth per stage, Check's questions sharing theirs (ringPercent). */
  function ringPercent(step, answered, total) {
    if (step === 'predict') return 20;
    if (step === 'watch') return 40;
    if (step === 'check') return 40 + Math.round((40 * Math.min(answered, total)) / Math.max(1, total));
    return 100;
  }

  function mmss(s) {
    var n = Math.max(0, Math.floor(s || 0));
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  }

  /** What a refused `start` shows (VideoQuizCard's start branches). */
  function startOutcome(r) {
    if (r && r.ok) return 'ready';
    var st = r && r.status;
    var type = r && r.type;
    if (st === 401) return 'signedOut';
    if (st === 403 && (type === 'locked' || type === 'no-subscription')) return 'locked';
    if (st === 403 && type === 'quota') return 'quota';
    // r13c D109: 409 { type: 'none' } is "no quiz for this video" (404 before).
    if (st === 404 || (st === 409 && type === 'none')) return 'unavailable';
    if (st === 429) return 'cap';
    if (st === 403) return 'noPlan';
    return 'failed';
  }

  var SVG = {
    quiz: '<circle cx="12" cy="12" r="8.5" stroke-width="2.1"/><circle cx="12" cy="12" r="4.6" stroke-width="2.1"/><circle class="s" cx="12" cy="12" r="1.6"/>',
    arrow: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke-width="1.8"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.1"/>',
    add: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7M12 8.5v7" stroke-width="2.1"/>',
    watch: '<path class="f" d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/><path d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/>',
  };
  function icon(n) {
    return '<svg class="vp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + SVG[n] + '</svg>';
  }

  // video-quiz.css (the card, and its Classroom-only rules: .cp-pi, .cp-bub,
  // .cp-ask), in the desk's tokens: Classroom's --color-hair is --line,
  // --color-card --surface, --color-accent the subject colour --sc.
  var CSS = [
    '.cp-quiz{display:flex;flex-direction:column;gap:14px;--cp-on-sc:#fff}',
    '.cp-quiz .vp-ic{display:inline-block;fill:none;stroke:currentColor}',
    '.cp-quiz .vp-ic .f{fill:color-mix(in srgb,currentColor 24%,transparent);stroke:none}.cp-quiz .vp-ic .s{fill:currentColor;stroke:none}',
    '.vq-card{display:flex;flex-direction:column;gap:12px}',
    '.vq-ring{--p:0%;position:relative;display:grid;place-items:center;flex:none;width:60px;height:60px;border-radius:50%;background:conic-gradient(var(--sc) var(--p),color-mix(in srgb,var(--line) 70%,transparent) 0);transition:background .4s ease}',
    '.vq-ring::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--surface)}',
    '.vq-ring > *{position:relative}',
    '.vq-ring--spin{background:conic-gradient(from 0deg,var(--sc) 0 30%,color-mix(in srgb,var(--line) 70%,transparent) 30% 100%);animation:vq-turn 1.4s linear infinite}',
    '.vq-ring--spin > *{animation:vq-unturn 1.4s linear infinite}',
    '@keyframes vq-turn{to{transform:rotate(360deg)}}@keyframes vq-unturn{to{transform:rotate(-360deg)}}',
    // the step row: one row, an equal column per step, 28 px chips
    '.vq-steps{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;list-style:none;margin:0;padding:0}',
    '.vq-st{display:block;box-sizing:border-box;height:28px;line-height:25px;padding:0 6px;border:1.5px solid var(--line-strong);border-radius:999px;font:600 11.5px/25px ' + SANS + ';color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}',
    '.vq-st--on{background:var(--ink-deep);border-color:var(--ink-deep);color:#f6f1e7;font-weight:700}',
    '.vq-st--done{background:color-mix(in srgb,var(--sc) 18%,transparent);border-color:transparent;color:var(--ink-deep)}',
    '.vq-st--done em{font-style:italic;font-weight:600}',
    '.vq-st .vp-ic{width:11px;height:11px;margin-right:4px;vertical-align:-1px}',
    '.vq-st--done .vp-ic{color:var(--sc)}',
    '@container (max-width:420px){.vq-st{font-size:11px;padding:0 4px}.vq-st .vp-ic{width:10px;height:10px;margin-right:3px}}',
    // dots
    '.vq-dots{display:flex;align-items:center;gap:6px;margin:0}',
    '.vq-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--line-strong);background:var(--surface);box-sizing:border-box}',
    '.vq-dot--done{background:var(--sc);border-color:var(--sc)}.vq-dot--on{background:var(--ink-deep);border-color:var(--ink-deep)}',
    '.vq-dots b{margin-left:4px;font:700 13.5px/1.2 ' + SANS + ';color:var(--ink-deep)}',
    // prep
    '.vq-prep{display:grid;gap:6px}.vq-prep p{margin:0}',
    '.vq-prep__line{font:500 14.5px/1.45 ' + SANS + ';color:var(--ink)}',
    // the body
    '.vq-body{display:grid;gap:10px;min-width:0}.vq-body > p{margin:0}',
    '.vq-lbl{font:650 13px/1.4 ' + SANS + ';color:var(--ink-deep)}',
    '.vq-prompt{font:400 17px/1.35 ' + SERIF + ';color:var(--ink-deep);overflow-wrap:anywhere;text-wrap:pretty}',
    '.vq-fine{font:500 12.5px/1.45 ' + SANS + ';color:var(--muted);margin:0}',
    '.vq-why{margin:0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--line) 35%,transparent);font:500 14px/1.5 ' + SANS + ';color:var(--ink);overflow-wrap:anywhere}',
    '.vq-opts{display:grid;gap:8px}',
    '.vq-opt{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 10px;width:100%;min-height:44px;padding:10px 12px;text-align:left;cursor:pointer;border:1.5px solid var(--line-strong);border-radius:12px;background:var(--surface);color:var(--ink-deep);font:500 14.5px/1.4 ' + SANS + '}',
    '.vq-opt > span{flex:1 1 0;min-width:0;overflow-wrap:anywhere;text-wrap:pretty}',
    '.vq-opt__k{flex:none;display:grid;place-items:center;width:24px;height:24px;margin-top:1px;border-radius:50%;font-style:normal;box-sizing:border-box;border:1.5px solid var(--line-strong);font:700 12px/1 ' + MONO + ';color:var(--muted)}',
    '.vq-opt[aria-pressed="true"]{border-color:var(--sc);background:color-mix(in srgb,var(--sc) 12%,var(--surface))}',
    '.vq-opt[aria-pressed="true"] .vq-opt__k{background:var(--sc);border-color:var(--sc);color:#fff}',
    '.vq-opt[data-tone="good"]{border-color:#2f8f5b;background:color-mix(in srgb,#2f8f5b 12%,var(--surface))}',
    '.vq-opt[data-tone="good"] .vq-opt__k{background:#2f8f5b;border-color:#2f8f5b;color:#fff}',
    '.vq-opt[data-tone="bad"]{border-color:#c0392b;background:color-mix(in srgb,#c0392b 10%,var(--surface))}',
    '.vq-opt[data-tone="bad"] .vq-opt__k{background:#c0392b;border-color:#c0392b;color:#fff}',
    '.vq-opt__lab{flex:none;margin-left:auto;padding-left:34px;font:700 12px/1 ' + SANS + ';font-style:normal}',
    '.vq-opt[data-tone="good"] .vq-opt__lab{color:#1f6a40}.vq-opt[data-tone="bad"] .vq-opt__lab{color:#b23b3b}',
    '.vq-opt:disabled{cursor:default}',
    '.vq-opt__m{display:block;margin-top:2px;font-size:12px;color:var(--muted)}',
    '.vq-hint{margin:0;padding:8px 10px;border-radius:10px;border:1px dashed var(--line-strong);font:500 13.5px/1.45 ' + SANS + ';color:var(--ink);overflow-wrap:anywhere}',
    '.vq-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
    '.vq-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);font:700 13.5px/1.2 ' + SANS + ';cursor:pointer}',
    '.vq-btn.go{background:var(--sc);border-color:var(--sc);color:#fff}',
    '.vq-btn:disabled{opacity:.55;cursor:default}',
    '.vq-btn .vp-ic{width:16px;height:16px}',
    '.vq-btn.plain{background:transparent}',
    '.vq-link{font:650 13.5px ' + SANS + ';color:#1f6a40;padding:8px 4px;cursor:pointer}',
    '.vq-link:hover{text-decoration:underline}',
    '.vq-added{font:600 14px ' + SANS + ';color:var(--ink-deep)}',
    // results
    '.vq-results{display:grid;gap:10px}',
    '.vq-score{display:flex;align-items:flex-end;gap:10px;margin:0}',
    '.vq-score__n{font:700 34px/1 ' + SERIF + ';color:var(--ink-deep)}',
    '.vq-res{list-style:none;margin:0;padding:0;display:grid;gap:4px}',
    '.vq-res li{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font:500 14px/1.45 ' + SANS + ';color:var(--ink)}',
    '.vq-res li:last-child{border-bottom:0}',
    '.vq-ok{color:#1f6a40;font-weight:700}.vq-no{color:#c8333c;font-weight:700}',
    '.vq-chip{justify-self:start;margin:0;padding:2px 10px;border-radius:999px;border:1px solid #2f8a57;color:#1f6a40;font:650 12.5px ' + SANS + '}',
    // the upgrade card (videos.css .vp-upgrade)
    '.vq-upgrade{display:grid;gap:10px;padding:12px 14px;border-radius:12px;background:var(--sunk);font:500 13.5px/1.45 ' + SANS + ';color:var(--ink-deep)}',
    '.vq-upgrade .row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}',
    // Classroom only: the ring 52 px with a 4 px track and the 28 px crest, the bubble beside it
    '.cp-pi{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;align-items:start}',
    '.cp-pi > .vq-ring{width:52px;height:52px;margin-top:-2px}',
    '.cp-pi > .vq-ring::before{inset:4px}',
    '.cp-pi .vq-ring .eyes{width:28px;height:28px;border-radius:50%;transform-origin:50% 85%}',
    '.cp-bub{position:relative;display:grid;gap:8px;min-width:0;padding:10px 13px;border-radius:4px 14px 14px 14px;background:var(--sc-soft);color:var(--ink-deep);font:500 14px/1.5 ' + SANS + '}',
    '.cp-bub::before{content:"";position:absolute;left:-7px;top:9px;border:7px solid transparent;border-left:0;border-right-color:var(--sc-soft)}',
    '.cp-bub > p{margin:0;overflow-wrap:anywhere;text-wrap:pretty}',
    '.cp-bub .cp-q{font:600 16px/1.35 ' + SERIF + ';color:var(--ink-deep)}',
    '.cp-bub__k{font:600 10.5px/1.3 ' + MONO + ';letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--sc) 70%,var(--ink-deep))}',
    '@keyframes cp-pi-nod{0%{transform:rotate(0)}25%{transform:rotate(-12deg)}55%{transform:rotate(8deg)}80%{transform:rotate(-3deg)}100%{transform:rotate(0)}}',
    '@keyframes cp-bub-pop{0%{opacity:0;transform:translateX(-6px) scale(.94)}100%{opacity:1;transform:none}}',
    '@keyframes cp-bub-step{0%{opacity:.3;transform:scale(.96)}100%{opacity:1;transform:none}}',
    '.cd[data-rest] .cp-pi .vq-ring .eyes{animation:cp-pi-nod 1s ease-in-out .6s 1 both}',
    '.cd[data-rest] .cp-bub{animation:cp-bub-pop .32s cubic-bezier(.2,.8,.2,1.2) .2s 1 both}',
    '.cp-bub[data-step]{transform-origin:0 0;animation:cp-bub-step .24s ease-out 1 both}',
    '.cp-ask{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;padding:0 18px;border-radius:999px;background:var(--sc);color:var(--cp-on-sc);font:700 15px/1 ' + SANS + ';cursor:pointer;box-shadow:0 6px 16px color-mix(in srgb,var(--sc) 28%,transparent);transition:transform .12s ease,box-shadow .2s ease}',
    '.cp-ask::before{content:"";position:absolute;inset:-4px;z-index:-1;border-radius:999px;pointer-events:none;background:color-mix(in srgb,var(--sc) 22%,transparent);transition:background-color .2s ease}',
    '.cp-ask:hover{transform:translateY(-1px)}.cp-ask:hover::before{background:color-mix(in srgb,var(--sc) 36%,transparent)}',
    '.cp-ask:active{transform:scale(.98)}',
    '.cp-ask:focus-visible{outline:2px solid var(--ink-deep);outline-offset:4px}',
    '.cp-ask .vp-ic{width:18px;height:18px;flex:none}.cp-ask .vp-ic:last-of-type{width:16px;height:16px}',
    '.cp-ask__sheen{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;z-index:2}',
    '.cp-ask__sheen::after{content:"";position:absolute;top:0;bottom:0;left:0;width:38%;transform:translateX(-120%);background:linear-gradient(100deg,transparent,rgb(255 255 255 / .42) 50%,transparent)}',
    '@keyframes cp-ask-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.035,1.2);opacity:.45}}',
    '@keyframes cp-ask-sweep{0%{transform:translateX(-120%)}10%,100%{transform:translateX(330%)}}',
    '.cd[data-rest] .cp-ask::before{animation:cp-ask-breathe 3.2s ease-in-out 1.4s infinite}',
    '.cd[data-rest] .cp-ask .cp-ask__sheen::after{animation:cp-ask-sweep 12s cubic-bezier(.4,0,.2,1) 1.6s infinite}',
    '.cp-quiz__free{margin:0;font:500 12.5px/1.45 ' + SANS + ';color:var(--muted)}',
    '@media (prefers-reduced-motion:reduce){.vq-ring--spin,.vq-ring--spin > *,.cp-ask,.cp-ask *,.cp-ask::before,.cp-ask__sheen::after,.cp-pi .eyes,.cp-bub,.cd[data-rest] .cp-ask::before,.cd[data-rest] .cp-ask .cp-ask__sheen::after,.cd[data-rest] .cp-pi .vq-ring .eyes,.cd[data-rest] .cp-bub{animation:none !important;transition:none !important}}',
  ].join('\n');

  /**
   * opts: {
   *   doc, tr() → the translator, name() → "Newton", subjectName() → "Physics",
   *   eyes (the crest's markup), send(body) → Promise<parsed quiz reply>,
   *   seekPlay(t), openSite(path), signIn(), onRest(atRest)
   * }
   */
  function create(opts) {
    var doc = opts.doc;
    var q = null; // the quiz's state; null at rest
    var host = null; // the panel it is drawn into
    var timer = null;

    function tr() { return opts.tr().apply(null, arguments); }
    function name() { return opts.name(); }

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    function button(cls, label, fn) {
      var b = el('button', cls);
      b.type = 'button';
      if (typeof label === 'string') b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    }

    function redraw() {
      if (host && host.isConnected) draw(host);
    }

    // ─── the server's four calls ────────────────────────────────────────

    function start() {
      clearInterval(timer);
      q = { phase: 'loading', elapsed: 0, step: 'predict', guess: null, guessed: false, qi: 0, pick: null, hint: false, outcomes: [], busy: false, result: null, minted: null, set: null, why: null };
      timer = setInterval(function () {
        if (!q || q.phase !== 'loading') return clearInterval(timer);
        q.elapsed++;
        redraw();
      }, 1000);
      redraw();
      var mine = q;
      opts.send({ action: 'start' }).then(function (r) {
        if (q !== mine) return;
        clearInterval(timer);
        var out = startOutcome(r);
        if (out === 'ready') {
          q.set = r;
          q.outcomes = r.questions.map(function () { return null; });
          q.phase = 'ready';
          q.step = r.predict ? 'predict' : 'watch';
          if (q.step === 'watch') opts.seekPlay(r.range.startSec);
        } else if (out === 'signedOut') {
          q.phase = 'signedOut';
        } else if (out === 'locked' || out === 'quota') {
          q.phase = 'locked';
          q.why = out === 'quota' ? tr('qzQuota') : tr('qzNoPlan');
        } else if (out === 'failed') {
          q.phase = 'failed';
        } else {
          q.phase = 'message';
          q.why = tr(out === 'unavailable' ? 'qzUnavailable' : out === 'cap' ? 'qzCap' : 'qzNoPlan');
        }
        redraw();
      });
    }

    function answer(si) {
      if (!q || q.pick === null || q.busy) return;
      q.busy = true;
      redraw();
      var mine = q;
      opts.send({ action: 'answer', checkId: q.set.checkId, index: si, choice: q.pick }).then(function (r) {
        if (q !== mine) return;
        q.busy = false;
        if (r && r.ok) q.outcomes[si] = r;
        else q.phase = 'failed';
        redraw();
      });
    }

    function finish() {
      if (!q || q.busy) return;
      q.busy = true;
      redraw();
      var mine = q;
      opts.send({ action: 'finish', checkId: q.set.checkId }).then(function (r) {
        if (q !== mine) return;
        q.busy = false;
        if (!(r && r.ok)) q.phase = 'failed';
        else {
          q.result = { correct: r.correct, misses: r.misses };
          q.step = 'results';
        }
        redraw();
      });
    }

    function addCards() {
      if (!q || q.busy) return;
      q.busy = true;
      redraw();
      var mine = q;
      opts.send({ action: 'add_cards', checkId: q.set.checkId }).then(function (r) {
        if (q !== mine) return;
        q.busy = false;
        q.minted = r && r.ok ? r.minted : 0;
        redraw();
      });
    }

    // ─── drawing ─────────────────────────────────────────────────────────

    /** The ring and Pi's bubble (QuizPiHead): the eyes inside the ring. */
    function head(spinning, percent, view) {
      var h = el('div', 'vq-head cp-pi');
      var ring = el('span', spinning ? 'vq-ring vq-ring--spin' : 'vq-ring');
      ring.style.setProperty('--p', percent + '%');
      ring.setAttribute('aria-hidden', 'true');
      var eyes = el('span', 'eyes');
      eyes.innerHTML = opts.eyes;
      ring.appendChild(eyes);
      h.appendChild(ring);
      var bub = el('div', 'cp-bub');
      if (view.kind !== 'rest') bub.setAttribute('data-step', view.kind);
      if (view.key) bub.appendChild(el('span', 'cp-bub__k', view.key));
      bub.appendChild(el('p', view.question ? 'cp-q' : null, view.text));
      h.appendChild(bub);
      return h;
    }

    /** The step row (QuizSteps, Classroom's words). */
    function steps(step) {
      var ol = el('ol', 'vq-steps');
      ol.setAttribute('aria-label', tr('qzStepsLabel'));
      var cur = step ? STEP_INDEX[step] : -1;
      STEPS.forEach(function (key, i) {
        var li = el('li', i === cur ? 'vq-st vq-st--on' : i < cur ? 'vq-st vq-st--done' : 'vq-st');
        var nm = tr('qzStep' + key.charAt(0).toUpperCase() + key.slice(1), name());
        if (i < cur) {
          li.insertAdjacentHTML('beforeend', icon('tick'));
          li.appendChild(el('em', null, tr('qzName' + key.charAt(0).toUpperCase() + key.slice(1), name())));
        } else {
          li.textContent = nm;
        }
        if (i === cur) li.setAttribute('aria-current', 'step');
        ol.appendChild(li);
      });
      return ol;
    }

    function dots(index, total, answered) {
      var p = el('p', 'vq-dots');
      for (var i = 0; i < total; i++) {
        var d = el('i', i === index ? 'vq-dot vq-dot--on' : i < answered ? 'vq-dot vq-dot--done' : 'vq-dot');
        d.setAttribute('aria-hidden', 'true');
        p.appendChild(d);
      }
      p.appendChild(el('b', null, tr('qzQuestionOf', String(index + 1), String(total))));
      return p;
    }

    function backToClips() {
      return button('vq-link', tr('qzBack'), function () { opts.openSite('/study/clips'); });
    }

    /** Options with letters; `out` the marking, `pick` the child's choice. */
    function options(list, pick, out, onPick) {
      var box = el('div', 'vq-opts');
      list.forEach(function (o, i) {
        var tone = out ? (i === out.correctIndex ? 'good' : i === pick ? 'bad' : null) : null;
        var b = button('vq-opt', null, function () { onPick(i); });
        if (tone) b.setAttribute('data-tone', tone);
        if (out) b.disabled = true;
        b.setAttribute('aria-pressed', String(pick === i));
        b.appendChild(el('i', 'vq-opt__k', String.fromCharCode(65 + i)));
        var span = el('span', null, o);
        if (out && i === pick && out.misconception) span.appendChild(el('span', 'vq-opt__m', tr('qzMisTag', out.misconception)));
        b.appendChild(span);
        if (tone) b.appendChild(el('em', 'vq-opt__lab', tone === 'good' ? tr('qzOptRight') : tr('qzOptPick')));
        box.appendChild(b);
      });
      return box;
    }

    function draw(pn) {
      host = pn;
      pn.textContent = '';
      var wrap = el('div', 'sc cp-quiz');
      pn.appendChild(wrap);
      if (opts.onRest) opts.onRest(!q);
      if (!q) {
        // At rest (ClassroomQuizRest): the ring and the bubble, the row, the button, the free line.
        wrap.appendChild(head(false, 0, { kind: 'rest', text: tr('qzRest') }));
        wrap.appendChild(steps(null));
        var ask = button('cp-ask', null, start);
        ask.insertAdjacentHTML('beforeend', icon('quiz'));
        ask.appendChild(el('span', null, tr('qzButton', name())));
        ask.insertAdjacentHTML('beforeend', icon('arrow'));
        var sheen = el('span', 'cp-ask__sheen');
        sheen.setAttribute('aria-hidden', 'true');
        ask.appendChild(sheen);
        wrap.appendChild(ask);
        wrap.appendChild(el('p', 'cp-quiz__free', tr('qzFree', name())));
        return;
      }
      var card = el('section', 'vq-card');
      card.setAttribute('aria-label', tr('qzDialog', name()));
      wrap.appendChild(card);
      var body = el('div', 'vq-body');
      var ready = q.phase === 'ready' && q.set;
      var set = q.set;
      var total = set ? set.questions.length : 3;
      var answered = q.outcomes.filter(Boolean).length;
      var view;
      if (q.phase === 'loading') {
        var lines = [tr('qzPrep1'), tr('qzPrep2'), tr('qzPrep3'), tr('qzPrep4')];
        view = { kind: 'prep', text: tr('qzPrep', name()) };
        var prep = el('div', 'vq-prep');
        prep.setAttribute('role', 'status');
        prep.appendChild(el('p', 'vq-prep__line', q.elapsed >= PREP_SLOW_S ? tr('qzPrepSlow') : lines[Math.min(lines.length - 1, Math.floor(q.elapsed / PREP_SENTENCE_S))]));
        prep.appendChild(el('p', 'vq-fine', tr('qzPrepTime', String(q.elapsed))));
        prep.appendChild(el('p', 'vq-fine', tr('qzPrepComing', String(total))));
        if (q.elapsed >= PREP_RETRY_S) {
          var rr = el('div', 'vq-row');
          rr.appendChild(button('vq-btn', tr('qzTryAgain'), start));
          prep.appendChild(rr);
        }
        body.appendChild(prep);
      } else if (q.phase === 'failed') {
        view = { kind: 'say', text: tr('qzFailed') };
        var fr = el('div', 'vq-row');
        fr.appendChild(button('vq-btn go', tr('qzTryAgain'), start));
        fr.appendChild(backToClips());
        body.appendChild(fr);
      } else if (q.phase === 'signedOut') {
        view = { kind: 'say', text: tr('qzTitle') };
        var so = el('div', 'si');
        so.appendChild(el('span', null, tr('deskSignedOut')));
        so.appendChild(button('', tr('deskSignIn'), opts.signIn));
        body.appendChild(so);
      } else if (q.phase === 'locked') {
        // The upgrade card (QuizUpgrade): the line, See plans ↗, Back to My Clips.
        view = { kind: 'say', text: tr('qzTitle') };
        var up = el('div', 'vq-upgrade');
        up.setAttribute('role', 'status');
        up.appendChild(el('span', null, q.why));
        var urow = el('span', 'row');
        var plans = button('vq-btn go', tr('digestLockedCta'), function () { opts.openSite('/pricing'); });
        plans.title = tr('digestLockedCtaTitle');
        urow.appendChild(plans);
        urow.appendChild(backToClips());
        up.appendChild(urow);
        body.appendChild(up);
      } else if (q.phase === 'message') {
        view = { kind: 'say', text: tr('qzTitle') };
        body.appendChild(el('p', null, q.why));
        var mr = el('div', 'vq-row');
        mr.appendChild(backToClips());
        body.appendChild(mr);
      } else if (q.step === 'predict') {
        view = { kind: 'predict', key: tr('qzStepPredict', name()), text: set.predict.prompt, question: true };
        body.appendChild(options(set.predict.options, q.guess, null, function (i) { q.guess = i; redraw(); }));
        var pr = el('div', 'vq-row');
        var lock = button('vq-btn go', null, function () {
          q.guessed = true;
          q.step = 'watch';
          opts.seekPlay(set.range.startSec);
          redraw();
        });
        lock.appendChild(doc.createTextNode(tr('qzLock')));
        lock.insertAdjacentHTML('beforeend', icon('arrow'));
        lock.disabled = q.guess === null;
        pr.appendChild(lock);
        pr.appendChild(button('vq-btn plain', tr('qzSkip'), function () { q.step = 'watch'; opts.seekPlay(set.range.startSec); redraw(); }));
        body.appendChild(pr);
      } else if (q.step === 'watch') {
        view = { kind: 'watch', text: tr('qzWatch') };
        var end = set.range.endSec;
        if (end) body.appendChild(el('p', 'vq-lbl', tr('qzWatchRange', mmss(set.range.startSec), mmss(end))));
        body.appendChild(el('p', 'vq-prompt', tr(q.guessed ? 'qzWatchLead' : 'qzWatchLeadSkipped', name())));
        var wr = el('div', 'vq-row');
        wr.appendChild(button('vq-btn go', tr('qzWatched'), function () { q.step = 'check'; q.qi = 0; q.pick = null; q.hint = false; redraw(); }));
        var replay = button('vq-btn plain', null, function () { opts.seekPlay(set.range.startSec); });
        replay.insertAdjacentHTML('beforeend', icon('watch'));
        replay.appendChild(doc.createTextNode(tr('qzReplay')));
        wr.appendChild(replay);
        body.appendChild(wr);
      } else if (q.step === 'check') {
        var si = q.qi;
        var question = set.questions[si];
        var out = q.outcomes[si];
        var last = si >= total - 1;
        view = { kind: 'check', key: tr('qzQuestionOf', String(si + 1), String(total)), text: question.prompt, question: true };
        body.appendChild(dots(si, total, answered));
        body.appendChild(options(question.options, q.pick, out, function (i) { q.pick = i; redraw(); }));
        if (q.hint && !out && question.hint) body.appendChild(el('p', 'vq-hint', question.hint));
        if (out) body.appendChild(el('p', 'vq-why', out.explanation));
        var cr = el('div', 'vq-row');
        if (out) {
          var nx = button('vq-btn go', null, function () {
            if (last) return finish();
            q.qi = si + 1;
            q.pick = null;
            q.hint = false;
            redraw();
          });
          if (last) {
            nx.appendChild(doc.createTextNode(tr('qzSeeResults')));
            nx.insertAdjacentHTML('beforeend', icon('arrow'));
          } else nx.textContent = tr('qzNextQuestion');
          nx.disabled = q.busy;
          cr.appendChild(nx);
        } else {
          var sub = button('vq-btn go', tr('qzSubmit'), function () { answer(si); });
          sub.disabled = q.pick === null || q.busy;
          cr.appendChild(sub);
          var hb = button('vq-btn plain', tr('qzHint'), function () { q.hint = true; redraw(); });
          hb.disabled = q.hint;
          cr.appendChild(hb);
        }
        body.appendChild(cr);
      } else {
        // Results (QuizResults).
        var res = q.result;
        var guessText = q.guessed && q.guess !== null && set.predict ? set.predict.options[q.guess] : tr('qzNoGuess');
        view = { kind: 'results', text: tr(res.misses > 0 ? 'qzResults' : 'qzResultsAll', String(res.correct), String(total), guessText, name()) };
        var box = el('div', 'vq-results');
        var score = el('p', 'vq-score');
        score.appendChild(el('span', 'vq-score__n', res.correct + ' / ' + total));
        score.appendChild(doc.createTextNode(' '));
        score.appendChild(el('span', 'vq-fine', tr('qzCorrect')));
        box.appendChild(score);
        var ul = el('ul', 'vq-res');
        set.questions.forEach(function (qq, i) {
          var o = q.outcomes[i];
          var ok = !!(o && o.correct);
          var li = el('li');
          var t = el('span');
          t.appendChild(el('b', null, 'Q' + (i + 1)));
          var row = !ok && o && o.misconception ? (o.explanation ? tr('qzMissRow', o.misconception, o.explanation) : o.misconception) : qq.prompt;
          t.appendChild(doc.createTextNode(' ' + row));
          li.appendChild(t);
          var mark = el('span', ok ? 'vq-ok' : 'vq-no', ok ? '✓' : '✗');
          mark.setAttribute('aria-label', ok ? tr('qzRight') : tr('qzNotYet'));
          li.appendChild(mark);
          ul.appendChild(li);
        });
        box.appendChild(ul);
        if (res.correct === total) box.appendChild(el('p', 'vq-chip', tr('qzQuizzed')));
        box.appendChild(el('p', 'vq-fine', '✓ ' + tr('qzRecorded', opts.subjectName() || set.subject || '')));
        var rrow = el('div', 'vq-row');
        if (res.misses > 0) {
          if (q.minted === null) {
            var add = button('vq-btn go', null, addCards);
            add.insertAdjacentHTML('beforeend', icon('add'));
            add.appendChild(doc.createTextNode(q.busy ? tr('qzAdding') : tr(res.misses === 1 ? 'qzAddCardsOne' : 'qzAddCardsMany', String(res.misses))));
            add.disabled = q.busy;
            rrow.appendChild(add);
          } else {
            var a = el('span', 'vq-added', tr(q.minted === 1 ? 'qzAddedOne' : 'qzAddedMany', String(q.minted)));
            a.setAttribute('role', 'status');
            rrow.appendChild(a);
          }
        }
        rrow.appendChild(backToClips());
        box.appendChild(rrow);
        body.appendChild(box);
      }
      var percent = ready ? ringPercent(q.step, answered, total) : 0;
      card.appendChild(head(q.phase === 'loading', percent, view));
      card.appendChild(steps(ready ? q.step : null));
      card.appendChild(body);
    }

    return {
      CSS: CSS,
      draw: draw,
      /** The desk drew another tab: the quiz stays where it was. */
      detach: function () { host = null; },
      /** Another video, or the desk closed: back to rest. */
      reset: function () { clearInterval(timer); q = null; host = null; },
      state: function () { return q ? (q.phase === 'ready' ? q.step : q.phase) : 'rest'; },
    };
  }

  var api = { create: create, CSS: CSS, ringPercent: ringPercent, startOutcome: startOutcome, mmss: mmss, PREP_RETRY_S: PREP_RETRY_S };
  root.HeddyDeskQuiz = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
