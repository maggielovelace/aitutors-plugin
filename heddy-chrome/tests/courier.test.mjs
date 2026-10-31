// The background end to end, against a fake Chrome: a capture opens the
// window, the window gets its payload once, the result reaches the YouTube tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const { createCourier, SAVED_MS, TAB_CLOSE_MS, CANCELLED } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const VIDEO = 'Fq2aPn3x_-A';
const PROD = 'https://aitutors.me';
const DEV = 'http://localhost:3000';

function fakeChrome({ dev = false } = {}) {
  const local = { devOrigin: dev };
  const calls = { windows: [], icons: [], tabMessages: [], tabsCreated: [], injected: [], updated: [], removed: [], windowsRemoved: [] };
  // The YouTube tab (7) and, once opened, the capture tab (900) beside it.
  const tabs = { 7: { id: 7, index: 3, windowId: 1, active: true, url: `https://www.youtube.com/watch?v=${VIDEO}` } };
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
      remove: async (id) => { calls.windowsRemoved.push(id); },
    },
    action: { setIcon: async (o) => { calls.icons.push(o); } },
    tabs: {
      get: async (id) => {
        if (tabs[id]) return { ...tabs[id] };
        if (id === 900) throw new Error('No tab with id: 900');
        return { id, index: 0, windowId: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` };
      },
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); },
      create: async (o) => {
        calls.tabsCreated.push(o);
        if (/\/capture\//.test(o.url)) {
          for (const t of Object.values(tabs)) t.active = false;
          tabs[900] = { id: 900, index: (o.index ?? 9), windowId: o.windowId ?? 1, active: o.active !== false, url: o.url };
          return { ...tabs[900] };
        }
        return { id: 901 };
      },
      update: async (id, o) => { calls.updated.push({ id, o }); if (tabs[id] && o.active) { for (const t of Object.values(tabs)) t.active = false; tabs[id].active = true; } return tabs[id]; },
      remove: async (id) => { calls.removed.push(id); delete tabs[id]; },
    },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
  };
  return { chrome, calls, session, local, tabs };
}

function setup(opts) {
  const f = fakeChrome(opts);
  const timers = [];
  const courier = createCourier({ chrome: f.chrome, store: createCidStore(), randomUUID: () => CID, setTimeout: (fn, ms) => timers.push({ fn, ms }) });
  return { ...f, courier, timers };
}

// The toast of a clip waits for Heddy to close the capture tab (TAB_CLOSE_MS).
async function closeTab(s) {
  const t = s.timers.find((x) => x.ms === TAB_CLOSE_MS);
  if (t) await t.fn();
  await new Promise((r) => setImmediate(r));
}

const page = (origin = PROD, windowId = 1, tabId = 900) => ({ origin, url: `${origin}/capture/clip?cid=${CID}`, tab: { id: tabId, windowId } });
const fromYouTube = { id: 'heddy', url: `https://www.youtube.com/watch?v=${VIDEO}`, tab: { id: 7, windowId: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` } };

test('Full desk ↗ opens /capture/clip?cid=… in a NEW TAB next to the video, never a window (D71, D78)', async () => {
  for (const then of ['classroom']) {
    const s = setup();
    const r = await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 112, then }, fromYouTube);
    // Add to My Clips ('keep') is a background request since Round 9 (D86):
    // the courier refuses it, lib/web-routes.js answers it.
    assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 112, then: 'keep' }, fromYouTube), { ok: false });
    assert.deepEqual(r, { ok: true, cid: CID });
    assert.equal(s.calls.windows.length, 0, 'no window');
    assert.equal(s.calls.tabsCreated.length, 1);
    assert.deepEqual(s.calls.tabsCreated[0], { url: `${PROD}/capture/clip?cid=${CID}`, openerTabId: 7, index: 4, windowId: 1, active: true });
    const held = s.session.heddyCids.held[CID];
    assert.ok(held, 'mirrored to storage.session');
    assert.equal(held.captureTabId, 900);
    assert.equal(held.tabId, 7, 'the result still goes to the YouTube tab');
  }
});

test('the popup’s capture opens its tab beside the tab the popup names', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom', tabId: 7, windowId: 1 }, { id: 'heddy' });
  assert.equal(s.calls.tabsCreated[0].openerTabId, 7);
  assert.equal(s.calls.tabsCreated[0].index, 4);
});

test('only the capture tab Heddy opened may claim the payload', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  const ready = { type: 'heddy:ready', v: 1, cid: CID };
  assert.equal(await s.courier.external(ready, page(PROD, 1, 555)), null, 'another aitutors.me tab in the same window');
  assert.equal((await s.courier.external(ready, page())).youtubeId, VIDEO);
});

test('an ok result: Heddy closes the capture tab ~1 s later, brings the video back, then the toast shows there', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page());
  assert.equal(s.calls.removed.length, 0, 'not at once');
  assert.equal(s.calls.tabMessages.length, 0, 'the toast waits for the video to be in front');
  const close = s.timers.find((t) => t.ms === TAB_CLOSE_MS);
  assert.ok(close, 'scheduled');
  assert.equal(TAB_CLOSE_MS, 1000);
  await close.fn();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls.updated, [{ id: 7, o: { active: true } }], 'the YouTube tab re-activated');
  assert.deepEqual(s.calls.removed, [900], 'the extension closed the capture tab itself');
  assert.equal(s.calls.tabMessages[0].tabId, 7);
  assert.equal(s.calls.tabMessages[0].m.kind, 'clip');
});

test('Keep and watch: the capture tab closes, but the Classroom tab the site opened keeps the front', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  // The site's window.open: a new tab in front of the capture tab.
  s.tabs[900].active = false;
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page());
  await s.timers.find((t) => t.ms === TAB_CLOSE_MS).fn();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls.updated, [], 'nothing taken away from the child');
  assert.deepEqual(s.calls.removed, [900]);
  assert.deepEqual(s.calls.tabMessages.map((x) => x.m.type), ['heddy-ui:toast', 'heddy-ui:pause']);
});

test('an error result leaves the capture tab open', async () => {
  for (const error of ['cant_keep', 'unknown_video']) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
    await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error }, page());
    for (const t of s.timers) await t.fn();
    assert.deepEqual(s.calls.removed, [], error);
    assert.deepEqual(s.calls.updated, [], error);
  }
});

test('a capture tab the child closes takes its cid with it, quietly', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await s.courier.tabRemoved(900);
  assert.equal(s.session.heddyCids.held[CID], undefined, 'held payload dropped');
  assert.equal(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page()), null);
  assert.equal(s.calls.tabMessages.length, 0, 'no toast');

  const t = setup();
  await t.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await t.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await t.courier.tabRemoved(900);
  assert.equal(await t.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null, 'claimed one dropped too');
  await t.courier.tabRemoved(12345);
});

test('the signed-out child signs in in the same capture tab and it carries on with the same cid', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  // The kid door, then back to /capture/clip?cid=… — same tab id throughout.
  const back = { origin: PROD, url: `${PROD}/capture/clip?cid=${CID}`, tab: { id: 900, windowId: 1 } };
  assert.equal((await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, back)).cid, CID);
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
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  assert.equal(s.calls.tabsCreated[0].url, `${DEV}/capture/clip?cid=${CID}`);
  assert.equal(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page(PROD)), null, 'held for the dev origin');
  assert.equal((await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page(DEV))).youtubeId, VIDEO);
});

test('turning the developer switch off shuts localhost out, even for a payload held for it', async () => {
  const s = setup({ dev: true });
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
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
  await closeTab(s);
  const msgs = s.calls.tabMessages.map((x) => x.m);
  assert.deepEqual(msgs[0], { type: 'heddy-ui:toast', kind: 'clip', topic: 'Maths · Map scales', topicLang: null, startSec: 112, href: `${PROD}/study/clips/map-scales?v=${VIDEO}` });
  assert.deepEqual(msgs[1], { type: 'heddy-ui:pause' });
  assert.ok(s.calls.tabMessages.every((x) => x.tabId === 7));
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null, 'one result per cid');
});

test('Full desk pauses the video after the toast; without a topic, Open goes to My Clips', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page());
  await closeTab(s);
  const msgs = s.calls.tabMessages.map((x) => x.m);
  assert.deepEqual(msgs.map((m) => m.type), ['heddy-ui:toast', 'heddy-ui:pause']);
  assert.equal(msgs[0].href, `${PROD}/study/clips`);
});

test('Open goes to the topic’s clip page first, then an off-map clip in Mentor’s Classroom, then My Clips', async () => {
  const MOMENT = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
  async function hrefFor(extra) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
    await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, ...extra }, page());
    await closeTab(s);
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
  await t.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await t.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await t.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'unknown_video' }, page());
  assert.equal(t.calls.tabMessages.length, 0);
});

test('a result for a cid nobody claimed does nothing', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null);
  assert.equal(s.calls.tabMessages.length, 0);
});

test('a content script can only capture the video its own page shows, and only from Heddy', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: 'abcdefghijk', startSec: null, then: 'keep' }, fromYouTube), { ok: false });
  assert.equal(await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, then: 'keep' }, { ...fromYouTube, id: 'someone-else' }), null);
  assert.equal(s.calls.windows.length, 0);
  assert.equal(s.calls.tabsCreated.length, 0);
});

test('the popup’s capture targets the tab it names', async () => {
  const s = setup();
  const r = await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom', tabId: 5, windowId: 1 }, { id: 'heddy' });
  assert.equal(r.ok, true);
  assert.equal(s.calls.tabsCreated.length, 1);
  assert.equal(s.calls.tabsCreated[0].openerTabId, 5);
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

test('the clip toast’s "from m:ss" is the start the site kept (Part of it, or another start chosen there)', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: 112, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, t: 140 }, page());
  await closeTab(s);
  assert.equal(s.calls.tabMessages[0].m.startSec, 140);
});

test('Cancel or Close in the capture tab (heddy:result cancelled): Heddy closes the tab at once, no toast; the video comes back only if the tab was in front', async () => {
  assert.equal(CANCELLED, 'cancelled');
  for (const front of [true, false]) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
    await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
    s.tabs[900].active = front;
    assert.deepEqual(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cancelled' }, page()), { ok: true });
    assert.deepEqual(s.calls.removed, [900], 'closed without waiting');
    assert.deepEqual(s.calls.updated, front ? [{ id: 7, o: { active: true } }] : []);
    assert.equal(s.calls.tabMessages.length, 0, 'no toast');
    assert.equal(s.calls.icons.length, 0, 'no tick');
    assert.deepEqual(s.calls.windowsRemoved, [], 'the YouTube window is never closed');
    assert.equal(s.session.heddyCids.claimed[CID], undefined, 'the cid is dropped');
    assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null);
  }
});

test('Cancel or Close AFTER an earlier result (the duplicate screen’s ok) still closes the tab, once, from that tab only', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, fromYouTube);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, momentId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8' }, page());
  const cancel = { type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cancelled' };
  assert.equal(await s.courier.external(cancel, page(PROD, 1, 555)), null, 'not from another tab');
  assert.equal(await s.courier.external(cancel, page('https://evil.example')), null, 'not from another origin');
  assert.deepEqual(await s.courier.external(cancel, page()), { ok: true });
  assert.deepEqual(s.calls.removed, [900], 'closed now, not after the 1 s');
  assert.equal(await s.courier.external(cancel, page()), null, 'once');
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'x' }, page()), null, 'only a cancel reaches a finished cid');
});
