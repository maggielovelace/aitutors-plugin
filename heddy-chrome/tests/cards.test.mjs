// The panel's numbered cards and Save to Jotters (Round 5: D54, D55, D58).
// The limits (10 snippets, 4 pictures, one page), the heddy:save message
// against the shared contract, and the background's list: kept per tab in
// storage.session, cleared by another page, numbers sent to the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
globalThis.HeddyTools = load('./lib/tools.js');
globalThis.HeddyPos = load('./lib/pos.js');
const K = globalThis.HeddyCrop;
const C = load('./lib/cards.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PAGE = 'https://www.sparxscience.com/home';
const PNG = K.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));
const BOX = { kind: 'web', vw: 1280, vh: 800, x: 200, y: 166, w: 270, h: 136 };

// ─── the contract's message ─────────────────────────────────────────────────

const text = (quote = 'Building scientific knowledge', pos = { block: 1, offset: 0 }) => ({ kind: 'text', quote, before: 'Before.', after: 'After.', pos });
const image = (pos = { block: 2, offset: 0 }) => ({ kind: 'image', png: PNG, box: BOX, before: 'A scale bar', after: 'Next words', pos });

test('heddy:save is exactly {v, cid, type, url, title, then, items}, items in the panel’s order', () => {
  const m = C.buildSave({ cid: CID, url: PAGE + '#top', title: '  Sparx  Science – Home ', then: 'save', items: [text(), image(), { kind: 'page', markdown: '# Hi' }] });
  assert.deepEqual(Object.keys(m), ['v', 'cid', 'type', 'url', 'title', 'then', 'items']);
  assert.equal(m.v, 1);
  assert.equal(m.type, 'heddy:save');
  assert.equal(m.url, PAGE, 'without its #fragment');
  assert.equal(m.title, 'Sparx Science – Home');
  assert.deepEqual(m.items.map((i) => i.kind), ['text', 'image', 'page']);
  assert.deepEqual(Object.keys(m.items[0]), ['kind', 'quote', 'before', 'after', 'pos']);
  assert.deepEqual(Object.keys(m.items[1]), ['kind', 'png', 'box', 'before', 'after', 'pos']);
  assert.deepEqual(Object.keys(m.items[2]), ['kind', 'markdown']);
  assert.deepEqual(m.items[0].pos, { block: 1, offset: 0 });
  assert.deepEqual(m.items[1].box, BOX);
});

test('then is "save" or "jot", nothing else', () => {
  assert.equal(C.buildSave({ cid: CID, url: PAGE, title: '', then: 'jot', items: [text()] }).then, 'jot');
  for (const then of ['keep', '', undefined, 'JOT']) assert.throws(() => C.buildSave({ cid: CID, url: PAGE, title: '', then, items: [text()] }), String(then));
});

test('a quote is at most 4000 characters, keeps its line breaks; before and after at most 300, cut away from the quote', () => {
  const m = C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [{ kind: 'text', quote: ' line one\nline\u0007 two ' + 'x'.repeat(5000), before: 'b'.repeat(400) + 'END', after: 'START' + 'a'.repeat(400), pos: { block: 0, offset: 3 } }] });
  const it = m.items[0];
  assert.equal(it.quote.length, 4000);
  assert.ok(it.quote.startsWith('line one\nline two'), 'control characters out, the line break kept, trimmed');
  assert.equal(it.before.length, 300);
  assert.ok(it.before.endsWith('END'), 'the words next to the quote are kept');
  assert.equal(it.after.length, 300);
  assert.ok(it.after.startsWith('START'));
});

test('a page item is cut past 200 KB of UTF-8, and says cut: true', () => {
  const big = ('A paragraph of words. '.repeat(40) + '\n\n').repeat(400);
  const m = C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [{ kind: 'page', markdown: big }] });
  assert.equal(m.items[0].cut, true);
  assert.ok(globalThis.HeddyProtocol.utf8Bytes(m.items[0].markdown) <= 200 * 1024);
  assert.throws(() => C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [{ kind: 'page', markdown: '   ' }] }), /empty/);
});

test('at most 10 text, 4 image and 1 page item; none at all is refused', () => {
  const ten = Array.from({ length: 10 }, (_, i) => text(`q${i}`, { block: i, offset: 0 }));
  const four = Array.from({ length: 4 }, () => image());
  assert.equal(C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [...ten, ...four, { kind: 'page', markdown: 'x' }] }).items.length, 15);
  assert.throws(() => C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [...ten, text('eleven')] }), /too many/);
  assert.throws(() => C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [...four, image()] }), /too many/);
  assert.throws(() => C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [{ kind: 'page', markdown: 'a' }, { kind: 'page', markdown: 'b' }] }), /too many/);
  assert.throws(() => C.buildSave({ cid: CID, url: PAGE, title: '', then: 'save', items: [] }), /empty/);
});

test('anything the site would refuse throws: a bad cid, url, pos, picture or kind', () => {
  const ok = { cid: CID, url: PAGE, title: '', then: 'save' };
  assert.throws(() => C.buildSave({ ...ok, cid: 'nope', items: [text()] }));
  assert.throws(() => C.buildSave({ ...ok, url: 'chrome://extensions', items: [text()] }));
  assert.throws(() => C.buildSave({ ...ok, items: [text('q', { block: -1, offset: 0 })] }), /bad pos/);
  assert.throws(() => C.buildSave({ ...ok, items: [text('q', { block: 1 })] }), /bad pos/);
  assert.throws(() => C.buildSave({ ...ok, items: [text('   ')] }), /no quote/);
  assert.throws(() => C.buildSave({ ...ok, items: [{ ...image(), png: 'data:image/png;base64,' + PNG }] }), /bad image/);
  assert.throws(() => C.buildSave({ ...ok, items: [{ ...image(), box: { ...BOX, kind: 'yt' } }] }), /bad image/);
  assert.throws(() => C.buildSave({ ...ok, items: [{ kind: 'video' }] }), /bad kind/);
});

// ─── the list's rules ───────────────────────────────────────────────────────

const ID = (n) => `card-${String(n).padStart(4, '0')}`;
const tcard = (n, quote = `quote ${n}`) => C.textCard(ID(n), { quote, before: '', after: '', pos: { block: n, offset: 0 } });
const icard = (n) => C.imageCard(ID(n), { png: PNG, box: BOX }, { pos: { block: n, offset: 0 }, page: { x: 10, y: 400 + n, w: 200, h: 100 }, before: 'cap', after: '' });

test('room: up to 10 snippets and, separately, 4 pictures', () => {
  const cards = [];
  for (let i = 0; i < 10; i++) { assert.ok(C.room(cards, 'text')); cards.push(tcard(i)); }
  assert.equal(C.room(cards, 'text'), false, 'the 11th snippet');
  for (let i = 10; i < 14; i++) { assert.ok(C.room(cards, 'image')); cards.push(icard(i)); }
  assert.equal(C.room(cards, 'image'), false, 'the 5th picture');
  assert.deepEqual(C.counts(cards), { text: 10, image: 4 });
  assert.equal(C.room(cards, 'page'), false);
});

test('one numbered list: a card’s number is its place, text and pictures together; removing one renumbers the rest', () => {
  const cards = [tcard(1), icard(2), tcard(3)];
  assert.deepEqual(C.marks(cards), [
    { id: ID(1), n: 1, kind: 'text' },
    { id: ID(2), n: 2, kind: 'image', rect: { x: 10, y: 402, w: 200, h: 100 } },
    { id: ID(3), n: 3, kind: 'text' },
  ]);
  const after = cards.filter((c) => c.id !== ID(2));
  assert.deepEqual(C.forPanel(after), [{ id: ID(1), n: 1, kind: 'text', quote: 'quote 1' }, { id: ID(3), n: 2, kind: 'text', quote: 'quote 3' }]);
  assert.equal(C.numberOf(after, ID(3)), 2);
});

test('the same words in the same place are one card, not two', () => {
  const cards = [tcard(1, 'Maps are models.')];
  assert.equal(C.sameText(cards, tcard(9, 'Maps are models.')), 0, 'same words, another place: a new card');
  assert.equal(C.sameText(cards, C.textCard(ID(9), { quote: 'Maps are models.', pos: { block: 1, offset: 0 } })), 1);
});

test('a card with no words, no pos, or a bad id is no card', () => {
  assert.equal(C.textCard(ID(1), { quote: '  ', pos: { block: 0, offset: 0 } }), null);
  assert.equal(C.textCard(ID(1), { quote: 'q' }), null);
  assert.equal(C.textCard('NOT AN ID', { quote: 'q', pos: { block: 0, offset: 0 } }), null);
  assert.equal(C.imageCard(ID(1), { png: 'nope', box: BOX }, { pos: { block: 0, offset: 0 }, page: { x: 0, y: 0, w: 9, h: 9 } }), null);
  assert.equal(C.imageCard(ID(1), { png: PNG, box: BOX }, { pos: { block: 0, offset: 0 } }), null, 'no page rect to draw');
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

function setup({ session = fakeSession(), selection = null, markdown = '# The page' } = {}) {
  const calls = { injected: [], synced: [], told: [], opened: [], tools: [], captures: [], lines: [] };
  const tab = { id: 7, windowId: 3, url: PAGE + '#top', title: 'Sparx Science – Home' };
  let n = 0;
  const page = { selection };
  const chrome = {
    runtime: { id: 'heddy', sendMessage: async (m) => { calls.told.push(m); } },
    storage: { session },
    tabs: { get: async (id) => ({ ...tab, id }) },
    scripting: {
      executeScript: async (o) => {
        if (o.files) { calls.injected.push(o.files); return []; }
        if (o.func.name === 'takeInPage') return [{ result: page.selection && { ...page.selection, url: tab.url } }];
        if (o.func.name === 'syncInPage') { calls.synced.push(o.args[0]); return [{ result: true }]; }
        if (o.func.name === 'extractInPage') return [{ result: { markdown } }];
        return [];
      },
    },
  };
  const cards = C.createCards({
    chrome,
    randomUUID: () => `c0ffee00-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    pageFiles: ['lib/pos.js', 'content/cards-layer.js'],
    capture: async (t, rect, vw, vh) => {
      calls.captures.push({ tabId: t.id, rect });
      if (!(rect.w >= 24 && rect.h >= 24)) throw new Error('too_small');
      return { png: PNG, box: K.webBox(rect, vw, vh) };
    },
    openCapture: async (spec) => { calls.opened.push({ spec, payload: spec.build(CID) }); return { ok: true, cid: CID }; },
    sender: { tool: async (input, where) => { calls.tools.push({ input, where }); return { ok: true }; } },
    droppedText: async () => 'The page changed, so the cards you collected were cleared.',
    showLine: async (tabId, t) => { calls.lines.push({ tabId, t }); },
    showPanel: async (t) => { calls.shown = (calls.shown || []).concat(t.id); },
  });
  const panel = { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html?tab=7&host=panel', tab, frameId: 4 };
  const box = { id: 'heddy', url: tab.url, tab, frameId: 0 };
  const ask = (m, from = panel) => cards.internal({ tabId: 7, ...m }, from);
  return { cards, calls, tab, page, panel, box, ask, session };
}

const SEL = (quote, block = 1, offset = 0) => ({ quote, before: 'Words before.', after: 'Words after.', pos: { block, offset }, title: 'Sparx Science – Home' });
const keepBox = (s, y = 150) => s.ask({ type: 'heddy-box:keep', rect: { x: 300, y, w: 300, h: 104 }, vw: 1280, vh: 800, page: { x: 300, y: y + 900, w: 300, h: 104 }, pos: { block: 2, offset: 0 }, before: 'A scale bar', after: 'Next' }, s.box);

test('+ Text: the words selected in the page become the next card; the page is told the numbers, the panel to redraw', async () => {
  const s = setup({ selection: SEL('Building scientific knowledge and understanding') });
  const r = await s.ask({ type: 'heddy-cards:add-text' });
  assert.equal(r.ok, true);
  assert.equal(r.n, 1);
  assert.deepEqual(r.cards, [{ id: 'c0ffee00-0000-4000-8000-000000000001', n: 1, kind: 'text', quote: 'Building scientific knowledge and understanding' }]);
  assert.deepEqual(r.counts, { text: 1, image: 0 });
  assert.deepEqual(s.calls.injected[0], ['lib/pos.js', 'content/cards-layer.js'], 'the page’s files first (activeTab)');
  assert.deepEqual(s.calls.synced.at(-1), [{ id: 'c0ffee00-0000-4000-8000-000000000001', n: 1, kind: 'text' }]);
  assert.deepEqual(s.calls.told.at(-1), { type: 'heddy-cards:changed', tabId: 7 });
});

test('+ Text with nothing selected, the same words again, or an 11th snippet: no card, and the panel says why', async () => {
  const s = setup();
  assert.equal((await s.ask({ type: 'heddy-cards:add-text' })).error, 'no_selection');
  s.page.selection = SEL('Maps are models.');
  await s.ask({ type: 'heddy-cards:add-text' });
  const again = await s.ask({ type: 'heddy-cards:add-text' });
  assert.deepEqual([again.ok, again.error, again.n], [false, 'same', 1]);
  assert.deepEqual(s.calls.synced.at(-1).map((c) => c.n), [1], 'the refused card’s highlight is dropped by the sync');
  for (let i = 0; i < 9; i++) { s.page.selection = SEL(`snippet ${i}`, 10 + i); assert.equal((await s.ask({ type: 'heddy-cards:add-text' })).ok, true); }
  s.page.selection = SEL('the eleventh', 40);
  const full = await s.ask({ type: 'heddy-cards:add-text' });
  assert.deepEqual([full.ok, full.error, full.cards.length], [false, 'full_text', 10]);
});

test('box mode’s + Picture: the box is cut, and it is the next numbered card after the snippets; a 5th picture is refused', async () => {
  const s = setup({ selection: SEL('one') });
  await s.ask({ type: 'heddy-cards:add-text' });
  const r = await keepBox(s);
  assert.deepEqual([r.ok, r.n], [true, 2]);
  assert.deepEqual(s.calls.captures[0], { tabId: 7, rect: { x: 300, y: 150, w: 300, h: 104 } });
  assert.deepEqual(s.calls.synced.at(-1)[1], { id: r.id, n: 2, kind: 'image', rect: { x: 300, y: 1050, w: 300, h: 104 } }, 'the green outline, in page coordinates');
  for (let i = 0; i < 3; i++) assert.equal((await keepBox(s)).ok, true);
  const full = await keepBox(s);
  assert.deepEqual([full.ok, full.error], [false, 'full_images']);
  assert.equal(s.calls.captures.length, 4, 'no fifth screenshot');
  const small = setup();
  assert.equal((await small.ask({ type: 'heddy-box:keep', rect: { x: 0, y: 0, w: 20, h: 300 }, vw: 1280, vh: 800, page: { x: 0, y: 0, w: 20, h: 300 }, pos: { block: 0, offset: 0 } }, small.box)).error, 'too_small');
});

test('✕ removes a card and the rest renumber, on the page too', async () => {
  const s = setup({ selection: SEL('one', 1) });
  await s.ask({ type: 'heddy-cards:add-text' });
  s.page.selection = SEL('two', 2);
  await s.ask({ type: 'heddy-cards:add-text' });
  const r = await s.ask({ type: 'heddy-cards:remove', id: 'c0ffee00-0000-4000-8000-000000000001' });
  assert.deepEqual(r.cards.map((c) => [c.quote, c.n]), [['two', 1]]);
  assert.deepEqual(s.calls.synced.at(-1), [{ id: 'c0ffee00-0000-4000-8000-000000000002', n: 1, kind: 'text' }]);
});

test('Save to Jotters: one heddy:save to /capture/save in a window, every card in the panel’s order, the card ids kept for the result', async () => {
  const s = setup({ selection: SEL('one', 3, 7) });
  await s.ask({ type: 'heddy-cards:add-text' });
  await keepBox(s);
  assert.equal((await s.ask({ type: 'heddy-cards:save', then: 'save' })).ok, true);
  const { spec, payload } = s.calls.opened[0];
  assert.equal(spec.page, 'save');
  assert.equal(spec.kind, 'save');
  assert.equal(spec.asTab, undefined, 'a window, which the site closes');
  assert.equal(spec.meta.then, 'save');
  assert.deepEqual(spec.meta.cards, ['c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000002']);
  assert.equal(payload.type, 'heddy:save');
  assert.equal(payload.url, PAGE);
  assert.equal(payload.title, 'Sparx Science – Home');
  assert.deepEqual(payload.items.map((i) => [i.kind, i.pos]), [['text', { block: 3, offset: 7 }], ['image', { block: 2, offset: 0 }]]);
  assert.deepEqual(payload.items[0], { kind: 'text', quote: 'one', before: 'Words before.', after: 'Words after.', pos: { block: 3, offset: 7 } });
  assert.equal(payload.items[1].before, 'A scale bar');
});

test('Save and jot now: then "jot", in a tab beside the page, which the site turns into the notebook', async () => {
  const s = setup({ selection: SEL('one') });
  await s.ask({ type: 'heddy-cards:add-text' });
  await s.ask({ type: 'heddy-cards:save', then: 'jot' });
  const { spec, payload } = s.calls.opened[0];
  assert.equal(payload.then, 'jot');
  assert.equal(spec.asTab, 7);
  assert.equal(spec.meta.then, 'jot');
});

test('Save page to Jotters: a page item, alone with no card, or after the cards with “Save the whole page too”', async () => {
  const s = setup({ markdown: '# Building scientific knowledge\n\nWords.' });
  await s.ask({ type: 'heddy-cards:save', then: 'save', page: true });
  assert.deepEqual(s.calls.opened[0].payload.items, [{ kind: 'page', markdown: '# Building scientific knowledge\n\nWords.' }]);
  s.page.selection = SEL('one');
  await s.ask({ type: 'heddy-cards:add-text' });
  await s.ask({ type: 'heddy-cards:save', then: 'save', page: true });
  assert.deepEqual(s.calls.opened[1].payload.items.map((i) => i.kind), ['text', 'page']);
  const empty = setup({ markdown: '   ' });
  assert.deepEqual(await empty.ask({ type: 'heddy-cards:save', then: 'save', page: true }), { ok: false, error: 'empty' });
  assert.deepEqual(await empty.ask({ type: 'heddy-cards:save', then: 'save' }), { ok: false, error: 'empty' }, 'nothing to save');
  assert.equal(empty.calls.opened.length, 0);
});

test('the site saved: the cards that save carried leave the list, any added since stay', async () => {
  const s = setup({ selection: SEL('one', 1) });
  await s.ask({ type: 'heddy-cards:add-text' });
  await s.ask({ type: 'heddy-cards:save', then: 'save' });
  s.page.selection = SEL('added while the window was open', 2);
  await s.ask({ type: 'heddy-cards:add-text' });
  await s.cards.saved(s.calls.opened[0].spec.meta);
  const r = await s.ask({ type: 'heddy-cards:get' });
  assert.deepEqual(r.cards.map((c) => [c.quote, c.n]), [['added while the window was open', 1]]);
  assert.deepEqual(s.calls.synced.at(-1).map((c) => c.n), [1]);
});

test('the crop bar no longer saves (D64): heddy-box:save is not the cards’ message any more', async () => {
  const s = setup({ selection: SEL('one') });
  await s.ask({ type: 'heddy-cards:add-text' });
  assert.equal(await s.ask({ type: 'heddy-box:save', box: null }, s.box), undefined);
  assert.equal(s.calls.opened.length, 0);
});

test('Explain · Make a card · Ask Heddy act on card 1: words as words, a picture as a picture', async () => {
  const s = setup({ selection: SEL('Maps are models.') });
  await s.ask({ type: 'heddy-cards:add-text' });
  await keepBox(s);
  await s.ask({ type: 'heddy-cards:tool', tool: 'explain' });
  assert.deepEqual(s.calls.tools[0].input, { tool: 'explain', url: s.tab.url, title: s.tab.title, quote: 'Maps are models.', context: 'Words before. … Words after.' });
  assert.deepEqual(s.calls.tools[0].where, { tabId: 7, windowId: 3 });
  const p = setup();
  await keepBox(p);
  await p.ask({ type: 'heddy-cards:tool', tool: 'card' });
  assert.equal(p.calls.tools[0].input.quote, '');
  assert.equal(p.calls.tools[0].input.images.length, 1);
  assert.deepEqual(await p.ask({ type: 'heddy-cards:tool', tool: 'delete-everything' }), { ok: false });
});

test('the Heddy ▾ menu on the box being drawn cuts it and keeps nothing; with no box, the last picture kept', async () => {
  const s = setup();
  await s.ask({ type: 'heddy-box:tool', tool: 'ask', box: { rect: { x: 0, y: 0, w: 100, h: 100 }, vw: 1280, vh: 800, context: 'cap' } }, s.box);
  assert.equal(s.calls.tools[0].input.images.length, 1);
  assert.equal((await s.ask({ type: 'heddy-cards:get' })).cards.length, 0, 'nothing kept');
  const k = await keepBox(s);
  await s.ask({ type: 'heddy-box:tool', tool: 'explain', cardId: k.id }, s.box);
  assert.equal(s.calls.tools[1].input.tool, 'explain');
  assert.equal(s.calls.tools[1].input.context, 'A scale bar');
});

test('going to another page clears the list (a #fragment is the same page), and the new page says so once it loads', async () => {
  const s = setup({ selection: SEL('one') });
  await s.ask({ type: 'heddy-cards:add-text' });
  await s.cards.tabUpdated(7, { url: PAGE + '#further' });
  assert.equal((await s.ask({ type: 'heddy-cards:get' })).cards.length, 1, 'a #fragment');
  await s.cards.tabUpdated(7, { url: 'https://www.sparxscience.com/other' });
  assert.deepEqual(s.session.data, {});
  await s.cards.tabUpdated(7, { status: 'complete' });
  assert.deepEqual(s.calls.lines, [{ tabId: 7, t: 'The page changed, so the cards you collected were cleared.' }]);
  // nothing collected: nothing said
  const t = setup();
  await t.cards.tabUpdated(7, { url: 'https://x.example/' });
  await t.cards.tabUpdated(7, { status: 'complete' });
  assert.deepEqual(t.calls.lines, []);
});

test('a list kept for another address is not this page’s: reading it starts empty', async () => {
  const session = fakeSession({ 'heddyCards:7': { url: 'https://elsewhere.example/', title: 'x', cards: [{ id: ID(1), kind: 'text', quote: 'old', before: '', after: '', pos: { block: 0, offset: 0 } }] } });
  const s = setup({ session });
  assert.deepEqual((await s.ask({ type: 'heddy-cards:get' })).cards, []);
});

test('the list lives in storage.session under the tab, so a worker restart loses nothing; closing the tab clears it', async () => {
  const session = fakeSession();
  const before = setup({ session, selection: SEL('one') });
  await before.ask({ type: 'heddy-cards:add-text' });
  await keepBox(before);
  assert.deepEqual(Object.keys(session.data), [`${C.KEY_PREFIX}7`]);
  const after = setup({ session });
  assert.deepEqual((await after.ask({ type: 'heddy-cards:get' })).counts, { text: 1, image: 1 });
  await after.cards.tabGone(7);
  assert.deepEqual(session.data, {});
});

test('who may ask: the panel (Heddy’s own page) names its tab; box mode is the page’s top frame; nobody else', async () => {
  const s = setup({ selection: SEL('one') });
  assert.deepEqual(await s.ask({ type: 'heddy-cards:add-text' }, s.box), { ok: false }, 'a page cannot add words itself');
  assert.deepEqual(await s.ask({ type: 'heddy-box:keep' }, s.panel), { ok: false });
  assert.deepEqual(await s.ask({ type: 'heddy-box:keep' }, { ...s.box, frameId: 2 }), { ok: false }, 'not from a frame');
  assert.equal(s.cards.internal({ type: 'heddy-cards:get', tabId: 7 }, { ...s.panel, id: 'another-extension' }), undefined);
  assert.equal(s.cards.internal({ type: 'heddy-ui:capture' }, s.panel), undefined, 'not the cards’');
  const blocked = setup();
  blocked.tab.url = 'chrome://extensions/';
  assert.deepEqual(await blocked.ask({ type: 'heddy-cards:get' }), { ok: false });
});

test('"Save to Jotters" on a selection and the tray’s + Add collect: the words become a card, then the panel opens on it; nothing is saved', async () => {
  const s = setup({ selection: SEL('Maps are models.') });
  const r = await s.ask({ type: 'heddy-cards:collect' }, s.box);
  assert.deepEqual([r.ok, r.n], [true, 1]);
  assert.deepEqual(s.calls.shown, [7]);
  assert.equal(s.calls.opened.length, 0, 'no capture window');
  s.page.selection = null;
  const none = await s.cards.collect(s.tab);
  assert.equal(none.error, 'no_selection');
  assert.deepEqual(s.calls.shown, [7, 7], 'the panel still opens, on the cards so far');
  assert.deepEqual(await s.ask({ type: 'heddy-cards:collect' }, s.panel), { ok: false }, 'the page asks, not the panel');
});

test('no path a child can tap builds heddy:jot or heddy:box any more (the site keeps accepting both from older installs)', async () => {
  const { shippedFiles, read: r } = await import('./helpers.mjs');
  for (const f of shippedFiles().filter((x) => /\.js$/.test(x) && x !== 'lib/protocol.js' && x !== 'lib/tools.js')) {
    const src = r(f);
    assert.doesNotMatch(src, /\bbuildJot\(|\bbuildBox\(|sender\.box\(|type: 'heddy-ui:jot'/, f);
  }
  const tools = r('lib/tools.js');
  assert.doesNotMatch(tools.slice(tools.indexOf('function createSender')), /buildBox\(/, 'the sender has no box');
});
