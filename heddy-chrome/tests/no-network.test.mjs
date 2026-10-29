// "The extension makes no fetch, XMLHttpRequest or WebSocket call" (PRD Must 2,
// D2, PRIVACY.md). Scans every file a store build ships, comments removed.
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

const FORBIDDEN = [
  [/\bfetch\s*\(/, 'fetch('],
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
    const src = stripComments(read(file), file);
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
