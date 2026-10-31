// "The extension makes no fetch, XMLHttpRequest or WebSocket call" (PRD Must 2,
// D2, PRIVACY.md), with TWO exceptions, both to aitutors.me with the browser's
// own aitutors.me cookie: D60, GET /api/learn/heddy/me, for the study pass and
// the panel's account row (lib/who.js); and Round 8 (D69–D72, artifact #desk),
// the desk's four requests under /api/learn/heddy/desk/ (lib/desk-api.js); and
// Round 9 (D78–D86), the six under /api/learn/heddy/ (lib/heddy-api.js: save,
// undo, clip, ask, card, jot), all made by the background, which hands them
// the worker's fetch. Scans every file
// a store build ships, comments removed: any mention of fetch at all fails,
// except those two places and the pages that hand them a fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, shippedFiles } from './helpers.mjs';

const CODE = /\.(js|mjs|html|css)$/;

/** Source with comments removed, so a comment may name what code may not do. */
function stripComments(src, file) {
  if (file.endsWith('.html')) return src.replace(/<!--[\s\S]*?-->/g, '');
  // Block comments, then line comments that are not inside a URL ("https://").
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
}

// The one request (lib/who.js) and the pages that hand it their fetch.
const ALLOWED_FETCH = {
  'lib/who.js': [/fetchImpl\(origin \+ PATH, \{ method: 'GET', credentials: 'include'/],
  'popup/popup.js': [/HeddyWho\.loadMe\(window\.fetch\.bind\(window\), ORIGIN\)/],
  'options/options.js': [/W\.loadMe\(window\.fetch\.bind\(window\), origin\)/],
  'background.js': [
    /HeddyDeskApi\.createDeskApi\(\{ chrome: chrome, fetchImpl: fetch\.bind\(self\) \}\)/,
    /HeddyApi\.createHeddyApi\(\{ call: desk\.call, origin: desk\.origin, fetchImpl: fetch\.bind\(self\) \}\)/,
  ],
};

/** Source with the allowed uses taken out, so nothing else may mention fetch. */
function withoutAllowed(src, file) {
  return (ALLOWED_FETCH[file] || []).reduce((s, re) => s.replace(re, ''), src);
}

const FORBIDDEN = [
  [/\bfetch\b/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bsendBeacon\b/, 'navigator.sendBeacon'],
  [/\bimportScripts\s*\(\s*['"`]?\s*(https?:)?\/\//, 'importScripts of a remote URL'],
  [/\bimport\s*\(/, 'dynamic import()'],
  [/\bnew\s+Image\s*\(/, 'new Image() (an image request)'],
  [/\b(src|href)\s*=\s*["']?\s*(https?:)?\/\//i, 'a remote src/href'],
  [/url\(\s*["']?\s*(https?:)?\/\//i, 'a remote CSS url()'],
  [/@import\b/, 'CSS @import'],
];

const files = shippedFiles().filter((f) => CODE.test(f));

test('the scan sees the extension’s code', () => {
  for (const f of ['background.js', 'lib/courier.js', 'content/youtube.js', 'popup/popup.js', 'popup/popup.html', 'options/options.js', 'content/page-tray.js', 'content/extract.js', 'lib/toast.js', 'lib/jot-key.js', 'lib/tray-tools.js']) {
    assert.ok(files.includes(f), `${f} not scanned`);
  }
});

for (const file of files) {
  test(`no network call in ${file}`, () => {
    const src = withoutAllowed(stripComments(read(file), file), file);
    for (const [pattern, name] of FORBIDDEN) {
      assert.ok(!pattern.test(src), `${file} uses ${name}`);
    }
  });
}

test('the comment stripper keeps code that contains a URL', () => {
  const src = stripComments("var a = 'https://aitutors.me'; // fetch(x)\n/* fetch( */ fetch(y)", 'x.js');
  assert.match(src, /https:\/\/aitutors\.me/);
  assert.match(src, /fetch\(y\)/);
  assert.doesNotMatch(src, /fetch\(x\)/);
});

test('the one request (D60) is GET /api/learn/heddy/me on the capture origin, with the browser’s cookie, and each allowed use is really there', () => {
  for (const [file, uses] of Object.entries(ALLOWED_FETCH)) {
    const src = stripComments(read(file), file);
    for (const re of uses) assert.match(src, re, `${file}: the allowed use moved; update this test, do not widen it`);
  }
  const who = read('lib/who.js');
  assert.match(who, /var PATH = '\/api\/learn\/heddy\/me';/);
  assert.equal((stripComments(who, 'lib/who.js').match(/fetchImpl\(/g) || []).length, 1, 'one request, one place');
  assert.doesNotMatch(who, /chrome\.storage|localStorage|sessionStorage|indexedDB/, 'never stored');
});
