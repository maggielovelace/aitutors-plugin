// Round 7 (PRD-v0.96.0 § 1g): the child orders the cards (D62), one switch
// between Text and Picture (D64), and selected words add themselves while
// the panel is open in Text mode (D65). The list's rules and the background
// as pure functions and fakes, the page's selection watcher in a vm, and
// source pins for the panel, which needs a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
globalThis.HeddyTools = load('./lib/tools.js');
globalThis.HeddyPos = load('./lib/pos.js');
const K = globalThis.HeddyCrop;
const C = load('./lib/cards.js');
const A = load('./lib/auto-add.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));

const PAGE = 'https://www.sparxscience.com/home';
const PNG = K.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));
const BOX = { kind: 'web', vw: 1280, vh: 800, x: 200, y: 166, w: 270, h: 136 };
const ID = (n) => `card-${String(n).padStart(4, '0')}`;
const tcard = (n, quote = `quote ${n}`) => C.textCard(ID(n), { quote, before: '', after: '', pos: { block: n, offset: 0 } });
const icard = (n) => C.imageCard(ID(n), { png: PNG, box: BOX }, { pos: { block: n, offset: 0 }, page: { x: 10, y: 400 + n, w: 200, h: 100 }, before: 'cap', after: '' });

// ─── D62: the child's order ─────────────────────────────────────────────────

test('moveCard: a card to any index, the others keeping their order; numbers are places, so they follow', () => {
  const cards = [tcard(1), icard(2), tcard(3), tcard(4)];
  const moved = C.moveCard(cards, ID(4), 0);
  assert.deepEqual(moved.map((c) => c.id), [ID(4), ID(1), ID(2), ID(3)]);
  assert.deepEqual(C.marks(moved).map((m) => [m.id, m.n]), [[ID(4), 1], [ID(1), 2], [ID(2), 3], [ID(3), 4]], 'the page’s numbers');
  assert.deepEqual(C.forPanel(moved).map((m) => m.n), [1, 2, 3, 4]);
  assert.deepEqual(C.moveCard(cards, ID(1), 2).map((c) => c.id), [ID(2), ID(3), ID(1), ID(4)], 'down two');
  assert.deepEqual(cards.map((c) => c.id), [ID(1), ID(2), ID(3), ID(4)], 'the list itself is untouched');
});

test('moveCard: out of range is clamped; an unknown card, a bad index or no move returns the same list', () => {
  const cards = [tcard(1), tcard(2), tcard(3)];
  assert.deepEqual(C.moveCard(cards, ID(1), 99).map((c) => c.id), [ID(2), ID(3), ID(1)]);
  assert.deepEqual(C.moveCard(cards, ID(3), -5).map((c) => c.id), [ID(3), ID(1), ID(2)]);
  assert.equal(C.moveCard(cards, ID(9), 0), cards);
  assert.equal(C.moveCard(cards, ID(2), 1), cards);
  for (const to of [undefined, null, '0', NaN, Infinity]) assert.equal(C.moveCard(cards, ID(2), to), cards, String(to));
});

test('dropIndex: a dragged card goes before the first other card whose middle is below the pointer', () => {
  const mids = [20, 60, 100];
  assert.equal(C.dropIndex(mids, 5), 0);
  assert.equal(C.dropIndex(mids, 59), 1);
  assert.equal(C.dropIndex(mids, 60), 2, 'on a middle: after it');
  assert.equal(C.dropIndex(mids, 500), 3, 'past the last: at the end');
  assert.equal(C.dropIndex([], 10), 0);
});

// ─── the background ─────────────────────────────────────────────────────────

function fakeSession(data = {}) {
  return {
    data,
    get: async (k) => ({ [k]: data[k] }),
    set: async (o) => { Object.assign(data, JSON.parse(JSON.stringify(o))); },
    remove: async (k) => { delete data[k]; },
  };
}

function setup({ selection = null } = {}) {
  const calls = { synced: [], told: [], opened: [], tools: [], takes: [] };
  const tab = { id: 7, windowId: 3, url: PAGE + '#top', title: 'Sparx Science – Home' };
  let n = 0;
  const page = { selection };
  const chrome = {
    runtime: { id: 'heddy', sendMessage: async (m) => { calls.told.push(m); } },
    storage: { session: fakeSession() },
    tabs: { get: async (id) => ({ ...tab, id }) },
    scripting: {
      executeScript: async (o) => {
        if (o.files) return [];
        if (o.func.name === 'takeInPage') { calls.takes.push(o.args); return [{ result: page.selection && { ...page.selection, url: tab.url } }]; }
        if (o.func.name === 'syncInPage') { calls.synced.push(o.args[0]); return [{ result: true }]; }
        return [];
      },
    },
  };
  const cards = C.createCards({
    chrome,
    randomUUID: () => `c0ffee00-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    pageFiles: ['lib/pos.js', 'content/cards-layer.js'],
    capture: async (t, rect, vw, vh) => ({ png: PNG, box: K.webBox(rect, vw, vh) }),
    openCapture: async (spec) => { calls.opened.push({ spec, payload: spec.build('0f8fad5b-d9cb-469f-a165-70867728950e') }); return { ok: true }; },
    sender: { tool: async (input) => { calls.tools.push(input); return { ok: true }; } },
  });
  const panel = { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html?tab=7&host=panel', tab, frameId: 4 };
  const top = { id: 'heddy', url: tab.url, tab, frameId: 0 };
  const ask = (m, from = panel) => cards.internal({ tabId: 7, ...m }, from);
  return { cards, calls, page, panel, top, ask };
}

const SEL = (quote, block = 1, offset = 0) => ({ quote, before: 'Words before.', after: 'Words after.', pos: { block, offset }, title: 'Sparx Science – Home' });
const UID = (k) => `c0ffee00-0000-4000-8000-${String(k).padStart(12, '0')}`;

async function three(s) {
  for (const [q, b] of [['one', 1], ['two', 2], ['three', 3]]) {
    s.page.selection = SEL(q, b);
    await s.ask({ type: 'heddy-cards:add-text' });
  }
}

test('heddy-cards:move from the panel: the list reorders, the page is told the new numbers, the order outlives the panel', async () => {
  const s = setup();
  await three(s);
  const r = await s.ask({ type: 'heddy-cards:move', id: UID(3), to: 0 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cards.map((c) => [c.quote, c.n]), [['three', 1], ['one', 2], ['two', 3]]);
  assert.deepEqual(s.calls.synced.at(-1).map((c) => [c.id, c.n]), [[UID(3), 1], [UID(1), 2], [UID(2), 3]], 'numbers beside the highlights follow');
  assert.deepEqual(s.calls.told.at(-1), { type: 'heddy-cards:changed', tabId: 7 });
  // The panel closed and opened again: the order lives in the background.
  const again = await s.ask({ type: 'heddy-cards:get' });
  assert.deepEqual(again.cards.map((c) => c.quote), ['three', 'one', 'two']);
});

test('the order is what is saved, and what Explain acts on as card 1', async () => {
  const s = setup();
  await three(s);
  await s.ask({ type: 'heddy-cards:move', id: UID(2), to: 0 });
  await s.ask({ type: 'heddy-cards:save', then: 'save' });
  assert.deepEqual(s.calls.opened[0].payload.items.map((i) => i.quote), ['two', 'one', 'three'], 'heddy:save in the child’s order');
  assert.deepEqual(s.calls.opened[0].spec.meta.cards, [UID(2), UID(1), UID(3)]);
  await s.ask({ type: 'heddy-cards:tool', tool: 'explain' });
  assert.equal(s.calls.tools[0].quote, 'two');
});

test('heddy-cards:move is the panel’s alone; a nonsense move changes nothing and tells no one', async () => {
  const s = setup();
  await three(s);
  assert.deepEqual(await s.ask({ type: 'heddy-cards:move', id: UID(1), to: 2 }, s.top), { ok: false }, 'not from the page');
  const synced = s.calls.synced.length;
  const r = await s.ask({ type: 'heddy-cards:move', id: 'nope', to: 0 });
  assert.deepEqual(r.cards.map((c) => c.quote), ['one', 'two', 'three']);
  assert.equal(s.calls.synced.length, synced);
});

// ─── D65: the list's side of auto-add ───────────────────────────────────────

test('autoPlan: add, replace the card just added, the same words (anywhere) ignored, ten snippets full', () => {
  const cards = [tcard(1, 'Maps are models.'), icard(2), tcard(3, 'Scale bars')];
  const card = (q) => C.textCard(ID(9), { quote: q, pos: { block: 9, offset: 0 } });
  assert.deepEqual(C.autoPlan(cards, card('Contours'), null), { act: 'add' });
  assert.deepEqual(C.autoPlan(cards, card('Scale bars show'), ID(3)), { act: 'replace', index: 2 });
  assert.deepEqual(C.autoPlan(cards, card('Maps  are\nmodels.'), null), { act: 'same', n: 1 }, 'spacing aside, the same words');
  assert.deepEqual(C.autoPlan(cards, card('Scale bars'), ID(3)), { act: 'same', n: 3 }, 'stretched back to exactly the card: nothing');
  assert.deepEqual(C.autoPlan(cards, card('Maps are models.'), ID(3)), { act: 'same', n: 1 }, 'a replace into another card’s words: nothing');
  assert.deepEqual(C.autoPlan(cards, card('Contours'), ID(2)), { act: 'add' }, 'a picture is never replaced by words');
  assert.deepEqual(C.autoPlan(cards, card('Contours'), ID(8)), { act: 'add' }, 'the card was removed: a new one');
  const ten = Array.from({ length: 10 }, (_, i) => tcard(i));
  assert.deepEqual(C.autoPlan(ten, card('eleven'), null), { act: 'full' });
  assert.deepEqual(C.autoPlan(ten, card('quote 4 and more'), ID(4)), { act: 'replace', index: 4 }, 'a replace needs no room');
});

test('heddy-cards:auto from the page: the next card, the words left selected; then a replace keeps the place and number', async () => {
  const s = setup({ selection: SEL('Building scientific') });
  const r = await s.ask({ type: 'heddy-cards:auto', replace: null }, s.top);
  assert.deepEqual(r, { ok: true, act: 'add', id: UID(1), n: 1 });
  assert.deepEqual(s.calls.takes[0], [UID(1), true], 'take(id, keepSelection)');
  s.page.selection = SEL('two', 2);
  await s.ask({ type: 'heddy-cards:add-text' });
  assert.deepEqual(s.calls.takes[1], [UID(2), false], '+ Text clears the selection, as before');
  s.page.selection = SEL('Building scientific knowledge', 1);
  const re = await s.ask({ type: 'heddy-cards:auto', replace: UID(1) }, s.top);
  assert.deepEqual(re, { ok: true, act: 'replace', id: UID(3), n: 1 });
  const got = await s.ask({ type: 'heddy-cards:get' });
  assert.deepEqual(got.cards.map((c) => [c.quote, c.n]), [['Building scientific knowledge', 1], ['two', 2]]);
  assert.deepEqual(s.calls.synced.at(-1).map((c) => c.id), [UID(3), UID(2)], 'the page drops the old highlight, keeps the new');
});

test('heddy-cards:auto: the same words are ignored silently; nothing selected adds nothing', async () => {
  const s = setup({ selection: SEL('Maps are models.') });
  await s.ask({ type: 'heddy-cards:auto' }, s.top);
  s.page.selection = SEL('Maps are models.', 5, 2);
  const same = await s.ask({ type: 'heddy-cards:auto' }, s.top);
  assert.deepEqual([same.ok, same.error], [false, 'same']);
  assert.ok(s.calls.told.every((m) => !m.note), 'no line in the panel');
  s.page.selection = null;
  assert.equal((await s.ask({ type: 'heddy-cards:auto' }, s.top)).error, 'no_selection');
  assert.equal((await s.ask({ type: 'heddy-cards:get' })).cards.length, 1);
});

test('heddy-cards:auto at ten snippets: the panel is told it is full once, and again only after there was room', async () => {
  const s = setup();
  for (let i = 0; i < 10; i++) { s.page.selection = SEL(`snippet ${i}`, i); await s.ask({ type: 'heddy-cards:auto' }, s.top); }
  s.page.selection = SEL('the eleventh', 40);
  assert.equal((await s.ask({ type: 'heddy-cards:auto' }, s.top)).error, 'full_text');
  assert.equal(s.calls.told.at(-1).note, 'full_text');
  s.page.selection = SEL('a twelfth', 41);
  await s.ask({ type: 'heddy-cards:auto' }, s.top);
  assert.equal(s.calls.told.filter((m) => m.note === 'full_text').length, 1, 'once');
  await s.ask({ type: 'heddy-cards:remove', id: UID(1) });
  await s.ask({ type: 'heddy-cards:auto' }, s.top); // fills the tenth again
  s.page.selection = SEL('one more', 42);
  await s.ask({ type: 'heddy-cards:auto' }, s.top);
  assert.equal(s.calls.told.filter((m) => m.note === 'full_text').length, 2, 'told again after a ✕ made room');
});

test('heddy-cards:auto is the page’s own top frame only, never the panel or a subframe', async () => {
  const s = setup({ selection: SEL('words') });
  assert.deepEqual(await s.ask({ type: 'heddy-cards:auto' }), { ok: false }, 'from the panel');
  assert.deepEqual(await s.ask({ type: 'heddy-cards:auto' }, { ...s.top, frameId: 2 }), { ok: false }, 'a frame in the page');
  assert.equal(s.calls.takes.length, 0);
});

// ─── D65: the page's side (lib/auto-add.js) ─────────────────────────────────

test('the filters: 2+ characters that are not spaces, in the page, never in Heddy, an input, a text area or an editable area', () => {
  const ok = { text: 'ab', inHeddy: false, editable: false, activeTag: '' };
  assert.equal(A.acceptable(ok), true);
  assert.equal(A.acceptable({ ...ok, text: 'a' }), false, 'one character');
  assert.equal(A.acceptable({ ...ok, text: ' a \n ' }), false, 'one character among spaces');
  assert.equal(A.acceptable({ ...ok, text: 'a b' }), true);
  assert.equal(A.acceptable({ ...ok, text: '光合' }), true, 'two characters of Chinese');
  assert.equal(A.acceptable({ ...ok, inHeddy: true }), false);
  assert.equal(A.acceptable({ ...ok, editable: true }), false);
  for (const tag of ['INPUT', 'textarea', 'SELECT']) assert.equal(A.acceptable({ ...ok, activeTag: tag }), false, tag);
  assert.equal(A.acceptable({ ...ok, activeTag: 'A' }), true, 'a focused link is the page');
  assert.equal(A.acceptable(null), false);
});

test('placeOf: Heddy’s own hosts, inputs, text areas and contenteditable anywhere up the chain', () => {
  assert.deepEqual(A.placeOf([{ tag: 'SPAN' }, { tag: 'P' }, { tag: 'BODY' }]), { inHeddy: false, editable: false });
  assert.equal(A.placeOf([{ tag: 'B' }, { tag: 'HEDDY-TRAY' }]).inHeddy, true);
  for (const t of ['heddy-panel', 'HEDDY-BOX-MODE', 'HEDDY-CARDS', 'HEDDY-TOAST']) assert.equal(A.placeOf([{ tag: t }]).inHeddy, true, t);
  assert.equal(A.placeOf([{ tag: 'SPAN' }, { tag: 'DIV', editable: true }]).editable, true);
  assert.equal(A.placeOf([{ tag: 'TEXTAREA' }]).editable, true);
  assert.deepEqual(A.placeOf([]), { inHeddy: false, editable: false });
});

test('replaceTarget: within 5 s and overlapping the card just added, replace it; otherwise a new card', () => {
  const last = { id: ID(1), at: 10000 };
  assert.equal(A.replaceTarget(last, 10000, true), ID(1));
  assert.equal(A.replaceTarget(last, 15000, true), ID(1), 'at exactly 5 s');
  assert.equal(A.replaceTarget(last, 15001, true), null, 'after 5 s');
  assert.equal(A.replaceTarget(last, 12000, false), null, 'somewhere else on the page');
  assert.equal(A.replaceTarget(last, 9000, true), null, 'a clock that went back');
  assert.equal(A.replaceTarget(null, 10000, true), null, 'nothing auto-added yet');
  assert.equal(A.replaceTarget({ id: ID(1) }, 10000, true), null);
  assert.equal(A.STABLE_MS, 400);
  assert.equal(A.REPLACE_MS, 5000);
});

test('overlap: two ranges share words only when each starts before the other ends', () => {
  assert.equal(A.overlap(1, -1), true, 'overlapping');
  assert.equal(A.overlap(0, -1), false, 'the new one ends where the card starts');
  assert.equal(A.overlap(1, 0), false, 'the new one starts where the card ends');
  assert.equal(A.overlap(-1, -1), false, 'wholly before');
  assert.equal(A.overlap(1, 1), false, 'wholly after');
});

// ─── D65: the watcher in the page (content/panel.js), in a vm ───────────────

function watcher({ mode = 'text' } = {}) {
  const listeners = {};
  const timers = [];
  const got = [];
  let now = 1000;
  const text = (v) => ({ nodeType: 3, parentElement: { tagName: 'P', isContentEditable: false, parentElement: { tagName: 'BODY', parentElement: null } }, v });
  const sel = { range: null, text: '' };
  function el(tag) {
    return {
      tag, attrs: {}, style: { setProperty() {} }, children: [], classList: { add() {} },
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); return c; },
      attachShadow() { this.shadow = el('#shadow'); return this.shadow; }, remove() {},
      contentWindow: { postMessage() {} },
    };
  }
  const ctx = {
    location: { href: PAGE },
    URL,
    Date: { now: () => now },
    document: {
      createElement: el,
      documentElement: { appendChild: (c) => c },
      body: {},
      activeElement: null,
      addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
      removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((x) => x !== fn); },
    },
    addEventListener() {},
    removeEventListener() {},
    getSelection: () => (sel.range ? { rangeCount: 1, isCollapsed: false, getRangeAt: () => sel.range, toString: () => sel.text } : { rangeCount: 0, isCollapsed: true }),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: (i) => { if (timers[i - 1]) timers[i - 1].fn = () => {}; },
    setInterval: () => 1,
    clearInterval() {},
    requestAnimationFrame: (fn) => fn(),
    __heddyBoxMode: { mode: () => mode },
    __heddyCards: { overlaps: (id, r) => !!(r && r.overlapsLast) },
    chrome: {
      runtime: {
        id: 'heddy',
        getURL: (p) => `chrome-extension://heddy/${p}`,
        onMessage: { addListener: (fn) => { ctx.onMessage = fn; } },
        // Messages cross from the page's context: kept as plain JSON.
        sendMessage: async (m) => { got.push(JSON.parse(JSON.stringify(m))); return { ok: true, id: `auto-${got.length}` }; },
      },
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('lib/auto-add.js'), ctx);
  vm.runInContext(read('content/panel.js'), ctx);
  const node = text();
  return {
    ctx, sent: got, timers,
    open: () => new Promise((r) => ctx.onMessage({ type: 'heddy-panel:open', tabId: 7 }, { id: 'heddy' }, r)),
    close: () => new Promise((r) => {
      ctx.onMessage({ type: 'heddy-panel:close' }, { id: 'heddy' }, r);
      // The reply waits for a painted frame: run that wait.
      setImmediate(() => timers.filter((x) => x.ms === 30).forEach((x) => x.fn()));
    }),
    select(t, { start = 0, end = t.length, overlapsLast = false } = {}) {
      sel.text = t;
      sel.range = { startContainer: node, startOffset: start, endContainer: node, endOffset: end, overlapsLast, cloneRange() { return { ...this }; } };
    },
    clear() { sel.range = null; sel.text = ''; },
    release(type = 'pointerup', path = []) { (listeners[type] || []).forEach((fn) => fn({ composedPath: () => path })); },
    async settle() {
      const t = timers.filter((x) => x.ms === A.STABLE_MS).at(-1);
      if (t) { const fn = t.fn; t.fn = () => {}; fn(); }
      for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
    },
    later(ms) { now += ms; },
  };
}

test('watcher: a finished selection, still after 400 ms, is sent as heddy-cards:auto; a stretch within 5 s replaces it', async () => {
  const w = watcher();
  await w.open();
  w.select('Building scientific');
  w.release('pointerup');
  await w.settle();
  assert.deepEqual(w.sent, [{ type: 'heddy-cards:auto', replace: null }]);
  w.later(2000);
  w.select('Building scientific knowledge', { end: 29, overlapsLast: true });
  w.release('keyup');
  await w.settle();
  assert.deepEqual(w.sent[1], { type: 'heddy-cards:auto', replace: 'auto-1' }, 'shift+arrow: the card just added');
  w.later(6000);
  w.select('Building scientific knowledge and', { end: 33, overlapsLast: true });
  w.release();
  await w.settle();
  assert.deepEqual(w.sent[2], { type: 'heddy-cards:auto', replace: null }, 'after 5 s: a new card');
});

test('watcher: nothing while the selection still moves, in Heddy’s own UI, in an editable area, or when too short', async () => {
  const w = watcher();
  await w.open();
  w.select('first');
  w.release();
  w.select('first words', { end: 11 });
  await w.settle();
  assert.equal(w.sent.length, 0, 'it changed during the 400 ms');
  w.select('words');
  w.release('pointerup', [{ tagName: 'HEDDY-BOX-MODE' }]);
  await w.settle();
  assert.equal(w.sent.length, 0, 'a click in box mode’s bar');
  w.ctx.document.activeElement = { tagName: 'TEXTAREA' };
  w.release();
  await w.settle();
  assert.equal(w.sent.length, 0, 'typing in a text area');
  w.ctx.document.activeElement = null;
  w.select('a');
  w.release();
  await w.settle();
  assert.equal(w.sent.length, 0, 'one character');
  w.clear();
  w.release();
  await w.settle();
  assert.equal(w.sent.length, 0, 'nothing selected');
});

test('watcher: panel closed, nothing is collected; Picture mode, nothing either', async () => {
  const w = watcher();
  w.select('Building scientific');
  w.release();
  await w.settle();
  assert.equal(w.sent.length, 0, 'never opened');
  await w.open();
  await w.close();
  w.release();
  await w.settle();
  assert.equal(w.sent.length, 0, 'closed again');
  const p = watcher({ mode: 'picture' });
  await p.open();
  p.select('Building scientific');
  p.release();
  await p.settle();
  assert.equal(p.sent.length, 0, 'box mode is drawing');
});

test('PANEL_FILES load the rules before the watcher', () => {
  assert.deepEqual(load('./lib/panel.js').PANEL_FILES, ['lib/auto-add.js', 'content/panel.js']);
});

// ─── the panel (popup/popup.js): source pins ────────────────────────────────

const src = read('popup/popup.js');
const css = read('popup/popup.css');

test('each card has ⠿, ↑ and ↓ (named "Move up" and "Move down"), and Alt+↑ / Alt+↓ on a focused card', () => {
  assert.match(src, /var dh = el\('span', 'dh', '⠿'\);/);
  assert.match(src, /dh\.addEventListener\('pointerdown', function \(e\) \{ dragFrom\(e, row, card, row\.parentNode\); \}\);/);
  assert.match(src, /\[\['up', -1, 'cardMoveUp'\], \['down', 1, 'cardMoveDown'\]\]/);
  assert.match(src, /b\.setAttribute\('aria-label', tr\(m\[2\]\)\);/);
  assert.match(src, /if \(!e\.altKey \|\| \(e\.key !== 'ArrowUp' && e\.key !== 'ArrowDown'\) \|\| busyNow\(\)\) return;/);
  assert.match(src, /cardsCall\(\{ type: 'heddy-cards:move', id: card\.id, to: to \}, view\.tab\)/);
  assert.match(src, /var at = HeddyCards\.dropIndex\(mids, ev\.clientY\);/, 'the drag lands by the shared rule');
  assert.match(css, /\.dh \{[^}]*touch-action: none;/, 'a pointer drag, not the page’s scroll');
  assert.deepEqual([en.cardMoveUp.message, en.cardMoveDown.message], ['Move up', 'Move down']);
  assert.deepEqual([zh.cardMoveUp.message, zh.cardMoveDown.message], ['上移', '下移']);
});

test('the panel’s + Text / + Picture is the switch: the mode that is on is pressed, and it follows the page', () => {
  assert.match(src, /addText\.setAttribute\('aria-pressed', String\(!picture\)\);/);
  assert.match(src, /addPic\.setAttribute\('aria-pressed', String\(picture\)\);/);
  assert.match(src, /if \(view\.mode === 'picture'\) return toTextMode\(tab\);/, '+ Text in Picture mode switches back');
  assert.match(src, /if \(b && b\.stop\) b\.stop\(\);/);
  assert.match(src, /if \(e\.data\.heddyPanel === 'mode'\) setMode\(/);
  assert.match(css, /\.adds button\[aria-pressed="true"\]/);
});

test('the empty list says selecting words adds them; a full list is said once, from the background’s note', () => {
  assert.match(src, /if \(!cards\.length && !picture\) body\.appendChild\(el\('p', 'fine hint', tr\('cardsEmptyHint'\)\)\);/);
  assert.match(src, /if \(note === 'full_text' && view\.err\) fail\(view\.err, 'cardsFullText'\);/);
  assert.equal(en.cardsEmptyHint.message, 'Select words on the page: each one is added here.');
  assert.doesNotMatch(en.cardsSelectFirst.message, /then tap/, 'no longer "then tap + Text"');
});

test('the old D55 "no reordering" is gone from the cards’ notes', () => {
  assert.doesNotMatch(read('lib/cards.js'), /There is no reordering/);
});

// ─── strings and version ────────────────────────────────────────────────────

test('every Round 7 string exists in both languages, the English free of Chinese', () => {
  const keys = ['modeSwitchLabel', 'modeText', 'modePicture', 'textModeLine', 'cardMoveUp', 'cardMoveDown', 'cardDrag', 'cardsEmptyHint'];
  for (const k of keys) {
    assert.ok(en[k] && en[k].message, `en ${k}`);
    assert.ok(zh[k] && zh[k].message, `zh_CN ${k}`);
    assert.doesNotMatch(en[k].message, /[　-鿿]/, k);
  }
});

test('the version is 0.4.0', () => {
  assert.equal(manifest().version, '0.4.0');
});
