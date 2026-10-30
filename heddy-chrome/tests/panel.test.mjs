// Heddy's panel (owner, 2026-10-30): the toolbar icon no longer opens a
// default_popup, which Chrome closes the moment focus leaves it. A click
// draws popup.html in a frame inside the page, top right, and it stays until
// its ✕, Esc, or a second click. Where Chrome keeps extensions out, the same
// popup opens in a small window instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { load, read } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const { createPanel, PANEL_FILES, WINDOWS_KEY, WINDOW } = load('./lib/panel.js');
const { createSnap } = load('./lib/snap.js');
const { createCourier } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const EXT = 'chrome-extension://heddy';
const ARTICLE = { id: 9, windowId: 1, url: 'https://www.ordnancesurvey.co.uk/map-scales' };
const STORE = { id: 11, windowId: 1, url: 'https://chromewebstore.google.com/detail/x' };

// ─── lib/panel.js, the background's side ────────────────────────────────────

function fakeChrome({ forbidden = [] } = {}) {
  const calls = { injected: [], sent: [], windows: [], removed: [] };
  const open = {}; // tabId → panel shown in that page
  const session = {};
  const live = new Set();
  const chrome = {
    runtime: { getURL: (p) => `${EXT}/${p}` },
    storage: { session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) } },
    scripting: {
      executeScript: async (o) => {
        calls.injected.push(o);
        if (forbidden.includes(o.target.tabId)) throw new Error('Cannot access contents of the page.');
      },
    },
    tabs: {
      sendMessage: async (tabId, m) => {
        calls.sent.push({ tabId, m });
        if (m.type === 'heddy-panel:toggle') { open[tabId] = !open[tabId]; return { open: open[tabId] }; }
        if (m.type === 'heddy-panel:close') { const was = !!open[tabId]; open[tabId] = false; return { ok: true, was }; }
        return undefined;
      },
    },
    windows: {
      get: async (id) => { if (id === 1) return { id: 1, left: 100, top: 40, width: 1440, height: 900 }; if (live.has(id)) return { id }; throw new Error('No window'); },
      getLastFocused: async () => ({ id: 1, left: 100, top: 40, width: 1440, height: 900 }),
      create: async (o) => { calls.windows.push(o); live.add(77); return { id: 77 }; },
      remove: async (id) => { calls.removed.push(id); live.delete(id); },
    },
  };
  return { chrome, calls, session, open, live };
}

test('a click on the icon injects the panel into the active tab and toggles it', async () => {
  const f = fakeChrome();
  const panel = createPanel({ chrome: f.chrome });
  assert.deepEqual(await panel.clicked(ARTICLE), { ok: true, where: 'page', open: true });
  assert.deepEqual(f.calls.injected[0], { target: { tabId: 9 }, files: PANEL_FILES });
  assert.deepEqual(PANEL_FILES, ['content/panel.js']);
  assert.deepEqual(f.calls.sent[0], { tabId: 9, m: { type: 'heddy-panel:toggle', tabId: 9 } });
  assert.deepEqual(await panel.clicked(ARTICLE), { ok: true, where: 'page', open: false }, 'the second click closes it');
  assert.equal(f.calls.windows.length, 0, 'no window on a page Heddy may draw on');
});

test('on a page Chrome keeps from extensions, the popup opens in a small window top right; a second click closes it', async () => {
  const f = fakeChrome({ forbidden: [11] });
  const panel = createPanel({ chrome: f.chrome });
  assert.deepEqual(await panel.clicked(STORE), { ok: true, where: 'window', open: true });
  const w = f.calls.windows[0];
  assert.equal(w.url, `${EXT}/popup/popup.html?tab=11&host=window&kind=store`, 'the window is told the kind of page (D61)');
  assert.equal(w.type, 'popup');
  assert.equal(w.focused, true);
  assert.equal(w.width, WINDOW.width);
  assert.equal(w.left, 100 + 1440 - WINDOW.width - WINDOW.right);
  assert.equal(w.top, 40 + WINDOW.top);
  assert.deepEqual(f.session[WINDOWS_KEY], { 11: 77 });
  assert.deepEqual(await panel.clicked(STORE), { ok: true, where: 'window', open: false });
  assert.deepEqual(f.calls.removed, [77]);
  assert.deepEqual(f.session[WINDOWS_KEY], {});
});

test('a fallback window the child closed is forgotten, and the next click opens a fresh one', async () => {
  const f = fakeChrome({ forbidden: [11] });
  const panel = createPanel({ chrome: f.chrome });
  await panel.clicked(STORE);
  f.live.delete(77);
  await panel.windowRemoved(77);
  assert.deepEqual(f.session[WINDOWS_KEY], {});
  await panel.clicked(STORE);
  assert.equal(f.calls.windows.length, 2);
  // A stale id (the worker missed onRemoved) also opens a fresh window.
  f.live.delete(77);
  await panel.clicked(STORE);
  assert.equal(f.calls.windows.length, 3);
});

test('hide takes the panel off a page and resolves; a page without one resolves too', async () => {
  const f = fakeChrome();
  const panel = createPanel({ chrome: f.chrome });
  await panel.clicked(ARTICLE);
  await panel.hide(9);
  assert.equal(f.open[9], false);
  f.chrome.tabs.sendMessage = async () => { throw new Error('Receiving end does not exist.'); };
  await panel.hide(9);
});

test('+ Picture from the panel: box mode is drawn BESIDE the panel (R5b); the whole tab still takes the panel off first', async () => {
  const order = [];
  const chrome = {
    runtime: { id: 'heddy' },
    storage: { session: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    tabs: { get: async (id) => ({ ...ARTICLE, id }), sendMessage: async (tabId, m) => { order.push(m.type); return { ok: true }; }, captureVisibleTab: async () => { throw new Error('stop'); } },
    scripting: { executeScript: async (o) => { order.push(o.files ? 'inject' : 'func'); return [{ result: { vw: 1280, vh: 800 } }]; } },
  };
  const snap = createSnap({ chrome, crop: { clampBox: (r) => r }, tools: {}, makers: {}, sender: {}, later: (fn) => fn(), hidePanel: async (tabId) => { order.push(`hide:${tabId}`); } });
  // The panel's frame has a sender.tab (the page it sits in) and an extension URL.
  const frame = { id: 'heddy', url: `${EXT}/popup/popup.html?tab=9&host=panel`, tab: ARTICLE, frameId: 3 };
  const r = await snap.internal({ type: 'heddy-ui:snap', mode: 'box', tabId: 9 }, frame);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(order, ['inject', 'heddy-box:start'], 'the panel stays: box mode hides it only for each screenshot');
  order.length = 0;
  await snap.internal({ type: 'heddy-ui:snap', mode: 'whole', tabId: 9 }, frame);
  assert.equal(order[0], 'hide:9', 'the whole tab: the panel leaves before the screenshot');
});

test('the panel’s frame names its tab like the old popup: a capture from it is not refused for its own URL', async () => {
  const VIDEO = 'Fq2aPn3x_-A';
  const calls = [];
  const chrome = {
    runtime: { id: 'heddy' },
    storage: { session: { get: async () => ({}), set: async () => {} }, local: { get: async () => ({}) } },
    tabs: {
      get: async (id) => ({ id, index: 2, windowId: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` }),
      create: async (o) => { calls.push(o); return { id: 900, windowId: 1 }; },
    },
    windows: { get: async () => ({ id: 1 }), getLastFocused: async () => ({ id: 1 }), create: async () => ({ id: 42 }) },
  };
  const courier = createCourier({ chrome, store: createCidStore(), randomUUID: () => '0f8fad5b-d9cb-469f-a165-70867728950e' });
  const frame = { id: 'heddy', url: `${EXT}/popup/popup.html?tab=7&host=panel`, tab: { id: 7, windowId: 1, url: `https://www.youtube.com/watch?v=${VIDEO}` }, frameId: 4 };
  const r = await courier.internal({ type: 'heddy-ui:capture', youtubeId: VIDEO, startSec: null, then: 'keep', tabId: 7, windowId: 1 }, frame);
  assert.equal(r.ok, true);
  assert.equal(calls[0].openerTabId, 7);
  const jot = await courier.internal({ type: 'heddy-ui:jot', url: ARTICLE.url, quote: 'q', tabId: 9, windowId: 1 }, { ...frame, tab: ARTICLE });
  assert.equal(jot.ok, true, 'Jot it from the panel on an article');
});

// ─── content/panel.js, in the page ──────────────────────────────────────────

/** Just enough DOM for content/panel.js, in a context of its own. */
function page() {
  const listeners = { win: {}, doc: {} };
  const timers = [];
  const posted = [];
  const frameWindow = { postMessage: (m, origin) => posted.push({ m, origin }) };
  const appended = [];
  let onMessage = null;
  function el(tag) {
    const e = {
      tag, attrs: {}, style: { setProperty(k, v, prio) { this[k] = `${v} !${prio}`; } }, children: [], className: '', title: '',
      classList: { set: new Set(), add(c) { this.set.add(c); }, contains(c) { return this.set.has(c); } },
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(c) { this.children.push(c); return c; },
      attachShadow(o) { this.shadowMode = o.mode; this.shadow = el('#shadow'); return this.shadow; },
      remove() { const i = appended.indexOf(this); if (i >= 0) appended.splice(i, 1); },
    };
    if (tag === 'iframe') e.contentWindow = frameWindow;
    return e;
  }
  const on = (where) => (type, fn) => { (listeners[where][type] ||= []).push(fn); };
  const off = (where) => (type, fn) => { listeners[where][type] = (listeners[where][type] || []).filter((x) => x !== fn); };
  const ctx = {
    location: { href: 'https://www.ordnancesurvey.co.uk/map-scales' },
    URL,
    document: {
      createElement: el,
      body: { appendChild: (c) => { appended.push(c); return c; } },
      documentElement: { appendChild: (c) => { appended.push(c); return c; } },
      addEventListener: on('doc'),
      removeEventListener: off('doc'),
    },
    addEventListener: on('win'),
    removeEventListener: off('win'),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => fn(),
    chrome: {
      runtime: {
        id: 'heddy',
        getURL: (p) => `${EXT}/${p}`,
        onMessage: { addListener: (fn) => { onMessage = fn; } },
      },
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('content/panel.js'), ctx);
  const fire = (where, type, ev) => (listeners[where][type] || []).slice().forEach((fn) => fn(ev));
  const fromBg = { id: 'heddy' };
  return {
    ctx, appended, posted, timers, frameWindow, fire,
    // Replies cross from the page's context: compared as plain JSON.
    send: (m, sender = fromBg) => new Promise((resolve) => {
      let replied = false;
      const keep = onMessage(m, sender, (r) => { replied = true; resolve(JSON.parse(JSON.stringify(r))); });
      if (!keep && !replied) resolve(undefined);
    }),
    host: () => appended[0],
    frame: () => appended[0] && appended[0].shadow.children.find((c) => c.tag === 'iframe'),
  };
}

test('the panel: a frame of popup.html in a CLOSED shadow root, fixed top right, above everything', async () => {
  const p = page();
  assert.deepEqual(await p.send({ type: 'heddy-panel:toggle', tabId: 9 }), { open: true });
  const host = p.host();
  assert.equal(host.shadowMode, 'closed');
  const css = host.attrs.style;
  assert.match(css, /position: fixed !important/);
  assert.match(css, /top: 12px !important/);
  assert.match(css, /right: 12px !important/);
  assert.match(css, /z-index: 2147483647 !important/);
  assert.match(css, /all: initial !important/);
  assert.equal(p.frame().src, `${EXT}/popup/popup.html?tab=9&host=panel`);
  assert.deepEqual(await p.send({ type: 'heddy-panel:toggle', tabId: 9 }), { open: false }, 'the second click closes it');
  assert.equal(p.appended.length, 0);
});

test('it stays through clicks and scrolls; Esc in the page closes it', async () => {
  const p = page();
  await p.send({ type: 'heddy-panel:toggle', tabId: 9 });
  p.fire('win', 'keydown', { key: 'a' });
  p.fire('doc', 'click', {});
  p.fire('win', 'scroll', {});
  assert.equal(p.appended.length, 1);
  p.fire('win', 'keydown', { key: 'Escape' });
  assert.equal(p.appended.length, 0);
});

test('the frame sizes itself and closes itself; a message from anyone else is ignored', async () => {
  const p = page();
  await p.send({ type: 'heddy-panel:toggle', tabId: 9 });
  const frame = p.frame();
  p.fire('win', 'message', { source: {}, data: { heddyPanel: 'close' } });
  assert.equal(p.appended.length, 1, 'the page cannot close it by pretending');
  p.fire('win', 'message', { source: p.frameWindow, data: { heddyPanel: 'size', h: 412.3 } });
  assert.equal(frame.style.height, '413px');
  assert.ok(frame.classList.contains('on'));
  p.fire('win', 'message', { source: p.frameWindow, data: { heddyPanel: 'close' } });
  assert.equal(p.appended.length, 0);
});

test('a new selection in the page is a hint to the frame (no data), sent to the frame’s own origin', async () => {
  const p = page();
  await p.send({ type: 'heddy-panel:toggle', tabId: 9 });
  p.fire('doc', 'selectionchange', {});
  const t = p.timers.find((x) => x.ms === 250);
  t.fn();
  assert.deepEqual(JSON.parse(JSON.stringify(p.posted)), [{ m: { heddyPanel: 'selection' }, origin: EXT }]);
});

test('heddy-panel:close (before Snap a picture) answers only once the panel is off the screen', async () => {
  const p = page();
  await p.send({ type: 'heddy-panel:toggle', tabId: 9 });
  const reply = p.send({ type: 'heddy-panel:close' });
  assert.equal(p.appended.length, 0);
  p.timers.filter((x) => x.ms === 30).forEach((x) => x.fn());
  assert.deepEqual(await reply, { ok: true, was: true });
});

test('only Heddy’s background may open or close it, not a content script of another tab', async () => {
  const p = page();
  const r = await p.send({ type: 'heddy-panel:toggle', tabId: 9 }, { id: 'heddy', tab: { id: 3 } });
  assert.equal(r, undefined);
  assert.equal(p.appended.length, 0);
  assert.equal(await p.send({ type: 'heddy-panel:toggle', tabId: 9 }, { id: 'someone-else' }), undefined);
});

test('a second injection draws nothing twice', () => {
  const p = page();
  vm.runInContext(read('content/panel.js'), p.ctx);
  assert.equal(typeof p.ctx.__heddyPanel.open, 'function');
});

// ─── popup/popup.js, the frame's content ────────────────────────────────────

const popup = read('popup/popup.js');

test('the popup closes the panel (or its window) where it used to close itself', () => {
  assert.doesNotMatch(popup.replace(/else window\.close\(\);/, ''), /window\.close\(\)/, 'window.close only inside closeUi');
  assert.match(popup, /if \(HOST === 'panel'\) window\.parent\.postMessage\(\{ heddyPanel: 'close' \}, '\*'\);\s*else window\.close\(\);/);
  assert.match(popup, /mountButton\(\$\('snap'\), \{ chrome: chrome, tr: tr, tab: tab, close: closeUi \}\)/);
});

test('Esc in the panel closes it, and the ✕ is in the header right of the host label, labelled "Close"', () => {
  assert.match(popup, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); closeUi\(\); \}/);
  assert.match(popup, /x\.setAttribute\('aria-label', tr\('close'\)\);\s*x\.addEventListener\('click', closeUi\);/);
  const html = read('popup/popup.html');
  assert.match(html, /<span class="ctx" id="ctx"><\/span>\s*<button type="button" class="x" id="close"><\/button>\s*<\/header>/);
  assert.equal(JSON.parse(read('_locales/en/messages.json')).close.message, 'Close');
  assert.equal(JSON.parse(read('_locales/zh_CN/messages.json')).close.message, '关闭');
});

test('the popup acts on the tab it is given (?tab=), not on its own window’s active tab', () => {
  assert.match(popup, /if \(TAB_ID != null\) return chrome\.tabs\.get\(TAB_ID\)/);
  assert.match(popup, /HOST !== 'panel' \|\| e\.source !== window\.parent/, 'hints only from the page that holds it');
});

test('a new selection changes nothing until + Text; the background’s "changed" redraws the cards, never during an action', () => {
  assert.doesNotMatch(popup, /heddyPanel === 'selection'/);
  assert.match(popup, /if \(m && m\.type === 'heddy-cards:changed' && view && m\.tabId === view\.tab\.id\) refreshCards\(\);/);
  assert.match(popup, /if \(!view \|\| busyNow\(\)\) return;/);
});

test('the panel is put on <html>, last, so box mode can sit just under it; away() hides it for a screenshot without reloading it', async () => {
  const p = page();
  await p.send({ type: 'heddy-panel:toggle', tabId: 9 });
  assert.equal(p.ctx.__heddyPanel.host(), p.host());
  p.ctx.__heddyPanel.away(true);
  assert.equal(p.host().style.opacity, '0 !important');
  assert.equal(p.appended.length, 1, 'still in the page: a frame removed would load again');
  p.ctx.__heddyPanel.away(false);
  assert.equal(p.host().style.opacity, '1 !important');
  assert.match(read('content/panel.js'), /document\.documentElement\.appendChild\(host\);/);
});
