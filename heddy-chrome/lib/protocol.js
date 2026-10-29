// lib/protocol.js — the messages Heddy exchanges with a /capture window on
// aitutors.me (PRD-v0.96.0 D19, D20). The site's side is lib/capture/protocol.ts
// and lib/capture/transport.ts in the aitutors.me repo; the shapes and the two
// patterns below are copied from there and must stay equal to them.
//
//   page  → Heddy  {type:'heddy:ready',  v:1, cid}
//   Heddy → page   {type:'heddy:add',    v:1, cid, youtubeId, startSec, then}   (the reply, once)
//   Heddy → page   {type:'heddy:moment', v:1, cid, youtubeId, t, tEnd?}        J on YouTube
//   Heddy → page   {type:'heddy:undo',   v:1, cid, jotId, jotterId?}            Undo on the toast
//   Heddy → page   {type:'heddy:jot',    v:1, cid, url, title, quote, context}  Jot it
//   Heddy → page   {type:'heddy:page',   v:1, cid, url, title, markdown, cut?}  Clip this page
//   page  → Heddy  {type:'heddy:result', v:1, cid, ok, error?, quote?, t?, jotId?, jotterId?}
//
// `tEnd` on heddy:moment is the player time of the LAST J in a chain of
// presses each within 2.5 s of the one before (PRD-v0.97.0 D11); `t` is the
// FIRST. Sent only for more than one press, never less than t and at most
// 120 s after it (the site refuses a wider range); the site joins every line
// from the one at t through the one at tEnd. The site's parser drops a field it does not know, so an older
// site saves the one line. Everything a page sends is untrusted data.
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
  // The quote a result carries back for the toast (the site's JOT_QUOTE_MAX is larger;
  // the toast clamps it to three lines anyway).
  var MAX_RESULT_QUOTE = 2000;
  // Jot it (D5, D20): the words either side of a selection, and the site's outer
  // bound on a field (lib/capture/protocol.ts MAX_FIELD).
  var CONTEXT_SIDE = 300;
  var MAX_FIELD = 20000;
  var MAX_TITLE = 300;
  var MAX_URL = 2048;
  // Clip this page (D20, Must 6): at most 200 KB of UTF-8, as the site counts it
  // (lib/jotters/storage.ts MAX_PAGE_BYTES).
  var MAX_PAGE_BYTES = 200 * 1024;
  // heddy:moment's tEnd may be at most this many seconds after t (site rule).
  var MAX_SPAN = 120;

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

  /** heddy:moment: J on a watch page. `tEnd` (the last press of a chain) is
   *  sent only when the caller gives one; it may not be before `t`, and a
   *  range wider than 120 s is clamped to t + 120 rather than lose the jot. */
  function buildMoment(input) {
    if (!isCaptureId(input.cid)) throw new Error('bad cid');
    if (!isYoutubeId(input.youtubeId)) throw new Error('bad youtubeId');
    if (!isSeconds(input.t)) throw new Error('bad t');
    var tEnd = input.tEnd == null ? null : input.tEnd;
    if (tEnd !== null && (!isSeconds(tEnd) || tEnd < input.t)) throw new Error('bad tEnd');
    var out = { type: 'heddy:moment', v: PROTOCOL_VERSION, cid: input.cid, youtubeId: input.youtubeId, t: Math.floor(input.t) };
    if (tEnd !== null) out.tEnd = Math.min(Math.floor(tEnd), out.t + MAX_SPAN);
    return out;
  }

  /** heddy:undo: delete a jot Heddy just saved. A web jot (Jot it on a page,
   *  a picture jot) also names its Jotter, `jotterId`, from that save's
   *  heddy:result, so the site deletes it from the Jotter and not from the
   *  clips; an H jot on a video sends `jotId` alone. */
  function buildUndo(input) {
    if (!isCaptureId(input.cid)) throw new Error('bad cid');
    if (!isCaptureId(input.jotId)) throw new Error('bad jotId');
    var out = { type: 'heddy:undo', v: PROTOCOL_VERSION, cid: input.cid, jotId: input.jotId.toLowerCase() };
    if (input.jotterId != null) {
      if (!isCaptureId(input.jotterId)) throw new Error('bad jotterId');
      out.jotterId = input.jotterId.toLowerCase();
    }
    return out;
  }

  /** A page address as Heddy sends it: http(s), without the #fragment. Null otherwise. */
  function pageUrl(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.hash = '';
    var out = u.href;
    return out.length <= MAX_URL ? out : null;
  }

  /** Text from a page, made one line of plain characters: control characters
   *  out, runs of white space one space. */
  function flat(x) {
    return typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim() : '';
  }

  /** The words around a selection: at most 300 characters of each side,
   *  cut at the side away from the quote. */
  function contextOf(before, after) {
    var b = flat(before);
    var a = flat(after);
    if (b.length > CONTEXT_SIDE) b = b.slice(b.length - CONTEXT_SIDE);
    if (a.length > CONTEXT_SIDE) a = a.slice(0, CONTEXT_SIDE);
    return { before: b, after: a };
  }

  /** heddy:jot. The quote keeps its line breaks (they are the child's words);
   *  `context` is the words before, " … ", the words after (each ≤ 300). */
  function buildJot(input) {
    if (!isCaptureId(input.cid)) throw new Error('bad cid');
    var url = pageUrl(input.url);
    if (!url) throw new Error('bad url');
    var quote = typeof input.quote === 'string' ? input.quote.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
    if (!quote) throw new Error('no quote');
    if (quote.length > MAX_FIELD) quote = quote.slice(0, MAX_FIELD);
    var c = contextOf(input.before, input.after);
    var context = c.before && c.after ? c.before + ' … ' + c.after : c.before || c.after;
    return { type: 'heddy:jot', v: PROTOCOL_VERSION, cid: input.cid, url: url, title: flat(input.title).slice(0, MAX_TITLE), quote: quote, context: context };
  }

  /** UTF-8 bytes of a string, as the site measures a page. */
  function utf8Bytes(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  /** The first 200 KB of UTF-8 of a page's Markdown, cut at a paragraph
   *  boundary (owner, 2026-10-29: cut, don't refuse). A first paragraph that
   *  is itself too long is cut at the last whole character that fits.
   *  Returns { markdown, cut }. */
  function cutMarkdown(markdown, max) {
    var limit = max || MAX_PAGE_BYTES;
    if (utf8Bytes(markdown) <= limit) return { markdown: markdown, cut: false };
    var paras = markdown.split(/\n{2,}/);
    var kept = [];
    var bytes = 0;
    for (var i = 0; i < paras.length; i++) {
      var add = utf8Bytes(paras[i]) + (kept.length ? 2 : 0);
      if (bytes + add > limit) break;
      kept.push(paras[i]);
      bytes += add;
    }
    if (kept.length && kept.join('').trim()) return { markdown: kept.join('\n\n'), cut: true };
    var out = '';
    var n = 0;
    for (var j = 0; j < markdown.length; j++) {
      var c = markdown.charCodeAt(j);
      var pair = c >= 0xd800 && c <= 0xdbff && j + 1 < markdown.length && (markdown.charCodeAt(j + 1) & 0xfc00) === 0xdc00;
      var ch = pair ? markdown.slice(j, j + 2) : markdown[j];
      var w = utf8Bytes(ch);
      if (n + w > limit) break;
      out += ch;
      n += w;
      if (pair) j++;
    }
    return { markdown: out, cut: true };
  }

  /** heddy:page, or throws 'empty' for a page with no text. Past 200 KB of
   *  UTF-8 the Markdown is cut (cutMarkdown) and the message says `cut: true`. */
  function buildPage(input) {
    if (!isCaptureId(input.cid)) throw new Error('bad cid');
    var url = pageUrl(input.url);
    if (!url) throw new Error('bad url');
    var markdown = typeof input.markdown === 'string' ? input.markdown : '';
    if (!markdown.trim()) throw new Error('empty');
    var c = cutMarkdown(markdown, MAX_PAGE_BYTES);
    var out = { type: 'heddy:page', v: PROTOCOL_VERSION, cid: input.cid, url: url, title: flat(input.title).slice(0, MAX_TITLE), markdown: c.markdown };
    if (c.cut) out.cut = true;
    return out;
  }

  function label(x) {
    if (typeof x !== 'string') return null;
    var s = x.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return s && s.length <= MAX_LABEL ? s : null;
  }

  /** One message from a page, or null when it is not one Heddy answers. */
  /** 1–10 card ids (UUIDs), lowercased, or null for anything else. */
  var MAX_CARD_IDS = 10;
  function cardIdsOf(x) {
    if (!Array.isArray(x) || x.length < 1 || x.length > MAX_CARD_IDS || !x.every(isCaptureId)) return null;
    return x.map(function (id) { return id.toLowerCase(); });
  }

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
        quote: typeof data.quote === 'string' && data.quote.trim() ? data.quote.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_RESULT_QUOTE) : null,
        t: isSeconds(data.t) ? Math.floor(data.t) : null,
        jotId: isCaptureId(data.jotId) ? data.jotId.toLowerCase() : null,
        jotterId: isCaptureId(data.jotterId) ? data.jotterId.toLowerCase() : null,
        // Make a card (Phase 3): the cards Keep card made, for the toast's Undo.
        cardIds: cardIdsOf(data.cardIds),
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
    buildMoment: buildMoment,
    buildUndo: buildUndo,
    buildJot: buildJot,
    buildPage: buildPage,
    pageUrl: pageUrl,
    contextOf: contextOf,
    cardIdsOf: cardIdsOf,
    MAX_CARD_IDS: MAX_CARD_IDS,
    utf8Bytes: utf8Bytes,
    cutMarkdown: cutMarkdown,
    CONTEXT_SIDE: CONTEXT_SIDE,
    MAX_PAGE_BYTES: MAX_PAGE_BYTES,
    MAX_SPAN: MAX_SPAN,
    parseExternal: parseExternal,
    topicForToast: topicForToast,
    clockOf: clockOf,
  };
  root.HeddyProtocol = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
