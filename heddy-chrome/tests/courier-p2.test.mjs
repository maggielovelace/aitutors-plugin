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

test('Undo: heddy:undo in a window without focus; then "Jot deleted." or "Couldn’t undo that note."', async () => {
  for (const [ok, kind] of [[true, 'undone'], [false, 'undo_failed']]) {
    const s = setup();
    const r = await s.courier.internal({ type: 'heddy-ui:undo', jotId: JOT }, fromYouTube);
    assert.equal(r.ok, true);
    assert.equal(s.calls.windows[0].url, `${PROD}/capture/jot?cid=${CID}`);
    assert.equal(s.calls.windows[0].focused, false);
    assert.deepEqual(await claim(s), { type: 'heddy:undo', v: 1, cid: CID, jotId: JOT });
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok }, page());
    assert.deepEqual(s.calls.tabMessages, [{ tabId: 7, m: { type: 'heddy-ui:toast', kind } }]);
    assert.equal(s.calls.icons.length, 0, 'no tick for an undo');
  }
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:undo', jotId: 'nope' }, fromYouTube), { ok: false });
});

test('Round 5: nothing writes a jot from a page any more; heddy-ui:jot opens nothing', async () => {
  const s = setup();
  assert.equal(await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q' }, fromArticle), null);
  assert.equal(await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q', tabId: 9, windowId: 1 }, { id: 'heddy' }), null);
  assert.equal(s.calls.windows.length, 0);
  const src = (await import('node:fs')).readFileSync(new URL('../lib/courier.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /buildJot\(/, 'the courier never builds heddy:jot');
});

test('a page can only clip itself; the popup names its tab', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:page', url: 'https://evil.example/', markdown: 'm' }, fromArticle), { ok: false });
  assert.equal(s.calls.windows.length, 0);
  const r = await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, markdown: '# m', tabId: 9, windowId: 1 }, { id: 'heddy' });
  assert.equal(r.ok, true);
});

test('Save page to Jotters: heddy:page to /capture/page; past 200 KB, the first part with cut: true', async () => {
  const s = setup();
  const r = await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Map scales', markdown: '# Map scales\n\nOn a 1:50 000 map…' }, fromArticle);
  assert.equal(r.ok, true);
  assert.equal(s.calls.windows[0].url, `${PROD}/capture/page?cid=${CID}`);
  assert.equal((await claim(s)).type, 'heddy:page');
  const big = setup();
  const cut = await big.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Long', markdown: 'a'.repeat(1000) + '\n\n' + 'b'.repeat(200 * 1024) }, fromArticle);
  assert.equal(cut.ok, true);
  assert.equal(big.calls.windows.length, 1);
  const payload = await claim(big);
  assert.equal(payload.cut, true);
  assert.equal(payload.markdown, 'a'.repeat(1000));
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

test('Open in Jotter without a valid jotterId goes to the Jotters shelf', async () => {
  for (const jotterId of [undefined, '../../admin', 'abc']) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Map scales', markdown: '# Map scales' }, fromArticle);
    await claim(s);
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotId: JOT, jotterId }, page());
    assert.equal(s.calls.tabMessages[0].m.href, `${PROD}/study/jotters`, String(jotterId));
  }
});

test('Save page to Jotters saved: "Saved to Jotters · title", Open in Jotter, and the cut line only when cut', async () => {
  for (const [markdown, cut] of [['# Short', false], ['a'.repeat(10) + '\n\n' + 'b'.repeat(200 * 1024), true]]) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Understanding map scales', markdown }, fromArticle);
    await claim(s);
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotterId: JOTTER }, page());
    assert.deepEqual(s.calls.tabMessages, [{ tabId: 9, m: { type: 'heddy-ui:toast', kind: 'clipped', title: 'Understanding map scales', cut, href: `${PROD}/study/jotters/${JOTTER}` } }]);
  }
});

test('a refused Jot it or Save page to Jotters stays in its window: no toast', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q' }, fromArticle);
  await claim(s);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'too_long' }, page());
  assert.equal(s.calls.tabMessages.length, 0);
});

test('Undo of a web jot names its Jotter; Undo of an H jot sends jotId alone; a bad jotterId opens nothing', async () => {
  const web = setup();
  await web.courier.internal({ type: 'heddy-ui:undo', jotId: JOT, jotterId: JOTTER }, fromArticle);
  assert.deepEqual(await claim(web), { type: 'heddy:undo', v: 1, cid: CID, jotId: JOT, jotterId: JOTTER });
  const h = setup();
  await h.courier.internal({ type: 'heddy-ui:undo', jotId: JOT, jotterId: null }, fromYouTube);
  assert.deepEqual(await claim(h), { type: 'heddy:undo', v: 1, cid: CID, jotId: JOT });
  const bad = setup();
  assert.deepEqual(await bad.courier.internal({ type: 'heddy-ui:undo', jotId: JOT, jotterId: '../admin' }, fromArticle), { ok: false });
  assert.equal(bad.calls.windows.length, 0);
});

test('Cancel or Close in a capture window (heddy:result cancelled): Heddy closes that window, no toast, cid dropped', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Map scales', markdown: '# Map scales' }, fromArticle);
  await claim(s);
  assert.deepEqual(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cancelled' }, page()), { ok: true });
  assert.deepEqual(s.calls.windowsRemoved, [42]);
  assert.equal(s.calls.tabMessages.length, 0);
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true }, page()), null, 'dropped');
});

test('a Save page to Jotters the site refuses after its file check (not_study, too_long, unreadable, failed): no Saved to Jotters toast, the window stays; Close then closes it', async () => {
  for (const error of ['not_study', 'too_long', 'unreadable', 'failed']) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Map scales', markdown: '# Map scales' }, fromArticle);
    await claim(s);
    assert.deepEqual(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error }, page()), { ok: true }, error);
    assert.equal(s.calls.tabMessages.length, 0, `${error}: no toast`);
    assert.deepEqual(s.calls.windowsRemoved, [], `${error}: the window stays`);
    assert.equal(s.calls.icons.length, 0, `${error}: no tick`);
    assert.deepEqual(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cancelled' }, page()), { ok: true });
    assert.deepEqual(s.calls.windowsRemoved, [42], `${error}: Close afterwards closes it`);
  }
});

test('a Save page to Jotters ok that comes ~30 s after the tap (the site waited for its file check) still gets the Saved to Jotters toast', async () => {
  let now = 1_000_000;
  const s = setup({ store: createCidStore({ now: () => now }) });
  await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Map scales', markdown: '# Map scales' }, fromArticle);
  await claim(s);
  now += 30_000;
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotterId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8' }, page());
  assert.equal(s.calls.tabMessages.at(-1).m.kind, 'clipped');
});


test('Close under a failure that was already reported still closes the window', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Map scales', markdown: '# Map scales' }, fromArticle);
  await claim(s);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'save_failed' }, page());
  assert.deepEqual(s.calls.windowsRemoved, [], 'a failure leaves it open');
  assert.equal(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cancelled' }, page(77)), null, 'not from another window');
  assert.deepEqual(await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'cancelled' }, page()), { ok: true });
  assert.deepEqual(s.calls.windowsRemoved, [42]);
});
