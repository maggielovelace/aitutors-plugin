// The one toast spec (D25; artifact Round 3 · "After J · one toast spec on
// both hosts"): "Note saved · 2:48 — Map scales", the quote, Undo and Open in
// Jotter for 5 s; "Jot deleted." for 1.8 s; "Couldn't undo that note.".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
const I = load('./lib/i18n.js');
const T = load('./lib/toast.js');
const JOT = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const en = I.translator('en');
const zh = I.translator('zh_CN');
const HREF = 'https://aitutors.me/study/jotters/v/Fq2aPn3x_-A';

const note = (over = {}) => ({ kind: 'note', t: 168, quote: 'On a 1:50 000 map, 2 cm represents 1 km on the ground.', jotId: JOT, topic: 'Map scales', topicLang: 'en-GB', title: 'GCSE Maths - Using Scales on Maps', href: HREF, ...over });

test('Note saved: time, name, the quote in quotation marks, Undo and Open in Jotter, 5 s', () => {
  const m = T.model(note(), 'en', en);
  assert.equal(m.title, 'Note saved · 2:48 — Map scales');
  assert.equal(m.quote, '“On a 1:50 000 map, 2 cm represents 1 km on the ground.”');
  assert.deepEqual(m.undo, { label: 'Undo', jotId: JOT });
  assert.deepEqual(m.open, { label: 'Open in Jotter', href: HREF, quiet: true });
  assert.equal(m.ms, 5000);
  assert.equal(m.wide, true);
});

test('without a topic in Heddy’s language the video’s title stands in; without either, the time alone', () => {
  assert.equal(T.model(note({ topic: null }), 'en', en).title, 'Note saved · 2:48 — GCSE Maths - Using Scales on Maps');
  assert.equal(T.model(note({ topicLang: 'zh-Hans', topic: '比例尺' }), 'en', en).title, 'Note saved · 2:48 — GCSE Maths - Using Scales on Maps');
  assert.equal(T.model(note({ topic: null, title: '  ' }), 'en', en).title, 'Note saved · 2:48');
});

test('no quote, no quote line; no valid jot id, no Undo', () => {
  const m = T.model(note({ quote: null, jotId: 'x' }), 'en', en);
  assert.equal(m.quote, null);
  assert.equal(m.undo, null);
});

test('简体中文: the same toast in Heddy’s other language, 「」 around the quote', () => {
  const m = T.model(note({ topic: '比例尺', topicLang: 'zh-Hans' }), 'zh_CN', zh);
  assert.equal(m.title, '已记下 · 2:48 — 比例尺');
  assert.equal(m.quote, '「On a 1:50 000 map, 2 cm represents 1 km on the ground.」');
  assert.equal(m.undo.label, '撤销');
  assert.equal(m.open.label, '在批注本中打开');
});

test('after Undo: "Jot deleted." for 1.8 s, or "Couldn’t undo that note."', () => {
  assert.deepEqual(T.model({ kind: 'undone' }, 'en', en), { title: 'Jot deleted.', ms: 1800 });
  assert.equal(T.model({ kind: 'undo_failed' }, 'en', en).title, "Couldn't undo that note.");
});

test('Phase 1’s clip toast is unchanged', () => {
  const m = T.model({ kind: 'clip', topic: 'Maths · Map scales', topicLang: 'en-GB', startSec: 112, href: 'https://aitutors.me/study/clips' }, 'en', en);
  assert.equal(m.title, 'In My Clips');
  assert.equal(m.line, 'Maths · Map scales · from 1:52');
  assert.deepEqual(m.open, { label: 'Open', href: 'https://aitutors.me/study/clips' });
  assert.equal(m.ms, 4000);
  assert.equal(T.model({ kind: 'cant_keep' }, 'en', en).title, "Your family's settings don't allow keeping this video.");
  assert.equal(T.model({ kind: 'nope' }, 'en', en), null);
});

test('the toast sets page and result text only as textContent', () => {
  const src = read('lib/toast.js');
  // innerHTML takes the constant shell only; every string goes in as text.
  const inner = src.match(/innerHTML\s*=([\s\S]*?);/g) || [];
  assert.equal(inner.length, 1);
  assert.doesNotMatch(inner[0], /m\.(title|quote|line)|label/);
  assert.match(src, /q\.textContent = m\.quote/);
});

test('Jotted: the quote, Undo and Open in Jotter, 5 s', () => {
  const JOTTER = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
  const m = T.model({ kind: 'jotted', quote: 'On a 1:50 000 map', jotId: JOT, jotterId: JOTTER, href: 'https://aitutors.me/study/jotters/x' }, 'en', en);
  assert.equal(m.title, 'Jotted');
  assert.equal(m.quote, '“On a 1:50 000 map”');
  assert.deepEqual(m.undo, { label: 'Undo', jotId: JOT, jotterId: JOTTER }, 'a web jot’s Undo names its Jotter');
  assert.equal(m.open.label, 'Open in Jotter');
  assert.equal(m.ms, 5000);
  assert.equal(T.model({ kind: 'jotted', jotId: 'nope', jotterId: JOTTER }, 'en', en).undo, null);
  assert.equal(T.model({ kind: 'jotted', jotId: JOT }, 'en', en).undo, null, 'no Jotter, no Undo');
  assert.equal(T.model({ kind: 'jotted', jotId: JOT, jotterId: '../x' }, 'en', en).undo, null);
  assert.equal(T.model({ kind: 'note', jotId: JOT, jotterId: JOTTER, t: 1 }, 'en', en).undo.jotterId, undefined, 'an H jot’s Undo is jotId alone');
});

test('Clipped · title, Open in Jotter, no Undo; the cut line only when the page was cut', () => {
  const whole = T.model({ kind: 'clipped', title: 'Understanding map scales', cut: false, href: 'https://aitutors.me/study/jotters' }, 'en', en);
  assert.equal(whole.title, 'Clipped · Understanding map scales');
  assert.equal(whole.line, null);
  assert.equal(whole.undo, undefined);
  assert.equal(whole.open.label, 'Open in Jotter');
  const cut = T.model({ kind: 'clipped', title: 'Long', cut: true }, 'en', en);
  assert.equal(cut.line, 'Heddy kept the first part of this page.');
  assert.equal(T.model({ kind: 'clipped', title: ' ' }, 'en', en).title, 'Clipped');
  assert.equal(T.model({ kind: 'clipped', title: 'Long', cut: true }, 'zh_CN', zh).line, 'Heddy 只保留了这一页的前一部分。');
});

test('the page tray shows the toasts after Jot it and Clip this page, except where the YouTube script already does', () => {
  const src = read('content/page-tray.js');
  assert.match(src, /msg\.type === 'heddy-ui:toast'/);
  assert.match(src, /if \(globalThis\.__heddyYouTube\) return undefined;/);
  assert.match(src, /onUndo: function \(jotId, jotterId\) \{ send\(\{ type: 'heddy-ui:undo', jotId: jotId, jotterId: jotterId \}\); \}/);
  assert.match(read('content/youtube.js'), /onUndo: function \(jotId, jotterId\) \{ send\(\{ type: 'heddy-ui:undo', jotId: jotId, jotterId: jotterId \}\); \}/);
});

test('tapping Undo hides the toast and hands back the jot id and its Jotter', () => {
  // A small stand-in for the DOM: enough for createToaster's constant shell.
  function node(tag) {
    const n = { tag, children: [], listeners: {}, className: '', textContent: '', removed: false,
      classList: { add() {} }, appendChild(c) { this.children.push(c); return c; },
      addEventListener(type, fn) { this.listeners[type] = fn; }, remove() { this.removed = true; } };
    return n;
  }
  const box = node('div');
  const t = node('span');
  const b = node('b');
  t.querySelector = () => b;
  const host = node('heddy-toast');
  host.attachShadow = () => ({ set innerHTML(_) {}, querySelector: (s) => (s === '.toast' ? box : s === '.t' ? t : null) });
  const doc = { createElement: (tag) => (tag === 'heddy-toast' ? host : node(tag)), documentElement: node('html') };
  const undos = [];
  const toaster = T.createToaster({ document: doc, marks: { sprite: () => '', use: () => '' }, onOpen() {}, onUndo: (...a) => undos.push(a), setTimeout: () => 1, clearTimeout() {} });
  const JOTTER = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
  toaster.show(T.model({ kind: 'jotted', quote: 'q', jotId: JOT, jotterId: JOTTER }, 'en', en));
  const actions = box.children.find((c) => c.className === 'o');
  const undo = actions.children.find((c) => c.textContent === 'Undo');
  undo.listeners.click();
  assert.deepEqual(undos, [[JOT, JOTTER]]);
  assert.equal(host.removed, true, 'the toast goes when Undo is tapped');
});
