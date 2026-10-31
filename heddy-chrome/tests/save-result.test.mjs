// What happens after /capture/clip answers (D59), and the save toasts' words.
// Round 9 (D78, D83): the save is a background request and the desk shows its
// Saved card (tests/round9.test.mjs), so no /capture/save window answers here.
// A clip refused for no captions says so on the video.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const P = globalThis.HeddyProtocol;
const I = globalThis.HeddyI18n;
const T = load('./lib/toast.js');
const { createCourier, TAB_CLOSE_MS } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const JOTTER = '9b2e5f0c-3c1d-4a7e-8f00-1a2b3c4d5e6f';
const SAVE = 'a1000000-0000-4000-8000-000000000001';
const PROD = 'https://aitutors.me';
const VIDEO = 'Fq2aPn3x_-A';

function setup() {
  const calls = { tabMessages: [], injected: [], saved: [], removed: [], created: [], timers: [] };
  const chrome = {
    runtime: { id: 'heddy' },
    storage: { session: { get: async () => ({}), set: async () => {} }, local: { get: async () => ({ devOrigin: false }) } },
    windows: { get: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }), getLastFocused: async () => ({ id: 1 }), create: async () => ({ id: 42 }), remove: async () => {} },
    action: { setIcon: async () => {} },
    tabs: {
      get: async (id) => ({ id, index: 2, windowId: 1, active: true, url: `https://www.youtube.com/watch?v=${VIDEO}` }),
      create: async (o) => { calls.created.push(o); return { id: 900, windowId: 1 }; },
      update: async () => {},
      remove: async (id) => { calls.removed.push(id); },
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); },
    },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
  };
  const courier = createCourier({
    chrome,
    store: createCidStore(),
    randomUUID: () => CID,
    setTimeout: (fn, ms) => { calls.timers.push({ fn, ms }); },
  });
  return { courier, calls };
}

test('the result’s saveIds and title: UUIDs lowercased, a title as one line; anything else is none', () => {
  const r = P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, saveIds: [SAVE.toUpperCase()], title: ' Sparx\n Science ' });
  assert.deepEqual(r.saveIds, [SAVE]);
  assert.equal(r.title, 'Sparx Science');
  const bad = P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, saveIds: ['x'], title: 42 });
  assert.equal(bad.saveIds, null);
  assert.equal(bad.title, null);
  assert.equal(P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, saveIds: Array(16).fill(SAVE) }).saveIds, null);
});

test('the cid store carries a save’s card ids from the payload to its result', () => {
  const store = createCidStore();
  store.put(CID, { payload: {}, origin: PROD, kind: 'save', tabId: 9, cards: ['card-0001', 7, 'x'.repeat(65)] });
  store.claim(CID, { origin: PROD });
  assert.deepEqual(store.takeResult(CID, { origin: PROD }).cards, ['card-0001']);
});

// ─── D59: no captions ───────────────────────────────────────────────────────

test('a clip refused with no_captions: Heddy closes its tab and says so on the video', async () => {
  const s = setup();
  // Full desk's tab (Add to My Clips is a background request since Round 9).
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'classroom' }, { id: 'heddy', url: `https://www.youtube.com/watch?v=${VIDEO}`, tab: { id: 7, windowId: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` } });
  const who = { origin: PROD, url: `${PROD}/capture/clip?cid=${CID}`, tab: { id: 900, windowId: 1 } };
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, who);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'no_captions' }, who);
  assert.deepEqual(s.calls.tabMessages, [], 'not before the tab has gone');
  const t = s.calls.timers.find((x) => x.ms === TAB_CLOSE_MS);
  t.fn();
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls.removed, [900]);
  assert.deepEqual(s.calls.tabMessages, [{ tabId: 7, m: { type: 'heddy-ui:toast', kind: 'no_captions' } }]);
});

test('the toasts’ words, in both languages', () => {
  const en = I.translator('en');
  const zh = I.translator('zh_CN');
  assert.equal(T.model({ kind: 'no_captions' }, 'en', en).title, 'Heddy needs captions to help with this video, and this one has none.');
  assert.equal(T.model({ kind: 'no_captions' }, 'zh_CN', zh).title, 'Heddy 需要字幕才能帮你看这个视频，可这个视频没有字幕。');
  const saved = T.model({ kind: 'saved', title: 'Sparx Science – Home', href: `${PROD}/study/jotters/${JOTTER}` }, 'en', en);
  assert.equal(saved.title, 'Saved to Jotters · Sparx Science – Home');
  assert.equal(saved.undo, undefined, 'no Undo: the result names saves, not a jot');
  assert.equal(saved.open.label, 'Open in Jotter');
  assert.equal(T.model({ kind: 'saved', title: 'Sparx Science – Home' }, 'zh_CN', zh).title, '已存到 Jotters · Sparx Science – Home');
  assert.equal(T.model({ kind: 'saved' }, 'en', en).title, 'Saved to Jotters');
  assert.equal(T.model({ kind: 'saved' }, 'en', en).open, null, 'after Save and jot now');
});
