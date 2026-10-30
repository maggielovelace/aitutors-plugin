// lib/auto-add.js — when a selection on the page becomes a card by itself
// (PRD-v0.96.0 D65). Pure rules; content/panel.js watches the page and
// lib/cards.js keeps the list.
//
// While Heddy's panel is open in Text mode, a finished selection is the next
// card: the mouse or a key is released, the selection holds still for 400 ms,
// it has at least 2 characters that are not spaces, and it lies in the page
// itself, never in Heddy's own UI, an input, a text area or an editable area.
// Stretching or shrinking it within 5 s replaces the card just added instead
// of adding another. With the panel closed nothing is collected.
(function (root) {
  var STABLE_MS = 400;
  var REPLACE_MS = 5000;
  var MIN_CHARS = 2;
  // Heddy's own hosts in the page: the panel, box mode, the cards' numbers,
  // the page tray, toasts and notes.
  var HEDDY_TAGS = /^HEDDY-/;
  var EDITABLE_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };

  /** At least two characters that are not spaces. */
  function enoughWords(text) {
    return String(text || '').replace(/\s+/g, '').length >= MIN_CHARS;
  }

  /** May this selection become a card? sel: {text, inHeddy, editable,
   *  activeTag}. inHeddy: it starts or ends in one of Heddy's hosts;
   *  editable: in an input, a text area or a contenteditable; activeTag: the
   *  focused element (a selection inside an input reads as the page's). */
  function acceptable(sel) {
    if (!sel || sel.inHeddy || sel.editable) return false;
    if (EDITABLE_TAGS[String(sel.activeTag || '').toUpperCase()]) return false;
    return enoughWords(sel.text);
  }

  /** Is this element (or one of its ancestors, `chain` from the element up)
   *  Heddy's, or editable? chain: [{tag, editable}] where editable is the
   *  element's own isContentEditable. */
  function placeOf(chain) {
    var out = { inHeddy: false, editable: false };
    (chain || []).forEach(function (e) {
      var tag = String(e && e.tag || '').toUpperCase();
      if (HEDDY_TAGS.test(tag)) out.inHeddy = true;
      if (EDITABLE_TAGS[tag] || (e && e.editable)) out.editable = true;
    });
    return out;
  }

  /** The card this selection replaces, or null to add a new one. last: the
   *  card auto-added most recently {id, at}; overlaps: the new selection
   *  shares words with that card's highlight. */
  function replaceTarget(last, now, overlaps) {
    if (!last || !last.id || typeof last.at !== 'number') return null;
    if (!(now - last.at >= 0 && now - last.at <= REPLACE_MS)) return null;
    return overlaps ? last.id : null;
  }

  /** Two ranges share words when each starts before the other ends. The
   *  arguments are Range.compareBoundaryPoints answers for the new range
   *  against the card's: START_TO_END (new end vs card start) and
   *  END_TO_START (new start vs card end). */
  function overlap(endVsStart, startVsEnd) {
    return endVsStart > 0 && startVsEnd < 0;
  }

  var api = {
    STABLE_MS: STABLE_MS,
    REPLACE_MS: REPLACE_MS,
    MIN_CHARS: MIN_CHARS,
    enoughWords: enoughWords,
    acceptable: acceptable,
    placeOf: placeOf,
    replaceTarget: replaceTarget,
    overlap: overlap,
  };
  root.HeddyAutoAdd = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
