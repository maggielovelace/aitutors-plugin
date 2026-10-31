// lib/desk-api.js — the desk's four requests to aitutors.me, made by the
// background (PRD-v0.96.0 D69–D72; the Round 8 contract's §§ 1–4).
//
// The desk lives inside the YouTube page, where an aitutors.me frame would be
// third-party and signed out (artifact #desk). So the desk asks Heddy's
// background, and the background asks aitutors.me with the browser's own
// aitutors.me cookie, exactly as lib/who.js asks /api/learn/heddy/me. Heddy
// still holds no credential: the cookie is the browser's, and Heddy never
// reads it. The site checks the request's Origin is Heddy's extension id and
// that a child is signed in.
//
//   GET  /api/learn/heddy/desk/video?v=&title=          the professor, the Jotter
//   GET  /api/learn/heddy/desk/transcript?v=&title=[&zh=1&from=] the Digest, zh stretches
//   GET  /api/learn/heddy/desk/insights?v=&lang=         Insights, or 404 (drawn disabled)
//   POST /api/learn/heddy/desk/jots                     Save to My Jotters (the
//                                                       desk then shows the Saved card, D86)
//
// Every answer is untrusted: each parser keeps only the fields the desk draws,
// cut to size, and anything else reads as an error. The desk sets every
// string as text. tests/no-network.test.mjs allows exactly these paths.
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var C = root.HeddyConfig || (typeof require === 'function' && require('./config.js'));

  var BASE = '/api/learn/heddy/desk/';
  var PATHS = { video: BASE + 'video', transcript: BASE + 'transcript', insights: BASE + 'insights', jots: BASE + 'jots' };
  var TIMEOUT_MS = 15000;
  // The transcript's first read of a long video goes through the site's
  // captions vendor (an hour-long video took the owner's desk past 15 s, and
  // the desk then said there was no transcript): it gets longer.
  var TRANSCRIPT_TIMEOUT_MS = 60000;
  var MAX_LINES = 8000;
  var MAX_LINE = 2000;
  var MAX_NAME = 40;
  var MAX_PARTS = 40;
  var MAX_PART_TEXT = 4000;
  var HEX = /^#[0-9a-f]{6}$/i;
  var SUBJECT = /^[A-Z]{3,5}$/;
  var JOTTER_HREF = /^\/study\/jotters\/v\/[A-Za-z0-9_-]{11}$/;
  var STATUS = ['ok', 'none', 'locked', 'error'];
  var ZH_STATE = ['idle', 'ready', 'writing', 'failed', 'locked'];
  var INSIGHT_STATUS = ['ok', 'writing', 'failed', 'locked', 'none'];
  var ERROR = { ok: false, error: 'network' };

  function num(x) {
    return typeof x === 'number' && isFinite(x);
  }

  function text(x, max) {
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function linesOf(x) {
    if (!Array.isArray(x)) return [];
    var out = [];
    for (var i = 0; i < x.length && out.length < MAX_LINES; i++) {
      var l = x[i];
      if (!l || !num(l.t) || l.t < 0) continue;
      var s = text(l.text, MAX_LINE);
      if (s) out.push({ t: l.t, text: s });
    }
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  /** § 1: who is signed in and which professor's desk it is. */
  function parseVideo(data) {
    if (!data || typeof data !== 'object') return ERROR;
    if (data.signedIn === false) return { ok: true, signedIn: false };
    if (data.signedIn !== true) return ERROR;
    var p = data.professor || {};
    var name = text(p.name, MAX_NAME) || 'Mentor';
    return {
      ok: true,
      signedIn: true,
      professor: {
        code: typeof p.code === 'string' && SUBJECT.test(p.code) ? p.code : null,
        name: name,
        nameZh: text(p.nameZh, MAX_NAME) || name,
        sc: typeof p.sc === 'string' && HEX.test(p.sc) ? p.sc : null,
        scSoft: typeof p.scSoft === 'string' && HEX.test(p.scSoft) ? p.scSoft : null,
      },
      inMyClips: data.inMyClips === true,
      jotterHref: typeof data.jotterHref === 'string' && JOTTER_HREF.test(data.jotterHref) ? data.jotterHref : null,
    };
  }

  /** § 2: the transcript, and the Chinese stretch asked for. */
  function parseTranscript(data) {
    if (!data || typeof data !== 'object' || STATUS.indexOf(data.status) < 0) return ERROR;
    var zh = null;
    if (data.zh && typeof data.zh === 'object' && num(data.zh.from) && num(data.zh.to) && data.zh.to > data.zh.from) {
      zh = { from: data.zh.from, to: data.zh.to, lines: linesOf(data.zh.lines) };
    }
    return {
      ok: true,
      status: data.status,
      lines: data.status === 'ok' ? linesOf(data.lines) : [],
      zh: zh,
      zhState: ZH_STATE.indexOf(data.zhState) >= 0 ? data.zhState : 'idle',
    };
  }

  /** § 3: /api/videos/insights' answer, kept to what the tab draws. */
  function parseInsights(data) {
    if (!data || typeof data !== 'object' || data.ok !== true || INSIGHT_STATUS.indexOf(data.status) < 0) return { ok: false, error: 'unavailable' };
    var parts = Array.isArray(data.parts) ? data.parts.slice(0, MAX_PARTS) : [];
    return {
      ok: true,
      status: data.status,
      parts: parts.filter(function (p) { return p && num(p.startSec) && p.startSec >= 0; }).map(function (p) {
        var m = p.minutes && num(p.minutes.from) && num(p.minutes.to) ? { from: p.minutes.from, to: p.minutes.to } : null;
        return { startSec: p.startSec, title: text(p.title, 200) || null, minutes: m, text: text(p.text, MAX_PART_TEXT) || null, en: text(p.en, MAX_PART_TEXT) || null, zh: text(p.zh, MAX_PART_TEXT) || null };
      }),
    };
  }

  /** § 4: the save's answer. */
  function parseSaved(data) {
    if (!data || data.ok !== true || !num(data.saved) || typeof data.href !== 'string' || !JOTTER_HREF.test(data.href)) return { ok: false, error: 'save' };
    return { ok: true, saved: Math.max(0, Math.floor(data.saved)), href: data.href };
  }

  /** A status the site answers with no body worth reading. */
  function errorFor(status) {
    if (status === 401) return { ok: false, error: 'unauthenticated' };
    if (status === 403) return { ok: false, error: 'forbidden' };
    if (status === 404) return { ok: false, error: 'unavailable' };
    return ERROR;
  }

  function query(params) {
    return Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; }).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
    }).join('&');
  }

  /**
   * deps: { chrome, fetchImpl, setTimeout?, clearTimeout? }. internal(message,
   * sender) answers heddy-desk:* from the YouTube content script, or returns
   * undefined for any other message.
   */
  function createDeskApi(deps) {
    var chrome = deps.chrome;
    var later = deps.setTimeout || setTimeout;
    var cancel = deps.clearTimeout || clearTimeout;

    function origin() {
      return chrome.storage.local.get(C.DEV_KEY).then(
        function (got) { return C.captureOrigin(!!got && got[C.DEV_KEY] === true); },
        function () { return C.PROD_ORIGIN; }
      );
    }

    /** The one place a desk request is made. Resolves to {status, data}, never rejects. */
    function call(method, path, params, body, waitMs) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctrl ? later(function () { ctrl.abort(); }, waitMs || TIMEOUT_MS) : null;
      return origin()
        .then(function (o) {
          var qs = query(params || {});
          // X-Heddy-Id: Chrome sends NO Origin on a GET from the service
          // worker to a host Heddy has permission for (proven in real Chrome,
          // 2026-10-31: every desk GET was 403 'forbidden', so the desk never
          // loaded and H found no transcript). The header names Heddy's id;
          // a web page cannot send it cross-site without a preflight the site
          // refuses (contract Changes, r9-ext 8).
          var init = { method: method, credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'X-Heddy-Id': chrome.runtime.id }, signal: ctrl ? ctrl.signal : undefined };
          if (body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
          }
          return deps.fetchImpl(o + path + (qs ? '?' + qs : ''), init);
        })
        .then(function (res) {
          if (!res) return { status: 0, data: null };
          return res.json().then(function (data) { return { status: res.status, data: data }; }, function () { return { status: res.status, data: null }; });
        })
        .catch(function () { return { status: 0, data: null }; })
        .then(function (r) {
          if (timer !== null) cancel(timer);
          return r;
        });
    }

    function answer(parse) {
      return function (r) { return r.status >= 200 && r.status < 300 ? parse(r.data) : errorFor(r.status); };
    }

    /** The desk's message, from the watch page of the video it names. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || typeof message.type !== 'string' || message.type.indexOf('heddy-desk:') !== 0) return undefined;
      if (!sender || sender.id !== chrome.runtime.id || !sender.tab || /^chrome-extension:/.test(String(sender.url || ''))) return Promise.resolve({ ok: false });
      var id = message.youtubeId;
      if (!P.isYoutubeId(id) || P.youtubeIdFromUrl(sender.url || sender.tab.url) !== id) return Promise.resolve({ ok: false });
      switch (message.type) {
        case 'heddy-desk:video':
          return call('GET', PATHS.video, { v: id, title: text(message.title, 300) }).then(answer(parseVideo));
        case 'heddy-desk:transcript': {
          var from = num(message.zhFrom) && message.zhFrom >= 0 ? Math.floor(message.zhFrom) : null;
          // &title= helps the site pick the subject for the Chinese (contract Changes, site 7).
          var q = { v: id, title: text(message.title, 300) };
          if (from !== null) { q.zh = 1; q.from = from; }
          return call('GET', PATHS.transcript, q, undefined, TRANSCRIPT_TIMEOUT_MS).then(answer(parseTranscript));
        }
        case 'heddy-desk:insights':
          return call('GET', PATHS.insights, { v: id, lang: message.lang === 'zh' ? 'zh' : 'en' }).then(answer(parseInsights));
        case 'heddy-desk:save-jots': {
          var jots;
          try { jots = P.jotsOf(message.jots); } catch (e) { return Promise.resolve({ ok: false, error: 'bad_jots' }); }
          if (!jots.length) return Promise.resolve({ ok: false, error: 'bad_jots' });
          var body = {
            youtubeId: id,
            title: text(message.title, 300),
            channel: text(message.channel, 200),
            durationSec: num(message.durationSec) && message.durationSec > 0 ? Math.round(message.durationSec) : null,
            jots: jots,
          };
          // Round 9 (D86): no tab opens by itself. The desk shows the Saved
          // card, and its Open my Jotter ↗ is the one tap that leaves.
          return call('POST', PATHS.jots, null, body).then(answer(parseSaved));
        }
        default:
          return Promise.resolve({ ok: false });
      }
    }

    return { internal: internal, call: call, origin: origin };
  }

  var api = {
    PATHS: PATHS,
    TIMEOUT_MS: TIMEOUT_MS,
    TRANSCRIPT_TIMEOUT_MS: TRANSCRIPT_TIMEOUT_MS,
    parseVideo: parseVideo,
    parseTranscript: parseTranscript,
    parseInsights: parseInsights,
    parseSaved: parseSaved,
    createDeskApi: createDeskApi,
  };
  root.HeddyDeskApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
