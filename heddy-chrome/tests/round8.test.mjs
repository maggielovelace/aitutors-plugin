// Round 8 (PRD-v0.96.0 § 1h, D68–D77; the plugin ↔ site contract): heddy:add's
// endSec and jots (mirroring the site's lib/capture/protocol.ts rules), the
// desk's four requests through the background (lib/desk-api.js) against a fake
// fetch, the courier carrying Full desk's jots and dropping them once saved,
// the crest's Ask with the video at its second, and source pins for the
// button, the desk and the popup, which need a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest, shippedFiles } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const P = globalThis.HeddyProtocol;
const A = load('./lib/desk-api.js');
const { createCourier } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const VIDEO = 'Xq3aPn3x_-A';
const PROD = 'https://aitutors.me';
const WATCH = `https://www.youtube.com/watch?v=${VIDEO}`;
const fromYouTube = { id: 'heddy', url: WATCH, tab: { id: 7, index: 3, windowId: 1, url: WATCH } };

test('the version moved on from 0.5.0 (Round 9 is 0.6.0: tests/round9.test.mjs)', () => {
  assert.notEqual(manifest().version, '0.5.0');
});

// ─── heddy:add: endSec and jots (contract § 5) ─────────────────────────────

const add = (over) => P.buildAdd({ cid: CID, youtubeId: VIDEO, startSec: null, then: 'keep', ...over });

test('endSec: after the start (after 0 with no start), at most 6 h, rounded up as the site rounds it; the whole video sends neither', () => {
  assert.equal('endSec' in add({}), false);
  assert.deepEqual(add({ startSec: 21, endSec: 73.2 }), { type: 'heddy:add', v: 1, cid: CID, youtubeId: VIDEO, startSec: 21, then: 'keep', endSec: 74 });
  assert.equal(add({ endSec: 73 }).endSec, 73, 'a part from the start');
  assert.throws(() => add({ startSec: 21, endSec: 21 }), /bad endSec/);
  assert.equal(add({ startSec: 21, endSec: 21.7 }).endSec, 22, 'the raw end is after the raw start');
  assert.throws(() => add({ startSec: 21.8, endSec: 21.7 }), /bad endSec/);
  assert.equal(add({ endSec: 0.5 }).endSec, 1);
  assert.throws(() => add({ endSec: 0 }), /bad endSec/);
  assert.throws(() => add({ endSec: 6 * 3600 + 1 }), /bad endSec/);
  assert.equal(add({ endSec: 6 * 3600 }).endSec, 21600);
  assert.throws(() => add({ endSec: NaN }), /bad endSec/);
  assert.throws(() => add({ endSec: '73' }), /bad endSec/);
});

test('jots: only with then classroom (Full desk), at most 200, t ≥ 0 to 0.1 s, text cut at 2000, kind line or note', () => {
  const jots = [{ t: 14.24, kind: 'line', text: 'Predict first' }, { t: 52, kind: 'note', text: 'They land\ntogether\u0007' }];
  assert.deepEqual(add({ then: 'classroom', jots }).jots, [{ t: 14.2, kind: 'line', text: 'Predict first' }, { t: 52, kind: 'note', text: 'They land\ntogether' }]);
  assert.throws(() => add({ then: 'keep', jots }), /classroom/);
  assert.equal('jots' in add({ then: 'classroom', jots: [] }), false, 'none to carry, no field');
  assert.throws(() => add({ then: 'classroom', jots: Array.from({ length: 201 }, () => ({ t: 1, kind: 'note', text: 'x' })) }), /bad jots/);
  assert.equal(add({ then: 'classroom', jots: Array.from({ length: 200 }, () => ({ t: 1, kind: 'note', text: 'x' })) }).jots.length, 200);
  assert.equal(add({ then: 'classroom', jots: [{ t: 1, kind: 'note', text: 'é'.repeat(2500) }] }).jots[0].text.length, 2000);
  for (const bad of [{ t: -1, kind: 'note', text: 'x' }, { t: 1, kind: 'picture', text: 'x' }, { t: 1, kind: 'note', text: 3 }, null]) {
    assert.throws(() => add({ then: 'classroom', jots: [bad] }), /bad jot/, JSON.stringify(bad));
  }
});

// ─── the desk's requests (contract §§ 1–4) ──────────────────────────────────

function deskSetup({ answers = {}, dev = false } = {}) {
  const calls = { fetches: [], tabsCreated: [] };
  const chrome = {
    runtime: { id: 'heddy' },
    storage: { local: { get: async () => ({ devOrigin: dev }) } },
    tabs: { create: async (o) => { calls.tabsCreated.push(o); return { id: 99 }; } },
  };
  const fetchImpl = async (url, init) => {
    calls.fetches.push({ url, init });
    const path = new URL(url).pathname;
    const a = answers[path] || { status: 200, body: {} };
    return { ok: a.status < 300, status: a.status, json: async () => a.body };
  };
  const api = A.createDeskApi({ chrome, fetchImpl, setTimeout: () => 1, clearTimeout: () => {} });
  return { api, calls };
}

test('every desk request goes to aitutors.me under /api/learn/heddy/desk/, with the browser’s cookie, never cached', async () => {
  const s = deskSetup({ answers: { '/api/learn/heddy/desk/video': { status: 200, body: { signedIn: false } } } });
  const r = await s.api.internal({ type: 'heddy-desk:video', youtubeId: VIDEO, title: 'Meet Professor Newton (Physics)' }, fromYouTube);
  assert.deepEqual(r, { ok: true, signedIn: false });
  const f = s.calls.fetches[0];
  assert.equal(f.url, `${PROD}/api/learn/heddy/desk/video?v=${VIDEO}&title=Meet%20Professor%20Newton%20(Physics)`);
  assert.equal(f.init.method, 'GET');
  assert.equal(f.init.credentials, 'include');
  assert.equal(f.init.cache, 'no-store');
  assert.equal(f.init.redirect, 'error');
  const dev = deskSetup({ dev: true });
  await dev.api.internal({ type: 'heddy-desk:transcript', youtubeId: VIDEO }, fromYouTube);
  assert.equal(dev.calls.fetches[0].url, `http://localhost:3000/api/learn/heddy/desk/transcript?v=${VIDEO}`, 'no title, no &title=');
  assert.ok(Object.values(A.PATHS).every((p) => p.startsWith('/api/learn/heddy/desk/')), 'every desk path, incl. r13 quiz');
  assert.deepEqual(Object.keys(A.PATHS).sort(), ['jots', 'keypoints', 'quiz', 'transcript', 'video']);
});

test('only the watch page of the video named may ask, and never one of Heddy’s own pages', async () => {
  const s = deskSetup();
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:video', youtubeId: 'abcdefghijk' }, fromYouTube), { ok: false });
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:video', youtubeId: VIDEO }, { ...fromYouTube, url: 'chrome-extension://heddy/popup/popup.html' }), { ok: false });
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:video', youtubeId: VIDEO }, { ...fromYouTube, id: 'other' }), { ok: false });
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:video', youtubeId: VIDEO }, { id: 'heddy', url: WATCH }), { ok: false });
  assert.equal(s.api.internal({ type: 'heddy-ui:capture' }, fromYouTube), undefined, 'not a desk message');
  assert.equal(s.calls.fetches.length, 0);
});

test('§ 1: the professor, checked: colours must be hex, the Jotter link must be the video’s', () => {
  assert.deepEqual(A.parseVideo({ signedIn: true, youtubeId: VIDEO, professor: { code: 'PHYS', name: 'Newton', nameZh: 'Newton', sc: '#2f64d6', scSoft: '#e5ecfb' }, inMyClips: false, jotterHref: `/study/jotters/v/${VIDEO}` }), {
    ok: true, signedIn: true, professor: { code: 'PHYS', name: 'Newton', nameZh: 'Newton', sc: '#2f64d6', scSoft: '#e5ecfb' }, inMyClips: false, quiz: 'none', jotterHref: `/study/jotters/v/${VIDEO}`,
  });
  const odd = A.parseVideo({ signedIn: true, professor: { code: null, name: '', sc: 'red;background:url(x)', scSoft: '#zzzzzz' }, jotterHref: 'https://evil.example/x' });
  assert.deepEqual(odd.professor, { code: null, name: 'Mentor', nameZh: 'Mentor', sc: null, scSoft: null });
  assert.equal(odd.jotterHref, null);
  assert.deepEqual(A.parseVideo({ signedIn: false }), { ok: true, signedIn: false });
  assert.equal(A.parseVideo('x').ok, false);
});

test('§ 2: the transcript and a Chinese stretch; zh=1&from= asks for the stretch', async () => {
  const body = { status: 'ok', lines: [{ t: 31, text: 'Which one?' }, { t: 24.1, text: 'Before we drop them' }, { t: -1, text: 'bad' }, { t: 3 }], zh: { from: 0, to: 600, lines: [{ t: 24.1, text: '在我们松手之前' }] }, zhState: 'ready' };
  const s = deskSetup({ answers: { '/api/learn/heddy/desk/transcript': { status: 200, body } } });
  const r = await s.api.internal({ type: 'heddy-desk:transcript', youtubeId: VIDEO, title: 'Meet Newton', zhFrom: 1834.6 }, fromYouTube);
  assert.equal(s.calls.fetches[0].url, `${PROD}/api/learn/heddy/desk/transcript?v=${VIDEO}&title=Meet%20Newton&zh=1&from=1834`);
  assert.deepEqual(r.lines, [{ t: 24.1, text: 'Before we drop them' }, { t: 31, text: 'Which one?' }]);
  assert.deepEqual(r.zh, { from: 0, to: 600, lines: [{ t: 24.1, text: '在我们松手之前' }] });
  assert.equal(r.zhState, 'ready');
  assert.deepEqual(A.parseTranscript({ status: 'none', lines: [{ t: 1, text: 'x' }] }), { ok: true, status: 'none', lines: [], zh: null, zhState: 'idle' });
  assert.equal(A.parseTranscript({ status: 'weird' }).ok, false);
});

test('r11b: Insights is POST …/desk/keypoints with the video’s chapters; the reply is checked', async () => {
  const body = { status: 'writing', chapters: [{ startSec: 0, endSec: 312, title: 'Intro', text: 'They fall together.', points: [], written: true }, { startSec: -3, endSec: 1 }] };
  const s = deskSetup({ answers: { '/api/learn/heddy/desk/keypoints': { status: 200, body } } });
  const r = await s.api.internal({ type: 'heddy-desk:keypoints', youtubeId: VIDEO, title: 'Meet Newton', lang: 'zh', from: 12.7, chapters: [{ startSec: 0, endSec: 312.4, title: 'Intro' }, { startSec: 312.4, endSec: 600, title: 'Drop' }] }, fromYouTube);
  assert.equal(s.calls.fetches[0].url, `${PROD}/api/learn/heddy/desk/keypoints`);
  assert.equal(s.calls.fetches[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(s.calls.fetches[0].init.body), { youtubeId: VIDEO, title: 'Meet Newton', lang: 'zh', chapters: [{ startSec: 0, endSec: 312, title: 'Intro' }, { startSec: 312, endSec: 600, title: 'Drop' }], from: 12 });
  assert.deepEqual(r, { ok: true, status: 'writing', chapters: [{ startSec: 0, endSec: 312, title: 'Intro', text: 'They fall together.', points: [], written: true }] });
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:keypoints', youtubeId: VIDEO, chapters: [{ startSec: 10, endSec: 5, title: 'x' }] }, fromYouTube), { ok: false, error: 'bad_request' }, 'never sends chapters the site would refuse');
  assert.equal(A.parseKeypoints({ status: 'weird' }).ok, false);
});

test('§ 4: Save to My Jotters posts the jots and opens nothing (Round 9, D86: the desk shows the Saved card); 401 is signed out', async () => {
  const s = deskSetup({ answers: { '/api/learn/heddy/desk/jots': { status: 200, body: { ok: true, saved: 2, href: `/study/jotters/v/${VIDEO}` } } } });
  const jots = [{ t: 14.24, kind: 'line', text: 'Predict first' }, { t: 52, kind: 'note', text: 'They land together' }];
  const r = await s.api.internal({ type: 'heddy-desk:save-jots', youtubeId: VIDEO, title: 'Meet Professor Newton', channel: 'Heddy', durationSec: 174.4, jots }, fromYouTube);
  assert.deepEqual(r, { ok: true, saved: 2, href: `/study/jotters/v/${VIDEO}` });
  const f = s.calls.fetches[0];
  assert.equal(f.url, `${PROD}/api/learn/heddy/desk/jots`);
  assert.equal(f.init.method, 'POST');
  assert.equal(f.init.credentials, 'include');
  assert.equal(f.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.init.body), { youtubeId: VIDEO, title: 'Meet Professor Newton', channel: 'Heddy', durationSec: 174, jots: [{ t: 14.2, kind: 'line', text: 'Predict first' }, { t: 52, kind: 'note', text: 'They land together' }] });
  assert.deepEqual(s.calls.tabsCreated, [], 'no tab until Open my Jotter ↗ is tapped');

  const out = deskSetup({ answers: { '/api/learn/heddy/desk/jots': { status: 401, body: { error: 'unauthenticated' } } } });
  assert.deepEqual(await out.api.internal({ type: 'heddy-desk:save-jots', youtubeId: VIDEO, jots }, fromYouTube), { ok: false, error: 'unauthenticated' });
  assert.equal(out.calls.tabsCreated.length, 0);
  const evil = deskSetup({ answers: { '/api/learn/heddy/desk/jots': { status: 200, body: { ok: true, saved: 1, href: 'https://evil.example/' } } } });
  assert.deepEqual(await evil.api.internal({ type: 'heddy-desk:save-jots', youtubeId: VIDEO, jots }, fromYouTube), { ok: false, error: 'save' });
  assert.equal(evil.calls.tabsCreated.length, 0, 'never opens an address the site did not mean');
  const none = deskSetup();
  assert.deepEqual(await none.api.internal({ type: 'heddy-desk:save-jots', youtubeId: VIDEO, jots: [] }, fromYouTube), { ok: false, error: 'bad_jots' });
  assert.equal(none.calls.fetches.length, 0);
});

test('a network failure, a 500 or a broken body is an error, never a throw', async () => {
  const s = deskSetup({ answers: { '/api/learn/heddy/desk/video': { status: 500, body: null } } });
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:video', youtubeId: VIDEO }, fromYouTube), { ok: false, error: 'network' });
  const broken = A.createDeskApi({ chrome: { runtime: { id: 'heddy' }, storage: { local: { get: async () => ({}) } } }, fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, setTimeout: () => 1, clearTimeout: () => {} });
  assert.deepEqual(await broken.internal({ type: 'heddy-desk:video', youtubeId: VIDEO }, fromYouTube), { ok: false, error: 'network' });
  assert.deepEqual(await s.api.internal({ type: 'heddy-desk:nope', youtubeId: VIDEO }, fromYouTube), { ok: false });
});

// ─── the courier: Full desk's jots, Add to My Clips' end (contract § 5) ────

function courierSetup(stored = {}) {
  const calls = { tabsCreated: [], tabMessages: [], localSet: [], localRemoved: [] };
  const session = {};
  const local = { devOrigin: false, ...stored };
  const chrome = {
    runtime: { id: 'heddy', getManifest: () => ({ version: '0.5.0' }) },
    storage: {
      session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) },
      local: {
        get: async (k) => (typeof k === 'string' ? { [k]: local[k] } : { ...local }),
        set: async (o) => { calls.localSet.push(o); Object.assign(local, o); },
        remove: async (k) => { calls.localRemoved.push(k); delete local[k]; },
      },
    },
    windows: { get: async () => ({ id: 1 }), getLastFocused: async () => ({ id: 1 }), create: async () => ({ id: 42 }), remove: async () => {} },
    action: { setIcon: async () => {} },
    tabs: {
      get: async (id) => ({ id, index: 3, windowId: 1, url: WATCH, active: false }),
      create: async (o) => { calls.tabsCreated.push(o); return { id: 900, windowId: 1 }; },
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); },
      update: async () => {},
      remove: async () => {},
    },
    scripting: { executeScript: async () => {} },
  };
  const courier = createCourier({ chrome, store: createCidStore(), randomUUID: () => CID, setTimeout: () => {} });
  return { courier, calls, local };
}

const capturePage = { origin: PROD, url: `${PROD}/capture/clip?cid=${CID}`, tab: { id: 900, windowId: 1 } };

test('Add to My Clips from the popup carries the part’s end (D75), now as the clip request’s body (Round 9 § 3)', () => {
  const H = load('./lib/heddy-api.js');
  assert.deepEqual(H.clipBody({ youtubeId: VIDEO, title: 'Meet Newton', startSec: 21.7, endSec: 72.2 }), { youtubeId: VIDEO, title: 'Meet Newton', startSec: 21, endSec: 73 });
});

test('Full desk carries the desk’s jots to Classroom; once the clip is kept, those jots leave the desk and newer ones stay (D71)', async () => {
  const key = `deskJots:${VIDEO}`;
  const s = courierSetup({ [key]: [{ id: 'a', t: 14.2, kind: 'line', text: 'Predict first' }, { id: 'b', t: 52, kind: 'note', text: 'Land together' }, { id: 'c', t: 60, kind: 'note', text: 'made after Full desk' }] });
  const jots = [{ t: 14.2, kind: 'line', text: 'Predict first' }, { t: 52, kind: 'note', text: 'Land together' }];
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom', jots, jotIds: ['a', 'b'] }, fromYouTube);
  const payload = await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, capturePage);
  assert.deepEqual(payload.jots, jots);
  assert.equal(payload.then, 'classroom');
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, topicId: 'forces', jotsSaved: 2 }, capturePage);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(s.local[key].map((j) => j.id), ['c']);
});

test('a kept clip whose jots did not save (no jotsSaved) leaves them on the desk', async () => {
  const key = `deskJots:${VIDEO}`;
  const s = courierSetup({ [key]: [{ id: 'a', t: 1, kind: 'note', text: 'x' }] });
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'classroom', jots: [{ t: 1, kind: 'note', text: 'x' }], jotIds: ['a'] }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, capturePage);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, capturePage);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(s.local[key].map((j) => j.id), ['a']);
});

test('jotsSaved on a result is an integer 0–200, else dropped', () => {
  const r = (x) => P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotsSaved: x }).jotsSaved;
  assert.equal(r(0), 0);
  assert.equal(r(200), 200);
  for (const bad of [201, -1, 1.5, '2', null, undefined]) assert.equal(r(bad), null, String(bad));
});

test('jots ride only on Full desk from the video’s own page, never from the popup; keep is not the courier’s at all', async () => {
  const jots = [{ t: 1, kind: 'note', text: 'x' }];
  const keep = courierSetup();
  assert.deepEqual(await keep.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'keep', jots, jotIds: ['a'] }, fromYouTube), { ok: false });
  const popup = courierSetup();
  await popup.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'classroom', jots, tabId: 7 }, { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html', tab: { id: 7 } });
  assert.equal('jots' in (await popup.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, capturePage)), false);
});

test('a failed or refused clip leaves the desk’s jots where they are', async () => {
  const key = `deskJots:${VIDEO}`;
  const s = courierSetup({ [key]: [{ id: 'a', t: 1, kind: 'note', text: 'x' }] });
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'classroom', jots: [{ t: 1, kind: 'note', text: 'x' }], jotIds: ['a'] }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, capturePage);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cant_keep' }, capturePage);
  assert.deepEqual(s.local[key].map((j) => j.id), ['a']);
});

test('Open from the desk: My Clips, Jotters and the kid sign-in door; nothing else', async () => {
  const s = courierSetup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/auth/login?door=kid` }, fromYouTube), { ok: true });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/jotters/v/${VIDEO}` }, fromYouTube), { ok: true });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/auth/login?door=parent&next=/x` }, fromYouTube), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/admin` }, fromYouTube), { ok: false });
});

test('D92: See plans opens exactly aitutors.me/pricing, nothing under it, nothing with a query', async () => {
  const s = courierSetup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/pricing` }, fromYouTube), { ok: true });
  assert.equal(s.calls.tabsCreated.at(-1).url, `${PROD}/pricing`);
  for (const bad of [`${PROD}/pricing/x`, `${PROD}/pricing?next=/admin`, `${PROD}/pricing#x`, `${PROD}/pricingx`, `${PROD}/admin`, 'https://evil.example/pricing']) {
    assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: bad }, fromYouTube), { ok: false }, bad);
  }
});

// ─── the crest: Ask {professor} with the video at its second (contract § 6) ─

// ─── source pins (the page surfaces need a browser; looked at headless) ────

const yt = read('content/youtube.js');
const desk = read('content/desk.js');
const popup = read('popup/popup.js');

test('D68: one button on YouTube’s bar, Watch with Heddy, pressed while the desk is open; Add to My Clips left the bar', () => {
  assert.equal((yt.match(/<button /g) || []).length, 1);
  assert.doesNotMatch(yt, /addToMyClips|h-film|startChoice|capture\('keep'\)/);
  assert.match(yt, /watch\.addEventListener\('click', function \(\) \{ desk\.toggle\(\); \}\);/);
  assert.match(yt, /bar\.watch\.setAttribute\('aria-pressed', String\(desk\.isOpen\(\)\)\);/);
  assert.match(yt, /attachShadow\(\{ mode: 'closed' \}\)/);
});

test('D76: the script checks chrome.runtime.id on every tick and tears down what it drew', () => {
  assert.match(yt, /D\.createLifeline\(\{\s*isAlive: function \(\) \{ return D\.alive\(globalThis\.chrome\); \},\s*teardown: teardown,/);
  assert.match(yt, /function teardown\(\) \{[^]*desk\.destroy\(\);\s*removeBar\(\);/);
  assert.match(yt, /life\.start\(\);/);
  assert.doesNotMatch(yt, /setInterval\(refresh/, 'the only interval is the lifeline’s');
});

test('the desk is a closed shadow root; YouTube’s suggestions are hidden only while it is open and come back on close', () => {
  assert.match(desk, /host\.attachShadow\(\{ mode: 'closed' \}\)/);
  assert.match(desk, /close: function \(quiet\) \{[^]*restoreSuggestions\(\);/);
  assert.match(desk, /hidden = \{ el: rel, display: rel\.style\.display \};/);
  assert.doesNotMatch(desk, /\.innerHTML = (?!EYES|'<style>')/, 'nothing from a page or the site goes in as HTML');
});

test('the desk’s strings are Heddy’s catalog, the professor’s name and the site’s words set as text', () => {
  assert.doesNotMatch(desk, /insertAdjacentHTML\([^)]*(text|title|name|quote)/i);
  assert.match(desk, /el\('q', null, j\.text\)/);
  for (const k of ['deskTabJot', 'deskTabDigest', 'deskTabInsights', 'deskFoot', 'deskJkBtn', 'deskInsightsSoon', 'deskSaveJotters', 'deskFull', 'deskSub', 'digestTranscript', 'deskShowSuggestions']) {
    assert.match(desk, new RegExp(`'${k}'`), k);
  }
});

test('D73: EN | 中 writes Heddy’s Language setting, the options page’s value', () => {
  assert.match(desk, /o\[I\.STORAGE_KEY\] = next;\s*Promise\.resolve\(\)\.then\(function \(\) \{ return chrome\.storage\.sync\.set\(o\); \}\)/);
  assert.match(read('options/options.js'), /STORAGE_KEY/);
});

test('D75: the popup on a video is Add to My Clips with the faint eyes, the real thumbnail, the exact link, the strip and the chips', () => {
  assert.match(popup, /\$\('title'\)\.textContent = tr\('addToMyClips'\);/);
  assert.match(popup, /lite\.insertAdjacentHTML\('beforeend', M\.use\('h-eyes', 22\)\);/);
  assert.match(popup, /type: 'heddy-ui:open-desk'/);
  assert.match(popup, /img\.src = F\.thumbUrl\(youtubeId\);/);
  assert.match(popup, /img\.addEventListener\('error', function \(\) \{ img\.remove\(\); th\.classList\.add\('none'\); \}\);/, 'the placeholder stays on error');
  assert.match(popup, /\[\['whole', 'chipWhole'\], \['last30', 'chipLast30'\], \['fromNow', 'chipFromNow'\]\]/);
  assert.match(popup, /Object\.assign\(m, F\.captureFields\(range, duration\)\)/);
  assert.match(popup, /world: 'MAIN', func: readStoryboard/);
  assert.doesNotMatch(popup, /wholeVideo|fromTime|keyRow/);
  assert.match(read('popup/popup.css'), /body\.yt \{ width: 400px; \}/);
  assert.match(read('popup/popup.css'), /\.yt \.ph \.watchlite svg \{ opacity: \.38;/);
});

test('images come only from YouTube’s own i.ytimg.com, named in one file (lib/film-strip.js)', () => {
  const named = shippedFiles().filter((f) => /\.(js|html|css)$/.test(f) && read(f).includes('i.ytimg.com'));
  assert.deepEqual(named, ['lib/film-strip.js']);
});

test('the desk’s requests: one place, aitutors.me paths only, and nothing stored', () => {
  const src = read('lib/desk-api.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
  assert.equal((src.match(/deps\.fetchImpl\(/g) || []).length, 1);
  assert.match(src, /credentials: 'include'/);
  assert.match(src, /var BASE = '\/api\/learn\/heddy\/desk\/';/);
  assert.doesNotMatch(src, /chrome\.storage\.(local|sync)\.set|localStorage|indexedDB/);
  assert.match(src, /return deps\.fetchImpl\(o \+ path \+ \(qs \? '\?' \+ qs : ''\), init\);/);
});

test('the desk ships on every watch page, in the manifest and in the background’s re-injection list', () => {
  const js = manifest().content_scripts[0].js;
  for (const f of ['lib/config.js', 'lib/desk-model.js', 'lib/film-strip.js', 'lib/desk-ask.js', 'content/desk.js']) assert.ok(js.includes(f), f);
  assert.ok(js.indexOf('content/desk.js') < js.indexOf('content/youtube.js'));
});
