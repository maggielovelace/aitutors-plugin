// What a tool window's heddy:result does on the page (owner, 2026-10-29):
// Make a card closes with {cardIds, jotterId} → "Card made" + Undo + Open in
// Jotter; its Undo is heddy:undo {cardIds} in a non-focused /capture/card
// window → "Card deleted." (1.8 s) or "Couldn't undo that card.". Explain and
// Ask Heddy stay open; "Jot it with this" there → the web Jotted toast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
const P = globalThis.HeddyProtocol;
const T = load('./lib/tools.js');
const Toast = load('./lib/toast.js');
const { createCourier, PAGE_FILES } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const URL_ = 'https://www.ordnancesurvey.co.uk/blog/map-scales';
const JOTTER = '7a2b0000-0000-4000-8000-0000000000ee';
const JOT = '6f1c2a3b-0000-4000-8000-00000000abcd';
const CARDS = ['A1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002'];
const cards = CARDS.map((c) => c.toLowerCase());
const ids = (n) => Array.from({ length: n }, (_, i) => `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

function setup() {
  const calls = { windows: [], tabMessages: [], injected: [] };
  const session = {};
  const chrome = {
    runtime: { id: 'heddy' },
    storage: { session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) }, local: { get: async () => ({}) } },
    windows: {
      get: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      getLastFocused: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      create: async (spec) => { calls.windows.push(spec); return { id: 42 }; },
    },
    action: { setIcon: async () => {} },
    tabs: { get: async (id) => ({ id, url: URL_ }), sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); } },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
  };
  const courier = createCourier({ chrome, store: createCidStore(), randomUUID: () => CID, setTimeout: () => {} });
  const sender = T.createSender({ openCapture: courier.openCapture });
  return { calls, courier, sender };
}

const win = (page) => ({ origin: 'https://aitutors.me', url: `https://aitutors.me/capture/${page}?cid=${CID}`, tab: { id: 900, windowId: 42 } });
const ready = (s, page) => s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, win(page));
const result = (s, page, r) => s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ...r }, win(page));
const toasts = (s) => s.calls.tabMessages.filter((x) => x.m.type === 'heddy-ui:toast').map((x) => x.m);

// ─── the result's cardIds ────────────────────────────────────────────────────

test('a result’s cardIds: 1–10 UUIDs, lowercased; anything else is none', () => {
  const r = (cardIds) => P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, cardIds }).cardIds;
  assert.deepEqual(r(CARDS), cards);
  assert.equal(r(ids(10)).length, 10);
  assert.equal(r(ids(11)), null, 'more than 10');
  assert.equal(r([]), null);
  assert.equal(r([CARDS[0], 'not-a-uuid']), null);
  assert.equal(r('a1000000-0000-4000-8000-000000000001'), null, 'not an array');
});

// ─── Make a card ─────────────────────────────────────────────────────────────

test('Keep card → “Card made” toast with its cards for Undo and the Jotter link, toaster put in the tab', async () => {
  const s = setup();
  await s.sender.tool({ tool: 'card', url: URL_, title: 't', quote: '2 cm is 1 km', context: '' }, { tabId: 7, windowId: 1 });
  assert.equal(s.calls.windows[0].url, `https://aitutors.me/capture/card?cid=${CID}`);
  await ready(s, 'card');
  assert.deepEqual(await result(s, 'card', { ok: true, cardIds: CARDS, jotterId: JOTTER }), { ok: true });
  assert.deepEqual(s.calls.injected.map((o) => o.files), [PAGE_FILES]);
  assert.deepEqual(toasts(s), [{ type: 'heddy-ui:toast', kind: 'card', cardIds: cards, href: `https://aitutors.me/study/jotters/${JOTTER}` }]);
});

test('a card result with no Jotter links to /study/jotters', async () => {
  const s = setup();
  await s.sender.tool({ tool: 'card', url: URL_, title: 't', quote: 'q', context: '' }, { tabId: 7, windowId: 1 });
  await ready(s, 'card');
  await result(s, 'card', { ok: true, cardIds: CARDS });
  assert.equal(toasts(s)[0].href, 'https://aitutors.me/study/jotters');
});

test('a card result without valid cardIds, or a refusal, shows nothing', async () => {
  for (const r of [{ ok: true }, { ok: true, cardIds: ['nope'] }, { ok: false, error: 'no_seat' }]) {
    const s = setup();
    await s.sender.tool({ tool: 'card', url: URL_, title: 't', quote: 'q', context: '' }, { tabId: 7, windowId: 1 });
    await ready(s, 'card');
    await result(s, 'card', r);
    assert.deepEqual(toasts(s), [], JSON.stringify(r));
  }
});

test('the “Card made” model: Undo carries the cards; no valid cards, no Undo', () => {
  const tr = (k) => k;
  const m = Toast.model({ kind: 'card', cardIds: cards, href: 'https://aitutors.me/study/jotters' }, 'en', tr);
  assert.equal(m.title, 'toastCardMade');
  assert.deepEqual(m.undo, { label: 'toastUndo', cardIds: cards });
  assert.deepEqual(m.open, { label: 'toastOpenInJotter', href: 'https://aitutors.me/study/jotters', quiet: true });
  assert.equal(Toast.model({ kind: 'card', cardIds: [] }, 'en', tr).undo, null);
  assert.equal(Toast.model({ kind: 'card', cardIds: ids(11) }, 'en', tr).undo, null);
  assert.equal(Toast.model({ kind: 'card' }, 'en', tr).undo, null);
});

test('“Card deleted.” for 1.8 s; “Couldn’t undo that card.” on failure', () => {
  const tr = (k) => k;
  assert.deepEqual(Toast.model({ kind: 'card_undone' }, 'en', tr), { title: 'toastCardDeleted', ms: 1800 });
  assert.equal(Toast.model({ kind: 'card_undo_failed' }, 'en', tr).title, 'toastCardUndoFailed');
  const en = JSON.parse(read('_locales/en/messages.json'));
  assert.equal(en.toastCardMade.message, 'Card made');
  assert.equal(en.toastCardDeleted.message, 'Card deleted.');
  assert.equal(en.toastCardUndoFailed.message, "Couldn't undo that card.");
});

test('heddy:undo for cards is exactly {type, v, cid, cardIds} with 1–10 UUIDs', () => {
  const m = T.buildCardUndo({ cid: CID, cardIds: CARDS });
  assert.deepEqual(m, { type: 'heddy:undo', v: 1, cid: CID, cardIds: cards });
  assert.throws(() => T.buildCardUndo({ cid: CID, cardIds: [] }));
  assert.throws(() => T.buildCardUndo({ cid: CID, cardIds: ids(11) }));
  assert.throws(() => T.buildCardUndo({ cid: CID, cardIds: ['x'] }));
  assert.throws(() => T.buildCardUndo({ cid: 'x', cardIds: CARDS }));
});

test('Undo opens a NON-focused /capture/card window with heddy:undo, then “Card deleted.”', async () => {
  const s = setup();
  assert.deepEqual(await s.sender.undoCards(CARDS, { tabId: 7, windowId: 1 }), { ok: true, cid: CID });
  assert.equal(s.calls.windows[0].url, `https://aitutors.me/capture/card?cid=${CID}`);
  assert.equal(s.calls.windows[0].focused, false);
  assert.deepEqual(await ready(s, 'card'), { type: 'heddy:undo', v: 1, cid: CID, cardIds: cards });
  await result(s, 'card', { ok: true });
  assert.deepEqual(toasts(s), [{ type: 'heddy-ui:toast', kind: 'card_undone' }]);
});

test('a failed card Undo says so', async () => {
  const s = setup();
  await s.sender.undoCards(CARDS, { tabId: 7, windowId: 1 });
  await ready(s, 'card');
  await result(s, 'card', { ok: false, error: 'not_found' });
  assert.deepEqual(toasts(s), [{ type: 'heddy-ui:toast', kind: 'card_undo_failed' }]);
});

test('Undo with bad card ids opens no window', async () => {
  const s = setup();
  assert.deepEqual(await s.sender.undoCards(['nope'], { tabId: 7 }), { ok: false });
  assert.equal(s.calls.windows.length, 0);
});

test('both toasters send the card Undo to the background', () => {
  for (const f of ['content/page-tray.js', 'content/youtube.js']) {
    assert.match(read(f), /onUndoCards: function \(cardIds\) \{ send\(\{ type: 'heddy-ui:undo-card', cardIds: cardIds \}\); \}/, f);
  }
  assert.match(read('lib/toast.js'), /if \(m\.undo && m\.undo\.cardIds\) \{[\s\S]*?deps\.onUndoCards\(cardIds\)/);
});

// ─── Explain and Ask Heddy ───────────────────────────────────────────────────

test('the room stays open: nothing on the page for an Explain or Ask result without a jot', async () => {
  for (const tool of ['explain', 'ask']) {
    const s = setup();
    await s.sender.tool({ tool, url: URL_, title: 't', quote: 'q', context: '' }, { tabId: 7, windowId: 1 });
    await ready(s, 'room');
    await result(s, 'room', { ok: true });
    assert.deepEqual(toasts(s), [], tool);
    assert.equal(s.calls.injected.length, 0);
  }
});

test('“Jot it with this” in the room → the web Jotted toast, Undo sending {jotId, jotterId}', async () => {
  const s = setup();
  await s.sender.tool({ tool: 'ask', url: URL_, title: 't', quote: 'q', context: '' }, { tabId: 7, windowId: 1 });
  await ready(s, 'room');
  await result(s, 'room', { ok: true, jotId: JOT, jotterId: JOTTER, quote: 'the line' });
  assert.deepEqual(s.calls.injected.map((o) => o.files), [PAGE_FILES]);
  const [m] = toasts(s);
  assert.deepEqual(m, { type: 'heddy-ui:toast', kind: 'jotted', quote: 'the line', jotId: JOT, jotterId: JOTTER, href: `https://aitutors.me/study/jotters/${JOTTER}` });
  const model = Toast.model(m, 'en', (k) => k);
  assert.deepEqual({ jotId: model.undo.jotId, jotterId: model.undo.jotterId }, { jotId: JOT, jotterId: JOTTER });
});
