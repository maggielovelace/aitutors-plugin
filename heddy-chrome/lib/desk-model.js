// lib/desk-model.js — the rules behind the desk on a YouTube watch page
// (PRD-v0.96.0 § 1h, D69–D74; artifact round-8-youtube-desk.html #desk, #lang).
// Pure: no DOM, no chrome.*, so each rule is a unit test. content/desk.js
// draws; this decides.
//
//   deskHeight      D69: at rest as tall as the player, the chevron pulls it to
//                   the bottom of the window; under the player (theatre mode, a
//                   narrow window) it has a height of its own
//   layoutFor       D69: YouTube's right column, or under the player
//   lineAt          the transcript line being spoken at a player time
//   press / note    D74 + Classroom's D11: H (or the Jot card) jots the line
//                   being spoken; another press within 2.5 s of the last joins
//                   the line before; a typed note is its own jot
//   wireJots        the jots as heddy:add and POST …/desk/jots carry them
//   zhNeed          D72: the 10-minute stretch to ask for, and the next one once
//                   the player passes 80% of the one it is in
//   zhLine          a line's Chinese, or null outside every stretch
//   defaultView     D73: Classroom's defaultView, EN → English, 中 → Bilingual
//   createLifeline  D76: a script left behind by a reload of Heddy stops itself
(function (root) {
  var K = root.HeddyJotKey || (typeof require === 'function' && require('./jot-key.js'));

  var JOIN_MS = K.JOIN_MS;
  var MAX_JOTS = 200;
  var MAX_TEXT = 2000;
  // D72: the server translates [floor(S/600)*600, +600); the next stretch is
  // asked for when the player passes 80% of the current one.
  var STRETCH = 600;
  var NEXT_AT = 0.8;
  // The contract's § 2: a stretch another request is writing is asked for
  // again after 4 s, at most 5 times.
  var ZH_RETRY_MS = 4000;
  var ZH_TRIES = 5;
  // Round 11 (site PR #1192): a stretch that failed is not tried again by the
  // site for 10 minutes; after that the desk may ask for it again.
  var ZH_FAIL_RETRY_MS = 10 * 60 * 1000;
  // The last line of a video stays "being spoken" for this long.
  var LINE_HOLD = 10;
  // D69: at rest the desk is never shorter than this (the Jot card, two jots
  // and the composer fit); under the player it is this tall at rest.
  var MIN_H = 420;
  var BELOW_H = 560;
  var GAP = 12;
  var VIEWS = ['en', 'bi', 'zh'];
  var STORE_PREFIX = 'deskJots:';

  function num(x) {
    return typeof x === 'number' && isFinite(x);
  }

  /** 'column' while YouTube draws two columns and is not in theatre mode;
   *  'below' otherwise (D69). */
  // Narrower than this, the right column cannot hold the desk (YouTube's
  // newer watch page puts a ~110 px rail of icons there): under the player.
  var MIN_COLUMN = 300;

  /** flexy: { twoColumns, theater, column: {width, right} | null, viewportW }.
   *  The column only when YouTube shows two columns AND the column is wide
   *  enough and inside the window (the owner's desk ran off its right edge). */
  function layoutFor(flexy) {
    var f = flexy || {};
    if (!f.twoColumns || f.theater) return 'below';
    var c = f.column;
    if (c && num(c.width) && c.width < MIN_COLUMN) return 'below';
    if (c && num(c.right) && num(f.viewportW) && c.right > f.viewportW + 1) return 'below';
    return 'column';
  }

  /**
   * The desk's height in px (D69).
   * { layout, playerH, viewportH, top, tall, reserve }: `top` is where the
   * desk's sticky top sits in the window (under YouTube's masthead), `reserve`
   * the line under the desk (Show YouTube's suggestions).
   */
  function deskHeight(o) {
    var vh = num(o.viewportH) ? o.viewportH : 800;
    var top = num(o.top) ? o.top : 0;
    var reserve = num(o.reserve) ? o.reserve : 0;
    var room = Math.max(MIN_H, Math.floor(vh - top - reserve - GAP));
    if (o.tall) return room;
    var base = o.layout === 'below' ? BELOW_H : Math.max(MIN_H, num(o.playerH) && o.playerH > 0 ? Math.round(o.playerH) : MIN_H);
    // Round 11 (Classroom's deskStep): grown to what the open tab needs,
    // capped at the window, and never shrinking on its own (`keep`, the most
    // the content has wanted this visit).
    var want = Math.max(base, num(o.keep) ? o.keep : 0, num(o.content) ? Math.ceil(o.content) : 0);
    return Math.min(want, room);
  }

  /** The index of the line being spoken at `t`, or -1. `lines` are sorted by t. */
  function lineAt(lines, t) {
    if (!Array.isArray(lines) || !lines.length || !num(t)) return -1;
    var lo = 0;
    var hi = lines.length - 1;
    var found = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (lines[mid].t <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return -1;
    // A line lasts until the next one starts; the last one, LINE_HOLD seconds.
    if (lines[found + 1]) return found;
    return t - lines[found].t <= LINE_HOLD ? found : -1;
  }

  function clean(text) {
    var s = typeof text === 'string' ? text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
    return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s;
  }

  function round1(t) {
    return Math.round(t * 10) / 10;
  }

  /** Jots in time order (Classroom's jotOrder, without the professor's). */
  function sorted(jots) {
    return jots.slice().sort(function (a, b) { return a.t - b.t; });
  }

  /**
   * H, or the Jot card's button (D74; Classroom D11). Returns
   * { jots, last, result } — result 'new', 'joined', 'noLine' or 'full'.
   * `last` is { id, at, from, to } for the jot a next press may join.
   * state: { jots, last }, input: { now, t, lines, id }: `id` names a new jot.
   */
  function press(state, input) {
    var jots = state.jots || [];
    var last = state.last || null;
    var lines = input.lines || [];
    var i = lineAt(lines, input.t);
    var held = last && input.now - last.at < JOIN_MS ? jots.filter(function (j) { return j.id === last.id; })[0] : null;
    if (held) {
      // Another press inside the window joins the line before (never past the
      // first line), the jot's time moving back to it. The window restarts.
      if (last.from <= 0) return { jots: jots, last: Object.assign({}, last, { at: input.now }), result: 'joined' };
      var from = last.from - 1;
      var text = clean(lines.slice(from, last.to + 1).map(function (l) { return l.text; }).join(' '));
      var next = jots.map(function (j) { return j.id === held.id ? Object.assign({}, j, { t: round1(lines[from].t), text: text }) : j; });
      return { jots: sorted(next), last: { id: held.id, at: input.now, from: from, to: last.to }, result: 'joined' };
    }
    if (i < 0) return { jots: jots, last: null, result: 'noLine' };
    if (jots.length >= MAX_JOTS) return { jots: jots, last: null, result: 'full' };
    var jot = { id: input.id, t: round1(lines[i].t), kind: 'line', text: clean(lines[i].text) };
    return { jots: sorted(jots.concat([jot])), last: { id: jot.id, at: input.now, from: i, to: i }, result: 'new' };
  }

  /** Jot it on a Digest line (Round 11, Classroom's onJot): the chosen words
   *  as a line jot at the line's start. Returns the jots, or null (nothing
   *  to add, or no room). */
  function lineJot(jots, input) {
    var text = clean(input.text);
    if (!text || !num(input.t) || input.t < 0 || jots.length >= MAX_JOTS) return null;
    return sorted(jots.concat([{ id: input.id, t: round1(input.t), kind: 'line', text: text }]));
  }

  /** The stretches whose failure is ZH_FAIL_RETRY_MS old at `nowMs`. */
  function zhRetryDue(failedAt, nowMs) {
    return Object.keys(failedAt || {}).map(Number).filter(function (from) {
      return num(failedAt[from]) && nowMs - failedAt[from] >= ZH_FAIL_RETRY_MS;
    });
  }

  /** A typed note at `t` (the composer). Returns the jots, or null when there
   *  is nothing to add or no room. */
  function note(jots, input) {
    var text = clean(input.text);
    if (!text || !num(input.t) || input.t < 0 || jots.length >= MAX_JOTS) return null;
    return sorted(jots.concat([{ id: input.id, t: round1(input.t), kind: 'note', text: text }]));
  }

  function removeIds(jots, ids) {
    var gone = {};
    (ids || []).forEach(function (id) { gone[id] = true; });
    return (jots || []).filter(function (j) { return !gone[j.id]; });
  }

  /** Jots read back from chrome.storage.local, checked: anything malformed is dropped. */
  function parseStored(x) {
    if (!Array.isArray(x)) return [];
    return sorted(x.filter(function (j) {
      return j && typeof j.id === 'string' && j.id.length <= 64 && num(j.t) && j.t >= 0 && (j.kind === 'line' || j.kind === 'note') && typeof j.text === 'string' && j.text.trim();
    }).slice(0, MAX_JOTS).map(function (j) {
      var o = { id: j.id, t: j.t, kind: j.kind, text: clean(j.text) };
      // Who made it (Round 11): H ('key', the small H mark) or the professor's insights.
      if (j.by === 'key' || j.by === 'professor') o.by = j.by;
      return o;
    }));
  }

  /** What leaves the device: {t, kind, text}, no ids. */
  function wireJots(jots) {
    return (jots || []).map(function (j) { return { t: round1(j.t), kind: j.kind, text: clean(j.text) }; }).filter(function (j) { return j.text; });
  }

  function storeKey(youtubeId) {
    return STORE_PREFIX + youtubeId;
  }

  function stretchOf(t) {
    return Math.floor(Math.max(0, t) / STRETCH) * STRETCH;
  }

  /**
   * D72: which stretch to ask for now, or null. `have` lists stretches already
   * written or on their way ({from}); `duration` stops it at the video's end.
   */
  function zhNeed(o) {
    if (!num(o.t)) return null;
    var have = {};
    (o.have || []).forEach(function (s) { have[s.from] = true; });
    var cur = stretchOf(o.t);
    if (!have[cur]) return cur;
    var next = cur + STRETCH;
    if (o.t - cur >= NEXT_AT * STRETCH && !have[next] && (!num(o.duration) || next < o.duration)) return next;
    return null;
  }

  /** The Chinese for a line, from the stretches written so far, or null. */
  function zhLine(stretches, line) {
    for (var i = 0; i < (stretches || []).length; i++) {
      var s = stretches[i];
      if (line.t < s.from || line.t >= s.to) continue;
      for (var j = 0; j < s.lines.length; j++) {
        if (Math.abs(s.lines[j].t - line.t) < 0.05) return s.lines[j].text;
      }
    }
    return null;
  }

  /** D73: the Digest's starting view for Heddy's language. */
  function defaultView(lang) {
    return lang === 'zh_CN' ? 'bi' : 'en';
  }

  /** The view to show: a stored choice wins, else the language's default. */
  function viewFor(lang, stored) {
    return VIEWS.indexOf(stored) >= 0 ? stored : defaultView(lang);
  }

  /** Lines whose English or Chinese contains every word of the search. */
  function matches(lines, query, zhOf) {
    var words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    var out = [];
    lines.forEach(function (l, i) {
      var hay = (l.text + ' ' + (zhOf ? zhOf(l) || '' : '')).toLowerCase();
      if (words.every(function (w) { return hay.indexOf(w) >= 0; })) out.push(i);
    });
    return out;
  }

  /** Classroom's search (digest-helpers foldText / matchLines): the lines
   *  whose English or Chinese holds the query, accents and case folded. */
  function foldText(s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function matchLines(lines, q, zhOf) {
    var needle = foldText(String(q || '').trim());
    if (!needle) return [];
    var out = [];
    (lines || []).forEach(function (l, i) {
      var z = zhOf ? zhOf(l) : null;
      if (foldText(l.text).indexOf(needle) >= 0 || (z && foldText(z).indexOf(needle) >= 0)) out.push(i);
    });
    return out;
  }

  // The Digest's brief of the professor's insights (digest-helpers briefOf):
  // about two lines, at most 40 words (80 characters of Chinese).
  var BRIEF_MAX_WORDS = 40;
  var BRIEF_MAX_CJK = 80;

  function briefOf(text) {
    var t = String(text || '').trim().replace(/\s+/g, ' ');
    if (!t) return '';
    var cjk = /[\u3400-\u9fff]/.test(t);
    var max = cjk ? BRIEF_MAX_CJK : BRIEF_MAX_WORDS;
    function size(x) { return cjk ? x.replace(/\s/g, '').length : x.split(' ').filter(Boolean).length; }
    if (size(t) <= max) return t;
    var sentences = t.match(/[^.!?…。！？]+[.!?…。！？]+["”’)]*\s*|[^.!?…。！？]+$/g) || [t];
    var out = '';
    for (var i = 0; i < sentences.length; i++) {
      if (size(out + sentences[i]) > max) break;
      out += sentences[i];
    }
    out = out.trim();
    if (!out) out = cjk ? Array.from(t.replace(/\s/g, '')).slice(0, max).join('') : t.split(' ').slice(0, max).join(' ');
    return out.replace(/[\s.,;:!?…。，；：！？]+$/, '') + '…';
  }

  /** The first sentence, beside the folded card's title (teaserOf). */
  function teaserOf(text) {
    var t = String(text || '').trim();
    var m = /^[\s\S]*?(?:[。！？]|[.!?…](?=\s|$))/.exec(t);
    return (m ? m[0] : t).trim();
  }

  // ─── chapters (Round 11b, D93; r11b-contract "Chapters (plugin)") ────────

  var MAX_CHAPTERS = 60;
  var MAX_CHAPTER_TITLE = 120;

  /** "1:02:03" / "12:34" → seconds, or null. */
  function secondsOf(stamp) {
    var m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*$/.exec(String(stamp || ''));
    if (!m) return null;
    return (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
  }

  function chapterTitle(x) {
    return String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAPTER_TITLE);
  }

  /** The page's chapters, checked: [{t, title}] (untrusted) → [{startSec,
   *  endSec, title}], or null when they are not a video's chapters (YouTube's
   *  own rule: the first at 0:00, at least three, each start later than the
   *  last). Needs the video's length for the last chapter's end. */
  function chaptersOf(items, duration) {
    if (!Array.isArray(items) || !num(duration) || duration <= 0) return null;
    var out = [];
    for (var i = 0; i < items.length && out.length < MAX_CHAPTERS; i++) {
      var it = items[i];
      var t = it && num(it.t) ? Math.floor(it.t) : null;
      var title = chapterTitle(it && it.title);
      if (t === null || !title || t >= duration) continue;
      if (out.length && t <= out[out.length - 1].startSec) return null;
      out.push({ startSec: t, title: title });
    }
    if (out.length < 3 || out[0].startSec !== 0) return null;
    return out.map(function (c, k) {
      return { startSec: c.startSec, endSec: k + 1 < out.length ? out[k + 1].startSec : Math.ceil(duration), title: c.title };
    });
  }

  /** Chapters from the description's own timestamps ("0:00 Intro" lines). */
  function chaptersFromText(text, duration) {
    var items = [];
    String(text || '').split(/\n/).forEach(function (line) {
      var m = /^\s*[-–•▶]?\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–:|]?\s*(.+)$/.exec(line);
      if (m) items.push({ t: secondsOf(m[1]), title: m[2] });
    });
    return chaptersOf(items, duration);
  }

  /** No chapters: ten-minute stretches (the Chinese's, D72), titled by time. */
  function stretchChapters(duration, clock) {
    if (!num(duration) || duration <= 0) return null;
    var out = [];
    for (var s = 0; s < duration && out.length < MAX_CHAPTERS; s += STRETCH) {
      var e = Math.min(Math.ceil(duration), s + STRETCH);
      out.push({ startSec: s, endSec: e, title: clock(s) + '–' + clock(e) });
    }
    return out;
  }

  /** The chapter holding `t`, as its index, or -1. */
  function chapterAt(chapters, t) {
    if (!Array.isArray(chapters) || !num(t)) return -1;
    for (var i = 0; i < chapters.length; i++) if (t >= chapters[i].startSec && t < chapters[i].endSec) return i;
    return -1;
  }

  /** Is Heddy still installed under this script? chrome.runtime.id goes when
   *  Heddy is reloaded or removed; touching it may then throw. */
  function alive(chromeApi) {
    try { return !!(chromeApi && chromeApi.runtime && chromeApi.runtime.id); } catch (e) { return false; }
  }

  /**
   * D76: the YouTube script checks its lifeline on every tick; once Heddy is
   * gone it tears down what it drew, stops its interval and never runs again.
   * deps: { isAlive(), teardown(), setInterval, clearInterval, everyMs, tick() }.
   */
  function createLifeline(deps) {
    var dead = false;
    var handle = null;
    function check() {
      if (dead) return false;
      if (deps.isAlive()) return true;
      dead = true;
      if (handle !== null) deps.clearInterval(handle);
      handle = null;
      try { deps.teardown(); } catch (e) { /* the page is ours no longer */ }
      return false;
    }
    function start() {
      handle = deps.setInterval(function () { if (check()) deps.tick(); }, deps.everyMs);
      return handle;
    }
    return { check: check, start: start, dead: function () { return dead; } };
  }

  var api = {
    JOIN_MS: JOIN_MS,
    MAX_JOTS: MAX_JOTS,
    STRETCH: STRETCH,
    NEXT_AT: NEXT_AT,
    ZH_RETRY_MS: ZH_RETRY_MS,
    ZH_TRIES: ZH_TRIES,
    ZH_FAIL_RETRY_MS: ZH_FAIL_RETRY_MS,
    lineJot: lineJot,
    zhRetryDue: zhRetryDue,
    MIN_H: MIN_H,
    BELOW_H: BELOW_H,
    VIEWS: VIEWS,
    layoutFor: layoutFor,
    MIN_COLUMN: MIN_COLUMN,
    deskHeight: deskHeight,
    lineAt: lineAt,
    press: press,
    note: note,
    removeIds: removeIds,
    parseStored: parseStored,
    wireJots: wireJots,
    storeKey: storeKey,
    stretchOf: stretchOf,
    zhNeed: zhNeed,
    zhLine: zhLine,
    defaultView: defaultView,
    viewFor: viewFor,
    matches: matches,
    foldText: foldText,
    MAX_CHAPTERS: MAX_CHAPTERS,
    secondsOf: secondsOf,
    chaptersOf: chaptersOf,
    chaptersFromText: chaptersFromText,
    stretchChapters: stretchChapters,
    chapterAt: chapterAt,
    matchLines: matchLines,
    briefOf: briefOf,
    teaserOf: teaserOf,
    alive: alive,
    createLifeline: createLifeline,
  };
  root.HeddyDeskModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
