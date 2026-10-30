// What happens after /capture/save and /capture/clip answer (Round 5: D54,
// D59). A save's ok result clears the cards it carried and the page says
// "Saved to Jotters · {title}"; Save and jot now's tab is the notebook by
// then and stays. A clip refused for no captions says so on the video.
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
const { createCourier, PAGE_FILES, TAB_CLOSE_MS } = load('./lib/courier.js');
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
    saved: (meta) => { calls.saved.push(meta); },
  });
  return { courier, calls };
}

const site = (tabId, windowId = 42) => ({ origin: PROD, url: `${PROD}/capture/save?cid=${CID}`, tab: { id: tabId, windowId } });
const SAVE_MSG = { v: 1, cid: CID, type: 'heddy:save', url: 'https://www.sparxscience.com/', title: 'Sparx Science – Home', then: 'save', items: [{ kind: 'text', quote: 'q', before: '', after: '', pos: { block: 0, offset: 0 } }] };

async function saveVia(s, then) {
  const spec = { page: 'save', kind: 'save', windowId: 1, build: () => ({ ...SAVE_MSG, then }), meta: { tabId: 9, title: 'Sparx Science – Home', then, cards: ['card-0001', 'card-0002'] } };
  if (then === 'jot') spec.asTab = 9;
  assert.equal((await s.courier.openCapture(spec)).ok, true);
  const who = then === 'jot' ? site(900, 1) : site(77);
  return who;
}

test('the save window claims heddy:save once, as it was built', async () => {
  const s = setup();
  const who = await saveVia(s, 'save');
  assert.deepEqual(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, who), { ...SAVE_MSG, then: 'save' });
  assert.equal(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, who), null);
});

test('saved: the cards it carried are cleared, and the page says "Saved to Jotters · title" with Open in Jotter, no Undo', async () => {
  const s = setup();
  const who = await saveVia(s, 'save');
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, who);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotterId: JOTTER, saveIds: [SAVE], title: 'Sparx Science – Home', lang: 'en-GB' }, who);
  assert.deepEqual(s.calls.saved.map((m) => m.cards), [['card-0001', 'card-0002']]);
  assert.deepEqual(s.calls.injected.at(-1), { target: { tabId: 9 }, files: PAGE_FILES }, 'the toaster is put in the page first');
  assert.deepEqual(s.calls.tabMessages, [{ tabId: 9, m: { type: 'heddy-ui:toast', kind: 'saved', title: 'Sparx Science – Home', href: `${PROD}/study/jotters/${JOTTER}` } }]);
});

test('Save and jot now: a tab beside the page; the result leaves it open (it is the notebook), and the toast has no Open', async () => {
  const s = setup();
  const who = await saveVia(s, 'jot');
  assert.equal(s.calls.created[0].url, `${PROD}/capture/save?cid=${CID}`);
  assert.equal(s.calls.created[0].openerTabId, 9);
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, who);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotterId: JOTTER, saveIds: [SAVE] }, who);
  s.calls.timers.forEach((t) => t.fn());
  assert.deepEqual(s.calls.removed, [], 'the capture tab stays');
  assert.deepEqual(s.calls.tabMessages[0].m, { type: 'heddy-ui:toast', kind: 'saved', title: 'Sparx Science – Home' });
});

test('a refused save stays in its window: no toast, and the cards stay', async () => {
  const s = setup();
  const who = await saveVia(s, 'save');
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, who);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'failed' }, who);
  assert.deepEqual(s.calls.saved, []);
  assert.deepEqual(s.calls.tabMessages, []);
});

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
  await s.courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep', tabId: 7, windowId: 1 }, { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html' });
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
