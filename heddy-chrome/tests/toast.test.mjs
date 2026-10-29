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
