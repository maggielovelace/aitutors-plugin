// lib/protocol.js — the messages Heddy exchanges with a /capture window on
// aitutors.me (PRD-v0.96.0 D19, D20). The site's side is lib/capture/protocol.ts
// and lib/capture/transport.ts in the aitutors.me repo; the shapes and the two
// patterns below are copied from there and must stay equal to them.
//
//   page  → Heddy  {type:'heddy:ready',  v:1, cid}
//   Heddy → page   {type:'heddy:add',    v:1, cid, youtubeId, startSec, then}   (the reply, once)
//   page  → Heddy  {type:'heddy:result', v:1, cid, ok, error?}
//
// Phase 1 sends only heddy:add. Everything a page sends is untrusted data.
(function (root) {
  var PROTOCOL_VERSION = 1;
  var YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var MAX_T = 24 * 60 * 60;
  var THEN = ['keep', 'classroom'];
  // Optional extras on heddy:result that make the toast more useful. The site
  // may omit them; nothing else is read from a result.
  var TOPIC_ID = /^[A-Za-z0-9_-]{1,120}$/;
  var MAX_LABEL = 120;
  var ERROR = /^[a-z_]{1,40}$/;
  // The site's locale on a result, and the Heddy language each one matches.
  var SITE_LANGS = { 'en-GB': 'en', 'zh-Hans': 'zh_CN' };

  function isCaptureId(x) {
    return typeof x === 'string' && UUID.test(x);
  }

  function isYoutubeId(x) {
    return typeof x === 'string' && YOUTUBE_ID.test(x);
  }

  function isSeconds(x) {
    return typeof x === 'number' && isFinite(x) && x >= 0 && x <= MAX_T;
  }

  /** The video id of a YouTube watch page, or null for any other address
   *  (Shorts, live, embeds, the home page and other hosts are not watch pages). */
  function youtubeIdFromUrl(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    if (u.protocol !== 'https:' || u.hostname !== 'www.youtube.com' || u.pathname !== '/watch') return null;
    var v = u.searchParams.get('v');
    return isYoutubeId(v) ? v : null;
  }

  /** The start the child chose: null for the whole video, else whole seconds.
   *  "From m:ss" at the very start is the whole video. */
  function startSecFor(choice, currentTime) {
    if (choice !== 'from' || !isSeconds(currentTime)) return null;
    var s = Math.floor(currentTime);
    return s >= 1 ? s : null;
  }

  /** heddy:add, built so that the site's parseHeddyMessage accepts it. Throws
   *  on anything it would refuse, so a bad payload is never handed over. */
  function buildAdd(input) {
    var startSec = input.startSec === undefined ? null : input.startSec;
    if (!isCaptureId(input.cid)) throw new Error('bad cid');
    if (!isYoutubeId(input.youtubeId)) throw new Error('bad youtubeId');
    if (startSec !== null && !isSeconds(startSec)) throw new Error('bad startSec');
    if (THEN.indexOf(input.then) < 0) throw new Error('bad then');
    return {
      type: 'heddy:add',
      v: PROTOCOL_VERSION,
      cid: input.cid,
      youtubeId: input.youtubeId,
      startSec: startSec === null ? null : Math.floor(startSec),
      then: input.then,
    };
  }

  function label(x) {
    if (typeof x !== 'string') return null;
    var s = x.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return s && s.length <= MAX_LABEL ? s : null;
  }

  /** One message from a page, or null when it is not one Heddy answers. */
  function parseExternal(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.v !== PROTOCOL_VERSION || !isCaptureId(data.cid)) return null;
    var cid = data.cid.toLowerCase();
    if (data.type === 'heddy:ready') return { kind: 'ready', cid: cid };
    if (data.type === 'heddy:result') {
      if (typeof data.ok !== 'boolean') return null;
      return {
        kind: 'result',
        cid: cid,
        ok: data.ok,
        error: typeof data.error === 'string' && ERROR.test(data.error) ? data.error : null,
        topicId: typeof data.topicId === 'string' && TOPIC_ID.test(data.topicId) ? data.topicId : null,
        topic: label(data.topic),
        momentId: isCaptureId(data.momentId) ? data.momentId.toLowerCase() : null,
        lang: typeof data.lang === 'string' && Object.prototype.hasOwnProperty.call(SITE_LANGS, data.lang) ? data.lang : null,
      };
    }
    return null;
  }

  /** The topic label for a toast in Heddy's language, or null. The label is in
   *  the site's language; a toast never mixes two, so when the site says its
   *  language and it is not Heddy's, the label is left off. */
  function topicForToast(topic, siteLang, heddyLang) {
    if (typeof topic !== 'string' || !topic) return null;
    if (siteLang && SITE_LANGS[siteLang] !== heddyLang) return null;
    return topic;
  }

  /** m:ss (or h:mm:ss), as the site prints a time. */
  function clockOf(t) {
    var s = Math.max(0, Math.floor(t));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var ss = String(s % 60).padStart(2, '0');
    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
  }

  var api = {
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    YOUTUBE_ID: YOUTUBE_ID,
    UUID: UUID,
    isCaptureId: isCaptureId,
    isYoutubeId: isYoutubeId,
    youtubeIdFromUrl: youtubeIdFromUrl,
    startSecFor: startSecFor,
    buildAdd: buildAdd,
    parseExternal: parseExternal,
    topicForToast: topicForToast,
    clockOf: clockOf,
  };
  root.HeddyProtocol = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
