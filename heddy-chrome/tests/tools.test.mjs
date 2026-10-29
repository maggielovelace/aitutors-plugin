// heddy:box and heddy:tool (D20 tool, D32, D33), exactly the shapes in
// COMMON.md / the site's lib/capture/protocol.ts, and the windows they open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
const T = load('./lib/tools.js');
const K = globalThis.HeddyCrop;
const { createCourier, PAGE_FILES } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PNG = K.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));
const BOX = { kind: 'web', vw: 1280, vh: 800, x: 200, y: 166, w: 270, h: 136 };
const IMG = { png: PNG, box: BOX };
const URL_ = 'https://www.ordnancesurvey.co.uk/blog/map-scales';

function bigPng(bytes) {
  const b = new Uint8Array(bytes);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return K.base64FromBytes(b);
}

test('heddy:box has exactly COMMON.md’s fields', () => {
  const m = T.buildBox({ cid: CID, url: URL_ + '#scales', title: 'Understanding map scales', images: [IMG], context: 'Scales are written three ways.' });
  assert.deepEqual(Object.keys(m).sort(), ['cid', 'context', 'images', 'title', 'type', 'url', 'v']);
  assert.equal(m.type, 'heddy:box');
  assert.equal(m.v, 1);
  assert.equal(m.url, URL_, 'no #fragment');
  assert.deepEqual(m.images, [{ png: PNG, box: BOX }]);
  assert.deepEqual(Object.keys(m.images[0].box).sort(), ['h', 'kind', 'vh', 'vw', 'w', 'x', 'y']);
});

test('heddy:box takes 1 to 4 images', () => {
  const b = (images) => () => T.buildBox({ cid: CID, url: URL_, title: 't', images, context: '' });
  assert.throws(b([]));
  assert.throws(b(undefined));
  assert.equal(b([IMG, IMG, IMG, IMG])().images.length, 4);
  assert.throws(b([IMG, IMG, IMG, IMG, IMG]));
});

test('each png is base64 PNG without a data: prefix, at most 1 MB decoded', () => {
  const b = (png) => () => T.buildBox({ cid: CID, url: URL_, title: 't', images: [{ png, box: BOX }], context: '' });
  assert.throws(b('data:image/png;base64,' + PNG), 'prefix');
  assert.throws(b(K.base64FromBytes(new Uint8Array([255, 216, 255, 224]))), 'a JPEG');
  assert.throws(b(PNG + '!'), 'not base64');
  assert.ok(b(bigPng(1000000))());
  assert.throws(b(bigPng(1000001)), 'over 1 MB');
});

test('each box is {kind:"web", vw, vh > 0, x, y ≥ 0, w, h > 0}', () => {
  const b = (box) => () => T.buildBox({ cid: CID, url: URL_, title: 't', images: [{ png: PNG, box }], context: '' });
  assert.throws(b({ ...BOX, kind: 'page' }));
  assert.throws(b({ ...BOX, vw: 0 }));
  assert.throws(b({ ...BOX, x: -1 }));
  assert.throws(b({ ...BOX, w: 0 }));
  assert.throws(b({ ...BOX, h: NaN }));
  assert.ok(b({ ...BOX, x: 0, y: 0 })());
  // extra keys on a box are not carried
  assert.deepEqual(b({ ...BOX, evil: 1 })().images[0].box, BOX);
});

test('url is http(s) only; title and context are capped at 300 and cleaned', () => {
  const b = (o) => T.buildBox({ cid: CID, url: URL_, title: 't', images: [IMG], context: '', ...o });
  assert.throws(() => b({ url: 'javascript:alert(1)' }));
  assert.throws(() => b({ url: 'chrome://settings' }));
  assert.throws(() => b({ cid: 'nope' }));
  assert.equal(b({ title: 'x'.repeat(400) }).title.length, 300);
  assert.equal(b({ context: 'y'.repeat(400) }).context.length, 300);
  assert.equal(b({ context: 'a\u0000b\nc' }).context, 'a b c');
});

test('heddy:tool on a picture: quote is empty; explain and card take exactly one, ask up to four', () => {
  const t = (tool, images) => T.buildTool({ cid: CID, tool, url: URL_, title: 't', quote: 'ignored', context: 'c', images });
  const one = t('explain', [IMG]);
  assert.deepEqual(Object.keys(one).sort(), ['cid', 'context', 'images', 'quote', 'title', 'tool', 'type', 'url', 'v']);
  assert.equal(one.type, 'heddy:tool');
  assert.equal(one.quote, '');
  assert.throws(() => t('explain', [IMG, IMG]));
  assert.throws(() => t('card', [IMG, IMG]));
  assert.equal(t('card', [IMG]).images.length, 1);
  assert.equal(t('ask', [IMG, IMG, IMG, IMG]).images.length, 4);
  assert.throws(() => t('ask', [IMG, IMG, IMG, IMG, IMG]));
  assert.throws(() => t('ask', []));
  assert.throws(() => t('jot', [IMG]), 'not a tool');
});

test('heddy:tool on words: the quote is required, and no images key', () => {
  const m = T.buildTool({ cid: CID, tool: 'ask', url: URL_, title: 't', quote: ' 2 cm represents 1 km ', context: 'On a 1:50 000 map' });
  assert.deepEqual(Object.keys(m).sort(), ['cid', 'context', 'quote', 'title', 'tool', 'type', 'url', 'v']);
  assert.equal(m.quote, '2 cm represents 1 km');
  assert.throws(() => T.buildTool({ cid: CID, tool: 'ask', url: URL_, title: 't', quote: '  ', context: '' }));
});

test('windows: jot → /capture/jot, explain and ask → /capture/room, card → /capture/card', () => {
  assert.equal(T.pageFor('jot'), 'jot');
  assert.equal(T.pageFor('explain'), 'room');
  assert.equal(T.pageFor('ask'), 'room');
  assert.equal(T.pageFor('card'), 'card');
  assert.throws(() => T.pageFor('toString'));
});

function fakeChrome() {
  const calls = { windows: [], tabMessages: [], injected: [] };
  const session = {};
  const chrome = {
    runtime: { id: 'heddy' },
    storage: {
      session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) },
      local: { get: async () => ({}) },
    },
    windows: {
      get: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      getLastFocused: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      create: async (spec) => { calls.windows.push(spec); return { id: 42 }; },
    },
    action: { setIcon: async () => {} },
    tabs: { get: async (id) => ({ id, url: URL_ }), sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); } },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
  };
  return { chrome, calls, session };
}

function setup() {
  const f = fakeChrome();
  const store = createCidStore();
  const courier = createCourier({ chrome: f.chrome, store, randomUUID: () => CID, setTimeout: () => {} });
  const sender = T.createSender({ openCapture: courier.openCapture });
  return { ...f, courier, sender };
}

const windowSender = (page) => ({ origin: 'https://aitutors.me', url: `https://aitutors.me/capture/${page}?cid=${CID}`, tab: { id: 900, windowId: 42 } });

test('a box opens /capture/jot focused, and the courier hands the window heddy:box once', async () => {
  const s = setup();
  const r = await s.sender.box({ url: URL_, title: 'Map scales', images: [IMG, IMG], context: 'c' }, { tabId: 7, windowId: 1 });
  assert.deepEqual(r, { ok: true, cid: CID });
  assert.equal(s.calls.windows.length, 1);
  assert.equal(s.calls.windows[0].url, `https://aitutors.me/capture/jot?cid=${CID}`);
  assert.equal(s.calls.windows[0].focused, true);
  assert.ok(s.session.heddyCids.held[CID], 'held in the courier’s store, mirrored to storage.session');
  const payload = await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, windowSender('jot'));
  assert.equal(payload.type, 'heddy:box');
  assert.equal(payload.images.length, 2);
  assert.equal(await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, windowSender('jot')), null, 'once');
});

test('Explain and Ask open /capture/room; Make a card opens /capture/card', async () => {
  for (const [tool, page] of [['explain', 'room'], ['ask', 'room'], ['card', 'card']]) {
    const s = setup();
    await s.sender.tool({ tool, url: URL_, title: 't', quote: '', context: '', images: [IMG] }, { tabId: 7, windowId: 1 });
    assert.equal(s.calls.windows[0].url, `https://aitutors.me/capture/${page}?cid=${CID}`, tool);
  }
});

test('a payload the builder refuses opens no window and holds nothing', async () => {
  const s = setup();
  const r = await s.sender.tool({ tool: 'explain', url: URL_, title: 't', images: [IMG, IMG] }, { tabId: 7, windowId: 1 });
  assert.deepEqual(r, { ok: false });
  assert.equal(s.calls.windows.length, 0);
  assert.equal(Object.keys((s.session.heddyCids || { held: {} }).held).length, 0);
});

test('a picture jot’s result: the Jotted toast (no quote, Undo, Open in Jotter), with the toaster put in the tab', async () => {
  const s = setup();
  await s.sender.box({ url: URL_, title: 't', images: [IMG], context: '' }, { tabId: 7, windowId: 1 });
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, windowSender('jot'));
  const jotId = '6f1c2a3b-0000-4000-8000-00000000abcd';
  const r = await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotId, jotterId: '7a2b0000-0000-4000-8000-0000000000ee' }, windowSender('jot'));
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(s.calls.injected.map((o) => o.files), [PAGE_FILES]);
  assert.equal(s.calls.tabMessages.length, 1);
  const { tabId, m } = s.calls.tabMessages[0];
  assert.equal(tabId, 7);
  assert.equal(m.type, 'heddy-ui:toast');
  assert.equal(m.kind, 'jotted');
  assert.equal(m.jotId, jotId);
  assert.equal(m.quote, undefined, 'a picture has no quote');
  assert.equal(m.jotterId, '7a2b0000-0000-4000-8000-0000000000ee', 'Undo needs the Jotter');
  // The toast model gives it an Undo that sends {jotId, jotterId}.
  globalThis.HeddyMarks = load('./lib/marks.js');
  const Toast = load('./lib/toast.js');
  const model = Toast.model(m, 'en', (k) => k);
  assert.deepEqual(model.undo && { jotId: model.undo.jotId, jotterId: model.undo.jotterId }, { jotId, jotterId: '7a2b0000-0000-4000-8000-0000000000ee' });
  assert.match(m.href, /\/study\/jotters\/7a2b0000-0000-4000-8000-0000000000ee$/);
});

test('a tool’s result puts nothing on the page (its window is the answer)', async () => {
  const s = setup();
  await s.sender.tool({ tool: 'explain', url: URL_, title: 't', quote: 'q', context: '' }, { tabId: 7, windowId: 1 });
  await s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, windowSender('room'));
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, windowSender('room'));
  assert.equal(s.calls.tabMessages.length, 0);
  assert.equal(s.calls.injected.length, 0);
});

test('on words, the context keeps 300 each side of the quote', () => {
  const ctx = 'b'.repeat(300) + ' … ' + 'a'.repeat(300);
  const m = T.buildTool({ cid: CID, tool: 'explain', url: URL_, title: 't', quote: 'q', context: ctx });
  assert.equal(m.context, ctx);
  assert.equal(T.buildTool({ cid: CID, tool: 'explain', url: URL_, title: 't', quote: 'q', context: ctx + 'zzz' }).context.length, 603);
});

test('sendTool asks the background with the words, and reports ok', async () => {
  const sent = [];
  globalThis.chrome = { runtime: { sendMessage: async (m) => { sent.push(m); return { ok: true }; } } };
  try {
    const r = await T.sendTool('explain', { url: URL_, title: 't', quote: 'q', context: 'c' });
    assert.deepEqual(r, { ok: true });
    assert.deepEqual(sent, [{ type: 'heddy-ui:tool', tool: 'explain', url: URL_, title: 't', quote: 'q', context: 'c' }]);
    globalThis.chrome = { runtime: { sendMessage: () => { throw new Error('Extension context invalidated'); } } };
    assert.deepEqual(await T.sendTool('ask', {}), { ok: false });
  } finally {
    delete globalThis.chrome;
  }
});

test('the 4-picture payload at the cap still fits Chrome messaging (64 MiB)', () => {
  const png = bigPng(1000000);
  const m = T.buildBox({ cid: CID, url: URL_, title: 't', images: [0, 1, 2, 3].map(() => ({ png, box: BOX })), context: '' });
  const size = JSON.stringify(m).length;
  assert.ok(size < 6 * 1024 * 1024, `about 5.3 MB, got ${size}`);
});
