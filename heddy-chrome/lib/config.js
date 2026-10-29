// lib/config.js — where Heddy sends a capture, and who may answer it.
//
// Production is https://aitutors.me. A developer building aitutors.me locally
// can switch captures to http://localhost:3000 on the options page; that
// switch lives in chrome.storage.local (this computer only) and is off by
// default. The two origins are the manifest's externally_connectable list,
// and tests/manifest.test.mjs keeps them equal.
(function (root) {
  var PROD_ORIGIN = 'https://aitutors.me';
  var DEV_ORIGIN = 'http://localhost:3000';
  var DEV_KEY = 'devOrigin';
  var START_KEY = 'startChoice';
  var FIRST_RUN_KEY = 'seenFirstRun';

  // The capture window (artifact R2 · F1): a Chrome popup window, 420 × 576,
  // 44 px in from the right of the browser window and 150 px down from its top.
  var WINDOW = { width: 420, height: 576, right: 44, top: 150 };

  function captureOrigin(devMode) {
    return devMode ? DEV_ORIGIN : PROD_ORIGIN;
  }

  /** Origins whose pages may claim a payload or report a result. The dev
   *  origin is accepted only while the developer switch is on. */
  function allowedOrigins(devMode) {
    return devMode ? [PROD_ORIGIN, DEV_ORIGIN] : [PROD_ORIGIN];
  }

  function originOf(href) {
    try { return new URL(href).origin; } catch (e) { return null; }
  }

  function captureUrl(origin, page, cid) {
    return origin + '/capture/' + page + '?cid=' + encodeURIComponent(cid);
  }

  /** The toast's Open, best first: the topic's clip page, which plays any
   *  clip on the child's map with the desk (topicId); an off-map clip in
   *  Mentor's Classroom (momentId); else My Clips. */
  function clipsUrl(origin, where) {
    var w = where || {};
    if (w.topicId && w.youtubeId) {
      return origin + '/study/clips/' + encodeURIComponent(w.topicId) + '?v=' + encodeURIComponent(w.youtubeId);
    }
    if (w.momentId) return origin + '/study/clips/m/' + encodeURIComponent(w.momentId);
    return origin + '/study/clips';
  }

  /** The toast's Open in Jotter after H: the video's Jotter (D25). */
  function jotterUrl(origin, youtubeId) {
    return origin + '/study/jotters/v/' + encodeURIComponent(youtubeId);
  }

  /** Open in Jotter after Jot it or Clip this page: the Jotter the site named
   *  (a UUID, checked by the protocol), else the Jotters shelf. */
  function jotterById(origin, jotterId) {
    return jotterId ? origin + '/study/jotters/' + encodeURIComponent(jotterId) : origin + '/study/jotters';
  }

  /** The first-run page (PRD D8): opened once, when Heddy is installed, and
   *  from the popup's first-time state. In Heddy's language: /zh for zh_CN. */
  function welcomeUrl(origin, lang) {
    return origin + (lang === 'zh_CN' ? '/zh' : '') + '/heddy-chrome/welcome';
  }

  /** Where the capture window opens, from the browser window it came from. */
  function windowBounds(win) {
    var b = { width: WINDOW.width, height: WINDOW.height };
    if (win && typeof win.left === 'number' && typeof win.width === 'number') {
      b.left = Math.max(win.left, win.left + win.width - WINDOW.width - WINDOW.right);
    }
    if (win && typeof win.top === 'number') b.top = win.top + WINDOW.top;
    return b;
  }

  var api = {
    PROD_ORIGIN: PROD_ORIGIN,
    DEV_ORIGIN: DEV_ORIGIN,
    DEV_KEY: DEV_KEY,
    START_KEY: START_KEY,
    FIRST_RUN_KEY: FIRST_RUN_KEY,
    WINDOW: WINDOW,
    captureOrigin: captureOrigin,
    allowedOrigins: allowedOrigins,
    originOf: originOf,
    captureUrl: captureUrl,
    clipsUrl: clipsUrl,
    jotterUrl: jotterUrl,
    jotterById: jotterById,
    welcomeUrl: welcomeUrl,
    windowBounds: windowBounds,
  };
  root.HeddyConfig = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
