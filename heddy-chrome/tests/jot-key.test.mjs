// J on YouTube (D18): the guards are the desk's isJotKey (aitutors.me
// lib/videos/jots-client.ts), and a second J within 2.5 s joins the line
// before, held and sent ONCE, as the desk's createJotKeeper does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const K = load('./lib/jot-key.js');

const el = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra });
const body = el('BODY');
const key = (over = {}) => ({ key: 'j', code: 'KeyJ', target: body, ...over });

test('J and Shift-less J on any layout is a jot', () => {
  assert.equal(K.isJotKey(key(), body), true);
  assert.equal(K.isJotKey(key({ key: 'J' }), body), true);
  assert.equal(K.isJotKey(key({ key: 'й', code: 'KeyJ' }), body), true, 'the J key on a Cyrillic layout');
  assert.equal(K.isJotKey(key({ key: 'k', code: 'KeyK' }), body), false);
  assert.equal(K.isJotKey(key({ key: 'Enter', code: 'KeyJ' }), body), false);
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

test('the content script takes J before YouTube, guarded, on a watch page that is not live', () => {
  const src = read('content/youtube.js');
  assert.match(src, /addEventListener\('keydown', onKeyDown, true\)/, 'capture phase, ahead of YouTube’s own J');
  assert.match(src, /if \(!id \|\| isLive\(\) \|\| !K\.isJotKey\(e, document\.activeElement\)\) return;/);
  assert.match(src, /e\.stopImmediatePropagation\(\)/);
  assert.match(src, /hold\.flush\(\)/);
});
