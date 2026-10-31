// H on YouTube ("H for Heddy", owner 2026-10-29): the guards are the desk's
// isJotKey (aitutors.me lib/videos/jots-client.ts) with H for J. Since Round 8
// (D74) H jots into the desk on the page, only while it is open; the join of
// the line before is lib/desk-model.js press.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const K = load('./lib/jot-key.js');

const el = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra });
const body = el('BODY');
const key = (over = {}) => ({ key: 'h', code: 'KeyH', target: body, ...over });

test('H on any layout is a jot; J, YouTube’s own back-10-seconds, is not', () => {
  assert.equal(K.isJotKey(key(), body), true);
  assert.equal(K.isJotKey(key({ key: 'H' }), body), true);
  assert.equal(K.isJotKey(key({ key: 'р', code: 'KeyH' }), body), true, 'the H key on a Cyrillic layout');
  assert.equal(K.isJotKey(key({ key: 'j', code: 'KeyJ' }), body), false, 'J stays YouTube’s');
  assert.equal(K.isJotKey(key({ key: 'J', code: 'KeyJ' }), body), false);
  for (const k of ['k', 'l', 'f', 't', 'i', 'm', 'c', '0', ',', '.', '/']) assert.equal(K.isJotKey(key({ key: k, code: '' }), body), false, k);
  assert.equal(K.isJotKey(key({ key: 'Enter', code: 'KeyH' }), body), false);
});

test('no modifier, no auto-repeat, not already handled', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) assert.equal(K.isJotKey(key({ [mod]: true }), body), false, mod);
  assert.equal(K.isJotKey(key({ repeat: true }), body), false);
  assert.equal(K.isJotKey(key({ defaultPrevented: true }), body), false);
});

test('never during IME composition', () => {
  assert.equal(K.isJotKey(key({ isComposing: true }), body), false);
  assert.equal(K.isJotKey(key({ keyCode: 229 }), body), false);
});

test('never while the child types: fields, editable regions, textboxes, focus inside a shadow root', () => {
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) assert.equal(K.isJotKey(key({ target: el(tag) }), body), false, tag);
  assert.equal(K.isJotKey(key({ target: el('DIV', { isContentEditable: true }) }), body), false);
  const inBox = el('SPAN', { closest: (s) => (s === K.TYPING_SELECTOR ? {} : null) });
  assert.equal(K.isJotKey(key({ target: inBox }), body), false, 'inside YouTube’s comment box');
  // YouTube's search box lives in a shadow root: the event's target is the host.
  assert.equal(K.isJotKey(key({ target: el('YTD-SEARCHBOX') }), el('INPUT')), false);
  assert.equal(K.isJotKey(key({ target: el('DIV', { closest: () => { throw new Error('bad'); } }) }), body), true);
});

test('the join window is Classroom’s 2.5 s (the desk’s press joins inside it: tests/desk-model.test.mjs)', () => {
  assert.equal(K.JOIN_MS, 2500);
  assert.equal(K.createJHold, undefined, 'the H-to-a-window hold is gone (D74)');
});

test('the content script listens for H only while the desk is open, guarded, and stops no key (D74)', () => {
  const src = read('content/youtube.js');
  assert.match(src, /addEventListener\('keydown', onKeyDown, true\)/);
  assert.match(src, /function onKeyDown\(e\) \{\n    if \(!desk\.isOpen\(\)\) return;\n    if \(!currentId\(\) \|\| isLive\(\) \|\| !K\.isJotKey\(e, document\.activeElement\) \|\| desk\.isTyping\(\)\) return;\n    desk\.pressJot\(\);/);
  assert.doesNotMatch(src, /stopImmediatePropagation|stopPropagation|preventDefault/, 'YouTube’s own keys are left alone');
  assert.doesNotMatch(src, /heddy-ui:moment|createJHold/, 'no H window any more');
});
