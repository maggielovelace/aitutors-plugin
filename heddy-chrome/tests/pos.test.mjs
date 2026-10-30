// pos (the Round 5 contract, D54): where a saved snippet or picture sat on its
// page, so the site can draw the left page in the page's own order. Driven
// with a tiny DOM-like tree, as tests/extract.test.mjs is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const POS = load('./lib/pos.js');

function h(tag, attrs, ...children) {
  const el = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    attrs: attrs || {},
    childNodes: [],
    parentNode: null,
    get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(''); },
  };
  for (const c of children.flat()) {
    const node = typeof c === 'string' ? { nodeType: 3, nodeValue: c, parentNode: el } : c;
    node.parentNode = el;
    el.childNodes.push(node);
  }
  return el;
}

/** The text node that is exactly `needle`, else the first holding it (depth first). */
function textNode(root, needle) {
  const all = [];
  (function walk(n) { for (const c of n.childNodes) { if (c.nodeType === 3) all.push(c); else if (c.nodeType === 1) walk(c); } })(root);
  return all.find((c) => c.nodeValue === needle) || all.find((c) => c.nodeValue.includes(needle)) || null;
}

/** pos of the first character of `needle`, as a Range starting there would give it. */
function posOf(root, needle, lead) {
  const n = textNode(root, needle);
  assert.ok(n, `no text node with ${needle}`);
  return POS.textPos(root, n, n.nodeValue.indexOf(needle), lead);
}

function article() {
  return h('body', {},
    h('header', {}, h('p', {}, 'Sparx Science — Schools · Parents')),
    h('nav', {}, h('ul', {}, h('li', {}, 'Home'), h('li', {}, 'Students'))),
    h('div', { id: 'main' },
      h('h1', {}, 'Building scientific knowledge'),                                   // 0
      h('p', {}, 'Building ', h('em', {}, 'scientific ', h('b', {}, 'knowledge')), ' through homework.'), // 1
      h('img', { src: 'a.png' }),
      h('p', {}, 'Questions that promote understanding. Our bank of 23,000 questions.'), // 2
      h('aside', {}, h('p', {}, 'Sign up for our newsletter')),
      h('figure', {}, h('img', { src: 'b.png' }), h('figcaption', {}, 'A scale bar')),    // 3
      h('ul', {}, h('li', {}, h('p', {}, 'Ratio')), h('li', {}, 'Words')),                 // 4 li, 5 p, 6 li
      h('blockquote', {}, h('p', {}, 'Maps are models.')),                                 // 7 blockquote, 8 p
      h('table', {}, h('tr', {}, h('td', {}, '1:50 000'), h('td', {}, '   '))),            // 9 td (the blank td is no block)
      h('p', {}, '   '),
      h('script', {}, 'var p = "<p>not a block</p>";'),
      h('pre', {}, 'cm × 50 000')),                                                         // 10
    h('footer', {}, h('p', {}, 'Copyright')));
}

test('text blocks: p, li, h1–h6, blockquote, pre, td, figcaption and dd with words, in reading order', () => {
  const names = POS.textBlocks(article()).map((b) => `${b.nodeName}:${b.textContent.trim().slice(0, 12)}`);
  assert.deepEqual(names, [
    'H1:Building sci', 'P:Building sci', 'P:Questions th', 'FIGCAPTION:A scale bar',
    'LI:Ratio', 'P:Ratio', 'LI:Words', 'BLOCKQUOTE:Maps are mod', 'P:Maps are mod', 'TD:1:50 000', 'PRE:cm × 50 000',
  ]);
});

test('nav, header, footer, aside, script and style hold no text block, however deep', () => {
  const text = POS.textBlocks(article()).map((b) => b.textContent).join('|');
  for (const gone of ['Sparx Science', 'Home', 'Students', 'newsletter', 'Copyright', 'not a block']) assert.ok(!text.includes(gone), gone);
});

test('a block with only white space is not a block, so it moves no index', () => {
  const body = h('body', {}, h('p', {}, '  '), h('p', {}, 'one'), h('td', {}, '\n\t'), h('p', {}, 'two'));
  assert.deepEqual(POS.textBlocks(body).map((b) => b.textContent), ['one', 'two']);
  assert.deepEqual(posOf(body, 'two'), { block: 1, offset: 0 });
});

test('offset counts the block’s textContent across nested inline elements', () => {
  const a = article();
  assert.deepEqual(posOf(a, 'knowledge'), { block: 1, offset: 'Building scientific '.length });
  assert.deepEqual(posOf(a, 'scientific '), { block: 1, offset: 'Building '.length });
  assert.deepEqual(posOf(a, ' through'), { block: 1, offset: 'Building scientific knowledge'.length });
  assert.deepEqual(posOf(a, 'Our bank'), { block: 2, offset: 'Questions that promote understanding. '.length });
});

test('a picture between two blocks moves no index: the block after it is still the next number', () => {
  const a = article();
  assert.equal(posOf(a, 'Questions').block, 2);
  assert.equal(posOf(a, 'A scale bar').block, 3);
});

test('words belong to the innermost block: li › p, blockquote › p', () => {
  const a = article();
  assert.deepEqual(posOf(a, 'Ratio'), { block: 5, offset: 0 });
  assert.deepEqual(posOf(a, 'Words'), { block: 6, offset: 0 });
  assert.deepEqual(posOf(a, 'models'), { block: 8, offset: 'Maps are '.length });
  assert.deepEqual(posOf(a, '50 000'), { block: 9, offset: 2 });
});

test('the offset of a selection that starts with white space moves past it, inside the block', () => {
  const a = article();
  assert.deepEqual(posOf(a, ' through', 1), { block: 1, offset: 'Building scientific knowledge '.length });
  const p = POS.textBlocks(a)[2];
  const n = textNode(a, 'Questions');
  assert.equal(POS.textPos(a, n, n.nodeValue.length - 2, 999).offset, p.textContent.length, 'never past the block’s end');
});

test('words that start outside every block (a nav, loose text in a div) take the next block, at 0', () => {
  const a = article();
  assert.deepEqual(posOf(a, 'Students'), { block: 0, offset: 0 }, 'in the nav, before the first block');
  assert.deepEqual(posOf(a, 'newsletter'), { block: 3, offset: 0 }, 'in an aside: the figcaption after it');
  const loose = h('body', {}, h('p', {}, 'First.'), h('div', {}, 'Loose words'), h('p', {}, 'Second.'));
  assert.deepEqual(posOf(loose, 'Loose'), { block: 1, offset: 0 });
  const tail = h('body', {}, h('p', {}, 'Only.'), h('div', {}, 'After every block'));
  assert.deepEqual(posOf(tail, 'After'), { block: 0, offset: 0 }, 'past the last block: the last block');
});

test('a Range starting on an element (a child index) is placed like the text it is before', () => {
  const a = article();
  const p = POS.textBlocks(a)[1];
  assert.deepEqual(POS.textPos(a, p, 1), { block: 1, offset: 'Building '.length }, 'before the <em>');
  assert.deepEqual(POS.textPos(a, p, 0), { block: 1, offset: 0 });
  assert.deepEqual(POS.textPos(a, p, p.childNodes.length), { block: 1, offset: p.textContent.length });
});

test('a page with no text block gives 0, 0; a node not in the page gives block 0', () => {
  const bare = h('body', {}, h('div', {}, 'Only a div.'));
  assert.deepEqual(posOf(bare, 'Only'), { block: 0, offset: 0 });
  const a = article();
  assert.deepEqual(POS.textPos(a, { nodeType: 3, nodeValue: 'elsewhere' }, 0), { block: 0, offset: 0 });
});

test('a picture: the last block (in reading order) whose top is above the box’s top edge, offset 0', () => {
  const tops = [100, 180, 400, 620, 900];
  assert.equal(POS.imageBlock(tops, 300), 1);
  assert.equal(POS.imageBlock(tops, 400), 1, 'a block starting exactly at the box’s top is not above it');
  assert.equal(POS.imageBlock(tops, 401), 2);
  assert.equal(POS.imageBlock(tops, 50), 0, 'above every block: 0');
  assert.equal(POS.imageBlock([], 300), 0);
  // reading order, not height: a sidebar block later in the order but higher up still counts
  assert.equal(POS.imageBlock([100, 600, 150], 300), 2);
});

test('the words after a picture: the first block whose top is at or below its bottom edge', () => {
  assert.equal(POS.imageAfterIndex([100, 180, 400, 620], 400), 2);
  assert.equal(POS.imageAfterIndex([100, 180], 400), -1);
});

test('pos is two whole numbers ≥ 0', () => {
  assert.ok(POS.isPos({ block: 0, offset: 0 }));
  for (const bad of [null, {}, { block: -1, offset: 0 }, { block: 1.5, offset: 0 }, { block: 1, offset: '2' }, { block: NaN, offset: 0 }]) {
    assert.ok(!POS.isPos(bad), JSON.stringify(bad));
  }
});
