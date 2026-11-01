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

// ─── 13c bug: Heddy ▾ "Ask Mentor about this" on a web page ────────────────

const A = load('./lib/desk-ask.js');
globalThis.HeddyDeskAsk = A;
const W = load('./lib/web-routes.js');

test('13c: the picked words are in sight in the room: Classroom’s context chip (the page’s host, the words in quotes)', () => {
  const s = A.fresh({ about: 'words', attach: { kind: 'text', quote: 'On a 1:50 000 map, 2 cm represents 1 km.' } });
  assert.deepEqual(A.contextChip(s, 'deeplearning.ai'), { label: 'deeplearning.ai', quote: 'On a 1:50 000 map, 2 cm represents 1 km.' });
  const yt = A.fresh({ about: 'words', atLabel: '1:09', attach: { kind: 'text', quote: 'They land at the same time.' } });
  assert.deepEqual(A.contextChip(yt, 'youtube.com'), { label: '1:09', quote: 'They land at the same time.' }, 'on a video the label is the second (Classroom’s chip)');
  assert.equal(A.contextChip(A.fresh({ about: 'video', atLabel: '1:09', attach: { kind: 'text', quote: 'x' } }), 'youtube.com'), null, 'the crest’s Ask carries its line on the bubble');
  assert.equal(A.contextChip(A.fresh({ about: 'picture', attach: { kind: 'image', png: 'iVBORw0KGgo' } }), 'x'), null);
  const view = read('lib/ask-view.js');
  assert.match(view, /var chip = A\.contextChip\(state, site\);/);
  assert.match(view, /qq\.appendChild\(doc\.createTextNode\(chip\.quote\)\);/, 'set as text');
  assert.match(view, /'\.talk \.ctx\{align-self:stretch;display:grid;grid-template-columns:auto minmax\(0,1fr\);gap:8px;padding:8px 10px;border-radius:10px;background:var\(--sunk\);font:500 12\.5px\/1\.4 /);
});

test('13c: the words travel the whole way: Heddy ▾ → the pending ask → the desk → the port → POST ask’s attach (Ask, Explain, Make a card)', async () => {
  const tab = { id: 7, windowId: 1, url: 'https://www.deeplearning.ai/courses/', title: 'Courses' };
  const asked = [];
  const routes = W.createWebRoutes({
    chrome: { runtime: { id: 'heddy', sendMessage: async () => {} }, tabs: { get: async () => tab, sendMessage: async () => {} }, storage: { local: { get: async () => ({}) } } },
    api: { ask: (body, onEvent) => { asked.push(body); onEvent({ type: 'done', turnsLeft: null }); return { done: Promise.resolve(), stop() {} }; } },
    cards: {}, showPanel: async () => {}, now: () => 1000,
  });
  const page = { id: 'heddy', url: tab.url, tab, frameId: 0 };
  const frame = { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html?tab=7&host=panel', tab, frameId: 3 };
  for (const [menu, intent] of [['ask', 'ask'], ['ask', 'explain'], ['card', 'card']]) {
    assert.deepEqual(await routes.internal({ type: 'heddy-page:ask', intent: menu, quote: 'Gradient descent', before: 'We train with', after: 'on batches' }, page), { ok: true });
    // What the desk RECEIVES (web-desk.js takePending), not only what was sent.
    const got = await routes.internal({ type: 'heddy-web:ask-pending', tabId: 7 }, frame);
    assert.deepEqual(got.pending.ctx.attach, { kind: 'text', quote: 'Gradient descent', before: 'We train with', after: 'on batches' }, `${menu}: the desk gets the words`);
    const state = A.fresh(got.pending.ctx);
    assert.deepEqual(A.contextChip(state, 'deeplearning.ai').quote, 'Gradient descent');
    // ask-view.js send(): the port message carries the attach.
    const listeners = [];
    const port = { name: W.PORT, sender: frame, onMessage: { addListener: (f) => listeners.push(f) }, onDisconnect: { addListener() {} }, postMessage() {}, disconnect() {} };
    routes.connected(port);
    listeners[0]({ intent, tabId: 7, lang: 'en', state: { about: state.about, n: state.n, attach: state.attach, subject: null, items: [{ who: 'me', text: intent === 'ask' ? 'What is it?' : 'Explain this' }] } });
    await new Promise((r) => setTimeout(r, 0));
    const body = asked.at(-1);
    assert.equal(body.intent, intent);
    assert.deepEqual(body.attach, { kind: 'text', quote: 'Gradient descent', before: 'We train with', after: 'on batches' }, `${intent}: POST ask carries the words`);
  }
});

// ─── D109: the quiz on any video ──────────────────────────────────────────

test('D109: every quiz call carries the page’s title (it names the subject of a video in no clip)', async () => {
  const A2 = load('./lib/desk-api.js');
  const fetches = [];
  const api = A2.createDeskApi({ chrome: { runtime: { id: 'heddy' }, storage: { local: { get: async () => ({}) } } }, fetchImpl: async (url, init) => { fetches.push(JSON.parse(init.body)); return { status: 409, json: async () => ({ type: 'none' }) }; } });
  const V = 'Xq3aPn3x_-A';
  const from = { id: 'heddy', url: `https://www.youtube.com/watch?v=${V}`, tab: { id: 1, url: `https://www.youtube.com/watch?v=${V}` } };
  const r = await api.internal({ type: 'heddy-desk:quiz', youtubeId: V, action: 'start', title: 'Cell division explained' }, from);
  assert.deepEqual(fetches[0], { action: 'start', youtubeId: V, title: 'Cell division explained' });
  assert.deepEqual(r, { ok: false, status: 409, type: 'none' });
  assert.match(desk, /type: 'heddy-desk:quiz', youtubeId: st\.id, title: deps\.title\(\)/);
});

test('D109: 409 none is "no quiz for this video" (Classroom’s unavailable line); the tab is asked again once the transcript is cached', () => {
  const Q = load('./lib/desk-quiz.js');
  assert.equal(Q.startOutcome({ ok: false, status: 409, type: 'none' }), 'unavailable');
  assert.equal(Q.startOutcome({ ok: false, status: 409, type: 'busy' }), 'failed');
  assert.match(desk, /if \(st\.transcript\.status === 'ok' && st\.video\.status === 'ok' && st\.video\.quiz !== 'ready'\) recheckQuiz\(id\);/);
  assert.match(desk, /st\.video\.quiz = r\.quiz;\n        label\(\);/, 'the Quiz tab appears without a reload');
});
