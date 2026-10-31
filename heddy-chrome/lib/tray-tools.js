// lib/tray-tools.js — the bar under a picture and under selected words, and
// its Heddy ▾ menu (PRD-v0.96.0 § 1i, D85; artifact round-8-youtube-desk.html
// #web, frames r9f1 and r9f1t — the spec, matched literally).
//
// One bar for both: [Text view | Picture view] · Heddy ▾. Heddy ▾ holds the
// two tools, each tagged "in Heddy's desk" because that is where they open
// (D84: the desk's Ask view, never a window), then a rule, then two page
// actions:
//   a picture   Ask {professor} about it · Make a card | Copy picture · Whole visible page
//   words       Ask {professor} about this · Make a card | Copy words · Select the whole paragraph
// With the desk closed, words get one more item first, Add to Sources, which
// opens the desk (with it open, selected words add themselves, D65). Explain
// is no longer a menu item: it is a chip in the Ask view ("Merge into Ask").
//
// content/box-mode.js draws it under a box, content/page-tray.js under
// words. The icons are Classroom-style line icons (the artifact's SV), as
// constant SVG; every label goes in as text.
(function (root) {
  var SV = Object.freeze({
    ask: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H10l-4.5 3.5V16h-1a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/><path d="M8.5 10.5h7"/>',
    card: '<path d="M12 3.5l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    page: '<path d="M6.5 3v14.5H21"/><path d="M3 6.5h14.5V21"/>',
    text: '<path d="M5 6.5h14M5 11h14M5 15.5h14M5 20h8"/>',
    pic: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    read: '<path d="M3.5 6c2.8-1 5.6-1 8.5 1 2.9-2 5.7-2 8.5-1v12c-2.8-1-5.6-1-8.5 1-2.9-2-5.7-2-8.5-1z"/><path d="M12 7v12"/>',
    jot: '<path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M5.5 19.5 14 11"/>',
    get: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16 9.6"/>',
  });

  function sv(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SV[name] + '</svg>';
  }

  /** The switch on the bar (D64), as the artifact words it. */
  function switchRows(mode) {
    return [
      { mode: 'text', label: 'modeTextView', icon: 'text', pressed: mode === 'text' },
      { mode: 'picture', label: 'modePictureView', icon: 'pic', pressed: mode !== 'text' },
    ];
  }

  /**
   * Heddy ▾'s rows. kind 'picture' | 'words'. o: { deskOpen, any (a box or
   * a picture to act on), full (no room for one more picture) }.
   * label keys take the professor's name as $1 where they name them.
   */
  function menuFor(kind, o) {
    var opts = o || {};
    if (kind === 'picture') {
      var none = opts.any === false;
      return [
        { act: 'ask', label: 'menuAskAboutIt', icon: 'ask', tag: true, disabled: none },
        { act: 'card', label: 'menuMakeCard', icon: 'card', tag: true, disabled: none },
        { sep: true },
        { act: 'copy', label: 'menuCopyPicture', icon: 'copy', disabled: none },
        { act: 'whole', label: 'menuWholePage', icon: 'page', disabled: opts.full === true },
      ];
    }
    var rows = [];
    if (!opts.deskOpen) rows.push({ act: 'add', label: 'menuAddToSources', icon: 'plus' });
    return rows.concat([
      { act: 'ask', label: 'menuAskAboutThis', icon: 'ask', tag: true },
      { act: 'card', label: 'menuMakeCard', icon: 'card', tag: true },
      { sep: true },
      { act: 'copy', label: 'menuCopyWords', icon: 'copy' },
      { act: 'paragraph', label: 'menuParagraph', icon: 'text' },
    ]);
  }

  // The artifact's .hbar and .hmenu, for a shadow root (each surface adds its
  // own :host and position rules).
  var SANS = '"Heddy Manrope",Manrope,Roboto,Arial,sans-serif';
  var CSS =
    '.hbar{display:flex;gap:6px;align-items:center;background:#0d2a52;border-radius:14px;padding:6px;box-shadow:0 10px 26px rgba(0,0,0,.22);white-space:nowrap;line-height:1;font-family:' + SANS + ';-webkit-font-smoothing:antialiased}' +
    '.hbar svg,.hmenu svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block;color:#4b5b73}' +
    '.hbar .sg{display:flex;background:#1e3a66;border-radius:10px;padding:3px}' +
    '.hbar .sg button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;font:700 13px ' + SANS + ';color:#c9d4e6;cursor:pointer}' +
    '.hbar .sg button svg{width:16px;height:16px;color:currentColor}' +
    '.hbar .sg button[aria-pressed="true"]{background:#fff;color:#002147;cursor:default}' +
    '.hbar .hd2{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;background:#1e3a66;border-radius:10px;padding:6px 10px;font:700 13px ' + SANS + ';color:#fff;cursor:pointer}' +
    '.hbar .hd2 .eyes{width:20px;height:20px;border-radius:5px;overflow:hidden;display:block;flex:none}' +
    '.hbar .hd2 .eyes svg{width:100%;height:100%;color:inherit}' +
    '.hbar .hd2[aria-expanded="true"],.hbar .hd2:hover{background:#2a4a7c}' +
    '.hbar button:focus-visible{outline:2px solid #DC9400;outline-offset:1px}' +
    '.hmenu{position:absolute;box-sizing:border-box;width:300px;background:#fff;border:1px solid #d9dde3;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.18);padding:6px;font:600 14px ' + SANS + ';color:#1b1b1f;display:grid}' +
    '.hmenu button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;white-space:nowrap}' +
    '.hmenu button:hover,.hmenu button:focus-visible{background:#eef3fb}.hmenu button:hover svg,.hmenu button:focus-visible svg{color:#2f64d6}' +
    '.hmenu button[aria-disabled="true"]{color:#9aa0a6;cursor:default;background:transparent}' +
    '.hmenu small{margin-left:auto;font:600 10.5px ' + SANS + ';color:#6c7888;background:#f1f3f6;border-radius:999px;padding:2px 8px;letter-spacing:0}' +
    '.hmenu hr{all:unset;display:block;border-top:1px solid #e6e8ec;margin:4px 6px}' +
    '.hmenu[hidden]{display:none}';

  var api = { SV: SV, sv: sv, switchRows: switchRows, menuFor: menuFor, CSS: CSS };
  root.HeddyTrayTools = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
