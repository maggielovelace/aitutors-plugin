// Round 12 (0.7.1): no Quiz tab while the video has no quiz, the tab row is
// Classroom's and never scrolls, a Digest time plays the video, and the Jot
// composer leaves no band of rows under it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMarks = load('./lib/marks.js');
const SH = load('./lib/desk-shell.js');
const desk = read('content/desk.js');

test('the version is 0.7.1, with no new permission', () => {
  const m = manifest();
  assert.equal(m.version, '0.7.1');
  assert.deepEqual(m.permissions, ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage']);
});

test('no quiz, no Quiz tab (as Classroom): Jot · Digest · Insights and the crest; the arrows and the pill walk those', () => {
  assert.match(desk, /\[\['jot', 'jot'\], \['digest', 'digest'\], \['insights', 'insights'\]\]\.forEach/);
  assert.doesNotMatch(desk, /\['quiz', 'quiz'\]/);
  assert.match(desk, /return \['jot', 'digest', 'insights'\]\.filter\(tabLive\)\.concat\(\['ask'\]\);/);
});

test('the tab row is Classroom’s: 48 px, 16 px in, 4 px gaps, 10 px tabs, 14 px / 700 muted words, the 34 px pill at 12% with a 2 px base', () => {
  assert.match(SH.CSS, /\.tabs\{position:relative;height:48px;display:flex;align-items:stretch;gap:4px;padding:0 16px;border-bottom:1px solid var\(--line\);flex:none;min-width:0;overflow:clip;background:var\(--surface\)\}/);
  assert.match(SH.CSS, /\.tab\{position:relative;display:inline-flex;align-items:center;gap:6px;padding:0 10px;font:700 14px\/1 [^;]+;color:var\(--muted\);white-space:nowrap\}/);
  assert.match(SH.CSS, /\.ind\{position:absolute;left:0;width:0;bottom:7px;height:34px;border-radius:10px;background:color-mix\(in srgb,var\(--sc\) 12%,transparent\);box-shadow:inset 0 -2px 0 var\(--sc\);pointer-events:none\}/);
  assert.match(SH.CSS, /\.tab:focus-visible\{outline:2px solid var\(--sc\);outline-offset:-6px;border-radius:10px\}/);
});

test('the row never scrolls sideways: overflow:clip on the row and the card, and focus never scrolls it', () => {
  assert.match(SH.CSS, /border-radius:16px;overflow:clip;/);
  assert.match(desk, /if \(b\) b\.focus\(\{ preventScroll: true \}\);/);
});

test('a Digest line’s time seeks and plays the video (if paused, play)', () => {
  assert.match(desk, /ts\.addEventListener\('click', function \(\) \{ seekPlay\(l\.t\); \}\);/);
  assert.match(desk, /function seekPlay\(t\) \{\n      seek\(t\);\n      var v = video\(\);\n      if \(v && v\.paused\) \{/);
});

test('the Jot composer sits at the panel’s foot with nothing under it (no sticky bottom against the panel’s padding)', () => {
  assert.match(SH.CSS, /\.pn\{flex:1;min-height:0;padding:16px 18px 0;/, 'the panel has no bottom padding for rows to show through');
  const cp = SH.CSS.match(/\.cp\{[^}]*\}/)[0];
  assert.doesNotMatch(cp, /sticky/);
  assert.match(cp, /margin-top:auto/);
});
