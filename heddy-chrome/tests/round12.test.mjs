// Round 12 (0.7.1): no Quiz tab while the video has no quiz, the tab row is
// Classroom's and never scrolls, a Digest time plays the video, and the Jot
// composer leaves no band of rows under it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMarks = load('./lib/marks.js');
const SH = load('./lib/desk-shell.js');
const desk = read('content/desk.js');

test('Round 12 asks for no new permission (the version: tests/round13.test.mjs)', () => {
  const m = manifest();
  assert.notEqual(m.version, '0.7.0');
  assert.deepEqual(m.permissions, ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage']);
});

test('no quiz, no Quiz tab (as Classroom): the Quiz tab is hidden unless the site says ready (D98, D104)', () => {
  assert.match(desk, /ui\.tabs\.quiz\.hidden = !tabLive\('quiz'\);/);
  assert.match(desk, /if \(k === 'quiz'\) return st\.video\.quiz === 'ready'; \/\/ D104/);
  assert.match(desk, /return \['quiz', 'jot', 'digest', 'insights'\]\.filter\(tabLive\)\.concat\(\['ask'\]\);/, 'the arrows and the pill walk only the tabs that are there');
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

// ─── D100: the desk's width is draggable ─────────────────────────────────

const D = load('./lib/desk-model.js');

test('D100 widths: 360–640 px, Classroom’s 410 px by default, never squeezing the video under 480 px', () => {
  assert.deepEqual(D.DESK_W, { min: 360, max: 640, def: 410 });
  assert.equal(D.deskWidth(), 410);
  assert.equal(D.deskWidth(1000), 640);
  assert.equal(D.deskWidth(100), 360);
  assert.equal(D.deskWidth(455.6), 456);
  assert.equal(D.deskWidthFor(640, 1500), 640);
  assert.equal(D.deskWidthFor(640, 1000), 1000 - 72 - 480);
  assert.equal(D.deskWidthFor(640, 800), 360, 'never under the minimum: YouTube’s own layout decides');
});

test('D100 the page’s style: only the two-column watch page, never theatre or fullscreen; removing it restores YouTube', () => {
  const css = D.sidebarCss(520);
  assert.match(css, /^ytd-watch-flexy\[is-two-columns_\]:not\(\[theater\]\):not\(\[fullscreen\]\)\{--ytd-watch-flexy-sidebar-width:520px !important;--ytd-watch-flexy-sidebar-min-width:520px !important\}/);
  assert.match(css, /#secondary\{width:520px !important;min-width:520px !important;max-width:520px !important;flex-basis:520px !important\}$/);
  assert.match(desk, /function clearWidth\(\) \{[\s\S]*tag\.remove\(\);[\s\S]*playerResized\(\);/);
  assert.match(desk, /st = null;\n        \/\/ Last, with the desk gone: the resize it sends must not place it again\.\n        clearWidth\(\);/, 'closing restores the page, after the desk is gone (a live desk would put the style back on the resize)');
  assert.match(desk, /if \(layout === 'column'\) applyWidth\(fs\.viewportW\);\n      else clearWidth\(\);/, 'under the player (theatre, one column) YouTube keeps its width');
});

test('D100 the handle: a separator with its values, a drag, ←/→ (claimed from YouTube), a double-click resets, remembered per computer', () => {
  assert.match(desk, /rz\.setAttribute\('role', 'separator'\);/);
  assert.match(desk, /rz\.setAttribute\('aria-valuemin', String\(D\.DESK_W\.min\)\);/);
  assert.match(desk, /ui\.rz\.setAttribute\('aria-valuenow', String\(w\)\);/);
  assert.match(desk, /var next = drag\.w \+ \(drag\.x - e\.clientX\);/, 'dragging the left edge left widens');
  assert.match(desk, /e\.key === 'ArrowLeft' \? w \+ WIDTH_STEP : e\.key === 'ArrowRight' \? w - WIDTH_STEP/);
  assert.match(desk, /e\.preventDefault\(\);\n        e\.stopPropagation\(\);\n        setWidth\(next, true\);/);
  assert.match(desk, /rz\.addEventListener\('dblclick', function \(\) \{\n        prefs\.width = null;/);
  assert.match(desk, /setLocal\(PREF\.width, prefs\.width\);/);
  assert.match(SH.CSS, /\.rz\{position:absolute;z-index:3;left:-8px;top:0;bottom:0;width:12px;cursor:col-resize;/);
});
