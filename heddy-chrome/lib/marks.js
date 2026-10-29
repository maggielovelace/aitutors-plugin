// lib/marks.js — the drawn marks Heddy uses, as constant SVG (no text from any
// page ever goes in here). The eyes mark is A · 02's (D34), the same drawing
// as icons/src/eyes-mark.svg; the line icons are the design artifact's.
(function (root) {
  var EYES =
    '<rect width="48" height="48" rx="11" fill="#002147"/>' +
    '<path d="M10 13 L15 8 L18 13 M38 13 L33 8 L30 13" stroke="#f2ead8" stroke-width="2.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="17" cy="23" r="8.6" fill="#f2ead8"/><circle cx="32" cy="23.5" r="7.2" fill="#f2ead8"/>' +
    '<circle cx="17" cy="23" r="3.8" fill="#002147"/><circle cx="32" cy="23.5" r="3.2" fill="#002147"/>' +
    '<path d="M24.5 31 L21.2 34.4 L24.5 38 L27.8 34.4 Z" fill="#f2ead8"/>';

  var SYMBOLS = {
    'h-eyes': { viewBox: '0 0 48 48', body: EYES },
    'h-film': { viewBox: '0 0 24 24', body: '<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9 L15 12 L10 15 Z" fill="currentColor"/>' },
    'h-clock': { viewBox: '0 0 24 24', body: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5 V12 L15 14" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>' },
    'h-lock': { viewBox: '0 0 24 24', body: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5 V8 a3.5 3.5 0 0 1 7 0 V10.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    'h-open': { viewBox: '0 0 24 24', body: '<path d="M14 5 H19 V10 M19 5 L11 13 M17 14 V19 H5 V7 H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    // Phase 2 (artifact round 2 and Round 3 · A): the tray's pen, the popup's
    // quill for Jot it, the page for Clip this page, the › menu's chevron.
    'h-pen': { viewBox: '0 0 24 24', body: '<path d="M5 19 L6 15 L15.5 5.5 a2 2 0 0 1 3 3 L9 18 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7.5 l3 3" stroke="currentColor" stroke-width="1.8"/>' },
    'h-quill': { viewBox: '0 0 24 24', body: '<path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M5.5 19.5 14 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="15.4" cy="9.2" r="1.1" fill="currentColor"/>' },
    'h-page': { viewBox: '0 0 24 24', body: '<path d="M6 3.5 H14 L18.5 8 V20.5 H6 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3.5 V8 H18.5 M9 12 H15.5 M9 15.5 H15.5" stroke="currentColor" stroke-width="1.6" fill="none"/>' },
    // Phase 3: the tray's Explain and Make a card (the box tray's glyphs), and
    // the popup's (artifact i-explain, i-cardt).
    'h-search': { viewBox: '0 0 24 24', body: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15 L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
    'h-star': { viewBox: '0 0 24 24', body: '<path d="M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.5 L12 16.5 L6.7 19.5 L8 13.6 L3.5 9.6 L9.4 9 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' },
    'h-explain': { viewBox: '0 0 24 24', body: '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4 3.5V16.5H6.5a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 9h7M8.5 12.2h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
    'h-cardt': { viewBox: '0 0 24 24', body: '<rect x="6.5" y="3.5" width="13" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".55"/><rect x="4" y="6" width="13" height="15" rx="2.5" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 11.5h6M7.5 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
    'h-chev': { viewBox: '0 0 24 24', body: '<path d="M8 10 L12 14 L16 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
    'h-cog': { viewBox: '0 0 24 24', body: '<path fill="currentColor" fill-rule="evenodd" d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41l-.36 2.54a7.4 7.4 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>' },
  };

  /** A hidden <svg> sprite of the given symbols, for <use href="#id">. */
  function sprite(ids) {
    return (
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
      ids.map(function (id) {
        return '<symbol id="' + id + '" viewBox="' + SYMBOLS[id].viewBox + '">' + SYMBOLS[id].body + '</symbol>';
      }).join('') +
      '</defs></svg>'
    );
  }

  /** <svg><use/></svg> for one symbol at a size. */
  function use(id, size, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>';
  }

  var api = { SYMBOLS: SYMBOLS, sprite: sprite, use: use };
  root.HeddyMarks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
