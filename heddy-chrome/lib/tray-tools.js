// lib/tray-tools.js — the tools in the tray under a selection, in the desk's
// order (PRD-v0.96.0 D16, D17, D25; artifact Round 3 · Direction A).
//
// Direction A: nothing is shown before it works. The one filled (amber)
// button is + Add (Round 5; it was Jot it), then the › menu. Phase 3 adds Explain, Make
// a card and Ask Heddy as outlined buttons after it, each with its window on
// aitutors.me: add the tool here (and its `send` in content/page-tray.js);
// the tray and the popup draw whatever this list holds.
//
//   id       the tool, as heddy:tool names it ('add' adds a card, lib/cards.js)
//   label    the message key for its name
//   mark     the constant SVG symbol before the label (lib/marks.js)
//   primary  the one filled button (D17); exactly one tool has it
(function (root) {
  var TOOLS = Object.freeze([
    // Round 5 (D54, D55): "+ Add" puts the words in the panel's cards and
    // opens the panel; Heddy writes no jot from a page any more.
    Object.freeze({ id: 'add', label: 'trayAddCard', mark: 'h-add', primary: true }),
    // Phase 3 (D15, D20 tool): outlined, each opens its window on aitutors.me
    // through lib/tools.js sendTool. Ask Heddy wears the eyes mark (D34) on
    // a white disc, as the desk's tray does. popupMark is the popup's glyph.
    Object.freeze({ id: 'explain', label: 'trayExplain', mark: 'h-search', popupMark: 'h-explain', primary: false }),
    Object.freeze({ id: 'card', label: 'trayCard', mark: 'h-star', popupMark: 'h-cardt', primary: false }),
    Object.freeze({ id: 'ask', label: 'trayAsk', mark: 'h-eyes', popupMark: 'h-eyes', badge: true, primary: false }),
  ]);

  // The › menu (artifact R3 · Fix 4): Copy · Select the whole paragraph · a rule ·
  // Save the whole page.
  var MENU = Object.freeze([
    Object.freeze({ id: 'copy', label: 'menuCopy', kbd: true }),
    Object.freeze({ id: 'paragraph', label: 'menuParagraph' }),
    Object.freeze({ id: 'clip', label: 'menuClipPage', mark: 'h-page', ruleBefore: true }),
  ]);

  var api = { TOOLS: TOOLS, MENU: MENU };
  root.HeddyTrayTools = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
