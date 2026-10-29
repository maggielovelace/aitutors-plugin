// Snap a picture (D30, D33; R3b · 01, R3b · 04, R3b · 05): telling one click
// or press from two, box mode's rules, and the background collecting up to
// four pictures from one page and sending them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
const T = load('./lib/tools.js');
const S = load('./lib/snap.js');
const B = load('./content/box-mode.js');
const K = globalThis.HeddyCrop;

/** Fake timers: run() advances the clock. */
function clock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    later: (fn, ms) => { timers.set(++id, { fn, at: now + ms }); return id; },
    clear: (t) => { timers.delete(t); },
    run(ms) {
      now += ms;
      for (const [k, t] of [...timers]) if (t.at <= now) { timers.delete(k); t.fn(); }
    },
  };
}

// ─── the gate ────────────────────────────────────────────────────────────────

test('the timings are the owner’s: ~250 ms for a double-click, 0.4 s for a double press', () => {
  assert.equal(S.DOUBLE_CLICK_MS, 250);
  assert.equal(S.DOUBLE_PRESS_MS, 400);
});

test('one click waits 250 ms, then box mode', () => {
  const c = clock();
  const seen = [];
  const g = S.createGate({ waitMs: 250, later: c.later, clear: c.clear, onSingle: () => seen.push('box'), onDouble: () => seen.push('whole') });
  assert.equal(g.hit(), 'waiting');
  c.run(249);
  assert.deepEqual(seen, []);
  assert.ok(g.pending());
  c.run(1);
  assert.deepEqual(seen, ['box']);
  assert.ok(!g.pending());
});

test('a second click inside the wait is the whole tab, and box mode never starts', () => {
  const c = clock();
  const seen = [];
  const g = S.createGate({ waitMs: 250, later: c.later, clear: c.clear, onSingle: () => seen.push('box'), onDouble: () => seen.push('whole') });
  g.hit();
  c.run(200);
  assert.equal(g.hit(), 'double');
  c.run(1000);
  assert.deepEqual(seen, ['whole']);
});

test('two clicks further apart than the wait are two singles', () => {
  const c = clock();
  const seen = [];
  const g = S.createGate({ waitMs: 250, later: c.later, clear: c.clear, onSingle: () => seen.push('box'), onDouble: () => seen.push('whole') });
  g.hit();
  c.run(260);
  g.hit();
  c.run(260);
  assert.deepEqual(seen, ['box', 'box']);
});

// ─── box mode's rules ────────────────────────────────────────────────────────

test('the tray: one box → Jot it, Add, Explain and Make a card live', () => {
  assert.deepEqual(B.trayModel(0, true), { n: 1, count: null, showAdd: true, single: true, collecting: false });
});

test('the tray: two kept and a third drawn → Jot it · 3, Add, Explain and Make a card dimmed', () => {
  assert.deepEqual(B.trayModel(2, true), { n: 3, count: 3, showAdd: true, single: false, collecting: true });
});

test('the 4th box hides Add to this jot', () => {
  assert.equal(B.trayModel(3, true).showAdd, false);
  assert.equal(B.trayModel(3, true).count, 4);
  assert.equal(B.trayModel(2, false).showAdd, false, 'nothing drawn: nothing to add');
});

test('one kept and nothing drawn is still a single picture', () => {
  assert.deepEqual(B.trayModel(1, false), { n: 1, count: null, showAdd: false, single: true, collecting: true });
});

test('boxes from a drag, in any direction; under 24 × 24 ignored', () => {
  assert.deepEqual(B.rectFrom(300, 200, 100, 50), { x: 100, y: 50, w: 200, h: 150 });
  assert.equal(B.bigEnough({ x: 0, y: 0, w: 23, h: 300 }), false);
  assert.equal(B.bigEnough({ x: 0, y: 0, w: 24, h: 24 }), true);
});

test('corner handles resize, and moving stays on screen', () => {
  const r = { x: 100, y: 100, w: 200, h: 100 };
  assert.deepEqual(B.resize(r, 'se', 20, 10), { x: 100, y: 100, w: 220, h: 110 });
  assert.deepEqual(B.resize(r, 'nw', 20, 10), { x: 120, y: 110, w: 180, h: 90 });
  assert.deepEqual(B.resize(r, 'ne', 300, 0), { x: 100, y: 100, w: 500, h: 100 });
  assert.deepEqual(B.resize(r, 'sw', 250, 0), { x: 300, y: 100, w: 50, h: 100 }, 'dragged past the other side');
  assert.deepEqual(B.moveWithin(r, -500, 5000, 1280, 800), { x: 0, y: 700, w: 200, h: 100 });
});

test('what snaps: img, picture, svg, canvas, a video with a poster, a background image; 48 px each way', () => {
  const big = { w: 48, h: 48 };
  for (const tag of ['IMG', 'picture', 'svg', 'CANVAS']) assert.ok(B.isPicture({ tag, ...big }), tag);
  assert.ok(B.isPicture({ tag: 'VIDEO', poster: true, ...big }));
  assert.ok(!B.isPicture({ tag: 'VIDEO', poster: false, ...big }));
  assert.ok(B.isPicture({ tag: 'DIV', bg: 'url("https://x/y.png")', ...big }));
  assert.ok(!B.isPicture({ tag: 'DIV', bg: 'linear-gradient(red, blue)', ...big }));
  assert.ok(!B.isPicture({ tag: 'DIV', bg: 'none', ...big }));
  assert.ok(!B.isPicture({ tag: 'IMG', w: 47, h: 300 }), 'an icon');
});

test('the context is the last sentence before, at most 300 characters', () => {
  assert.equal(B.lastSentence('Maps use scales. Scales are written three ways: as a ratio, in words, and as a bar.', 300), 'Scales are written three ways: as a ratio, in words, and as a bar.');
  assert.equal(B.lastSentence('a\u0000b', 300), 'a b');
  assert.equal(B.lastSentence('x'.repeat(500), 300).length, 300);
});

test('the same page: the address without its #fragment', () => {
  assert.equal(B.samePageKey('https://a.example/p#one'), B.samePageKey('https://a.example/p#two'));
  assert.notEqual(B.samePageKey('https://a.example/p'), B.samePageKey('https://a.example/q'));
});

// ─── the background ──────────────────────────────────────────────────────────

const PAGE = 'https://www.ordnancesurvey.co.uk/blog/map-scales';
const PNG = K.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));
const SHOT = 'data:image/png;base64,' + PNG;

function setup() {
  const c = clock();
  const calls = { captures: [], injected: [], tabMessages: [], boxes: [], tools: [], menus: [] };
  const tab = { id: 7, windowId: 3, url: PAGE + '#top', title: 'Understanding map scales' };
  const chrome = {
    runtime: { id: 'heddy' },
    tabs: {
      get: async (id) => ({ ...tab, id }),
      captureVisibleTab: async (windowId, o) => { calls.captures.push({ windowId, o }); return SHOT; },
      sendMessage: async (tabId, m) => { calls.tabMessages.push({ tabId, m }); return { ok: true }; },
    },
    scripting: {
      executeScript: async (o) => {
        calls.injected.push(o);
        return o.func ? [{ result: { vw: 1440, vh: 900 } }] : [];
      },
    },
    contextMenus: { remove: async () => {}, create: (o) => { calls.menus.push(o); } },
  };
  const sender = {
    box: async (input, where) => { calls.boxes.push({ input, where }); return { ok: true }; },
    tool: async (input, where) => { calls.tools.push({ input, where }); return { ok: true }; },
  };
  const crop = {
    ...K,
    cropShot: async (shot, rects, vw, vh) => rects.map((r) => ({ png: PNG, box: K.webBox(r, vw, vh) })),
  };
  const snap = S.createSnap({ chrome, sender, crop, tools: T, later: c.later, clear: c.clear });
  const fromPage = { id: 'heddy', frameId: 0, tab };
  return { snap, calls, tab, fromPage, clock: c, chrome };
}

const grab = (s, rect = { x: 200, y: 166, w: 270, h: 136 }, extra = {}) =>
  s.snap.internal({ type: 'heddy-box:grab', rect, vw: 1280, vh: 800, context: 'Scales are written three ways.', ...extra }, s.fromPage);

test('a kept box is cut from captureVisibleTab of the tab’s window, as PNG', async () => {
  const s = setup();
  assert.deepEqual(await grab(s), { ok: true, n: 1 });
  assert.deepEqual(s.calls.captures, [{ windowId: 3, o: { format: 'png' } }]);
});

test('Jot it sends heddy:box with every kept picture, from the tab’s own address', async () => {
  const s = setup();
  await grab(s);
  await grab(s, { x: 500, y: 100, w: 200, h: 100 });
  const r = await s.snap.internal({ type: 'heddy-box:send', action: 'jot' }, s.fromPage);
  assert.deepEqual(r, { ok: true });
  assert.equal(s.calls.boxes.length, 1);
  const { input, where } = s.calls.boxes[0];
  assert.equal(input.images.length, 2);
  assert.equal(input.url, PAGE, 'the tab’s address, without #');
  assert.equal(input.context, 'Scales are written three ways.', 'the cover’s caption');
  assert.deepEqual(where, { tabId: 7, windowId: 3 });
  assert.equal(s.snap.kept(7), 0, 'sent, so forgotten');
});

test('at most 4 pictures for one jot', async () => {
  const s = setup();
  for (let i = 0; i < 4; i++) assert.equal((await grab(s)).ok, true);
  assert.deepEqual(await grab(s), { ok: false, error: 'full' });
  assert.equal(s.calls.captures.length, 4, 'no fifth screenshot');
});

test('same page only: a different address drops what was kept', async () => {
  const s = setup();
  await grab(s);
  await grab(s);
  s.tab.url = 'https://www.ordnancesurvey.co.uk/blog/other';
  assert.deepEqual(await grab(s), { ok: false, error: 'page_changed' });
  assert.equal(s.snap.kept(7), 0);
  // a #fragment change is the same page
  const t = setup();
  await grab(t);
  t.tab.url = PAGE + '#further-down';
  assert.equal((await grab(t)).n, 2);
});

test('a navigation while collecting drops the pictures, and the new page gets one line', async () => {
  const s = setup();
  await grab(s);
  s.snap.tabUpdated(7, { url: 'https://www.ordnancesurvey.co.uk/blog/other' });
  assert.equal(s.snap.kept(7), 0);
  await s.snap.tabUpdated(7, { status: 'complete' });
  const line = s.calls.injected.find((o) => o.func && o.func.name === 'showDroppedLine');
  assert.ok(line, 'the notice is injected');
  // a navigation with nothing kept says nothing
  const t = setup();
  await t.snap.tabUpdated(7, { url: 'https://x.example/' });
  await t.snap.tabUpdated(7, { status: 'complete' });
  assert.equal(t.calls.injected.length, 0);
});

test('Explain and Make a card refuse two pictures; Ask takes them', async () => {
  for (const action of ['explain', 'card']) {
    const s = setup();
    await grab(s);
    await grab(s);
    assert.deepEqual(await s.snap.internal({ type: 'heddy-box:send', action }, s.fromPage), { ok: false });
    assert.equal(s.calls.tools.length, 0);
  }
  const s = setup();
  await grab(s);
  await grab(s);
  await s.snap.internal({ type: 'heddy-box:send', action: 'ask' }, s.fromPage);
  assert.equal(s.calls.tools[0].input.tool, 'ask');
  assert.equal(s.calls.tools[0].input.images.length, 2);
  assert.equal(s.calls.tools[0].input.quote, '');
});

test('Explain on one picture sends heddy:tool with it', async () => {
  const s = setup();
  await grab(s);
  await s.snap.internal({ type: 'heddy-box:send', action: 'explain' }, s.fromPage);
  assert.equal(s.calls.tools[0].input.tool, 'explain');
  assert.equal(s.calls.tools[0].input.images.length, 1);
});

test('a box under 24 × 24 takes no screenshot', async () => {
  const s = setup();
  assert.deepEqual(await grab(s, { x: 10, y: 10, w: 20, h: 300 }), { ok: false, error: 'too_small' });
  assert.equal(s.calls.captures.length, 0);
});

test('Esc keeps none', async () => {
  const s = setup();
  await grab(s);
  await s.snap.internal({ type: 'heddy-box:cancel' }, s.fromPage);
  assert.deepEqual(await s.snap.internal({ type: 'heddy-box:send', action: 'jot' }, s.fromPage), { ok: false });
});

test('a frame, another extension or a page cannot drive box mode', async () => {
  const s = setup();
  assert.deepEqual(await s.snap.internal({ type: 'heddy-box:grab' }, { ...s.fromPage, frameId: 2 }), { ok: false });
  assert.equal(s.snap.internal({ type: 'heddy-box:grab' }, { ...s.fromPage, id: 'other' }), undefined);
  assert.equal(s.snap.internal({ type: 'heddy-ui:capture' }, s.fromPage), undefined, 'not ours: the courier’s');
  // the popup's message must not come from a tab
  assert.deepEqual(await s.snap.internal({ type: 'heddy-ui:snap', mode: 'whole', tabId: 7 }, s.fromPage), { ok: false });
});

test('the popup icon: box mode injects box-mode.js and starts it; whole crops the full viewport', async () => {
  const s = setup();
  await s.snap.internal({ type: 'heddy-ui:snap', mode: 'box', tabId: 7 }, { id: 'heddy' });
  assert.deepEqual(s.calls.injected[0], { target: { tabId: 7 }, files: S.BOX_FILES });
  assert.equal(s.calls.tabMessages[0].m.type, 'heddy-box:start');

  const t = setup();
  await t.snap.internal({ type: 'heddy-ui:snap', mode: 'whole', tabId: 7 }, { id: 'heddy' });
  assert.equal(t.calls.boxes.length, 1);
  assert.deepEqual(t.calls.boxes[0].input.images[0].box, { kind: 'web', vw: 1440, vh: 900, x: 0, y: 0, w: 1440, h: 900 });
});

test('Ctrl Shift K: once → box mode after 0.4 s; twice within 0.4 s → the whole tab', async () => {
  const s = setup();
  s.snap.command(S.COMMAND, s.tab);
  s.clock.run(399);
  assert.equal(s.calls.injected.length, 0);
  s.clock.run(1);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls.injected[0].files, S.BOX_FILES);

  const t = setup();
  t.snap.command(S.COMMAND, t.tab);
  t.clock.run(300);
  t.snap.command(S.COMMAND, t.tab);
  await new Promise((r) => setImmediate(r));
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.equal(t.calls.boxes.length, 1, 'the whole tab');
  assert.ok(!t.calls.injected.some((o) => o.files), 'box mode never started');
  assert.equal(t.snap.command('other-command', t.tab), false);
});

test('right-click an image: box mode with the box on that image; inside a frame, no box', async () => {
  const s = setup();
  s.snap.menuClicked({ menuItemId: S.MENU_ID, srcUrl: 'https://x.example/map.png', frameId: 0 }, s.tab);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.calls.tabMessages[0].m, { type: 'heddy-box:start', srcUrl: 'https://x.example/map.png' });

  const t = setup();
  t.snap.menuClicked({ menuItemId: S.MENU_ID, srcUrl: 'https://x.example/map.png', frameId: 5 }, t.tab);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(t.calls.tabMessages[0].m, { type: 'heddy-box:start' });
  assert.equal(t.snap.menuClicked({ menuItemId: 'someone-else' }, t.tab), false);
});

test('the menu item is on images only, titled “Jot this picture with Heddy”', async () => {
  const s = setup();
  await s.snap.installMenu('Jot this picture with Heddy');
  assert.deepEqual(s.calls.menus, [{ id: S.MENU_ID, title: 'Jot this picture with Heddy', contexts: ['image'] }]);
});

test('the words tray’s Explain takes the address and title from the tab, not the page', async () => {
  const s = setup();
  await s.snap.internal({ type: 'heddy-ui:tool', tool: 'explain', url: 'https://evil.example/', title: 'x', quote: '2 cm is 1 km', context: 'c' }, s.fromPage);
  assert.equal(s.calls.tools[0].input.url, s.tab.url);
  assert.equal(s.calls.tools[0].input.title, s.tab.title);
  assert.equal(s.calls.tools[0].input.quote, '2 cm is 1 km');
});

test('the snap icon is the crop-corners glyph at 20 px, stroke 2.6, round caps and joins', () => {
  assert.match(S.SNAP_ICON, /d="M7 2\.5 V17 H21\.5 M2\.5 7 H17 V21\.5"/);
  assert.match(S.SNAP_ICON, /viewBox="0 0 24 24"/);
  assert.match(S.SNAP_ICON, /width="20" height="20"/);
  assert.match(S.SNAP_ICON, /stroke-width="2\.6" stroke-linecap="round" stroke-linejoin="round"/);
});

test('the tooltip shows the shortcut Chrome has, or none', () => {
  assert.equal(S.shortcutLabel([{ name: 'snap-picture', shortcut: '⇧⌘K' }]), '⇧⌘K');
  assert.equal(S.shortcutLabel([{ name: 'snap-picture', shortcut: '' }]), null);
  assert.equal(S.shortcutLabel([]), null);
});
