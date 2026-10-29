// Phase 2's courier, against a fake Chrome: J opens /capture/jot without focus
// and the result becomes "Note saved" with Undo; Undo opens its own window
// without focus; Jot it and Clip this page carry the tab's own page; the menu
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

function setup({ tabReply = { ok: true } } = {}) {
  const calls = { windows: [], tabMessages: [], injected: [], menus: [], icons: [] };
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
    },
    action: { setIcon: async (o) => { calls.icons.push(o); } },
    tabs: {
      get: async (id) => ({ id, url: WATCH }),
      query: async () => [{ id: 9, windowId: 1, url: ARTICLE }],
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); return tabReply; },
      create: async () => {},
    },
    scripting: { executeScript: async (o) => { calls.injected.push(o); } },
    contextMenus: {
      removeAll: async () => { calls.menus.push('removeAll'); },
      remove: async (id) => { calls.menus.push(`remove:${id}`); if (calls.menus.filter((x) => typeof x === 'object').length === 0) throw new Error('Cannot find menu item'); },
      create: (o) => { calls.menus.push(o); },
    },
  };
  const courier = createCourier({ chrome, store: createCidStore(), randomUUID: () => CID, setTimeout: () => {} });
  return { chrome, calls, courier };
}

const page = (windowId = 42) => ({ origin: PROD, url: `${PROD}/capture/jot?cid=${CID}`, tab: { id: 900, windowId } });
const fromYouTube = { id: 'heddy', url: WATCH, tab: { id: 7, windowId: 1, url: WATCH } };
const fromArticle = { id: 'heddy', url: `${ARTICLE}#grid`, tab: { id: 9, windowId: 1, url: `${ARTICLE}#grid` } };

async function claim(s) {
  return s.courier.external({ type: 'heddy:ready', v: 1, cid: CID }, page());
}

test('J opens /capture/jot in a window that does not take focus, with heddy:moment', async () => {
  const s = setup();
  const r = await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 168.4, tEnd: 171.2, title: 'GCSE Maths - Using Scales on Maps' }, fromYouTube);
  assert.deepEqual(r, { ok: true, cid: CID });
  assert.equal(s.calls.windows[0].url, `${PROD}/capture/jot?cid=${CID}`);
  assert.equal(s.calls.windows[0].focused, false);
  assert.deepEqual(await claim(s), { type: 'heddy:moment', v: 1, cid: CID, youtubeId: VIDEO, t: 168, tEnd: 171 });
});

test('J’s saved result: the tick, then "Note saved" with the quote, Undo’s jot id and Open in Jotter', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 170, title: 'GCSE Maths - Using Scales on Maps' }, fromYouTube);
  await claim(s);
  const reply = await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, t: 168, jotId: JOT, quote: 'On a 1:50 000 map, 2 cm represents 1 km on the ground.' }, page());
  assert.deepEqual(reply, { ok: true });
  assert.equal(s.calls.icons.at(-1).path[16], 'icons/toolbar-saved-16.png');
  assert.deepEqual(s.calls.tabMessages, [{
    tabId: 7,
    m: {
      type: 'heddy-ui:toast', kind: 'note', t: 168, quote: 'On a 1:50 000 map, 2 cm represents 1 km on the ground.', jotId: JOT,
      topic: null, topicLang: null, title: 'GCSE Maths - Using Scales on Maps', href: `${PROD}/study/jotters/v/${VIDEO}`,
    },
  }]);
});

test('J’s refusals stay in the window: no toast for Keep and jot, cant_keep or an unknown video', async () => {
  for (const error of ['unknown_video', 'cant_keep', 'cannot_keep', null]) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 3 }, fromYouTube);
    await claim(s);
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error }, page());
    assert.equal(s.calls.tabMessages.length, 0, String(error));
    assert.equal(s.calls.icons.length, 0);
  }
});

test('J only for the video the page shows, and never from Shorts, an embed or a page that is not Heddy', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: 'abcdefghijk', t: 3 }, fromYouTube), { ok: false });
  const shorts = { id: 'heddy', url: `https://www.youtube.com/shorts/${VIDEO}`, tab: { id: 7, windowId: 1, url: `https://www.youtube.com/shorts/${VIDEO}` } };
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 3 }, shorts), { ok: false });
  const embed = { id: 'heddy', url: `https://www.youtube.com/embed/${VIDEO}`, tab: { id: 7, windowId: 1, url: `https://www.youtube.com/embed/${VIDEO}` } };
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 3 }, embed), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: -1 }, fromYouTube), { ok: false });
  assert.equal(await s.courier.internal({ type: 'heddy-ui:moment', youtubeId: VIDEO, t: 3 }, { ...fromYouTube, id: 'other' }), null);
  assert.equal(s.calls.windows.length, 0);
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

test('Jot it: heddy:jot to a focused /capture/jot window, with the page’s own address', async () => {
  const s = setup();
  const r = await s.courier.internal({ type: 'heddy-ui:jot', url: `${ARTICLE}#grid`, title: 'Understanding map scales', quote: 'On a 1:50 000 map', before: 'The scale is printed in the margin.', after: 'Grid squares' }, fromArticle);
  assert.equal(r.ok, true);
  assert.equal(s.calls.windows[0].focused, true);
  const payload = await claim(s);
  assert.equal(payload.type, 'heddy:jot');
  assert.equal(payload.url, ARTICLE);
  assert.equal(payload.context, 'The scale is printed in the margin. … Grid squares');
});

test('a page can only jot or clip itself; the popup names its tab', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:jot', url: 'https://evil.example/', quote: 'q' }, fromArticle), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:page', url: 'https://evil.example/', markdown: 'm' }, fromArticle), { ok: false });
  assert.equal(s.calls.windows.length, 0);
  const r = await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q', tabId: 9, windowId: 1 }, { id: 'heddy' });
  assert.equal(r.ok, true);
});

test('Clip this page: heddy:page to /capture/page; past 200 KB, the first part with cut: true', async () => {
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

test('the context menu jots the selection; Ctrl Shift J shows the tray; both inject only then', async () => {
  const s = setup();
  assert.equal(s.calls.injected.length, 0);
  await s.courier.menuClicked({ menuItemId: MENU_ID, selectionText: 'x' }, { id: 9, windowId: 1, url: ARTICLE });
  assert.deepEqual(s.calls.injected[0], { target: { tabId: 9 }, files: PAGE_FILES });
  assert.deepEqual(s.calls.tabMessages.at(-1), { tabId: 9, m: { type: 'heddy-ui:jot-selection' } });
  await s.courier.command(COMMAND, { id: 9, windowId: 1, url: ARTICLE });
  assert.deepEqual(s.calls.tabMessages.at(-1), { tabId: 9, m: { type: 'heddy-ui:tray' } });
  await s.courier.command(COMMAND, undefined);
  assert.equal(s.calls.injected.length, 3, 'with no tab given, the active tab');
  assert.equal(await s.courier.command('something-else', { id: 9 }), null);
  assert.equal(await s.courier.menuClicked({ menuItemId: 'other' }, { id: 9 }), null);
  assert.equal(s.calls.injected.length, 3);
});

test('a page Heddy may not script (chrome://, the Web Store) fails quietly', async () => {
  const s = setup();
  s.chrome.scripting.executeScript = async () => { throw new Error('Cannot access a chrome:// URL'); };
  assert.deepEqual(await s.courier.command(COMMAND, { id: 9 }), { ok: false });
});

test('the menu item is on selections only, in Heddy’s language', async () => {
  const s = setup();
  await s.courier.installMenus('zh_CN');
  assert.deepEqual(s.calls.menus, [`remove:${MENU_ID}`, { id: MENU_ID, title: '用 Heddy 写批注', contexts: ['selection'] }], 'a first install: nothing to remove, still created');
  assert.ok(!s.calls.menus.includes('removeAll'), 'never removes Phase 3’s items');
  await s.courier.installMenus('en');
  assert.equal(s.calls.menus.at(-1).title, 'Jot it with Heddy');
});

test('Open goes to the child’s Jotter as well as My Clips, on the capture origin only', async () => {
  const s = setup();
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/jotters/v/${VIDEO}` }, fromYouTube), { ok: true });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `${PROD}/study/jottersx` }, fromYouTube), { ok: false });
  assert.deepEqual(await s.courier.internal({ type: 'heddy-ui:open', href: `https://evil.example/study/jotters/v/${VIDEO}` }, fromYouTube), { ok: false });
});

const JOTTER = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';

test('Jot it saved: the window closes on the site’s side, the page shows "Jotted", the quote, Undo, Open in Jotter', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, title: 'Map scales', quote: 'On a 1:50 000 map' }, fromArticle);
  await claim(s);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotId: JOT, jotterId: JOTTER, quote: 'On a 1:50 000 map' }, page());
  assert.deepEqual(s.calls.tabMessages, [{ tabId: 9, m: { type: 'heddy-ui:toast', kind: 'jotted', quote: 'On a 1:50 000 map', jotId: JOT, href: `${PROD}/study/jotters/${JOTTER}` } }]);
});

test('Open in Jotter without a valid jotterId goes to the Jotters shelf', async () => {
  for (const jotterId of [undefined, '../../admin', 'abc']) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q' }, fromArticle);
    await claim(s);
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotId: JOT, jotterId }, page());
    assert.equal(s.calls.tabMessages[0].m.href, `${PROD}/study/jotters`, String(jotterId));
  }
});

test('Clip this page saved: "Clipped · title", Open in Jotter, and the cut line only when cut', async () => {
  for (const [markdown, cut] of [['# Short', false], ['a'.repeat(10) + '\n\n' + 'b'.repeat(200 * 1024), true]]) {
    const s = setup();
    await s.courier.internal({ type: 'heddy-ui:page', url: ARTICLE, title: 'Understanding map scales', markdown }, fromArticle);
    await claim(s);
    await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: true, jotterId: JOTTER }, page());
    assert.deepEqual(s.calls.tabMessages, [{ tabId: 9, m: { type: 'heddy-ui:toast', kind: 'clipped', title: 'Understanding map scales', cut, href: `${PROD}/study/jotters/${JOTTER}` } }]);
  }
});

test('a refused Jot it or Clip this page stays in its window: no toast', async () => {
  const s = setup();
  await s.courier.internal({ type: 'heddy-ui:jot', url: ARTICLE, quote: 'q' }, fromArticle);
  await claim(s);
  await s.courier.external({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: 'too_long' }, page());
  assert.equal(s.calls.tabMessages.length, 0);
});
