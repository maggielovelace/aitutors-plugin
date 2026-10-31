// lib/desk-ask.js — Ask {professor}, the desk's Ask view (PRD-v0.96.0 § 1i,
// D80, D84; the Round 9 contract's § 4). The ONE place the desk asks: the
// YouTube desk's crest and the web desk's crest, Heddy ▾'s Ask about it and
// Make a card all call openAsk, which opens the desk's Ask view. Nothing pops
// up and no window opens (D78): the conversation fills the desk and goes from
// Heddy's background to POST /api/learn/heddy/ask, which answers in NDJSON.
//
// The rules are here, pure, so tests/round9.test.mjs can read them: the line
// splitter for the stream, the check on every line the site sends, what each
// line does to the conversation, the request body, and the header line
// "Ask Mentor · about picture 2". lib/ask-view.js draws it.
(function (root) {
  // The professor's colours (the site's DESK_COLOURS, lib/capture/heddy-desk.ts):
  // the stream's first line names the professor, and the desk takes its colours
  // from here, so a colour is never read from the network.
  var COLOURS = {
    MATH: { sc: '#4f46e5', scSoft: '#e8e8fc' },
    ENLA: { sc: '#be3d7a', scSoft: '#fbe6ef' },
    BIOL: { sc: '#2f8a57', scSoft: '#e2f1e7' },
    CHEM: { sc: '#7c4fd6', scSoft: '#efe8fb' },
    PHYS: { sc: '#2f64d6', scSoft: '#e5ecfb' },
    HIST: { sc: '#b4532a', scSoft: '#f8e7dd' },
    GEOG: { sc: '#0e7490', scSoft: '#dff3f7' },
  };
  var MENTOR = { sc: '#0d7565', scSoft: '#dcf1ec' };

  var INTENTS = ['ask', 'explain', 'card'];
  // The site's codes (contract Changes, site 3–4). 'safeguarding' carries the
  // room's Childline line, drawn verbatim and never retried.
  var ERRORS = ['signed_out', 'no_seat', 'cap', 'failed', 'no_subject', 'safeguarding', 'forbidden'];
  // The subjects a child may pick when nothing maps (site 3), and their professors.
  var SUBJECTS = ['MATH', 'ENLA', 'BIOL', 'CHEM', 'PHYS', 'HIST', 'GEOG'];
  var SUBJECT = /^[A-Z]{3,5}$/;
  // A draft token is the site's: opaque, short, and URL-safe.
  var TOKEN = /^[A-Za-z0-9._~+/=:-]{1,2000}$/;
  var MAX_LINE = 64 * 1024;
  var MAX_STREAM = 1024 * 1024;
  var MAX_DELTA = 8000;
  var MAX_ANSWER = 20000;
  var MAX_FRONT = 500;
  var MAX_BACK = 2000;
  var MAX_NAME = 40;
  var MAX_MESSAGE = 600;
  var MAX_TYPED = 2000;
  var MAX_HISTORY = 20;
  var MAX_HISTORY_TEXT = 4000;
  var SIDE = 300;
  var MAX_QUOTE = 4000;
  // A crop is at most 1 MB (lib/crop.js), as base64.
  var MAX_PNG = Math.ceil((1024 * 1024) / 3) * 4;

  function str(x, max) {
    return typeof x === 'string' ? x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : '';
  }

  function oneLine(x, max) {
    return str(x, max * 2).replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /** The colours for a professor's subject code; Mentor's for none. */
  function coloursFor(code) {
    return (typeof code === 'string' && COLOURS[code]) || MENTOR;
  }

  // ─── the stream ─────────────────────────────────────────────────────────

  /** NDJSON: text in, whole lines out. Past MAX_STREAM, or a line past
   *  MAX_LINE, the stream is over (`overflow`). */
  function createSplitter() {
    var rest = '';
    var total = 0;
    var dead = false;
    return {
      push: function (chunk) {
        if (dead) return [];
        total += chunk.length;
        rest += chunk;
        if (total > MAX_STREAM) { dead = true; rest = ''; return null; }
        var lines = rest.split('\n');
        rest = lines.pop();
        if (rest.length > MAX_LINE) { dead = true; rest = ''; return null; }
        return lines.filter(function (l) { return l.trim(); });
      },
      end: function () {
        var last = dead ? '' : rest;
        rest = '';
        return last.trim() ? [last] : [];
      },
    };
  }

  /** One line of the stream, checked: the contract's six types, each kept to
   *  the fields the desk draws and cut to size; anything else is null. */
  function parseEvent(line) {
    var e;
    try { e = JSON.parse(line); } catch (err) { return null; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    switch (e.type) {
      case 'professor': {
        var name = oneLine(e.name, MAX_NAME) || 'Mentor';
        var code = typeof e.code === 'string' && SUBJECT.test(e.code) ? e.code : null;
        return { type: 'professor', code: code, name: name };
      }
      case 'delta': {
        var text = str(e.text, MAX_DELTA);
        return text ? { type: 'delta', text: text } : null;
      }
      case 'card': {
        var front = oneLine(e.front, MAX_FRONT);
        // `back` may be empty: the child writes it (a printed question).
        var back = str(e.back, MAX_BACK).trim();
        if (!front || typeof e.draftToken !== 'string' || !TOKEN.test(e.draftToken)) return null;
        return { type: 'card', front: front, back: back, draftToken: e.draftToken };
      }
      case 'keepable':
        return typeof e.draftToken === 'string' && TOKEN.test(e.draftToken) ? { type: 'keepable', draftToken: e.draftToken } : null;
      case 'done': {
        var n = typeof e.turnsLeft === 'number' && isFinite(e.turnsLeft) && e.turnsLeft >= 0 ? Math.floor(e.turnsLeft) : null;
        return { type: 'done', turnsLeft: n };
      }
      case 'error': {
        var c = ERRORS.indexOf(e.code) >= 0 ? e.code : 'failed';
        // The Childline line is the site's words, kept as sent (one line).
        return { type: 'error', code: c, message: oneLine(e.message, MAX_MESSAGE) };
      }
      default:
        return null;
    }
  }

  // ─── the conversation ──────────────────────────────────────────────────

  /**
   * ctx: { about: 'picture'|'words'|'video'|'page', n?: number,
   *        attach?: {kind:'text', quote, before?, after?} | {kind:'image', png} }
   * The state is a plain object; every function returns a new one.
   */
  function fresh(ctx) {
    var c = ctx || {};
    return {
      about: ['picture', 'words', 'video', 'page'].indexOf(c.about) >= 0 ? c.about : 'page',
      n: typeof c.n === 'number' && c.n > 0 ? Math.floor(c.n) : null,
      attach: attachOf(c.attach),
      professor: null,
      items: [], // {who:'me', text, pic?} | {who:'tu', text, token?, kept?} | {who:'card', front, back, token, kept?}
      busy: false,
      error: null,
      message: '', // the site's words for an error (safeguarding: verbatim)
      subject: null, // the child's pick when nothing maps (site 3)
      retry: null, // after no_subject: { intent, text } to send again with a subject
      turnsLeft: null,
    };
  }

  /** The attachment as the contract carries it, or null. */
  function attachOf(a) {
    if (!a || typeof a !== 'object') return null;
    // Raw base64, as heddy:save and heddy:tool carry a crop (contract Changes).
    if (a.kind === 'image') return typeof a.png === 'string' && a.png.length <= MAX_PNG && /^iVBORw0KGgo[A-Za-z0-9+/=]*$/.test(a.png) ? { kind: 'image', png: a.png } : null;
    if (a.kind === 'text') {
      var quote = str(a.quote, MAX_QUOTE).trim();
      if (!quote) return null;
      var out = { kind: 'text', quote: quote };
      var before = oneLine(a.before, SIDE);
      var after = oneLine(a.after, SIDE);
      if (before) out.before = before;
      if (after) out.after = after;
      return out;
    }
    return null;
  }

  /** The header line, as {key, args}: "Ask Mentor · about picture 2". */
  function headerFor(state, name) {
    var who = name || 'Mentor';
    if (state.about === 'picture') return state.n ? { key: 'askAboutPictureN', args: [who, String(state.n)] } : { key: 'askAboutPicture', args: [who] };
    if (state.about === 'words') return { key: 'askAboutWords', args: [who] };
    if (state.about === 'video') return { key: 'askAboutVideo', args: [who] };
    return { key: 'askAboutPage', args: [who] };
  }

  /** The words the child's bubble shows for a chip, as a message key. */
  function chipKey(intent, about) {
    if (intent === 'card') return 'askMakeCard';
    if (about === 'picture') return 'askExplainPicture';
    if (about === 'video') return 'askExplainVideo';
    return 'askExplainThis';
  }

  /** The child's turn begins: their bubble and an empty answer. `text` is
   *  what the bubble says (typed, or the chip's words). Null when it cannot
   *  start (busy, nothing typed, a bad intent). */
  function start(state, intent, text) {
    if (state.busy || INTENTS.indexOf(intent) < 0) return null;
    var said = str(text, MAX_TYPED).trim();
    if (!said) return null;
    var first = !state.items.some(function (i) { return i.who === 'me'; });
    var me = { who: 'me', text: said };
    // The picture rides on the child's first bubble, as the artifact draws it.
    if (first && state.attach && state.attach.kind === 'image') me.pic = state.attach.png;
    var items = state.items.concat([me, { who: 'tu', text: '' }]);
    return Object.assign({}, state, { items: items, busy: true, error: null, message: '', lastIntent: intent });
  }

  /** What the conversation sends as `messages`: every finished turn, the
   *  newest last, at most MAX_HISTORY, each cut to size. */
  function history(state) {
    var out = [];
    state.items.forEach(function (i) {
      if (i.who === 'me') out.push({ role: 'user', text: i.text.slice(0, MAX_HISTORY_TEXT) });
      else if (i.who === 'tu' && i.text) out.push({ role: 'assistant', text: i.text.slice(0, MAX_HISTORY_TEXT) });
      else if (i.who === 'card') out.push({ role: 'assistant', text: (i.front + '\n' + i.back).slice(0, MAX_HISTORY_TEXT) });
    });
    return out.slice(-MAX_HISTORY);
  }

  /** The POST body (contract § 4). `source` comes from the background, which
   *  reads it from the tab; the desk's own copy is only a hint. */
  function body(state, intent, source, lang) {
    var b = { source: source, messages: history(state), intent: intent, lang: lang === 'zh' || lang === 'zh_CN' ? 'zh' : 'en' };
    if (state.attach) b.attach = state.attach;
    if (SUBJECTS.indexOf(state.subject) >= 0) b.subject = state.subject;
    return b;
  }

  /** The child picked a subject after no_subject: the turn that asked for it
   *  is taken back, to be sent again (its bubble comes back with it). */
  function pickSubject(state, code) {
    if (SUBJECTS.indexOf(code) < 0) return state;
    var items = state.items.slice();
    var last = -1;
    for (var i = items.length - 1; i >= 0; i--) if (items[i].who === 'me') { last = i; break; }
    var retry = last >= 0 ? { intent: state.lastIntent || 'ask', text: items[last].text } : null;
    if (last >= 0) items.splice(last, items.length - last);
    return Object.assign({}, state, { items: items, subject: code, error: null, message: '', retry: retry });
  }

  /** What Keep as a jot sends as `quote` (site 6): the words asked about, else
   *  the child's message the answer explained. */
  function jotQuote(state, index) {
    if (state.attach && state.attach.kind === 'text') return state.attach.quote;
    for (var i = index - 1; i >= 0; i--) if (state.items[i].who === 'me') return state.items[i].text;
    return '';
  }

  /** The last answer bubble (the one being written), or -1. */
  function lastAnswer(items) {
    for (var i = items.length - 1; i >= 0; i--) if (items[i].who === 'tu') return i;
    return -1;
  }

  /** One checked line of the stream, applied. */
  function apply(state, ev) {
    if (!ev) return state;
    var items = state.items.slice();
    var at = lastAnswer(items);
    switch (ev.type) {
      case 'professor':
        return Object.assign({}, state, { professor: { code: ev.code, name: ev.name } });
      case 'delta':
        if (at < 0 || !state.busy) return state;
        items[at] = Object.assign({}, items[at], { text: (items[at].text + ev.text).slice(0, MAX_ANSWER) });  // (keeps its `t`)
        return Object.assign({}, state, { items: items });
      case 'card':
        items.push({ who: 'card', front: ev.front, back: ev.back, token: ev.draftToken, kept: false });
        return Object.assign({}, state, { items: items });
      case 'keepable':
        if (at < 0) return state;
        items[at] = Object.assign({}, items[at], { token: ev.draftToken });
        return Object.assign({}, state, { items: items });
      case 'done':
        return Object.assign({}, state, { items: dropEmpty(items), busy: false, turnsLeft: ev.turnsLeft });
      case 'error':
        return Object.assign({}, state, { items: dropEmpty(items), busy: false, error: ev.code, message: ev.message || '' });
      default:
        return state;
    }
  }

  /** The stream ended without `done`: whatever came stays, the rest is an error. */
  function ended(state) {
    if (!state.busy) return state;
    return Object.assign({}, state, { items: dropEmpty(state.items), busy: false, error: 'failed' });
  }

  /** An answer bubble that never got words (a card-only reply) is not drawn. */
  function dropEmpty(items) {
    return items.filter(function (i) { return !(i.who === 'tu' && !i.text); });
  }

  /** A kept card or jot, marked so its button turns into "Kept". */
  function markKept(state, index) {
    var items = state.items.slice();
    if (!items[index]) return state;
    items[index] = Object.assign({}, items[index], { kept: true });
    return Object.assign({}, state, { items: items });
  }

  /** Change it: the draft goes and the child's words go back in the box. */
  function changeCard(state, index) {
    var items = state.items.slice();
    if (!items[index] || items[index].who !== 'card') return state;
    items.splice(index, 1);
    return Object.assign({}, state, { items: items });
  }

  /** The one function every Ask goes through. `desk` is the desk on the page
   *  (content/desk.js on YouTube, popup/web-desk.js on any other page): it
   *  selects the crest and opens its Ask view on this context. `intent`
   *  'card' or 'explain' starts that turn at once; 'ask' (or none) puts the
   *  cursor in the box. */
  function openAsk(ctx, desk, intent) {
    if (!desk || typeof desk.openAsk !== 'function') return false;
    desk.openAsk(ctx || {}, INTENTS.indexOf(intent) >= 0 ? intent : 'ask');
    return true;
  }

  var api = {
    COLOURS: COLOURS,
    MENTOR: MENTOR,
    INTENTS: INTENTS,
    ERRORS: ERRORS,
    SUBJECTS: SUBJECTS,
    pickSubject: pickSubject,
    jotQuote: jotQuote,
    MAX_LINE: MAX_LINE,
    MAX_STREAM: MAX_STREAM,
    MAX_HISTORY: MAX_HISTORY,
    MAX_TYPED: MAX_TYPED,
    coloursFor: coloursFor,
    createSplitter: createSplitter,
    parseEvent: parseEvent,
    fresh: fresh,
    attachOf: attachOf,
    headerFor: headerFor,
    chipKey: chipKey,
    start: start,
    history: history,
    body: body,
    apply: apply,
    ended: ended,
    markKept: markKept,
    changeCard: changeCard,
    openAsk: openAsk,
  };
  root.HeddyDeskAsk = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
