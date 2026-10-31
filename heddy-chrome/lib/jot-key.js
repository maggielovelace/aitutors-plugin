// lib/jot-key.js — H on a YouTube watch page (PRD-v0.96.0 D18, D74; artifact
// R2 · F3), with the desk's rules (aitutors.me lib/videos/jots-client.ts,
// PRD-v0.97.0 D11). Since Round 8, H jots into the desk on the page and only
// while it is open (content/youtube.js); the 2.5 s join of the line before is
// lib/desk-model.js press, which reads JOIN_MS from here.
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
//     (Round 11: every element on the event's composed path is checked, and
//     focus is followed into open shadow roots, so a field inside a web
//     component counts; the desk's own closed root is the desk's isTyping);
//   - JOIN_MS: a second press within 2.5 s of the last joins the line before.
//
// Pure.
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

  /** The focused element, followed down through open shadow roots. */
  function deepActive(active) {
    var a = active;
    for (var n = 0; n < 20 && a && a.shadowRoot && a.shadowRoot.activeElement; n++) a = a.shadowRoot.activeElement;
    return a;
  }

  /** Is anything on the event's composed path a field? */
  function pathTypes(e) {
    var path;
    try { path = typeof e.composedPath === 'function' ? e.composedPath() : []; } catch (err) { path = []; }
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n && n.nodeType === 1 && isTypingTarget(n)) return true;
    }
    return false;
  }

  /** Is this keydown an H for Heddy? `active` is document.activeElement: focus
   *  can sit in a field inside a shadow root while the event's target is the
   *  host, so the target, the composed path and the focus are all checked.
   *  keyCode 229 is a key the IME is holding. */
  function isJotKey(e, active) {
    if (!e || e.defaultPrevented || e.repeat || e.isComposing || e.keyCode === 229) return false;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
    var key = typeof e.key === 'string' ? e.key : '';
    var isH = key === 'h' || key === 'H' || (e.code === 'KeyH' && key.length === 1);
    if (!isH) return false;
    return !isTypingTarget(e.target) && !pathTypes(e) && !isTypingTarget(active) && !isTypingTarget(deepActive(active));
  }

  var api = { JOIN_MS: JOIN_MS, TYPING_SELECTOR: TYPING_SELECTOR, isJotKey: isJotKey, isTypingTarget: isTypingTarget };
  root.HeddyJotKey = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
