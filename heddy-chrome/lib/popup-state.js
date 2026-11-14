// lib/popup-state.js — which screen the toolbar popup (or the panel) draws
// (PRD-v0.146.0 § 5, rulings B7–B9). Pure, so the tests can walk every case.
//
//   page        any other web page: the web desk (Sources), unchanged (B7)
//   youtube     a YouTube watch page: Add to My Clips, unchanged (B7)
//   cant        a page Heddy can't read (lib/page-kind.js): why, what to try,
//               Open my Jotters (signed in) or Sign in (signed out)
//   site        aitutors.me itself: Open my Study, carry on, Watch with Heddy
//   first-out   the first time, signed out (or a grown-up): Sign in, I'm new,
//               I'm a parent, what Heddy does in three lines; shown once
//   intro       the first time, a child signed in: three cards, Skip, then
//               the page's own screen; shown once
//   wait        the first time is not over and who is signed in is not known
//               yet: ask /me (lib/who.js), then choose again. The popup draws
//               its frame at once and waits WAIT_MS at most (answerWithin):
//               with no answer by then (`asked`), the page's own screen, and
//               nothing is remembered, so the first time is asked again on
//               the next open. On Safari /me goes by a tab of aitutors.me and
//               can take seconds or never answer; a panel that drew nothing
//               until it did read as a dead button (2026-11-14).
//
// The first time only ever comes on a page Heddy can work on (page, youtube):
// on aitutors.me and on a page it can't read, those screens already lead with
// signing in. local[FIRST_RUN_KEY]: true when the first time is over (every
// install before PRD-v0.146.0 wrote true, so they are never shown the intro);
// 'out' once the signed-out first time was shown, the intro still to come.
(function (root) {
  var C = root.HeddyConfig || (typeof require === 'function' && require('./config.js'));

  /** The page's own screen, ignoring the first time. `o`: { url, cant
   *  (lib/page-kind.js describe(), or null), site, youtube }. */
  function pageState(o) {
    if (o.youtube) return 'youtube';
    if (o.cant) return 'cant';
    if (o.site) return 'site';
    if (/^https?:/.test(String(o.url || ''))) return 'page';
    return 'cant';
  }

  /** Does the first time still have something to show? */
  function firstTimeOpen(local) {
    var l = local || {};
    return l[C.INTRO_KEY] !== true && l[C.FIRST_RUN_KEY] !== true;
  }

  /** The screen. `o`: pageState's, plus `local` (chrome.storage.local's
   *  FIRST_RUN_KEY and INTRO_KEY), `me` (lib/who.js parseMe's answer, or
   *  null while it is not known) and `asked` (true once /me was asked and
   *  the wait is over, answered or not). */
  function choose(o) {
    var base = pageState(o);
    if ((base !== 'page' && base !== 'youtube') || !firstTimeOpen(o.local)) return base;
    var me = o.me;
    if (!me) return o.asked === true ? base : 'wait';
    if (me.signedIn && me.role === 'child') return 'intro';
    // Signed out, or a grown-up: the signed-out first time, once.
    return (o.local || {})[C.FIRST_RUN_KEY] === 'out' ? base : 'first-out';
  }

  // How long the first open waits for /me before it draws the page's own screen.
  var WAIT_MS = 1000;

  /** `promise`'s answer, or null if it has not come within `ms` (or it
   *  failed). Never rejects, and always settles. */
  function answerWithin(promise, ms, later) {
    return new Promise(function (resolve) {
      (later || setTimeout)(function () { resolve(null); }, ms);
      Promise.resolve(promise).then(function (v) { resolve(v == null ? null : v); }, function () { resolve(null); });
    });
  }

  // The intro's end (Skip, or its last card), for remember().
  var INTRO_DONE = 'intro-done';

  /** What to store after showing a screen, or after INTRO_DONE (null: nothing). */
  function remember(state) {
    var o = {};
    if (state === 'first-out') { o[C.FIRST_RUN_KEY] = 'out'; return o; }
    if (state === INTRO_DONE) { o[C.FIRST_RUN_KEY] = true; o[C.INTRO_KEY] = true; return o; }
    return null;
  }

  var api = { INTRO_DONE: INTRO_DONE, WAIT_MS: WAIT_MS, answerWithin: answerWithin, pageState: pageState, firstTimeOpen: firstTimeOpen, choose: choose, remember: remember };
  root.HeddyPopupState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
