// lib/heddy-api.js — Round 9's six requests to aitutors.me, made by the
// background (PRD-v0.96.0 § 1i, D78–D86; the Round 9 contract's §§ 1–6).
//
// D78: no window or tab opens unless the child taps a link that says it
// leaves. Every save, Undo, card, jot, clip and conversation goes from here
// to /api/learn/heddy/*, with the browser's own aitutors.me cookie, exactly
// as Round 8's desk requests do (lib/desk-api.js, whose `call` this reuses).
// Heddy still holds no password or token: the cookie is the browser's and
// Heddy never reads it. The site checks the request's Origin is Heddy's
// extension id and that a child is signed in.
//
//   POST /api/learn/heddy/save   Sources → the web Jotter's left page (§ 1)
//   POST /api/learn/heddy/undo   a save, a card, a jot, a clip (§ 2)
//   POST /api/learn/heddy/clip   Add to My Clips, no tab (§ 3)
//   POST /api/learn/heddy/ask    the desk's Ask view, NDJSON (§ 4)
//   POST /api/learn/heddy/card   Keep card (§ 5)
//   POST /api/learn/heddy/jot    Keep as a jot (§ 6)
//
// Every answer is untrusted: each parser keeps only the fields the desk draws,
// and anything else reads as an error. tests/no-network.test.mjs allows
// exactly these paths.
(function (root) {
  var A = root.HeddyDeskAsk || (typeof require === 'function' && require('./desk-ask.js'));
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));

  var BASE = '/api/learn/heddy/';
  var PATHS = { save: BASE + 'save', undo: BASE + 'undo', clip: BASE + 'clip', ask: BASE + 'ask', card: BASE + 'card', jot: BASE + 'jot' };
  // The site's routes run on Vercel, which refuses a body past 4.5 MB.
  var MAX_BODY = 4 * 1024 * 1024;
  // The conversation's stream is cut after this long without a byte.
  var IDLE_MS = 45000;
  var ID = /^[A-Za-z0-9_-]{1,80}$/;
  var JOTTER_PATH = /^\/study\/jotters\/[A-Za-z0-9_-]{1,80}(\/[A-Za-z0-9_-]{1,80})?$/;
  var CLIPS_PATH = /^\/study\/clips(\/[A-Za-z0-9_\-/]{0,200})?(\?[A-Za-z0-9_=&%-]{0,300})?$/;
  var DECK_PATH = /^\/study\/(jotters|cards)(\/[A-Za-z0-9_\-/]{0,200})?(\?[A-Za-z0-9_=&%-]{0,300})?$/;
  var SAVE_ERRORS = ['signed_out', 'too_big', 'invalid', 'failed'];
  var CLIP_ERRORS = ['no_captions', 'cant_keep', 'signed_out', 'invalid', 'limit', 'failed'];
  var KEEP_ERRORS = ['signed_out', 'invalid', 'too_big', 'no_seat', 'cap', 'not_found'];
  var NOTICES = ['new_channel', 'off_map'];

  function num(x) {
    return typeof x === 'number' && isFinite(x);
  }

  function text(x, max) {
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function id(x) {
    return typeof x === 'string' && ID.test(x) ? x : null;
  }

  /** A failed request's error, from its status or its body. */
  function failure(r, allowed) {
    var e = r.data && typeof r.data.error === 'string' ? r.data.error : null;
    if (r.status === 401) return { ok: false, error: 'signed_out' };
    // The site does not know this copy of Heddy (its id): no sign-in helps.
    if (r.status === 403 && e === 'forbidden') return { ok: false, error: 'forbidden' };
    // A 403 is a grown-up (signed_out), or a route's own refusal it names
    // (a forged token's 'invalid', 'no_seat'; contract Changes, site 1, 7).
    if (r.status === 403) return { ok: false, error: e && e !== 'forbidden' && allowed.indexOf(e) >= 0 ? e : 'signed_out' };
    return { ok: false, error: allowed.indexOf(e) >= 0 ? e : 'failed' };
  }

  // ─── the answers ─────────────────────────────────────────────────────────

  /** § 1: where the save went. */
  function parseSave(r) {
    var d = r.data;
    if (r.status < 200 || r.status >= 300 || !d || d.ok !== true) return failure(r, SAVE_ERRORS);
    var jotterId = id(d.jotterId);
    // saveId is null when the only thing sent was an article already there
    // (contract Changes, site 9): nothing new, so no Undo.
    var saveId = id(d.saveId);
    if (!jotterId || typeof d.href !== 'string' || !JOTTER_PATH.test(d.href)) return { ok: false, error: 'failed' };
    var c = d.counts || {};
    return {
      ok: true,
      jotterId: jotterId,
      jotterTitle: text(d.jotterTitle, 120) || null,
      href: d.href,
      saveId: saveId,
      counts: {
        snippets: num(c.snippets) && c.snippets >= 0 ? Math.floor(c.snippets) : 0,
        pictures: num(c.pictures) && c.pictures >= 0 ? Math.floor(c.pictures) : 0,
        article: c.article === true,
      },
      dropped: ['not_study', 'too_long', 'failed', 'daily'].indexOf(d.dropped) >= 0 ? d.dropped : null,
    };
  }

  /** § 2: {ok}. */
  function parseOk(r) {
    return r.status >= 200 && r.status < 300 && r.data && r.data.ok === true ? { ok: true } : failure(r, []);
  }

  /** § 3: the clip kept, or why not. */
  function parseClip(r) {
    var d = r.data;
    if (r.status < 200 || r.status >= 300 || !d || d.ok !== true) return failure(r, CLIP_ERRORS);
    if (typeof d.href !== 'string' || !CLIPS_PATH.test(d.href)) return { ok: false, error: 'failed' };
    var sec = function (x) { return num(x) && x >= 0 ? Math.floor(x) : null; };
    return {
      ok: true, momentId: id(d.momentId), topicId: id(d.topicId), href: d.href, duplicate: d.duplicate === true,
      startSec: sec(d.startSec), endSec: sec(d.endSec),
      notices: Array.isArray(d.notices) ? d.notices.filter(function (n) { return NOTICES.indexOf(n) >= 0; }) : [],
    };
  }

  /** § 5: the card kept in that Jotter's deck. */
  function parseCard(r) {
    var d = r.data;
    if (r.status < 200 || r.status >= 300 || !d || d.ok !== true) return failure(r, KEEP_ERRORS);
    var ids = Array.isArray(d.cardIds) ? d.cardIds.map(id).filter(Boolean).slice(0, 20) : [];
    if (!ids.length) return { ok: false, error: 'failed' };
    return { ok: true, cardIds: ids, jotterId: id(d.jotterId), deckHref: typeof d.deckHref === 'string' && DECK_PATH.test(d.deckHref) ? d.deckHref : null };
  }

  /** § 6: the jot kept on the Jotter's right page. */
  function parseJot(r) {
    var d = r.data;
    if (r.status < 200 || r.status >= 300 || !d || d.ok !== true) return failure(r, KEEP_ERRORS);
    // jotId may be null (site 6): kept, but with no Undo.
    var jotterId = id(d.jotterId);
    if (!jotterId) return { ok: false, error: 'failed' };
    return { ok: true, jotId: id(d.jotId), jotterId: jotterId };
  }

  // ─── what is sent ───────────────────────────────────────────────────────

  /** § 2's body, or null. */
  function undoBody(m) {
    if (!m || typeof m !== 'object') return null;
    if (m.kind === 'save' && id(m.saveId)) return { kind: 'save', saveId: m.saveId };
    if (m.kind === 'card' && Array.isArray(m.cardIds)) {
      var ids = m.cardIds.map(id).filter(Boolean);
      return ids.length && ids.length === m.cardIds.length && ids.length <= 20 ? { kind: 'card', cardIds: ids } : null;
    }
    if (m.kind === 'jot' && id(m.jotId) && id(m.jotterId)) return { kind: 'jot', jotId: m.jotId, jotterId: m.jotterId };
    if (m.kind === 'clip' && id(m.momentId)) return { kind: 'clip', momentId: m.momentId };
    return null;
  }

  /** § 3's body, or null. Times as the capture message validates them
   *  (contract Changes, site 5): start floored, end rounded up. */
  function clipBody(m) {
    if (!m || !P.isYoutubeId(m.youtubeId)) return null;
    var start = num(m.startSec) && m.startSec >= 0 && m.startSec <= 21600 ? Math.floor(m.startSec) : null;
    var end = null;
    if (num(m.endSec) && m.endSec <= 21600 && m.endSec > (num(m.startSec) ? m.startSec : 0)) end = Math.ceil(m.endSec);
    return { youtubeId: m.youtubeId, title: text(m.title, 300), startSec: start, endSec: end };
  }

  /** The size of a JSON body as sent, in bytes (near enough: UTF-16 → UTF-8). */
  function bytesOf(o) {
    var s = JSON.stringify(o);
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(s).length : s.length * 2;
  }

  /**
   * deps: { call (lib/desk-api.js's), origin() → Promise<string>, fetchImpl,
   *         setTimeout?, clearTimeout? }
   */
  function createHeddyApi(deps) {
    var later = deps.setTimeout || setTimeout;
    var cancel = deps.clearTimeout || clearTimeout;

    function post(path, body, parse) {
      if (bytesOf(body) > MAX_BODY) return Promise.resolve({ ok: false, error: 'too_big' });
      return deps.call('POST', path, null, body).then(parse);
    }

    /**
     * § 4: the conversation. Calls onEvent(event) for every checked line,
     * in order, and resolves when the stream ends (an `error` event first
     * when it ended badly). Returns { done: Promise, stop() }.
     */
    function ask(body, onEvent) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = null;
      var over = false;
      function poke() {
        if (!ctrl) return;
        if (timer !== null) cancel(timer);
        timer = later(function () { ctrl.abort(); }, IDLE_MS);
      }
      function emit(ev) { if (!over && ev) onEvent(ev); }
      function fail(code) { emit({ type: 'error', code: code, message: '' }); over = true; }
      if (bytesOf(body) > MAX_BODY) {
        fail('failed');
        return { done: Promise.resolve(), stop: function () {} };
      }
      poke();
      var done = deps.origin()
        .then(function (o) {
          return deps.fetchImpl(o + PATHS.ask, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            redirect: 'error',
            headers: { Accept: 'application/x-ndjson', 'Content-Type': 'application/json', 'X-Heddy-Id': deps.extensionId || '' },
            body: JSON.stringify(body),
            signal: ctrl ? ctrl.signal : undefined,
          });
        })
        .then(function (res) {
          if (!res) return fail('failed');
          if (res.status === 401) return fail('signed_out');
          if (res.status === 403) {
            // A grown-up is signed out for this; an unknown copy of Heddy is 'forbidden'.
            return Promise.resolve(typeof res.json === 'function' ? res.json() : null).catch(function () { return null; })
              .then(function (d) { fail(d && d.error === 'forbidden' ? 'forbidden' : 'signed_out'); });
          }
          if (res.status < 200 || res.status >= 300 || !res.body || typeof res.body.getReader !== 'function') return fail('failed');
          var reader = res.body.getReader();
          var dec = new TextDecoder();
          var split = A.createSplitter();
          var finished = false;
          function take(lines) {
            if (lines === null) { fail('failed'); return false; }
            lines.forEach(function (l) {
              var ev = A.parseEvent(l);
              if (ev && (ev.type === 'done' || ev.type === 'error')) finished = true;
              emit(ev);
            });
            return true;
          }
          function pump() {
            return reader.read().then(function (step) {
              poke();
              if (step.done) {
                take(split.end());
                if (!finished) fail('failed');
                return null;
              }
              if (!take(split.push(dec.decode(step.value, { stream: true })))) {
                try { reader.cancel(); } catch (e) { /* gone */ }
                return null;
              }
              return finished ? null : pump();
            });
          }
          return pump();
        })
        .catch(function () { fail('failed'); })
        .then(function () {
          over = true;
          if (timer !== null) cancel(timer);
        });
      return {
        done: done,
        stop: function () {
          over = true;
          if (ctrl) ctrl.abort();
        },
      };
    }

    return {
      save: function (body) { return post(PATHS.save, body, parseSave); },
      undo: function (m) {
        var b = undoBody(m);
        return b ? post(PATHS.undo, b, parseOk) : Promise.resolve({ ok: false, error: 'invalid' });
      },
      clip: function (m) {
        var b = clipBody(m);
        return b ? post(PATHS.clip, b, parseClip) : Promise.resolve({ ok: false, error: 'invalid' });
      },
      card: function (body) { return post(PATHS.card, body, parseCard); },
      jot: function (body) { return post(PATHS.jot, body, parseJot); },
      ask: ask,
    };
  }

  var api = {
    PATHS: PATHS,
    MAX_BODY: MAX_BODY,
    IDLE_MS: IDLE_MS,
    parseSave: parseSave,
    parseOk: parseOk,
    parseClip: parseClip,
    parseCard: parseCard,
    parseJot: parseJot,
    undoBody: undoBody,
    clipBody: clipBody,
    createHeddyApi: createHeddyApi,
  };
  root.HeddyApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
