// lib/tray-tools.js — the tools in the tray under a selection, in the desk's
// order (PRD-v0.96.0 D16, D17, D25; artifact Round 3 · Direction A).
//
// Direction A: nothing is shown before it works. Phase 2 has Jot it only, as
// the one filled (amber) button, then the › menu. Phase 3 adds Explain, Make
// a card and Ask Heddy as outlined buttons after it, each with its window on
// aitutors.me: add the tool here (and its `send` in content/page-tray.js);
// the tray and the popup draw whatever this list holds.
//
//   id       the tool, as heddy:tool names it ('jot' is heddy:jot)
//   label    the message key for its name
//   mark     the constant SVG symbol before the label (lib/marks.js)
//   primary  the one filled button (D17); exactly one tool has it
(function (root) {
  var TOOLS = Object.freeze([
    Object.freeze({ id: 'jot', label: 'trayJotIt', mark: 'h-pen', primary: true }),
  ]);

  // The › menu (artifact R3 · Fix 4): Copy · Select the whole paragraph · a rule ·
  // Clip the whole page.
  var MENU = Object.freeze([
    Object.freeze({ id: 'copy', label: 'menuCopy', kbd: true }),
    Object.freeze({ id: 'paragraph', label: 'menuParagraph' }),
    Object.freeze({ id: 'clip', label: 'menuClipPage', mark: 'h-page', ruleBefore: true }),
  ]);

  var api = { TOOLS: TOOLS, MENU: MENU };
  root.HeddyTrayTools = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
