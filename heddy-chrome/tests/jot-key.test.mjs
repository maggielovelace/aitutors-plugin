// H on YouTube (D18; "H for Heddy", owner 2026-10-29): the guards are the
// desk's isJotKey (aitutors.me lib/videos/jots-client.ts) with H for J, and a
// second H within 2.5 s joins the line before, held and sent ONCE with the
// first and last press times, as the desk's createJotKeeper holds its post.
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

function clocked() {
  let now = 0;
  const timers = new Map();
  let id = 0;
  const sent = [];
  const hold = K.createJHold({
    now: () => now,
    setTimer: (fn, ms) => { id += 1; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (h) => timers.delete(h),
    send: (j) => sent.push(j),
  });
  const tick = (ms) => {
    now += ms;
    for (const [h, t] of [...timers]) if (t.at <= now) { timers.delete(h); t.fn(); }
  };
  return { hold, tick, sent };
}

const V = { youtubeId: 'Fq2aPn3x_-A', title: 'GCSE Maths - Using Scales on Maps' };
const W = { youtubeId: 'abcdefghijk', title: 'Another' };

test('one J is held 2.5 s, then sent once at its own time', () => {
  const c = clocked();
  assert.equal(K.JOIN_MS, 2500);
  c.hold.press(168.4, V);
  c.tick(2499);
  assert.equal(c.sent.length, 0);
  c.tick(1);
  assert.deepEqual(c.sent, [{ t: 168.4, video: V }], 'one press: no tEnd');
});

test('a second J inside 2.5 s joins the line before; the window restarts from it', () => {
  const c = clocked();
  c.hold.press(168, V);
  c.tick(2000);
  assert.equal(c.hold.press(170, V), 'joined');
  c.tick(2000);
  assert.equal(c.hold.press(172, V), 'joined', '2 s after the SECOND press still joins');
  c.tick(2500);
  assert.deepEqual(c.sent, [{ t: 168, tEnd: 172, video: V }], 'one moment: the first press to the last');
});

test('a J at 2.5 s or later is its own jot', () => {
  const c = clocked();
  c.hold.press(10, V);
  c.tick(2500);
  c.hold.press(20, V);
  c.tick(2500);
  assert.deepEqual(c.sent, [{ t: 10, video: V }, { t: 20, video: V }]);
});

test('the join window is open below 2.5 s and shut at 2.5 s exactly', () => {
  let now = 0;
  const hold = K.createJHold({ now: () => now, setTimer: () => 1, clearTimer: () => {}, send: () => {} });
  hold.press(1, V);
  now = 2499;
  assert.equal(hold.press(2, V), 'joined');
  now = 2499 + 2500;
  assert.equal(hold.press(3, V), 'held');
});

test('tEnd is never before the first press, even if the child scrubbed back', () => {
  const c = clocked();
  c.hold.press(100, V);
  c.tick(500);
  c.hold.press(40, V);
  c.tick(2500);
  assert.deepEqual(c.sent, [{ t: 100, tEnd: 100, video: V }]);
});

test('a J on another video never joins, and a waiting J goes under its own video', () => {
  const c = clocked();
  c.hold.press(10, V);
  c.tick(500);
  assert.equal(c.hold.press(3, W), 'held');
  assert.deepEqual(c.sent, [{ t: 10, video: V }]);
  c.hold.flush();
  assert.deepEqual(c.sent[1], { t: 3, video: W });
  c.tick(5000);
  assert.equal(c.sent.length, 2, 'flushed, never sent twice');
});

test('the content script listens for H, guarded, on a watch page that is not live, and stops no key', () => {
  const src = read('content/youtube.js');
  assert.match(src, /addEventListener\('keydown', onKeyDown, true\)/);
  assert.match(src, /if \(!id \|\| isLive\(\) \|\| !K\.isJotKey\(e, document\.activeElement\)\) return;/);
  assert.doesNotMatch(src, /stopImmediatePropagation|stopPropagation|preventDefault/, 'YouTube’s own keys are left alone');
  assert.match(src, /hold\.flush\(\)/);
  assert.match(src, /<b>H<\/b>/, 'the hint shows H');
});
