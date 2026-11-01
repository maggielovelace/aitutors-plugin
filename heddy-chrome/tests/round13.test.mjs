// Round 13 (0.8.0, PRD-v0.96.0 § 1l, D104): the Quiz tab comes back on the
// YouTube desk only when aitutors.me says this video, in the child's My Clips,
// has a quiz `ready`; it runs inside the desk as Classroom's quiz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMarks = load('./lib/marks.js');
globalThis.HeddyMessages = load('./lib/messages.js');
const I = load('./lib/i18n.js');
globalThis.HeddyDeskShell = load('./lib/desk-shell.js');
const Q = load('./lib/desk-quiz.js');
const A = load('./lib/desk-api.js');
const desk = read('content/desk.js');
const CHECK = '0f8fad5b-d9cb-469f-a165-70867728950e';

test('Round 13 asks for no new permission (the version: tests/round13c.test.mjs); the quiz script loads before the desk', () => {
  const m = manifest();
  assert.notEqual(m.version, '0.7.1');
  assert.deepEqual(m.permissions, ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage']);
  const js = m.content_scripts[0].js;
  assert.ok(js.indexOf('lib/desk-quiz.js') > js.indexOf('lib/desk-shell.js') && js.indexOf('lib/desk-quiz.js') < js.indexOf('content/desk.js'));
});

test('D104: the video’s quiz state is read; anything but ready/none/locked is none', () => {
  const base = { signedIn: true, professor: { code: 'BIOL', name: 'Darwin' } };
  assert.equal(A.parseVideo({ ...base, quiz: 'ready' }).quiz, 'ready');
  assert.equal(A.parseVideo({ ...base, quiz: 'locked' }).quiz, 'locked');
  assert.equal(A.parseVideo({ ...base, quiz: 'yes' }).quiz, 'none');
  assert.equal(A.parseVideo(base).quiz, 'none');
});

test('D104: the Quiz tab is there only for ready, first in the row, walked by ←/→ and the pill', () => {
  assert.match(desk, /if \(k === 'quiz'\) return st\.video\.quiz === 'ready'; \/\/ D104/);
  assert.match(desk, /ui\.tabs\.quiz\.hidden = !tabLive\('quiz'\);/);
  assert.match(desk, /\[\['quiz', 'quiz'\], \['jot', 'jot'\], \['digest', 'digest'\], \['insights', 'insights'\]\]\.forEach/);
  assert.match(desk, /if \(st\.tab === 'quiz' && tabLive\('quiz'\)\) return quizView\.draw\(pn\);/);
});

test('the quiz route: POST …/desk/quiz with the four actions, checked before it leaves', async () => {
  const fetches = [];
  const chrome = { runtime: { id: 'heddy' }, storage: { local: { get: async () => ({}) } } };
  const api = A.createDeskApi({
    chrome,
    fetchImpl: async (url, init) => {
      fetches.push({ url, init });
      return { status: 200, json: async () => ({ checkId: CHECK, subject: 'Biology', subjectCode: 'BIOL', tutor: { id: 't', name: 'Darwin' }, topic: { id: 'offmap', name: 'Cells' }, video: { startSec: 30, endSec: 300 }, questions: { predict: { prompt: 'Guess?', options: ['a', 'b'] }, questions: [{ prompt: 'Q1', options: ['x', 'y'], hint: 'h', atSec: 40 }, { prompt: 'Q2', options: ['x', 'y'], hint: 'h' }, { prompt: 'Q3', options: ['x', 'y'], hint: 'h' }] } }) };
    },
  });
  const VIDEO = 'Xq3aPn3x_-A';
  const from = { id: 'heddy', url: `https://www.youtube.com/watch?v=${VIDEO}`, tab: { id: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` } };
  const r = await api.internal({ type: 'heddy-desk:quiz', youtubeId: VIDEO, action: 'start' }, from);
  assert.equal(fetches[0].url, 'https://aitutors.me/api/learn/heddy/desk/quiz');
  assert.deepEqual(JSON.parse(fetches[0].init.body), { action: 'start', youtubeId: VIDEO });
  assert.equal(r.ok, true);
  assert.equal(r.questions.length, 3);
  assert.deepEqual(r.predict, { prompt: 'Guess?', options: ['a', 'b'], hint: null });
  assert.deepEqual(r.range, { startSec: 30, endSec: 300 });
  await api.internal({ type: 'heddy-desk:quiz', youtubeId: VIDEO, action: 'answer', checkId: CHECK, index: 1, choice: 0 }, from);
  assert.deepEqual(JSON.parse(fetches[1].init.body), { action: 'answer', youtubeId: VIDEO, checkId: CHECK, index: 1, choice: 0 });
  assert.deepEqual(await api.internal({ type: 'heddy-desk:quiz', youtubeId: VIDEO, action: 'predict', checkId: CHECK }, from), { ok: false, status: 400, type: 'bad-request' }, 'no predict action on the desk');
  assert.deepEqual(await api.internal({ type: 'heddy-desk:quiz', youtubeId: VIDEO, action: 'finish', checkId: 'not-a-uuid' }, from), { ok: false, status: 400, type: 'bad-request' });
  assert.equal(fetches.length, 2);
});

test('the replies, checked: answers, finish, cards; a refusal keeps its status and type', () => {
  assert.deepEqual(A.parseQuiz('answer', 200, { correct: false, correctIndex: 2, explanation: 'Because.', misconception: null }), { ok: true, correct: false, correctIndex: 2, explanation: 'Because.', misconception: null });
  assert.deepEqual(A.parseQuiz('finish', 200, { correct: 2, checked: true, misses: 1, misconceptions: [], replay: false }), { ok: true, correct: 2, misses: 1 });
  assert.deepEqual(A.parseQuiz('add_cards', 200, { minted: 1, replay: false }), { ok: true, minted: 1 });
  assert.deepEqual(A.parseQuiz('start', 403, { type: 'quota' }), { ok: false, status: 403, type: 'quota' });
  assert.equal(A.parseQuiz('start', 200, { checkId: 'x', questions: [] }).ok, false, 'a reply with no check id is not a quiz');
  assert.equal(A.parseQuiz('start', 200, { checkId: CHECK, questions: [{ prompt: 'Q', options: ['a', 'b'], hint: '' }] }).predict, null, 'a bare list of questions: no Predict step');
});

test('Classroom’s states for a refused start (VideoQuizCard)', () => {
  assert.equal(Q.startOutcome({ ok: true }), 'ready');
  assert.equal(Q.startOutcome({ ok: false, status: 401 }), 'signedOut');
  assert.equal(Q.startOutcome({ ok: false, status: 403, type: 'locked' }), 'locked');
  assert.equal(Q.startOutcome({ ok: false, status: 403, type: 'no-subscription' }), 'locked');
  assert.equal(Q.startOutcome({ ok: false, status: 403, type: 'quota' }), 'quota');
  assert.equal(Q.startOutcome({ ok: false, status: 404 }), 'unavailable');
  assert.equal(Q.startOutcome({ ok: false, status: 429 }), 'cap');
  assert.equal(Q.startOutcome({ ok: false, status: 502 }), 'failed');
});

test('the ring fills a fifth per stage (ringPercent), and the clock is Classroom’s', () => {
  assert.equal(Q.ringPercent('predict', 0, 3), 20);
  assert.equal(Q.ringPercent('watch', 0, 3), 40);
  assert.equal(Q.ringPercent('check', 2, 3), 67);
  assert.equal(Q.ringPercent('results', 3, 3), 100);
  assert.equal(Q.PREP_RETRY_S, 30);
  assert.equal(Q.mmss(95), '1:35');
});

test('the quiz’s CSS is Classroom’s Classroom face, px only: the 52 px ring, the bubble, the 44 px breathing button, 28 px step chips', () => {
  const css = Q.CSS;
  assert.doesNotMatch(css, /\drem\b/);
  for (const rule of ['.cp-pi > .vq-ring{width:52px;height:52px;margin-top:-2px}', 'border-radius:4px 14px 14px 14px;background:var(--sc-soft)', '.cp-ask{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px', 'height:28px;line-height:25px', '@keyframes cp-ask-breathe', '.cd[data-rest] .cp-bub{animation:cp-bub-pop']) {
    assert.ok(css.includes(rule), rule);
  }
});

test('the quiz’s words are Classroom’s (pinned in the drift test), both languages', () => {
  const tr = I.translator('en');
  assert.equal(tr('qzButton', 'Darwin'), 'Let Darwin ask first');
  assert.equal(tr('qzStepCheck', 'Darwin'), '3 Ask more');
  assert.equal(I.translator('zh_CN')('qzBack'), I.translator('zh_CN')('qzBack'));
  const pins = read('tests/classroom-words.test.mjs');
  for (const k of ['qzButton', 'qzRest', 'qzResults', 'qzSubmit', 'qzRecorded', 'qzPrep1', 'qzAddCardsMany']) assert.match(pins, new RegExp(`\\['${k}', `), k);
});

test('it runs inside the desk: no window, no tab but the links that say they leave (See plans ↗, Back to My Clips)', () => {
  const src = read('lib/desk-quiz.js');
  assert.doesNotMatch(src, /window\.open|tabs\.create|chrome\./);
  assert.match(src, /opts\.openSite\('\/pricing'\)/);
  assert.match(src, /opts\.openSite\('\/study\/clips'\)/);
  assert.match(src, /opts\.seekPlay\(set\.range\.startSec\)/, 'Watch plays the part on YouTube’s own player');
});

// ─── Round 13b: the width drag and the pill ─────────────────────────────────

const D = load('./lib/desk-model.js');

function dragHarness(startW = 410, startX = 1000) {
  const frames = [];
  const applied = [];
  const committed = [];
  const drag = D.createWidthDrag({ startW, startX, raf: (fn) => frames.push(fn), apply: (w) => applied.push(w), commit: (w) => committed.push(w) });
  return { drag, frames, applied, committed, flush: () => frames.splice(0).forEach((f) => f()) };
}

test('13b drag: the last move wins: many moves in one frame apply the latest, never a stale one', () => {
  const h = dragHarness();
  h.drag.move(990); // +10
  h.drag.move(960); // +40
  h.drag.move(865); // +135
  assert.equal(h.frames.length, 1, 'one frame asked for, however many moves');
  h.flush();
  assert.deepEqual(h.applied, [545], 'the frame applies the pointer’s latest width (410 + 135)');
  h.drag.move(963); // back to +37
  h.flush();
  assert.deepEqual(h.applied, [545, 447]);
});

test('13b drag: the drop commits the pointer’s own width, even before the frame comes', () => {
  const h = dragHarness();
  h.drag.move(950);
  assert.equal(h.drag.end(902), 508, 'pointerup’s x is the last word: 410 + 98');
  assert.deepEqual(h.committed, [508]);
  assert.deepEqual(h.applied, [508]);
  h.flush();
  assert.deepEqual(h.applied, [508], 'a frame after the drop applies nothing stale');
  assert.equal(h.drag.end(0), null, 'one drop only');
});

test('13b drag: clamped to 360–640; a click with no move commits the start width', () => {
  const h = dragHarness();
  h.drag.move(0);
  h.flush();
  assert.deepEqual(h.applied, [640]);
  const c = dragHarness(410, 500);
  assert.equal(c.drag.end(null), 410);
  assert.equal(dragHarness(410, 0).drag.end(5000), 360);
});

test('13b drag in the desk: start from the width in the page, frames only write the width, the drop places once', () => {
  assert.match(desk, /startW: widthNow \|\| host\.getBoundingClientRect\(\)\.width,/);
  assert.match(desk, /apply: function \(w\) \{\n            prefs\.width = w;\n            if \(writeWidth\(D\.deskWidthFor\(w, vw\(\)\)\)\) playerResized\(\);\n            if \(ui\) ui\.geo = placeInd\(\);/, 'per frame: the width, the player once, the pill follows; no place()');
  assert.match(desk, /d\.end\(e && e\.type === 'pointerup' \? e\.clientX : null\);\n        dragging = false;\n        rz\.removeAttribute\('data-drag'\);\n        place\(\);\n        playerResized\(\);/);
  assert.match(desk, /resize: function \(\) \{ if \(st && !dragging\) place\(\); \}/, 'YouTube’s own resize does not re-place the desk mid-drag');
  assert.doesNotMatch(desk, /if \(raf\) return;/, 'the dropping throttle is gone');
});

test('13b pill: it follows each tab’s own box (each tab and the crest observed) and every relabel', () => {
  assert.match(desk, /Object\.keys\(tabEls\)\.forEach\(function \(k\) \{ ro\.observe\(tabEls\[k\]\); \}\);\n        ro\.observe\(crest\);/);
  assert.match(desk, /if \(from !== st\.tab\) moved\(from\);\n[^\n]*\n[^\n]*\n      else ui\.geo = placeInd\(\);/, 'after label(): placed again, not animated');
});
