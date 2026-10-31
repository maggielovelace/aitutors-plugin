// Phase 2's courier, against a fake Chrome: J opens /capture/jot without focus
// and the result becomes "Note saved" with Undo; Undo opens its own window
// without focus; Jot it and Save page to Jotters carry the tab's own page; the menu
// item and Ctrl Shift J inject the tray only on that gesture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const { createCourier, PAGE_FILES, MENU_ID, COMMAND } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const JOT = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const VIDEO = 'Fq2aPn3x_-A';
const PROD = 'https://aitutors.me';
const WATCH = `https://www.youtube.com/watch?v=${VIDEO}`;
const ARTICLE = 'https://www.ordnancesurvey.co.uk/map-scales';

function setup({ tabReply = { ok: true }, store = createCidStore() } = {}) {
  const calls = { windows: [], tabMessages: [], injected: [], menus: [], icons: [], tabsCreated: [], windowsRemoved: [] };
  const session = {};
  const chrome = {
    runtime: { id: 'heddy' },
    storage: {
      session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) },
      local: { get: async () => ({ devOrigin: false }) },
    },
    windows: {
      get: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      getLastFocused: async () => ({ id: 1, left: 0, top: 0, width: 1440, height: 900 }),
      create: async (spec) => { calls.windows.push(spec); return { id: 42 }; },
      remove: async (id) => { calls.windowsRemoved.push(id); },
    },
    action: { setIcon: async (o) => { calls.icons.push(o); } },
    tabs: {
      get: async (id) => ({ id, url: WATCH }),
      query: async () => [{ id: 9, windowId: 1, url: ARTICLE }],
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); return tabReply; },
      create: async (o) => { calls.tabsCreated.push(o); },
    },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
    contextMenus: {
      removeAll: async () => { calls.menus.push('removeAll'); },
      remove: async (id) => { calls.menus.push(`remove:${id}`); if (calls.menus.filter((x) => typeof x === 'object').length === 0) throw new Error('Cannot find menu item'); },
      create: (o) => { calls.menus.push(o); },
    },
  };
  calls.collected = [];
  const courier = createCourier({ chrome, store, randomUUID: () => CID, setTimeout: () => {}, collect: async (tab) => { calls.collected.push(tab.id); return { ok: true, n: 1 }; } });
  return { chrome, calls, courier };
}

const page = (windowId = 42) => ({ origin: PROD, url: `${PROD}/capture/jot?cid=${CID}`, tab: { id: 900, windowId } });
const fromYouTube = { id: 'heddy', url: WATCH, tab: { id: 7, windowId: 1, url: WATCH } };
const fromArticle = { id: 'heddy', url: `${ARTICLE}#grid`, tab: { id: 9, windowId: 1, url: `${ARTICLE}#grid` } };

async function claim(s) {
  return s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
}

test('H no longer opens a window (Round 8, D74): heddy-ui:moment is not a message the courier answers', async () => {
  const s = setup();
  assert.equal(await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 168.4, tEnd: 171.2, title: 'x' }, fromYouTube), null);
  assert.equal(s.calls.windows.length, 0);
  assert.equal(s.calls.tabsCreated.length, 0);
});

test('Round 5: nothing writes a jot from a page any more; heddy-ui:jot opens nothing', async () => {
  const s = setup();
  assert.equal(await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q' }, fromArticle), null);
  assert.equal(await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q', tabId: 9, windowId: 1 }, { id: 'heddy' }), null);
  assert.equal(s.calls.windows.length, 0);
  const src = (await import('node:fs')).readFileSync(new URL('../lib/courier.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /buildJot\(/, 'the courier never builds heddy:jot');
});

test('"Save to Jotters" on a selection adds it as a card (and the panel opens, lib/cards.js); the command shows the tray; neither writes a jot', async () => {
  const s = setup();
  assert.equal(s.calls.injected.length, 0);
  assert.deepEqual(await s.courier.menuClicked({ menuItemId: MENU_ID, selectionText: 'x' }, { id: 9, windowId: 1, url: ARTICLE }), { ok: true, n: 1 });
  assert.deepEqual(s.calls.collected, [9]);
  assert.equal(s.calls.windows.length, 0, 'no capture window: collect, then save');
  await s.courier.command(COMMAND, { id: 9, windowId: 1, url: ARTICLE });
  assert.deepEqual(s.calls.injected[0], { target: { tabId: 9 }, files: PAGE_FILES });
  assert.deepEqual(s.calls.tabMessages.at(-1), { tabId: 9, m: { type: 'heddy-ui:tray' } });
  await s.courier.command(COMMAND, undefined);
  assert.equal(s.calls.injected.length, 2, 'with no tab given, the active tab');
  assert.equal(await s.courier.command('something-else', { id: 9 }), null);
  assert.equal(await s.courier.menuClicked({ menuItemId: 'other' }, { id: 9 }), null);
  assert.deepEqual(s.calls.collected, [9]);
});

test('a page Heddy may not script (chrome://, the Web Store) fails quietly', async () => {
  const s = setup();
  s.chrome.scripting.executeScript = async () => { throw new Error('Cannot access a chrome:// URL'); };
  assert.deepEqual(await s.courier.command(COMMAND, { id: 9 }), { ok: false });
});

test('the menu item is on selections only, in Heddy’s language', async () => {
  const s = setup();
  await s.courier.installMenus('zh_CN');
  assert.deepEqual(s.calls.menus, [`remove:${MENU_ID}`, { id: MENU_ID, title: '存到 Jotters', contexts: ['selection'] }], 'a first install: nothing to remove, still created');
  assert.ok(!s.calls.menus.includes('removeAll'), 'never removes Phase 3’s items');
  await s.courier.installMenus('en');
  assert.equal(s.calls.menus.at(-1).title, 'Save to Jotters');
});

test('Open goes to the child’s Jotter as well as My Clips, on the capture origin only', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/jotters/v/${VIDEO}` }, fromYouTube), { ok: true });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/jottersx` }, fromYouTube), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `https://evil.example/study/jotters/v/${VIDEO}` }, fromYouTube), { ok: false });
});

const JOTTER = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';

test('Round 9 (D78): Undo and Save page are not the courier’s; nothing it is sent opens a window', async () => {
  const s = setup();
  assert.equal(await s.courier.internal({ type: 'heddy-ui:undo', jotId: JOT, jotterId: null }, fromYouTube), null);
  assert.equal(await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, markdown: '# m' }, fromArticle), null);
  assert.equal(s.calls.windows.length, 0);
  assert.equal(s.calls.tabsCreated.length, 0);
});
