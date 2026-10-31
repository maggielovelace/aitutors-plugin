// Round 8 (PRD-v0.96.0 § 1h): the desk's rules, pure — the height (D69), the
// line being spoken and H's join (D74, Classroom's D11), the jots' storage and
// what leaves the device (D71), the 10-minute Chinese stretches (D72), the
// Digest's starting view (D73) and the lifeline of a script Heddy left behind
// (D76).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const D = load('./lib/desk-model.js');

const LINES = [
  { t: 24.1, text: 'Before we drop them, make a prediction.' },
  { t: 31, text: 'Which one do you think hits the ground first?' },
  { t: 38, text: 'Write your guess down, and don’t change it later.' },
  { t: 46, text: 'Now watch closely as we let go.' },
];

// ─── D69: where and how tall ────────────────────────────────────────────────

test('the desk takes YouTube’s right column in the two-column layout; theatre mode and a narrow window put it under the player', () => {
  assert.equal(D.layoutFor({ twoColumns: true, theater: false }), 'column');
  assert.equal(D.layoutFor({ twoColumns: true, theater: true }), 'below');
  assert.equal(D.layoutFor({ twoColumns: false, theater: false }), 'below');
  assert.equal(D.layoutFor(null), 'below');
});

test('at rest the desk is as tall as the player, never shorter than 420 px, and never past the window', () => {
  const base = { layout: 'column', viewportH: 900, top: 68, reserve: 32 };
  assert.equal(D.deskHeight({ ...base, playerH: 540 }), 540);
  assert.equal(D.deskHeight({ ...base, playerH: 300 }), D.MIN_H, 'a small player still leaves room for the Jot card and the composer');
  assert.equal(D.deskHeight({ ...base, playerH: 1200 }), 900 - 68 - 32 - 12, 'its bottom stays on screen');
});

test('the chevron pulls it to the bottom of the window (sticky under the masthead), under the player too', () => {
  assert.equal(D.deskHeight({ layout: 'column', playerH: 540, viewportH: 900, top: 68, reserve: 32, tall: true }), 788);
  assert.equal(D.deskHeight({ layout: 'below', viewportH: 900, top: 68, reserve: 32, tall: true }), 788);
  assert.equal(D.deskHeight({ layout: 'below', viewportH: 1400, top: 68, reserve: 32 }), D.BELOW_H, 'under the player it has its own resting height');
  assert.equal(D.deskHeight({ layout: 'column', playerH: 540, viewportH: 300, top: 68, reserve: 32, tall: true }), D.MIN_H);
});

// ─── the line being spoken ──────────────────────────────────────────────────

test('the line being spoken is the last that started; before the first, none; the last one lasts 10 s', () => {
  assert.equal(D.lineAt(LINES, 10), -1);
  assert.equal(D.lineAt(LINES, 24.1), 0);
  assert.equal(D.lineAt(LINES, 33), 1);
  assert.equal(D.lineAt(LINES, 45.99), 2);
  assert.equal(D.lineAt(LINES, 50), 3);
  assert.equal(D.lineAt(LINES, 56), 3);
  assert.equal(D.lineAt(LINES, 56.5), -1);
  assert.equal(D.lineAt([], 3), -1);
  assert.equal(D.lineAt(LINES, NaN), -1);
});

// ─── D74: H, and the join of the line before ────────────────────────────────

test('H jots the line being spoken at the line’s start, as a spoken line', () => {
  const r = D.press({ jots: [], last: null }, { now: 1000, t: 33, lines: LINES, id: 'a' });
  assert.equal(r.result, 'new');
  assert.deepEqual(r.jots, [{ id: 'a', t: 31, kind: 'line', text: LINES[1].text }]);
  assert.deepEqual(r.last, { id: 'a', at: 1000, from: 1, to: 1 });
});

test('a second H within 2.5 s of the last joins the line before, and its time moves back; a third joins one more', () => {
  let s = D.press({ jots: [], last: null }, { now: 0, t: 40, lines: LINES, id: 'a' });
  s = D.press(s, { now: 2499, t: 41, lines: LINES, id: 'b' });
  assert.equal(s.result, 'joined');
  assert.deepEqual(s.jots, [{ id: 'a', t: 31, kind: 'line', text: `${LINES[1].text} ${LINES[2].text}` }]);
  s = D.press(s, { now: 4900, t: 42, lines: LINES, id: 'c' });
  assert.equal(s.jots.length, 1, 'the window restarts from the newest press');
  assert.equal(s.jots[0].t, 24.1);
  assert.match(s.jots[0].text, /^Before we drop them/);
});

test('an H at 2.5 s or later is its own jot', () => {
  let s = D.press({ jots: [], last: null }, { now: 0, t: 40, lines: LINES, id: 'a' });
  s = D.press(s, { now: 2500, t: 47, lines: LINES, id: 'b' });
  assert.equal(s.result, 'new');
  assert.deepEqual(s.jots.map((j) => j.id), ['a', 'b']);
});

test('joining at the first line keeps the jot; nothing being said jots nothing; 200 jots is full', () => {
  let s = D.press({ jots: [], last: null }, { now: 0, t: 25, lines: LINES, id: 'a' });
  s = D.press(s, { now: 100, t: 26, lines: LINES, id: 'b' });
  assert.equal(s.result, 'joined');
  assert.equal(s.jots.length, 1);
  assert.equal(D.press({ jots: [], last: null }, { now: 0, t: 3, lines: LINES, id: 'x' }).result, 'noLine');
  const full = Array.from({ length: 200 }, (_, i) => ({ id: String(i), t: i, kind: 'note', text: 'n' }));
  assert.equal(D.press({ jots: full, last: null }, { now: 0, t: 33, lines: LINES, id: 'y' }).result, 'full');
});

test('a jot deleted while its window is open is not joined into', () => {
  const s = D.press({ jots: [], last: null }, { now: 0, t: 33, lines: LINES, id: 'a' });
  const r = D.press({ jots: D.removeIds(s.jots, ['a']), last: s.last }, { now: 100, t: 40, lines: LINES, id: 'b' });
  assert.equal(r.result, 'new');
  assert.deepEqual(r.jots.map((j) => j.id), ['b']);
});

test('a typed note is its own jot at the time given, in time order; empty notes are not jots', () => {
  const jots = [{ id: 'a', t: 31, kind: 'line', text: 'x' }];
  assert.deepEqual(D.note(jots, { id: 'n', t: 12.345, text: '  They land together.  ' }).map((j) => [j.id, j.t, j.kind, j.text]), [['n', 12.3, 'note', 'They land together.'], ['a', 31, 'line', 'x']]);
  assert.equal(D.note(jots, { id: 'n', t: 3, text: '   ' }), null);
  assert.equal(D.note(jots, { id: 'n', t: -1, text: 'x' }), null);
  assert.equal(D.note(jots, { id: 'n', t: 3, text: 'é'.repeat(2500) })[0].text.length, 2000);
});

// ─── D71: storage and the wire ──────────────────────────────────────────────

test('jots are stored per video, read back checked, and leave the device without their ids', () => {
  assert.equal(D.storeKey('Xq3aPn3x_-A'), 'deskJots:Xq3aPn3x_-A');
  const stored = [
    { id: 'b', t: 52, kind: 'note', text: 'They land together' },
    { id: 'a', t: 14.2, kind: 'line', text: 'Predict first' },
    { id: 'c', t: -1, kind: 'note', text: 'bad time' },
    { id: 'd', t: 3, kind: 'picture', text: 'not in 8a' },
    { id: 'e', t: 3, kind: 'note', text: '   ' },
    null,
    'x',
  ];
  const back = D.parseStored(stored);
  assert.deepEqual(back.map((j) => j.id), ['a', 'b']);
  assert.deepEqual(D.parseStored('nope'), []);
  assert.deepEqual(D.wireJots(back), [{ t: 14.2, kind: 'line', text: 'Predict first' }, { t: 52, kind: 'note', text: 'They land together' }]);
  assert.deepEqual(D.removeIds(back, ['a']).map((j) => j.id), ['b']);
});

// ─── D72: the Chinese, ten minutes at a time ────────────────────────────────

test('the stretch asked for is the one the player is in: [floor(S/600)*600, +600)', () => {
  assert.equal(D.stretchOf(0), 0);
  assert.equal(D.stretchOf(599.9), 0);
  assert.equal(D.stretchOf(600), 600);
  assert.equal(D.stretchOf(1834), 1800);
  assert.equal(D.zhNeed({ t: 1834, have: [] }), 1800);
});

test('the next stretch is asked for once the player passes 80% of the current one, and never past the end', () => {
  const have = [{ from: 0 }];
  assert.equal(D.zhNeed({ t: 479.9, have }), null, 'not before 80%');
  assert.equal(D.zhNeed({ t: 480, have }), 600, 'at 80% exactly');
  assert.equal(D.zhNeed({ t: 590, have: [{ from: 0 }, { from: 600 }] }), null, 'already asked');
  assert.equal(D.zhNeed({ t: 500, have, duration: 590 }), null, 'a 9:50 video has no second stretch');
  assert.equal(D.zhNeed({ t: 500, have, duration: 601 }), 600);
  assert.equal(D.zhNeed({ t: NaN, have }), null);
});

test('a line takes its Chinese from the stretch it is in; outside every stretch, none (it shows its English)', () => {
  const stretches = [{ from: 0, to: 600, lines: [{ t: 24.1, text: '在我们松手之前，先做个预测。' }] }];
  assert.equal(D.zhLine(stretches, LINES[0]), '在我们松手之前，先做个预测。');
  assert.equal(D.zhLine(stretches, LINES[1]), null, 'no Chinese for that line yet');
  assert.equal(D.zhLine(stretches, { t: 640, text: 'later' }), null);
  assert.equal(D.zhLine([], LINES[0]), null);
});

test('the retry rule for a stretch another request is writing: every 4 s, at most 5 times', () => {
  assert.equal(D.ZH_RETRY_MS, 4000);
  assert.equal(D.ZH_TRIES, 5);
});

// ─── D73: the starting view ─────────────────────────────────────────────────

test('EN opens the Digest on English, 中 on Bilingual (Classroom’s defaultView); a choice on the device wins', () => {
  assert.equal(D.defaultView('en'), 'en');
  assert.equal(D.defaultView('zh_CN'), 'bi');
  assert.equal(D.viewFor('en', null), 'en');
  assert.equal(D.viewFor('zh_CN', undefined), 'bi');
  assert.equal(D.viewFor('en', 'zh'), 'zh');
  assert.equal(D.viewFor('zh_CN', 'nonsense'), 'bi');
});

test('the Digest’s search keeps lines with every word, in English or Chinese', () => {
  const zh = (l) => (l.t === 24.1 ? '先做个预测' : null);
  assert.deepEqual(D.matches(LINES, 'ground first', zh), [1]);
  assert.deepEqual(D.matches(LINES, '预测', zh), [0]);
  assert.deepEqual(D.matches(LINES, 'zebra', zh), []);
  assert.equal(D.matches(LINES, '  ', zh), null, 'no search, every line');
});

// ─── D76: a script left behind ──────────────────────────────────────────────

test('Heddy is alive while chrome.runtime.id is there; gone, or throwing, it is not', () => {
  assert.equal(D.alive({ runtime: { id: 'abc' } }), true);
  assert.equal(D.alive({ runtime: {} }), false);
  assert.equal(D.alive({}), false);
  assert.equal(D.alive(undefined), false);
  assert.equal(D.alive({ get runtime() { throw new Error('Extension context invalidated.'); } }), false);
});

test('the lifeline tears down once, stops its interval, and never ticks again once Heddy is gone', () => {
  let alive = true;
  let torn = 0;
  let ticks = 0;
  let fn = null;
  const cleared = [];
  const life = D.createLifeline({
    isAlive: () => alive,
    teardown: () => { torn += 1; },
    setInterval: (f) => { fn = f; return 77; },
    clearInterval: (h) => cleared.push(h),
    everyMs: 1500,
    tick: () => { ticks += 1; },
  });
  assert.equal(life.start(), 77);
  fn();
  fn();
  assert.equal(ticks, 2);
  alive = false;
  fn();
  assert.equal(ticks, 2, 'no tick once gone');
  assert.equal(torn, 1);
  assert.deepEqual(cleared, [77]);
  fn();
  assert.equal(life.check(), false);
  assert.equal(torn, 1, 'torn down once');
  assert.equal(life.dead(), true);
});

test('a teardown that throws still leaves the script stopped', () => {
  let fn = null;
  const life = D.createLifeline({ isAlive: () => false, teardown: () => { throw new Error('page gone'); }, setInterval: (f) => { fn = f; return 1; }, clearInterval: () => {}, everyMs: 10, tick: () => {} });
  life.start();
  assert.doesNotThrow(() => fn());
  assert.equal(life.dead(), true);
});
