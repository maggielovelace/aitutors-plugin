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
  var FIRST_RUN_KEY = 'seenFirstRun';
  // PRD-v0.146.0 B9: the signed-in three-card intro, shown once. FIRST_RUN_KEY
  // is `true` once the first time is over (every install before 0.10 wrote
  // true, so they never see the intro), or 'out' after the signed-out first
  // time was shown, when the intro still waits for the first signed-in open.
  var INTRO_KEY = 'seenIntro';
  // The store ids (PRD-v0.146.0 § 6), shown only in Settings' For school IT.
  var STORE_IDS = {
    chrome: 'cldkeocpehghpebfjdckhpdglbmjmocc',
    edge: 'hfgjgfghbdnbmgdbecjddmniaafmjpkl',
    safari: 'me.aitutors.heddy.safari.Extension',
  };
  var BROWSERS = ['chrome', 'edge', 'safari-mac', 'safari-ios'];
  // Each browser's own page for extension shortcuts; Safari has none.
  var SHORTCUTS_URL = { chrome: 'chrome://extensions/shortcuts', edge: 'edge://extensions/shortcuts' };
  // About Heddy's privacy link (D60): PRIVACY.md in this public repository,
  // the same page the Web Store listing names.
  var PRIVACY_URL = 'https://github.com/maggielovelace/aitutors-plugin/blob/main/heddy-chrome/PRIVACY.md';

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

  /** Open in Jotter after Jot it or Save page to Jotters: the Jotter the site named
   *  (a UUID, checked by the protocol), else the Jotters shelf. */
  function jotterById(origin, jotterId) {
    return jotterId ? origin + '/study/jotters/' + encodeURIComponent(jotterId) : origin + '/study/jotters';
  }

  /** The browser Heddy runs in (PRD-v0.146.0 § 4): 'chrome', 'edge',
   *  'safari-mac' or 'safari-ios'. `env`: { baseUrl, brands, userAgent,
   *  maxTouchPoints }. Safari is told by its own extension scheme (the flag
   *  background.js already uses); iPhone and iPad by the user agent, an iPad
   *  that asks for desktop sites by its touch points; Edge by its brand, or
   *  "Edg/" in the user agent. Anything else is Chrome. Pure. */
  function browserOf(env) {
    var e = env || {};
    var ua = String(e.userAgent || '');
    if (/^safari-web-extension:/.test(String(e.baseUrl || ''))) {
      if (/\b(iPhone|iPad|iPod)\b/.test(ua) || (/\bMacintosh\b/.test(ua) && Number(e.maxTouchPoints) > 1)) return 'safari-ios';
      return 'safari-mac';
    }
    var brands = Array.isArray(e.brands) ? e.brands : [];
    if (brands.some(function (b) { return b && /^Microsoft Edge$/.test(String(b.brand)); }) || /\bEdg\//.test(ua)) return 'edge';
    return 'chrome';
  }

  /** browserOf() for this page or worker. */
  function detectBrowser(g) {
    var r = g || root;
    var nav = r.navigator || {};
    var base = '';
    try { base = r.chrome && r.chrome.runtime && r.chrome.runtime.getURL ? r.chrome.runtime.getURL('/') : ''; } catch (e) { base = ''; }
    return browserOf({ baseUrl: base, brands: nav.userAgentData && nav.userAgentData.brands, userAgent: nav.userAgent, maxTouchPoints: nav.maxTouchPoints });
  }

  /** The first-run page (PRD D8): opened once, when Heddy is installed, and
   *  from the popup's first-time state. In Heddy's language: /zh for zh_CN.
   *  PRD-v0.146.0 P2: ?b= names the browser so the page opens on its tab
   *  (the site trusts it only for that, and falls back to the user agent). */
  function welcomeUrl(origin, lang, browser) {
    var b = BROWSERS.indexOf(browser) >= 0 ? '?b=' + browser : '';
    return origin + (lang === 'zh_CN' ? '/zh' : '') + '/heddy-chrome/welcome' + b;
  }

  /** The help guide (Settings › About), in Heddy's language. */
  function helpUrl(origin, lang) {
    return origin + (lang === 'zh_CN' ? '/zh' : '') + '/docs/heddy-for-chrome';
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
    FIRST_RUN_KEY: FIRST_RUN_KEY,
    INTRO_KEY: INTRO_KEY,
    STORE_IDS: STORE_IDS,
    BROWSERS: BROWSERS,
    SHORTCUTS_URL: SHORTCUTS_URL,
    browserOf: browserOf,
    detectBrowser: detectBrowser,
    helpUrl: helpUrl,
    PRIVACY_URL: PRIVACY_URL,
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
