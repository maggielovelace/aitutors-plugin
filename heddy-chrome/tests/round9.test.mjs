// Round 9 (PRD-v0.96.0 § 1i, D78–D86): Heddy on any web page is one desk, and
// no window or tab opens unless the child taps a link that says it leaves.
// The Ask view's rules (lib/desk-ask.js), the six requests (lib/heddy-api.js,
// the Round 9 contract's §§ 1–6), the background's routes (lib/web-routes.js),
// and a scan of every shipped file for the calls that open a window or a tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest, shippedFiles } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
globalThis.HeddyTools = load('./lib/tools.js');
const A = load('./lib/desk-ask.js');
globalThis.HeddyDeskAsk = A;
const H = load('./lib/heddy-api.js');
const W = load('./lib/web-routes.js');
const I = globalThis.HeddyI18n;

const PROD = 'https://aitutors.me';
const VIDEO = 'Xq3aPn3x_-A';
const WATCH = `https://www.youtube.com/watch?v=${VIDEO}`;
const PAGE = 'https://www.deeplearning.ai/courses/';
const PNG = globalThis.HeddyCrop.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));

test('the version is 0.6.0, and Round 9 asks for no new permission', () => {
  const m = manifest();
  assert.equal(m.version, '0.6.0');
  assert.deepEqual(m.permissions, ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage']);
  assert.deepEqual(m.host_permissions, ['https://www.youtube.com/watch*', 'https://aitutors.me/*', 'https://*.aitutors.me/*']);
});

// ─── D78: no window, and a tab only where the child taps a link that leaves ──

/** Source without comments, so a comment may name what code may not do. */
function code(f) {
  return read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
}

test('D78: nothing Heddy ships calls windows.create, window.open, or chrome.windows at all', () => {
  for (const f of shippedFiles().filter((x) => /\.(js|html)$/.test(x))) {
    const src = code(f);
    assert.doesNotMatch(src, /windows\.create\s*\(/, `${f} opens a window`);
    assert.doesNotMatch(src, /window\.open\s*\(/, `${f} opens a window`);
  }
});

test('D78: tabs.create only where a child taps a link that says it leaves (Full desk ↗, Open, Sign in, the popup’s tiles, settings) or on first install', () => {
  const KEPT = {
    // openTab (Full desk ↗'s /capture tab, D71) twice, heddy-ui:open (Open on a toast, Open my Jotter ↗, Sign in), installed (the welcome page).
    'lib/courier.js': 4,
    // openSite (first time's Open aitutors.me) and openAndClose (My Jotters · My Clips · My Study, Sign in).
    'popup/popup.js': 2,
    // the options page's links.
    'options/options.js': 1,
    // Full desk ↗: one tab straight to Classroom (owner, 2026-10-31; no /capture page).
    'lib/web-routes.js': 1,
  };
  const seen = {};
  for (const f of shippedFiles().filter((x) => /\.js$/.test(x))) {
    const n = (code(f).match(/tabs\.create\s*\(/g) || []).length;
    if (n) seen[f] = n;
  }
  assert.deepEqual(seen, KEPT);
  const courier = code('lib/courier.js');
  assert.match(courier, /function openTab\(url, fromTabId\)/);
  assert.match(courier, /case 'heddy-ui:open':[^]*chrome\.tabs\.create\(\{ url: u\.href/);
  assert.match(courier, /function installed\(details\) \{\s*if \(!details \|\| details\.reason !== 'install'\)/);
  // The only caller of openTab is Full desk.
  assert.match(courier, /if \(!P\.isYoutubeId\(message\.youtubeId\) \|\| message\.then !== 'classroom'\) return Promise\.resolve\(\{ ok: false \}\);/);
});

test('D78: the desk’s Save to My Jotters and every Round 9 route open nothing by themselves', () => {
  const wr = code('lib/web-routes.js');
  assert.ok(wr.indexOf('chrome.tabs.create') > wr.indexOf('function fullDesk') && wr.indexOf('chrome.tabs.create') < wr.indexOf('function keepCard'), 'web-routes opens a tab only in Full desk');
  assert.doesNotMatch(wr, /windows\.|openCapture/);
  for (const f of ['lib/desk-api.js', 'lib/heddy-api.js', 'lib/cards.js', 'lib/tools.js', 'lib/snap.js', 'lib/panel.js', 'popup/web-desk.js', 'lib/ask-view.js', 'content/desk.js', 'content/page-tray.js', 'content/box-mode.js']) {
    assert.doesNotMatch(code(f), /tabs\.create|windows\.|openCapture/, f);
  }
});

// ─── lib/desk-ask.js: the stream ───────────────────────────────────────────

test('the splitter: whole lines out of any chunking, the last line at the end, blank lines skipped', () => {
  const s = A.createSplitter();
  assert.deepEqual(s.push('{"type":"professor","co'), []);
  assert.deepEqual(s.push('de":null,"name":"Mentor"}\n{"type":"delta","text":"A "}\n\n{"type":"de'), ['{"type":"professor","code":null,"name":"Mentor"}', '{"type":"delta","text":"A "}']);
  assert.deepEqual(s.push('lta","text":"b"}\n'), ['{"type":"delta","text":"b"}']);
  assert.deepEqual(s.push('{"type":"done","turnsLeft":3}'), []);
  assert.deepEqual(s.end(), ['{"type":"done","turnsLeft":3}']);
});

test('the splitter stops a stream past 1 MB, or a line past 64 KB', () => {
  const s = A.createSplitter();
  assert.equal(s.push('x'.repeat(A.MAX_LINE + 1)), null);
  assert.deepEqual(s.push('{"type":"done"}\n'), [], 'dead after that');
  const t = A.createSplitter();
  for (let i = 0; i < 16; i++) t.push('{"type":"delta","text":"' + 'y'.repeat(60000) + '"}\n');
  assert.equal(t.push('z'.repeat(100000)), null);
});

test('every line is checked: the six types, cut to size, anything else is null', () => {
  assert.deepEqual(A.parseEvent('{"type":"professor","code":"PHYS","name":"Newton","sc":"red"}'), { type: 'professor', code: 'PHYS', name: 'Newton' });
  assert.deepEqual(A.parseEvent('{"type":"professor","code":"<b>","name":""}'), { type: 'professor', code: null, name: 'Mentor' });
  assert.deepEqual(A.parseEvent('{"type":"delta","text":"Hi\\u0007 there"}'), { type: 'delta', text: 'Hi there' });
  assert.deepEqual(A.parseEvent('{"type":"card","front":" Why? ","back":"Because.","draftToken":"tok_1.a"}'), { type: 'card', front: 'Why?', back: 'Because.', draftToken: 'tok_1.a' });
  assert.equal(A.parseEvent('{"type":"card","front":"Why?","back":"Because.","draftToken":"<script>"}'), null);
  assert.deepEqual(A.parseEvent('{"type":"keepable","draftToken":"k1"}'), { type: 'keepable', draftToken: 'k1' });
  assert.deepEqual(A.parseEvent('{"type":"done","turnsLeft":2.7}'), { type: 'done', turnsLeft: 2 });
  assert.deepEqual(A.parseEvent('{"type":"done","turnsLeft":null}'), { type: 'done', turnsLeft: null });
  assert.deepEqual(A.parseEvent('{"type":"error","code":"cap","message":"Out of turns"}'), { type: 'error', code: 'cap', message: 'Out of turns' });
  assert.deepEqual(A.parseEvent('{"type":"error","code":"rm -rf"}'), { type: 'error', code: 'failed', message: '' });
  for (const bad of ['nope', '[]', '{"type":"html","html":"<b>"}', '{"type":"delta","text":""}']) assert.equal(A.parseEvent(bad), null, bad);
});

test('the professor’s colours come from Heddy’s own table, never from the network; Mentor’s for none', () => {
  assert.deepEqual(A.coloursFor('PHYS'), { sc: '#2f64d6', scSoft: '#e5ecfb' });
  assert.deepEqual(A.coloursFor(null), { sc: '#0d7565', scSoft: '#dcf1ec' }, 'the artifact’s Mentor');
  assert.deepEqual(A.coloursFor('XXXX'), A.MENTOR);
});

// ─── lib/desk-ask.js: the conversation ─────────────────────────────────────

test('a turn: the child’s bubble (with the picture on the first), an answer written by deltas, then done', () => {
  let s = A.fresh({ about: 'picture', n: 2, attach: { kind: 'image', png: PNG } });
  s = A.start(s, 'explain', 'Explain this picture');
  assert.equal(s.busy, true);
  assert.deepEqual(s.items, [{ who: 'me', text: 'Explain this picture', pic: PNG }, { who: 'tu', text: '' }]);
  assert.equal(A.start(s, 'ask', 'again'), null, 'one turn at a time');
  s = A.apply(s, { type: 'professor', code: null, name: 'Mentor' });
  s = A.apply(s, { type: 'delta', text: 'A course page ' });
  s = A.apply(s, { type: 'delta', text: 'puts a face first.' });
  s = A.apply(s, { type: 'keepable', draftToken: 'k1' });
  s = A.apply(s, { type: 'done', turnsLeft: 4 });
  assert.equal(s.busy, false);
  assert.deepEqual(s.items[1], { who: 'tu', text: 'A course page puts a face first.', token: 'k1' });
  assert.equal(s.turnsLeft, 4);
  s = A.start(s, 'card', 'Make a card');
  assert.equal(s.items[2].pic, undefined, 'the picture rides on the first bubble only');
  s = A.apply(s, { type: 'card', front: 'Why the photo?', back: 'Trust.', draftToken: 'c1' });
  s = A.apply(s, { type: 'done', turnsLeft: 3 });
  assert.deepEqual(s.items.map((i) => i.who), ['me', 'tu', 'me', 'card'], 'a card-only reply draws no empty bubble');
});

test('the body (contract § 4): source, attach, the finished turns as messages, the intent and the language', () => {
  let s = A.fresh({ about: 'words', attach: { kind: 'text', quote: ' 2 cm is 1 km ', before: 'On a map', after: '' } });
  s = A.start(s, 'ask', 'What does it mean?');
  const src = { kind: 'page', url: PAGE, title: 'Courses' };
  assert.deepEqual(A.body(s, 'ask', src, 'zh_CN'), {
    source: src,
    messages: [{ role: 'user', text: 'What does it mean?' }],
    intent: 'ask',
    lang: 'zh',
    attach: { kind: 'text', quote: '2 cm is 1 km', before: 'On a map' },
  });
  s = A.apply(s, { type: 'delta', text: 'It is the scale.' });
  s = A.apply(s, { type: 'done', turnsLeft: null });
  s = A.start(s, 'card', 'Make a card');
  assert.deepEqual(A.body(s, 'card', src, 'en').messages.map((m) => m.role), ['user', 'assistant', 'user']);
});

test('an attachment is checked: a raw base64 PNG of at most 1 MB, or words; anything else is none', () => {
  assert.deepEqual(A.attachOf({ kind: 'image', png: PNG }), { kind: 'image', png: PNG });
  assert.equal(A.attachOf({ kind: 'image', png: 'data:image/png;base64,' + PNG }), null, 'raw base64, as the site’s validator takes it');
  assert.equal(A.attachOf({ kind: 'image', png: 'iVBORw0KGgo' + 'A'.repeat(1500000) }), null);
  assert.equal(A.attachOf({ kind: 'text', quote: '   ' }), null);
  assert.equal(A.attachOf({ kind: 'video' }), null);
});

test('a stream that ends without done, or an error line, leaves what came and says so', () => {
  let s = A.start(A.fresh({ about: 'page' }), 'ask', 'Hi');
  s = A.apply(s, { type: 'delta', text: 'Half an' });
  s = A.ended(s);
  assert.deepEqual([s.busy, s.error, s.items[1].text], [false, 'failed', 'Half an']);
  let t = A.start(A.fresh({ about: 'page' }), 'ask', 'Hi');
  t = A.apply(t, { type: 'error', code: 'signed_out', message: '' });
  assert.deepEqual([t.busy, t.error, t.items.length], [false, 'signed_out', 1], 'the empty answer is not drawn');
});

test('Keep card marks it kept; Change it takes the draft away', () => {
  let s = A.start(A.fresh({ about: 'page' }), 'card', 'Make a card');
  s = A.apply(s, { type: 'card', front: 'Q', back: 'A', draftToken: 'c1' });
  s = A.apply(s, { type: 'done', turnsLeft: null });
  const at = s.items.findIndex((i) => i.who === 'card');
  assert.equal(A.markKept(s, at).items[at].kept, true);
  assert.equal(A.changeCard(s, at).items.some((i) => i.who === 'card'), false);
});

test('the header line and the box: "Ask Mentor · about picture 2", in both languages', () => {
  const h = (ctx, name, lang = 'en') => { const x = A.headerFor(A.fresh(ctx), name); return I.t(lang, x.key, ...x.args); };
  assert.equal(h({ about: 'picture', n: 2 }, 'Mentor'), 'Ask Mentor · about picture 2');
  assert.equal(h({ about: 'words' }, 'Newton'), 'Ask Newton · about these words');
  assert.equal(h({ about: 'video' }, 'Newton'), 'Ask Newton · about this video');
  assert.equal(h({ about: 'picture', n: 2 }, 'Mentor', 'zh_CN'), '问 Mentor · 关于图 2');
  assert.equal(I.t('en', 'askPhPictureN', 'Mentor', '2'), 'Ask Mentor about picture 2…');
  assert.deepEqual(['askExplain', 'askMakeCard', 'askKeepCard', 'askChangeIt', 'askKeepJot'].map((k) => I.t('en', k)), ['Explain', 'Make a card', 'Keep card', 'Change it', 'Keep as a jot']);
});

test('openAsk is the one way in: it hands the desk the context and the intent, nothing else', () => {
  const got = [];
  const desk = { openAsk: (ctx, intent) => got.push({ ctx, intent }) };
  assert.equal(A.openAsk({ about: 'video' }, desk, 'ask'), true);
  assert.equal(A.openAsk({ about: 'picture', n: 1 }, desk, 'nonsense'), true);
  assert.deepEqual(got, [{ ctx: { about: 'video' }, intent: 'ask' }, { ctx: { about: 'picture', n: 1 }, intent: 'ask' }]);
  assert.equal(A.openAsk({}, null), false);
  const yt = read('content/desk.js');
  assert.match(yt, /root\.HeddyDeskAsk\.openAsk\(\{ about: 'video' \}, api, 'ask'\);/, 'the YouTube crest (D84: everywhere, YouTube too)');
  assert.doesNotMatch(yt, /heddy-ui:tool/, 'never the room window');
});

// ─── lib/heddy-api.js: the six requests ────────────────────────────────────

function apiSetup(answers = {}) {
  const calls = [];
  const call = async (method, path, params, body) => {
    calls.push({ method, path, body });
    const a = answers[path] || { status: 200, data: { ok: true } };
    return a;
  };
  return { calls, api: H.createHeddyApi({ call, origin: async () => PROD, fetchImpl: async () => null, setTimeout: () => 1, clearTimeout: () => {} }) };
}

test('§ 1 save: the answer is checked; the href must be a Jotter’s, else it is a failure', async () => {
  const ok = { status: 200, data: { ok: true, jotterId: 'j_1', jotterTitle: 'DeepLearning.AI', href: '/study/jotters/j_1', saveId: 's_1', counts: { snippets: 1, pictures: 2, article: false } } };
  const s = apiSetup({ '/api/learn/heddy/save': ok });
  const body = { url: PAGE, title: 't', items: [] };
  assert.deepEqual(await s.api.save(body), { ok: true, jotterId: 'j_1', jotterTitle: 'DeepLearning.AI', href: '/study/jotters/j_1', saveId: 's_1', counts: { snippets: 1, pictures: 2, article: false }, dropped: null });
  // Contract Changes, site 9: no new row (an article already there) → saveId null; an article refused → dropped.
  assert.equal(H.parseSave({ status: 200, data: { ...ok.data, saveId: null, dropped: 'not_study' } }).saveId, null);
  assert.equal(H.parseSave({ status: 200, data: { ...ok.data, dropped: 'not_study' } }).dropped, 'not_study');
  assert.deepEqual(s.calls[0], { method: 'POST', path: '/api/learn/heddy/save', body });
  assert.deepEqual(H.parseSave({ status: 200, data: { ...ok.data, href: 'https://evil.example/' } }), { ok: false, error: 'failed' });
  assert.deepEqual(H.parseSave({ status: 401, data: null }), { ok: false, error: 'signed_out' });
  assert.deepEqual(H.parseSave({ status: 403, data: { ok: false, error: 'signed_out' } }), { ok: false, error: 'signed_out' }, 'a grown-up: sign in as the child');
  assert.deepEqual(H.parseSave({ status: 403, data: { error: 'forbidden' } }), { ok: false, error: 'forbidden' }, 'an id the site does not know: no sign-in helps');
  assert.deepEqual(H.parseSave({ status: 413, data: { ok: false, error: 'too_big' } }), { ok: false, error: 'too_big' });
  assert.deepEqual(H.parseSave({ status: 400, data: { ok: false, error: '<b>' } }), { ok: false, error: 'failed' });
});

test('a body past 4 MB is never sent (Vercel refuses 4.5 MB)', async () => {
  const s = apiSetup();
  assert.deepEqual(await s.api.save({ url: PAGE, items: [{ png: 'A'.repeat(4.2 * 1024 * 1024) }] }), { ok: false, error: 'too_big' });
  assert.equal(s.calls.length, 0);
});

test('§ 2 undo: a save, cards, a jot or a clip, by id; anything else is not sent', async () => {
  assert.deepEqual(H.undoBody({ kind: 'save', saveId: 's_1', extra: 1 }), { kind: 'save', saveId: 's_1' });
  assert.deepEqual(H.undoBody({ kind: 'card', cardIds: ['a', 'b'] }), { kind: 'card', cardIds: ['a', 'b'] });
  assert.deepEqual(H.undoBody({ kind: 'jot', jotId: 'j', jotterId: 'r' }), { kind: 'jot', jotId: 'j', jotterId: 'r' });
  assert.deepEqual(H.undoBody({ kind: 'clip', momentId: 'm' }), { kind: 'clip', momentId: 'm' });
  for (const bad of [{ kind: 'save', saveId: '../x' }, { kind: 'card', cardIds: [] }, { kind: 'card', cardIds: ['a', '<'] }, { kind: 'jot', jotId: 'j' }, { kind: 'everything' }]) assert.equal(H.undoBody(bad), null, JSON.stringify(bad));
  const s = apiSetup();
  assert.deepEqual(await s.api.undo({ kind: 'nope' }), { ok: false, error: 'invalid' });
  assert.equal(s.calls.length, 0);
});

test('§ 3 clip: the times as the capture message rounds them; the answer’s href must be My Clips’', () => {
  assert.deepEqual(H.clipBody({ youtubeId: VIDEO, title: ' Meet\n Newton ', startSec: null, endSec: null }), { youtubeId: VIDEO, title: 'Meet Newton', startSec: null, endSec: null });
  assert.equal(H.clipBody({ youtubeId: VIDEO, startSec: 30, endSec: 20 }).endSec, null, 'an end before the start is dropped');
  assert.equal(H.clipBody({ youtubeId: 'nope' }), null);
  assert.deepEqual(H.parseClip({ status: 200, data: { ok: true, momentId: 'm1', topicId: 't1', href: '/study/clips/forces?v=' + VIDEO, duplicate: false, startSec: 21, endSec: null, notices: ['new_channel', 'evil'] } }), { ok: true, momentId: 'm1', topicId: 't1', href: '/study/clips/forces?v=' + VIDEO, duplicate: false, startSec: 21, endSec: null, notices: ['new_channel'] });
  assert.deepEqual(H.parseClip({ status: 429, data: { ok: false, error: 'limit' } }), { ok: false, error: 'limit' });
  assert.deepEqual(H.parseClip({ status: 200, data: { ok: true, href: '//evil.example' } }), { ok: false, error: 'failed' });
  assert.deepEqual(H.parseClip({ status: 422, data: { ok: false, error: 'no_captions' } }), { ok: false, error: 'no_captions' });
});

test('§ 5 card and § 6 jot: ids checked, the deck link kept only when it is a study page', () => {
  assert.deepEqual(H.parseCard({ status: 200, data: { ok: true, cardIds: ['c1', 'c2'], jotterId: 'j1', deckHref: '/study/jotters/j1/deck' } }), { ok: true, cardIds: ['c1', 'c2'], jotterId: 'j1', deckHref: '/study/jotters/j1/deck' });
  assert.equal(H.parseCard({ status: 200, data: { ok: true, cardIds: ['c1'], deckHref: 'https://evil.example' } }).deckHref, null);
  assert.deepEqual(H.parseCard({ status: 200, data: { ok: true, cardIds: [] } }), { ok: false, error: 'failed' });
  assert.deepEqual(H.parseJot({ status: 200, data: { ok: true, jotId: 'x1', jotterId: 'j1' } }), { ok: true, jotId: 'x1', jotterId: 'j1' });
  assert.deepEqual(H.parseJot({ status: 401 }), { ok: false, error: 'signed_out' });
});

/** A fetch whose body arrives in these chunks. */
function streamFetch(chunks, { status = 200 } = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    const enc = new TextEncoder();
    const body = new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
    return { status, body };
  };
  return { fetchImpl, seen };
}

test('§ 4 ask: POSTs NDJSON-accepting JSON with the browser’s cookie, and hands back every checked line, in order', async () => {
  const f = streamFetch(['{"type":"professor","code":"PHYS","name":"Newton"}\n{"type":"del', 'ta","text":"Pre"}\n{"type":"delta","text":"dict."}\n{"type":"html","x":1}\n', '{"type":"done","turnsLeft":5}\n']);
  const api = H.createHeddyApi({ call: async () => ({}), origin: async () => PROD, fetchImpl: f.fetchImpl, setTimeout: () => 1, clearTimeout: () => {} });
  const got = [];
  const body = { source: { kind: 'video', url: WATCH, title: 'Meet Newton', youtubeId: VIDEO }, messages: [{ role: 'user', text: 'Explain this video' }], intent: 'explain', lang: 'en' };
  await api.ask(body, (e) => got.push(e)).done;
  assert.equal(f.seen[0].url, `${PROD}/api/learn/heddy/ask`);
  assert.equal(f.seen[0].init.method, 'POST');
  assert.equal(f.seen[0].init.credentials, 'include');
  assert.equal(f.seen[0].init.headers.Accept, 'application/x-ndjson');
  assert.deepEqual(JSON.parse(f.seen[0].init.body), body);
  assert.deepEqual(got, [
    { type: 'professor', code: 'PHYS', name: 'Newton' },
    { type: 'delta', text: 'Pre' },
    { type: 'delta', text: 'dict.' },
    { type: 'done', turnsLeft: 5 },
  ]);
});

test('§ 4 ask: signed out is a line the view can draw; a stream with no done ends in an error', async () => {
  const out = streamFetch([], { status: 401 });
  const api = H.createHeddyApi({ call: async () => ({}), origin: async () => PROD, fetchImpl: out.fetchImpl, setTimeout: () => 1, clearTimeout: () => {} });
  const got = [];
  await api.ask({}, (e) => got.push(e)).done;
  assert.deepEqual(got, [{ type: 'error', code: 'signed_out', message: '' }]);
  const cut = streamFetch(['{"type":"delta","text":"Half"}\n']);
  const api2 = H.createHeddyApi({ call: async () => ({}), origin: async () => PROD, fetchImpl: cut.fetchImpl, setTimeout: () => 1, clearTimeout: () => {} });
  const got2 = [];
  await api2.ask({}, (e) => got2.push(e)).done;
  assert.deepEqual(got2, [{ type: 'delta', text: 'Half' }, { type: 'error', code: 'failed', message: '' }]);
  const broken = H.createHeddyApi({ call: async () => ({}), origin: async () => PROD, fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, setTimeout: () => 1, clearTimeout: () => {} });
  const got3 = [];
  await broken.ask({}, (e) => got3.push(e)).done;
  assert.deepEqual(got3, [{ type: 'error', code: 'failed', message: '' }]);
});

test('the six paths, and nothing else, under /api/learn/heddy/', () => {
  assert.deepEqual(H.PATHS, { save: '/api/learn/heddy/save', undo: '/api/learn/heddy/undo', clip: '/api/learn/heddy/clip', ask: '/api/learn/heddy/ask', card: '/api/learn/heddy/card', jot: '/api/learn/heddy/jot' });
  const src = code('lib/heddy-api.js');
  assert.equal((src.match(/deps\.fetchImpl\(/g) || []).length, 1, 'the stream is the one fetch of its own; the rest go through desk-api’s call');
  assert.doesNotMatch(src, /chrome\.storage|localStorage|indexedDB/);
});

// ─── lib/web-routes.js: who may ask what ───────────────────────────────────

function routesSetup({ url = PAGE, title = 'Courses | DeepLearning.AI' } = {}) {
  const calls = { api: [], tabMessages: [], told: [], shown: [] };
  const tab = { id: 7, windowId: 1, url, title };
  const chrome = {
    runtime: { id: 'heddy', sendMessage: async (m) => { calls.told.push(m); } },
    tabs: { get: async (id) => ({ ...tab, id }), sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); } },
    storage: { local: { get: async () => ({}) } },
  };
  const reply = { ok: true };
  const api = {
    save: async (b) => { calls.api.push(['save', b]); return reply; },
    undo: async (b) => { calls.api.push(['undo', b]); return { ok: true }; },
    clip: async (b) => { calls.api.push(['clip', b]); return { ok: true, href: '/study/clips/m/m1', duplicate: false, startSec: 21, endSec: 73, notices: ['off_map'] }; },
    card: async (b) => { calls.api.push(['card', b]); return { ok: true, cardIds: ['c1'], jotterId: 'j1', deckHref: '/study/jotters/j1' }; },
    jot: async (b) => { calls.api.push(['jot', b]); return { ok: true, jotId: 'x1', jotterId: 'j1' }; },
    ask: (body, onEvent) => { calls.api.push(['ask', body]); onEvent({ type: 'professor', code: 'PHYS', name: 'Newton' }); onEvent({ type: 'done', turnsLeft: 1 }); return { done: Promise.resolve(), stop: () => {} }; },
  };
  const cards = { saveWeb: async (t, a) => { calls.api.push(['saveWeb', t.id, a]); return { ok: true }; }, undoSave: async (t, id) => { calls.api.push(['undoSave', t.id, id]); return { ok: true }; } };
  const routes = W.createWebRoutes({ chrome, api, cards, showPanel: async (t) => { calls.shown.push(t.id); }, now: () => 1000 });
  const frame = { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html?tab=7&host=panel', tab, frameId: 3 };
  const page = { id: 'heddy', url, tab, frameId: 0 };
  return { routes, calls, frame, page, tab };
}

test('the desk’s save and Undo come only from Heddy’s own page, which names its tab', async () => {
  const s = routesSetup();
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:save', tabId: 7, article: true }, s.frame), { ok: true });
  assert.deepEqual(s.calls.api.at(-1), ['saveWeb', 7, true]);
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:save', tabId: 7 }, s.page), { ok: false }, 'a page cannot save itself');
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:undo-save', tabId: 7, saveId: 's1' }, s.frame), { ok: true });
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:save', tabId: 7 }, { ...s.frame, id: 'another' }), { ok: false });
  assert.equal(s.routes.internal({ type: 'heddy-cards:get' }, s.frame), undefined, 'not ours');
});

test('Heddy ▾ on words: the ask waits for the desk, which opens (D84); the desk takes it once', async () => {
  const s = routesSetup();
  assert.deepEqual(await s.routes.internal({ type: 'heddy-page:ask', intent: 'card', quote: ' 2 cm is 1 km ', before: 'On a map', after: '' }, s.page), { ok: true });
  assert.deepEqual(s.calls.shown, [7], 'the desk opens if it was closed');
  assert.deepEqual(s.calls.told.at(-1), { type: 'heddy-web:ask', tabId: 7 });
  const got = await s.routes.internal({ type: 'heddy-web:ask-pending', tabId: 7 }, s.frame);
  assert.deepEqual(got, { ok: true, pending: { ctx: { about: 'words', n: null, attach: { kind: 'text', quote: '2 cm is 1 km', before: 'On a map' } }, intent: 'card' } });
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:ask-pending', tabId: 7 }, s.frame), { ok: true, pending: null }, 'once');
  assert.deepEqual(await s.routes.internal({ type: 'heddy-page:ask', intent: 'ask', quote: '  ' }, s.page), { ok: false });
  assert.deepEqual(await s.routes.internal({ type: 'heddy-page:ask', quote: 'x' }, s.frame), { ok: false }, 'from the page only');
});

test('Keep card and Keep as a jot: the address and title from the tab, never the message; the deck link made whole', async () => {
  const s = routesSetup();
  const r = await s.routes.internal({ type: 'heddy-web:card', tabId: 7, url: 'https://evil.example/', front: 'Why the photo?', back: 'Trust.', draftToken: 'c1', png: PNG }, s.frame);
  assert.deepEqual(r, { ok: true, cardIds: ['c1'], jotterId: 'j1', deckHref: `${PROD}/study/jotters/j1` });
  assert.deepEqual(s.calls.api.at(-1), ['card', { url: PAGE, title: 'Courses | DeepLearning.AI', front: 'Why the photo?', back: 'Trust.', draftToken: 'c1', attach: { kind: 'image', png: PNG } }]);
  await s.routes.internal({ type: 'heddy-web:jot', tabId: 7, text: 'A face first.', draftToken: 'k1', quote: '2 cm' }, s.frame);
  assert.deepEqual(s.calls.api.at(-1), ['jot', { url: PAGE, title: 'Courses | DeepLearning.AI', text: 'A face first.', draftToken: 'k1', quote: '2 cm' }]);
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:card', tabId: 7, front: '', back: 'x', draftToken: 'c1' }, s.frame), { ok: false, error: 'invalid' });
});

test('on YouTube the source is the video at the player’s second', () => {
  assert.deepEqual(W.sourceOf({ url: `${WATCH}&list=PL1`, title: 'Meet Professor Newton - YouTube' }, 31.8), { kind: 'video', url: `${WATCH}&t=31`, title: 'Meet Professor Newton', youtubeId: VIDEO, t: 31 });
  assert.deepEqual(W.sourceOf({ url: `${PAGE}#top`, title: 'Courses' }), { kind: 'page', url: PAGE, title: 'Courses' });
  assert.equal(W.sourceOf({ url: 'chrome://extensions/' }), null);
});

test('Add to My Clips from the popup (D86, owner: C1 + C3’s toast): a request; the popup gets the Added card’s fields, the video the toast with Open · Undo; no tab', async () => {
  const s = routesSetup({ url: WATCH, title: 'Meet Professor Newton - YouTube' });
  s.routes = W.createWebRoutes({
    chrome: { runtime: { id: 'heddy', sendMessage: async (m) => { s.calls.told.push(m); } }, tabs: { get: async (id) => ({ id, windowId: 1, url: WATCH, title: 'Meet Professor Newton - YouTube' }), sendMessage: async (tabId, m) => { s.calls.tabMessages.push({ tabId, m }); } }, storage: { local: { get: async () => ({}) } } },
    api: {
      clip: async (b) => { s.calls.api.push(['clip', b]); return { ok: true, momentId: 'm1', href: '/study/clips/m/m1', duplicate: false, startSec: 69, endSec: 124, durationSec: 175, notices: ['new_channel'] }; },
      undo: async (b) => { s.calls.api.push(['undo', b]); return { ok: true }; },
    },
    cards: {}, showPanel: async () => {},
  });
  const r = await s.routes.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 69, endSec: 124, then: 'keep', tabId: 7 }, s.frame);
  assert.deepEqual(r, { ok: true, duplicate: false, momentId: 'm1', startSec: 69, endSec: 124, durationSec: 175, notices: ['new_channel'], href: `${PROD}/study/clips/m/m1` });
  assert.deepEqual(s.calls.api.at(-1), ['clip', { youtubeId: VIDEO, title: 'Meet Professor Newton', startSec: 69, endSec: 124 }]);
  const toast = s.calls.tabMessages[0].m;
  const T = load('./lib/toast.js');
  const m = T.model(toast, 'en', I.translator('en'));
  assert.deepEqual([m.title, m.line, m.warn, m.open.label, m.undo], ['Added to My Clips · 1:09 – 2:04', 'New channel · your grown-up will be told', true, 'Open', { label: 'Undo', momentId: 'm1' }]);
  // One Undo undoes both: from the toast (the page) or the popup (Heddy's page).
  assert.deepEqual(await s.routes.internal({ type: 'heddy-ui:undo-clip', momentId: 'm1' }, s.page), { ok: true });
  assert.deepEqual(s.calls.api.at(-1), ['undo', { kind: 'clip', momentId: 'm1' }]);
  assert.deepEqual(s.calls.tabMessages.at(-1).m, { type: 'heddy-ui:toast', kind: 'clip_undone' });
  assert.deepEqual(s.calls.told.at(-1), { type: 'heddy-clip:undone', tabId: 7, momentId: 'm1' }, 'the popup hears it');
  assert.deepEqual(await s.routes.internal({ type: 'heddy-web:undo', kind: 'clip', momentId: 'm1', tabId: 7 }, s.frame), { ok: true });
  assert.equal(T.model({ kind: 'clip_added', duplicate: true, momentId: 'm1' }, 'en', I.translator('en')).undo, null, 'a duplicate has nothing to undo');
  assert.deepEqual(await s.routes.internal({ type: 'heddy-ui:capture', youtubeId: 'Fq2aPn3x_-A', then: 'keep', tabId: 7 }, s.frame), { ok: false }, 'only the video the tab shows');
  assert.equal(s.routes.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'classroom' }, s.page), undefined, 'Full desk stays the courier’s');
  const pop = read('popup/popup.js');
  assert.match(pop, /function addedCard\(r, ctx\) \{/, 'the Added card is its own function');
  assert.doesNotMatch(pop.slice(pop.indexOf("go.addEventListener('click'"), pop.indexOf('function secWord')), /closeUi\(\)/, 'the popup stays open on Added');
});

test('the toasts’ Undo goes from the background (D78): a jot, cards; then the toast that says so', async () => {
  const s = routesSetup();
  assert.deepEqual(await s.routes.internal({ type: 'heddy-ui:undo-card', cardIds: ['c1'] }, s.page), { ok: true });
  assert.deepEqual(s.calls.api.at(-1), ['undo', { kind: 'card', cardIds: ['c1'] }]);
  assert.deepEqual(s.calls.tabMessages.at(-1), { tabId: 7, m: { type: 'heddy-ui:toast', kind: 'card_undone' } });
  await s.routes.internal({ type: 'heddy-ui:undo', jotId: 'x1', jotterId: 'j1' }, s.page);
  assert.deepEqual(s.calls.api.at(-1), ['undo', { kind: 'jot', jotId: 'x1', jotterId: 'j1' }]);
  assert.deepEqual(s.calls.tabMessages.at(-1), { tabId: 7, m: { type: 'heddy-ui:toast', kind: 'undone' } });
});

test('the conversation Port: one turn, the source read from the tab, every line back to the desk; Heddy ▾ learns the professor', async () => {
  const s = routesSetup();
  const posted = [];
  let onMsg = null;
  const port = { name: 'heddy-ask', sender: s.frame, postMessage: (m) => posted.push(m), onMessage: { addListener: (fn) => { onMsg = fn; } }, onDisconnect: { addListener: () => {} }, disconnect: () => {} };
  assert.equal(s.routes.connected(port), true);
  onMsg({ tabId: 7, intent: 'explain', state: { about: 'picture', n: 2, attach: { kind: 'image', png: PNG }, items: [{ who: 'me', text: 'Explain this picture' }, { who: 'tu', text: '' }] }, lang: 'en' });
  await new Promise((r) => setImmediate(r));
  const [kind, body] = s.calls.api.at(-1);
  assert.equal(kind, 'ask');
  assert.deepEqual(body, { source: { kind: 'page', url: PAGE, title: 'Courses | DeepLearning.AI' }, messages: [{ role: 'user', text: 'Explain this picture' }], intent: 'explain', lang: 'en', attach: { kind: 'image', png: PNG } });
  assert.deepEqual(posted.map((p) => p.event.type), ['professor', 'done']);
  assert.deepEqual(await s.routes.internal({ type: 'heddy-page:professor' }, s.page), { ok: true, name: 'Newton' });
  assert.equal(s.routes.connected({ name: 'something-else' }), false);
});

// ─── strings and surfaces ──────────────────────────────────────────────────

test('every Round 9 string exists in both languages, English free of Chinese, zh in the site’s words', () => {
  const en = JSON.parse(read('_locales/en/messages.json'));
  const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
  const keys = Object.keys(en).filter((k) => /^(web|save|saving|saved|step|ask|deskSaved|deskFootMentor|menuAsk|menuMakeCard|menuInDesk|menuCopyWords|menuAddToSources|modeTextView|modePictureView|barHeddyMenu|clipFailed|clipSignedOut|addsToMyClips|toastAddedToClips|toastAlreadyInClips|toastSignIn)/.test(k));
  assert.ok(keys.length > 60, `${keys.length} keys`);
  for (const k of keys) {
    assert.ok(zh[k], `zh_CN ${k}`);
    assert.doesNotMatch(en[k].message, /[　-鿿]/, k);
  }
  assert.deepEqual(['webTabSources', 'saveArticle', 'stepRead', 'stepJot', 'stepGet', 'deskAsk'].map((k) => zh[k].message), ['来源', '同时保留文章正文', '读', '记', '懂', '问 $NAME$']);
  assert.equal(I.t('zh_CN', 'saveN', '3'), '存 3 条到我的 Jotters');
  assert.equal(I.t('en', 'savedTo', 'DeepLearning.AI'), 'Saved to your DeepLearning.AI Jotter');
  assert.equal(I.t('en', 'deskFootMentor'), "Mentor's desk");
});

test('the web desk is the artifact’s: Sources and the crest as the Ask tab, the save block, the 32 px foot', () => {
  const desk = read('popup/web-desk.js');
  assert.match(desk, /var sources = btn\('tab', ic\('jot'\)\);/);
  assert.match(desk, /var crest = btn\('tab crest', null\);/);
  assert.match(desk, /ui\.crest\.setAttribute\('aria-selected', String\(st\.tab === 'ask'\)\);/);
  assert.match(desk, /ui\.crest\.title = tr\('deskAsk', profName\(\)\);/, 'the tooltip and the screen-reader name say "Ask Mentor"');
  const shell = read('lib/desk-shell.js');
  assert.match(shell, /'\.ft\{height:32px;/);
  assert.match(desk, /'\.cd \.svb \.sgo\{height:42px;border-radius:12px;background:var\(--ink-deep\);/);
  assert.match(desk, /'\.cd \.okc|\.okc/);
  assert.match(read('lib/ask-view.js'), /'\.askb\{margin-top:auto;margin-inline:-18px;padding:10px 18px 12px;border-top:1px solid var\(--line\);/);
  assert.match(read('lib/ask-view.js'), /'\.tab\.crest\[aria-selected="true"\]\{margin-left:auto;width:auto;padding:0 10px;align-self:stretch;/, 'the artifact’s crest fix');
});

// ─── the site's Changes (r9-contract.md, site 1–14) ────────────────────────

test('no_subject: the turn comes back with the subject the child picks (site 3); safeguarding keeps the site’s words (site 4)', () => {
  let s = A.start(A.fresh({ about: 'page' }), 'explain', 'Explain this');
  s = A.apply(s, { type: 'professor', code: null, name: 'Mentor' });
  s = A.apply(s, A.parseEvent('{"type":"error","code":"no_subject","message":"Pick a subject"}'));
  assert.equal(s.error, 'no_subject');
  s = A.pickSubject(s, 'GEOG');
  assert.deepEqual([s.subject, s.retry, s.items.length], ['GEOG', { intent: 'explain', text: 'Explain this' }, 0]);
  s = A.start(s, s.retry.intent, s.retry.text);
  assert.equal(A.body(s, 'explain', { kind: 'page', url: PAGE, title: '' }, 'en').subject, 'GEOG');
  assert.equal(A.pickSubject(s, 'ART'), s, 'only the seven');
  const line = "If you're struggling, please talk to a parent or call Childline 0800 1111";
  const ev = A.parseEvent(JSON.stringify({ type: 'error', code: 'safeguarding', message: line }));
  assert.equal(A.apply(A.start(A.fresh({}), 'ask', 'x'), ev).message, line);
  assert.match(read('lib/ask-view.js'), /if \(code === 'safeguarding'\) return el\(doc, 'p', 'aerr safe', state\.message/, 'drawn verbatim, nothing to tap');
});

test('a card may have an empty back (site 7); Keep as a jot sends the paragraph untouched with its quote (site 6)', async () => {
  assert.deepEqual(A.parseEvent('{"type":"card","front":"2 cm on the map is {{1 km}}","back":"","draftToken":"c"}'), { type: 'card', front: '2 cm on the map is {{1 km}}', back: '', draftToken: 'c' });
  let s = A.start(A.fresh({ about: 'page' }), 'explain', 'Explain this');
  s = A.apply(s, { type: 'delta', text: ' A scale says how far. ' });
  assert.equal(A.jotQuote(s, 1), 'Explain this', 'no attach: the child’s message it explained');
  const r = routesSetup();
  await r.routes.internal({ type: 'heddy-web:jot', tabId: 7, text: ' A scale says how far. ', draftToken: 'k1', quote: 'Explain this' }, r.frame);
  assert.equal(r.calls.api.at(-1)[1].text, ' A scale says how far. ', 'byte for byte');
  await r.routes.internal({ type: 'heddy-web:card', tabId: 7, front: 'Q', back: '', draftToken: 'c1' }, r.frame);
  assert.equal(r.calls.api.at(-1)[1].back, '');
});

test('Keep as a jot on YouTube goes to the video at t, never with a picture (site 14)', async () => {
  const r = routesSetup({ url: WATCH, title: 'Meet Newton - YouTube' });
  await r.routes.internal({ type: 'heddy-web:jot', t: 52.6, text: 'They land together.', draftToken: 'k1', png: PNG, quote: 'Explain this video' }, r.page);
  assert.deepEqual(r.calls.api.at(-1)[1], { url: `${WATCH}&t=52`, title: 'Meet Newton', text: 'They land together.', draftToken: 'k1', quote: 'Explain this video', t: 52 });
});

test('a 403 that names the route’s own refusal is that refusal; an unknown copy is forbidden; any other 403 is signed out (site 1, 7)', () => {
  assert.deepEqual(H.parseCard({ status: 403, data: { ok: false, error: 'invalid' } }), { ok: false, error: 'invalid' });
  assert.deepEqual(H.parseCard({ status: 403, data: { ok: false, error: 'no_seat' } }), { ok: false, error: 'no_seat' });
  assert.deepEqual(H.parseCard({ status: 403, data: { ok: false, error: 'signed_out' } }), { ok: false, error: 'signed_out' });
  assert.deepEqual(H.parseCard({ status: 403, data: { error: 'forbidden' } }), { ok: false, error: 'forbidden' });
  assert.deepEqual(H.parseJot({ status: 200, data: { ok: true, jotId: null, jotterId: 'j1' } }), { ok: true, jotId: null, jotterId: 'j1' }, 'kept, with no Undo');
});

// ─── the owner's 0.5.0 test in real Chrome (2026-10-31) ────────────────────

test('layout: the desk takes the column’s own width (≤ 410 px, never wider), or goes under the player when the column cannot hold it', () => {
  const D = load('./lib/desk-model.js');
  assert.equal(D.layoutFor({ twoColumns: true, column: { width: 368, right: 1264 }, viewportW: 1280 }), 'column');
  assert.equal(D.layoutFor({ twoColumns: true, column: { width: 110, right: 1280 }, viewportW: 1280 }), 'below', 'YouTube’s rail of icons');
  assert.equal(D.layoutFor({ twoColumns: true, column: { width: 400, right: 1400 }, viewportW: 1280 }), 'below', 'off the window’s edge');
  assert.equal(D.layoutFor({ twoColumns: true, theater: true }), 'below');
  const shell = read('lib/desk-shell.js');
  assert.match(shell, /':host\(\.column\)\{position:sticky;top:var\(--heddy-top,68px\);width:100%;max-width:410px;min-width:0\}'/);
  assert.match(shell, /@container \(max-width:350px\)\{\.tab \.vi\{display:none\}[^']*\.hd small\{display:none\}/, 'the subtitle goes first, then the tab icons');
  assert.doesNotMatch(shell.replace(/letter-spacing:[.\d]+em/g, ''), /\d(r?em)\b/, 'px only: the owner’s Chrome has a 24 px root font');
  assert.match(read('content/desk.js'), /tab: 'jot',/, 'the desk opens on Jot');
});

test('H with no transcript still does something you can see: the note box takes the time, and the line stays until a jot', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /say\(tr\('deskNoTranscriptNote', P\.clockOf\(at\)\), true\);/);
  assert.match(desk, /if \(text && !stay\) sayTimer = setTimeout/);
  assert.match(desk, /setTimeout\(function \(\) \{ if \(ui && ui\.field && ui\.field\.isConnected\) ui\.field\.focus\(\); \}, 0\);/, 'focused after the key, so the H is not typed');
  assert.equal(I.t('en', 'deskNoTranscriptNote', '0:31'), 'No transcript to jot from here. Type what you heard: it is kept at 0:31.');
});

test('a copy of Heddy aitutors.me does not know (403 forbidden) is said plainly, with its id, everywhere', () => {
  assert.match(read('content/desk.js'), /if \(st\.video\.status === 'forbidden'\) sc\.appendChild\(el\('div', 'si', tr\('deskForbidden', chrome\.runtime\.id\)\)\);/);
  assert.match(I.t('en', 'deskForbidden', 'abc'), /^aitutors\.me doesn't know this copy of Heddy \(id abc\)/);
  assert.ok(A.ERRORS.includes('forbidden'));
});

test('every desk and Round 9 request names Heddy’s id in X-Heddy-Id: Chrome sends no Origin on a GET from the worker to a permitted host', async () => {
  const DA = load('./lib/desk-api.js');
  const seen = [];
  const api = DA.createDeskApi({ chrome: { runtime: { id: 'dfodgnhipffpkldflfjcelbafjogjheo' }, storage: { local: { get: async () => ({}) } } }, fetchImpl: async (u, init) => { seen.push(init.headers); return { status: 200, json: async () => ({ signedIn: false }) }; }, setTimeout: () => 1, clearTimeout: () => {} });
  await api.internal({ type: 'heddy-desk:video', youtubeId: VIDEO }, { id: 'dfodgnhipffpkldflfjcelbafjogjheo', url: WATCH, tab: { id: 7, url: WATCH } });
  assert.equal(seen[0]['X-Heddy-Id'], 'dfodgnhipffpkldflfjcelbafjogjheo');
  const f = streamFetch(['{"type":"done","turnsLeft":null}\n']);
  const ask = H.createHeddyApi({ call: async () => ({}), origin: async () => PROD, fetchImpl: f.fetchImpl, extensionId: 'dfodgnhipffpkldflfjcelbafjogjheo', setTimeout: () => 1, clearTimeout: () => {} });
  await ask.ask({}, () => {}).done;
  assert.equal(f.seen[0].init.headers['X-Heddy-Id'], 'dfodgnhipffpkldflfjcelbafjogjheo');
  assert.equal(DA.TRANSCRIPT_TIMEOUT_MS, 60000, 'a long video’s first transcript gets a minute');
});

test('Full desk ↗ (owner, 2026-10-31): the whole video kept (§ 3), the jots saved, then ONE tab straight to Classroom at this second, and the video paused; no /capture page', async () => {
  const calls = { api: [], tabs: [], tabMessages: [], jots: [] };
  const tab = { id: 7, index: 3, windowId: 1, url: WATCH, title: 'GCSE Maths - YouTube' };
  const routes = W.createWebRoutes({
    chrome: { runtime: { id: 'heddy', sendMessage: async () => {} }, tabs: { get: async () => tab, sendMessage: async (id, m) => { calls.tabMessages.push(m); }, create: async (o) => { calls.tabs.push(o); return { id: 9 }; } }, storage: { local: { get: async () => ({}) } } },
    api: { clip: async (b) => { calls.api.push(b); return { ok: true, momentId: 'm1', topicId: null, href: '/study/clips/m/m1' }; } },
    cards: {}, showPanel: async () => {},
    saveJots: async (id, m) => { calls.jots.push({ id, m }); return { ok: true, saved: 2, href: `/study/jotters/v/${id}` }; },
  });
  const page = { id: 'heddy', url: WATCH, tab, frameId: 0 };
  const r = await routes.internal({ type: 'heddy-desk:full', youtubeId: VIDEO, title: 'GCSE Maths', jots: [{ t: 1, kind: 'note', text: 'x' }], t: 731.6, lang: 'en' }, page);
  assert.deepEqual(r, { ok: true, jotsSaved: 2 });
  assert.deepEqual(calls.api, [{ youtubeId: VIDEO, title: 'GCSE Maths', startSec: null, endSec: null }], 'the whole video');
  assert.equal(calls.jots[0].id, VIDEO);
  assert.deepEqual(calls.tabs, [{ url: `${PROD}/study/clips/m/m1?classroom=1&t=731&from=heddy`, openerTabId: 7, index: 4, windowId: 1, active: true }]);
  assert.deepEqual(calls.tabMessages, [{ type: 'heddy-ui:pause' }]);
  // a library video: its topic's Classroom; Chinese: the /zh door
  const lib = W.createWebRoutes({
    chrome: { runtime: { id: 'heddy', sendMessage: async () => {} }, tabs: { get: async () => tab, sendMessage: async () => {}, create: async (o) => { calls.tabs.push(o); } }, storage: { local: { get: async () => ({}) } } },
    api: { clip: async () => ({ ok: true, momentId: null, topicId: 'forces', href: '/study/clips/forces?v=' + VIDEO }) }, cards: {}, showPanel: async () => {},
  });
  await lib.internal({ type: 'heddy-desk:full', youtubeId: VIDEO, t: 5, lang: 'zh' }, page);
  assert.equal(calls.tabs.at(-1).url, `${PROD}/zh/study/clips/forces?v=${VIDEO}&classroom=1&t=5&from=heddy`);
  // signed out: no tab; the desk shows its Sign in line
  const out = W.createWebRoutes({ chrome: { runtime: { id: 'heddy' }, tabs: { get: async () => tab, create: async (o) => { calls.tabs.push(o); } }, storage: { local: { get: async () => ({}) } } }, api: { clip: async () => ({ ok: false, error: 'signed_out' }) }, cards: {}, showPanel: async () => {} });
  const n = calls.tabs.length;
  assert.deepEqual(await out.internal({ type: 'heddy-desk:full', youtubeId: VIDEO }, page), { ok: false, error: 'signed_out' });
  assert.equal(calls.tabs.length, n);
  assert.deepEqual(await routes.internal({ type: 'heddy-desk:full', youtubeId: 'Fq2aPn3x_-A' }, page), { ok: false }, 'only the video the tab shows');
  assert.doesNotMatch(read('content/desk.js'), /type: 'heddy-ui:capture'/, 'the desk never asks for a /capture page');
});

test('the Jot tab says why H cannot jot, for as long as it is true: reading, no captions, no seat, or a failed read with Try again', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /var key = \{ loading: 'deskWhyLoading', none: 'deskWhyNone', locked: 'deskWhyLocked', error: 'deskWhyError' \}\[s\];/);
  assert.match(desk, /else if \(!signedOut\(\)\) transcriptReason\(sc\);/);
  assert.match(desk, /if \(r && r\.ok && r\.signedIn === false\)[^]*?\} else if \(r && r\.ok\) \{[^]*?loadTranscript\(\);/, 'the transcript is asked for as the desk opens, whatever the tab');
});
