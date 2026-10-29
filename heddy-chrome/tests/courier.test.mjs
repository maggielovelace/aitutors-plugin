// The background end to end, against a fake Chrome: a capture opens the
// window, the window gets its payload once, the result reaches the YouTube tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const { createCourier, SAVED_MS } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const VIDEO = 'Fq2aPn3x_-A';
const PROD = 'https://aitutors.me';
const DEV = 'http://localhost:3000';

function fakeChrome({ dev = false } = {}) {
  const local = { devOrigin: dev };
  const calls = { windows: [], icons: [], tabMessages: [], tabsCreated: [], injected: [] };
  const session = {};
  const chrome = {
    runtime: { id: 'heddy' },
    storage: {
      session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) },
      local: { get: async () => ({ ...local }) },
    },
    windows: {
      get: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      getLastFocused: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      create: async (spec) => { calls.windows.push(spec); return { id: 42 }; },
    },
    action: { setIcon: async (o) => { calls.icons.push(o); } },
    tabs: {
      get: async (id) => ({ id, url: `https://www.youtube.com/watch?v=${VIDEO}` }),
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); },
      create: async (o) => { calls.tabsCreated.push(o); },
    },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
  };
  return { chrome, calls, session, local };
}

function setup(opts) {
  const f = fakeChrome(opts);
  const timers = [];
  const courier = createCourier({ chrome: f.chrome, store: createCidStore(), randomUUID: () => CID, setTimeout: (fn, ms) => timers.push({ fn, ms }) });
  return { ...f, courier, timers };
}

const page = (origin = PROD, windowId = 42) => ({ origin, url: `${origin}/capture/clip?cid=${CID}`, tab: { id: 900, windowId } });
const fromYouTube = { id: 'heddy', url: `https://www.youtube.com/watch?v=${VIDEO}`, tab: { id: 7, windowId: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` } };

test('Add to My Clips opens /capture/clip?cid=… as a 420 × 576 popup window at the right', async () => {
  const s = setup();
  const r = await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 112, then: 'keep' }, fromYouTube);
  assert.deepEqual(r, { ok: true, cid: CID });
  assert.equal(s.calls.windows.length, 1);
  const w = s.calls.windows[0];
  assert.equal(w.url, `${PROD}/capture/clip?cid=${CID}`);
  assert.equal(w.type, 'popup');
  assert.equal(w.width, 420);
  assert.equal(w.height, 576);
  assert.equal(w.left, 1440 - 420 - 44);
  assert.equal(w.top, 150);
  assert.ok(s.session.heddyCids.held[CID], 'mirrored to storage.session');
});

test('the window gets heddy:add once; a second ask, another origin or another window gets nothing', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 112, then: 'classroom' }, fromYouTube);
  const ready = { type: 'heddy:ready', v: 1, cid: CID };
  assert.equal(await s.courier.external(ready, page('https://evil.example')), null);
  assert.equal(await s.courier.external(ready, page(DEV)), null, 'dev origin while the switch is off');
  assert.equal(await s.courier.external(ready, page(PROD, 77)), null, 'another window');
  assert.equal(await s.courier.external(ready, { ...page(), url: `https://evil.example/x` }), null, 'origin and url disagree');
  const payload = await s.courier.external(ready, page());
  assert.deepEqual(payload, { type: 'heddy:add', v: 1, cid: CID, youtubeId: VIDEO, startSec: 112, then: 'classroom' });
  assert.equal(await s.courier.external(ready, page()), null);
});

test('with the developer switch on, captures go to localhost:3000 and it may answer', async () => {
  const s = setup({ dev: true });
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep' }, fromYouTube);
  assert.equal(s.calls.windows[0].url, `${DEV}/capture/clip?cid=${CID}`);
  assert.equal(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page(PROD)), null, 'held for the dev origin');
  assert.equal((await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page(DEV))).youtubeId, VIDEO);
});

test('turning the developer switch off shuts localhost out, even for a payload held for it', async () => {
  const s = setup({ dev: true });
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep' }, fromYouTube);
  s.local.devOrigin = false;
  assert.equal(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page(DEV)), null);
});

test('heddy:result ok: tick for 2 s, the toast with Open, and a pause for Watch with Heddy', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 112, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  const reply = await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, topicId: 'map-scales', topic: 'Maths · Map scales' }, page());
  assert.deepEqual(reply, { ok: true });
  assert.deepEqual(s.calls.icons.at(-1).path[16], 'icons/toolbar-saved-16.png');
  assert.equal(s.calls.icons.at(-1).tabId, 7);
  assert.equal(s.timers[0].ms, SAVED_MS);
  assert.equal(SAVED_MS, 2000);
  await s.timers[0].fn();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls.icons.at(-1).path[16], 'icons/toolbar-ready-16.png', 'back to the watch-page dot');
  const msgs = s.calls.tabMessages.map((x) => x.m);
  assert.deepEqual(msgs[0], { type: 'heddy-ui:toast', kind: 'clip', topic: 'Maths · Map scales', topicLang: null, startSec: 112, href: `${PROD}/study/clips/map-scales?v=${VIDEO}` });
  assert.deepEqual(msgs[1], { type: 'heddy-ui:pause' });
  assert.ok(s.calls.tabMessages.every((x) => x.tabId === 7));
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null, 'one result per cid');
});

test('Add to My Clips does not pause; without a topic, Open goes to My Clips', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page());
  const msgs = s.calls.tabMessages.map((x) => x.m);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].href, `${PROD}/study/clips`);
});

test('Open goes to the topic’s clip page first, then an off-map clip in Mentor’s Classroom, then My Clips', async () => {
  const MOMENT = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
  async function hrefFor(extra) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep' }, fromYouTube);
    await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, ...extra }, page());
    return s.calls.tabMessages[0].m;
  }
  assert.equal((await hrefFor({ momentId: MOMENT, topicId: 'map-scales' })).href, `${PROD}/study/clips/map-scales?v=${VIDEO}`);
  assert.equal((await hrefFor({ momentId: MOMENT })).href, `${PROD}/study/clips/m/${MOMENT}`);
  assert.equal((await hrefFor({ momentId: MOMENT, topicId: '../x' })).href, `${PROD}/study/clips/m/${MOMENT}`, 'a bad topicId falls through');
  assert.equal((await hrefFor({ topicId: 'map-scales' })).href, `${PROD}/study/clips/map-scales?v=${VIDEO}`);
  assert.equal((await hrefFor({ momentId: 'not-a-uuid', topicId: 'map-scales' })).href, `${PROD}/study/clips/map-scales?v=${VIDEO}`);
  assert.equal((await hrefFor({})).href, `${PROD}/study/clips`);
  assert.equal((await hrefFor({ topic: 'Maths · Map scales', lang: 'en-GB' })).topicLang, 'en-GB');
});

test('Open accepts the child’s own clip page', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/clips/m/6ba7b810-9dad-41d1-80b4-00c04fd430c8` }, fromYouTube), { ok: true });
});

test('cant_keep becomes the family-settings toast; other refusals stay in the window', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cant_keep' }, page());
  assert.deepEqual(s.calls.tabMessages.map((x) => x.m), [{ type: 'heddy-ui:toast', kind: 'cant_keep' }]);
  assert.equal(s.calls.icons.length, 0, 'no tick');

  const t = setup();
  await t.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep' }, fromYouTube);
  await t.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await t.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'unknown_video' }, page());
  assert.equal(t.calls.tabMessages.length, 0);
});

test('a result for a cid nobody claimed does nothing', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep' }, fromYouTube);
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null);
  assert.equal(s.calls.tabMessages.length, 0);
});

test('a content script can only capture the video its own page shows, and only from Heddy', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: 'abcdefghijk', startSec: null, then: 'keep' }, fromYouTube), { ok: false });
  assert.equal(await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'keep' }, { ...fromYouTube, id: 'someone-else' }), null);
  assert.equal(s.calls.windows.length, 0);
});

test('the popup’s capture targets the tab it names', async () => {
  const s = setup();
  const r = await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep', tabId: 5, windowId: 1 }, { id: 'heddy' });
  assert.equal(r.ok, true);
  assert.equal(s.calls.windows.length, 1);
});

test('Open goes only to the clips pages on the capture origin', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/clips/map-scales?v=${VIDEO}` }, fromYouTube), { ok: true });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: 'https://evil.example/study/clips' }, fromYouTube), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/auth/logout` }, fromYouTube), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: 'javascript:alert(1)' }, fromYouTube), { ok: false });
  assert.equal(s.calls.tabsCreated.length, 1);
});

test('reaching a watch page by YouTube’s own navigation injects the content script', async () => {
  const s = setup();
  await s.courier.tabUpdated(7, { url: `https://www.youtube.com/watch?v=${VIDEO}` }, { url: `https://www.youtube.com/watch?v=${VIDEO}` });
  assert.equal(s.calls.injected.length, 1);
  assert.deepEqual(s.calls.injected[0].target, { tabId: 7 });
  await s.courier.tabUpdated(8, { url: 'https://www.youtube.com/shorts/x' }, { url: 'https://www.youtube.com/shorts/x' });
  assert.equal(s.calls.injected.length, 1);
});
