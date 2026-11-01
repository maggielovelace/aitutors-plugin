// Round 13c (0.8.1, PRD-v0.96.0, D108–D110): the "Note saved" pop-up closes
// and goes after 3 s unless held; the caption ceiling is said plainly; the
// Quiz tab can come for any video.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMarks = load('./lib/marks.js');
globalThis.HeddyMessages = load('./lib/messages.js');
const I = load('./lib/i18n.js');
const SH = load('./lib/desk-shell.js');
const desk = read('content/desk.js');

test('the version is 0.8.1', () => {
  assert.equal(manifest().version, '0.8.1');
});

test('D110: the pop-up has Classroom’s ×, at least 24 px to hit, labelled Close / 关闭', () => {
  assert.match(desk, /var x = btn\('jx', ic\('close'\)\);\n      x\.setAttribute\('aria-label', tr\('close'\)\);/);
  assert.match(desk, /x\.addEventListener\('click', hideToast\);/);
  assert.match(SH.CSS, /\.jt \.jx\{position:absolute;top:6px;right:6px;width:28px;height:28px;/);
  assert.equal(I.t('en', 'close'), 'Close');
  assert.equal(I.t('zh_CN', 'close'), '关闭');
});

test('D110: it goes 3 s after it shows; hover or focus inside holds it; leaving starts the 3 s again', () => {
  assert.match(desk, /var TOAST_MS = 3000;/);
  assert.match(desk, /function hold\(\) \{\n        clearTimeout\(toastTimer\);\n        if \(held\.hover \|\| held\.focus\) return;\n        toastTimer = setTimeout\(hideToast, wait\);\n      \}/);
  for (const ev of ['pointerenter', 'pointerleave', 'focusin', 'focusout']) assert.match(desk, new RegExp(`t\\.addEventListener\\('${ev}'`), ev);
  assert.match(SH.CSS, /\.jt\[data-anim\]\{animation:hd-toast-in \.2s ease both\}/, 'no timed fade inside the animation: it stays while held');
  assert.doesNotMatch(SH.CSS, /hd-toast 5s/);
});

test('D110: Undo stays; Save to My Jotters is gone from the pop-up (the Jot tab keeps its own)', () => {
  const i = desk.indexOf('function jotted(id, key)');
  const body = desk.slice(i, desk.indexOf('function toastSay', i));
  assert.match(body, /tr\('deskJotUndo'\)/);
  assert.doesNotMatch(body, /deskSaveJotters|saveToJotters|deskOpenInJotter/);
  assert.match(desk, /var save = btn\('', null, st\.busy\.save \? tr\('deskSaving'\) : tr\('deskSaveJotters'\)\);/, 'the Jot tab’s Save to My Jotters stays');
});

test('D108: a transcript the site’s daily caption ceiling refused reads as busy, said as itself with Try again (Digest and Jot)', () => {
  const A = load('./lib/desk-api.js');
  assert.deepEqual(A.parseTranscript({ status: 'busy', lines: [], zh: null, zhState: 'idle' }), { ok: true, status: 'busy', lines: [], zh: null, zhState: 'idle' });
  assert.match(desk, /error: 'deskWhyError', busy: 'deskTranscriptBusy' \}\[s\];/);
  assert.match(desk, /if \(s === 'error' \|\| s === 'busy'\) \{/, 'Try again on the Jot tab');
  assert.match(desk, /tr\(t\.status === 'busy' \? 'deskTranscriptBusy' : 'digestFailed', profName\(\)\)/, 'the Digest: never "could not read" for a busy one');
  assert.equal(I.t('en', 'deskTranscriptBusy', 'Newton'), 'Newton has read a lot of transcripts today. Try again later.');
  assert.equal(I.t('zh_CN', 'deskTranscriptBusy', '牛顿'), '牛顿今天已经读了很多文字稿。晚点再试。');
});
