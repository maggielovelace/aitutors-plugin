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

test('the version is 0.8.0, with no new permission; the quiz script loads before the desk', () => {
  const m = manifest();
  assert.equal(m.version, '0.8.0');
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
