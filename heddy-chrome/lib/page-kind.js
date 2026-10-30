// lib/page-kind.js — what kind of page Heddy can't add to Jotters (PRD-v0.96.0
// D61; artifact R6 · owner's pick).
//
// On such a page the panel (or D49's small window) shows Heddy's face, a line
// saying why, the account row and three tiles. The header carries a plain
// chip naming the kind of page, never the raw extension id.
//
//   chrome   Chrome's own pages: chrome://, the new tab, settings, another
//            extension's pages, about:, devtools
//   store    the Chrome Web Store, which Chrome keeps every extension out of
//   heddy    Heddy's own pages (its settings, the panel's page)
//   source   view-source:
//   file     a PDF (on the web or on this computer) or another local file
//   other    any other page Heddy could not read (the script was refused)
//
// kindOf(url, ownId) answers null for a page Heddy can work on. Pure.
(function (root) {
  var STORE_HOSTS = { 'chromewebstore.google.com': 1 };

  /** { kind, chip, line, sub }: the message keys for the header chip and
   *  the two lines under Heddy's face. */
  var KINDS = {
    chrome: { chip: 'kindChrome', line: 'kindChromeLine', sub: 'kindChromeSub' },
    store: { chip: 'kindStore', line: 'kindStoreLine', sub: 'kindStoreSub' },
    heddy: { chip: 'kindHeddy', line: 'kindHeddyLine', sub: 'kindHeddySub' },
    source: { chip: 'kindSource', line: 'kindSourceLine', sub: 'kindSourceSub' },
    file: { chip: 'kindFile', line: 'kindFileLine', sub: 'kindFileSub' },
    other: { chip: 'kindOther', line: 'kindOtherLine', sub: 'kindOtherSub' },
  };

  function parse(url) {
    try { return new URL(String(url || '')); } catch (e) { return null; }
  }

  function isPdfPath(u) {
    return /\.pdf$/i.test(decodeURIComponent(u.pathname || '').replace(/\/+$/, ''));
  }

  /** The kind for an address, or null for a page Heddy may read and save. An
   *  address it cannot even parse (Chrome hides some) is 'other'. */
  function kindOf(url, ownId) {
    if (url == null || url === '') return 'other';
    var s = String(url);
    if (/^view-source:/i.test(s)) return 'source';
    var u = parse(s);
    if (!u) return 'other';
    var p = u.protocol;
    if (p === 'chrome-extension:') return ownId && u.hostname === ownId ? 'heddy' : 'chrome';
    if (p === 'chrome:' || p === 'chrome-untrusted:' || p === 'chrome-search:' || p === 'chrome-native:' || p === 'devtools:' || p === 'about:' || p === 'edge:') return 'chrome';
    if (p === 'file:') return 'file';
    if (p === 'http:' || p === 'https:') {
      if (STORE_HOSTS[u.hostname] || (u.hostname === 'chrome.google.com' && /^\/webstore(\/|$)/.test(u.pathname))) return 'store';
      if (isPdfPath(u)) return 'file';
      return null;
    }
    return 'other';
  }

  /** The chip's own words for Chrome's pages and files, more exact than the
   *  kind: "New tab", "Chrome settings", "Another extension", "PDF file". */
  function chipKey(url, kind) {
    var u = parse(url);
    if (kind === 'chrome' && u) {
      if (u.protocol === 'chrome-extension:') return 'kindExtension';
      var page = u.protocol === 'chrome:' ? u.hostname : '';
      if (page === 'newtab' || page === 'new-tab-page' || u.protocol === 'chrome-search:') return 'kindNewTab';
      if (page === 'settings') return 'kindSettings';
      if (page === 'extensions') return 'kindExtensions';
    }
    if (kind === 'file' && u && !isPdfPath(u)) return 'kindLocalFile';
    if (kind === 'heddy' && u && /\/options\//.test(u.pathname)) return 'kindHeddySettings';
    return KINDS[kind] ? KINDS[kind].chip : KINDS.other.chip;
  }

  /** Everything the panel draws for a page: null, or the kind and its keys. */
  function describe(url, ownId) {
    var kind = kindOf(url, ownId);
    if (!kind) return null;
    var k = KINDS[kind];
    var line = k.line, sub = k.sub;
    // A local file that is not a PDF: no "upload this PDF".
    if (kind === 'file' && chipKey(url, kind) === 'kindLocalFile') { line = 'kindLocalLine'; sub = 'kindLocalSub'; }
    return { kind: kind, chip: chipKey(url, kind), line: line, sub: sub };
  }

  var api = { KINDS: KINDS, kindOf: kindOf, chipKey: chipKey, describe: describe };
  root.HeddyPageKind = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
