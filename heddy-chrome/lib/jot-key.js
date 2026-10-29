// lib/jot-key.js — H on a YouTube watch page (PRD-v0.96.0 D18; artifact R2 · F3),
// with the desk's rules (aitutors.me lib/videos/jots-client.ts, PRD-v0.97.0 D11).
//
// The key is H, "H for Heddy" (owner, 2026-10-29), not the desk's J: on
// YouTube J is the player's own "back 10 seconds", and Heddy leaves it alone.
// H is none of YouTube's player keys (k j l f t i m c, the digits, , . < > / and
// the arrows), so Heddy does not need to stop the event either.
//
//   - isJotKey: H (either case, or the H key on any layout), no modifier, not
//     held down, not during IME composition, and not while the child types in
//     a field: an input, a textarea, a select, anything contenteditable or a
//     textbox (YouTube's search box and comment box among them);
//   - createJHold: an H is held for 2.5 s; another H inside that window joins
//     the line before (the window restarts from the newest press), and when it
//     closes Heddy sends ONE heddy:moment: `t` the FIRST press's player time,
//     and `tEnd` the LAST press's (only when there was more than one press),
//     so the site maps the time range to transcript lines. The desk holds its
//     post the same way and posts once.
//
// Pure: the clock and the timers are injected, so the join is a unit test.
(function (root) {
  var JOIN_MS = 2500;

  // The desk's TYPING_SELECTOR, minus its own quiz options (.vq-opt).
  var TYPING_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

  function isTypingTarget(target) {
    var el = target;
    if (!el || typeof el !== 'object') return false;
    if (el.isContentEditable === true) return true;
    var tag = typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (typeof el.closest === 'function') {
      try { return el.closest(TYPING_SELECTOR) !== null; } catch (e) { return false; }
    }
    return false;
  }

  /** Is this keydown an H for Heddy? `active` is document.activeElement: focus
   *  can sit in a field inside a shadow root while the event's target is the
   *  host, so both are checked. keyCode 229 is a key the IME is holding. */
  function isJotKey(e, active) {
    if (!e || e.defaultPrevented || e.repeat || e.isComposing || e.keyCode === 229) return false;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
    var key = typeof e.key === 'string' ? e.key : '';
    var isH = key === 'h' || key === 'H' || (e.code === 'KeyH' && key.length === 1);
    if (!isH) return false;
    return !isTypingTarget(e.target) && !isTypingTarget(active);
  }

  /**
   * deps: { now(), setTimer(fn, ms), clearTimer(h), send({ t, tEnd?, video }) }.
   * press(t, video) takes the player's second at the key press. Returns the hold.
   */
  function createJHold(deps) {
    var pending = null; // { t, tEnd, at, timer, video }

    function sameVideo(a, b) {
      return (a && a.youtubeId) === (b && b.youtubeId);
    }

    function fire() {
      var p = pending;
      if (!p) return;
      pending = null;
      var out = { t: p.t, video: p.video };
      if (p.tEnd !== null) out.tEnd = p.tEnd;
      deps.send(out);
    }

    /** `video` is what the J belongs to (the id and title read at the press),
     *  so a J still waiting when the video changes goes under ITS video. A
     *  press on another video never joins. */
    function press(t, video) {
      var at = deps.now();
      if (pending && at - pending.at < JOIN_MS && sameVideo(pending.video, video)) {
        // Never before the first press (the child may have scrubbed back).
        pending.tEnd = Math.max(pending.t, t);
        pending.at = at;
        deps.clearTimer(pending.timer);
        pending.timer = deps.setTimer(fire, JOIN_MS);
        return 'joined';
      }
      // A press outside the window lets the waiting one go first: its own jot.
      if (pending) {
        deps.clearTimer(pending.timer);
        fire();
      }
      pending = { t: t, tEnd: null, at: at, timer: null, video: video };
      pending.timer = deps.setTimer(fire, JOIN_MS);
      return 'held';
    }

    /** Send a waiting J now (the page is going away or the video changed). */
    function flush() {
      if (!pending) return;
      deps.clearTimer(pending.timer);
      fire();
    }

    return { press: press, flush: flush, waiting: function () { return !!pending; } };
  }

  var api = { JOIN_MS: JOIN_MS, TYPING_SELECTOR: TYPING_SELECTOR, isJotKey: isJotKey, createJHold: createJHold };
  root.HeddyJotKey = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
