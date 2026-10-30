// The words around a quote (a card's before / after, a picture's caption
// and the words below it). Owner's real test, 2026-10-30: a snippet's
// before read "HomeSystems Our storyThe teamBlogWork with us Contact us",
// because Range.toString() and textContent run neighbouring elements
// together. lib/pos.js wordsBefore / wordsAfter put one space where
// elements stand apart, none inside a word, and leave nav, header, footer
// and aside out. They walk outward from the quote and stop at their cap, so
// a big page costs no more than a small one (auto-add runs them on every
// selection).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const POS = load('./lib/pos.js');

// A DOM-like tree with parentNode and sibling links, as the walk reads it.
function h(tag, ...kids) {
  const el = { nodeType: 1, nodeName: tag.toUpperCase(), childNodes: [], parentNode: null, previousSibling: null, nextSibling: null };
  for (const k of kids) {
    const c = typeof k === 'string' ? { nodeType: 3, nodeName: '#text', nodeValue: k, childNodes: [], parentNode: null, previousSibling: null, nextSibling: null } : k;
    c.parentNode = el;
    const last = el.childNodes.at(-1);
    if (last) { last.nextSibling = c; c.previousSibling = last; }
    el.childNodes.push(c);
  }
  return el;
}
const BIG = 600;

// The owner's page: a nav of links with no white space between them, then
// the article. The links are inline elements in the markup.
function site() {
  const nav = h('nav', h('a', 'Home'), h('a', 'Systems'), ' ', h('a', 'Our story'), h('a', 'The team'), h('a', 'Blog'), h('a', 'Work with us'), ' ', h('a', 'Contact us'));
  const p1 = h('p', 'Maps are ', h('b', 'models'), ' of the world.');
  const p2 = h('p', 'A scale bar shows how far.');
  const body = h('body', nav, h('div', h('h1', 'Scales'), p1, p2));
  return { body, nav, p1, p2 };
}

test('the nav is left out of the words before a quote; blocks are kept apart by a space', () => {
  const { body, p2 } = site();
  const quote = p2.childNodes[0];
  const before = POS.wordsBefore(body, { node: quote, offset: 0 }, BIG);
  assert.equal(before, 'Scales Maps are models of the world.');
  assert.doesNotMatch(before, /Home|Systems|Contact/);
});

test('the words after a quote, a block apart, never run together', () => {
  const { body, p1 } = site();
  const words = p1.childNodes[2]; // " of the world."
  assert.equal(POS.wordsAfter(body, { node: words, offset: 4 }, BIG), 'the world. A scale bar shows how far.');
});

test('no space inside a word split by inline markup', () => {
  const p = h('p', 'It is im', h('b', 'port'), 'ant to ', h('a', 'read'), 's.');
  assert.equal(POS.wordsOf(p), 'It is important to reads.');
});

test('a quote inside the nav still reads its own nav, with the links apart when the page lays them out as boxes', () => {
  const { body, nav } = site();
  const blogText = nav.childNodes[5].childNodes[0];
  // By tag alone the links are inline, so the reader needs the page's CSS:
  const kind = POS.styleKind((el) => (el.nodeName === 'A' ? { display: 'inline-block' } : { display: el.nodeName === 'NAV' ? 'flex' : 'block' }));
  assert.equal(POS.wordsBefore(body, { node: blogText, offset: 0 }, BIG, kind), 'Home Systems Our story The team');
  assert.equal(POS.wordsAfter(body, { node: blogText, offset: 4 }, BIG, kind), 'Work with us Contact us Scales Maps are models of the world. A scale bar shows how far.');
});

test('styleKind: hidden is skipped, a non-inline display is apart, an inline with margin or padding beside it is apart', () => {
  const k = (style, tag = 'span') => POS.styleKind(() => style)(h(tag));
  assert.equal(k({ display: 'none' }), 'skip');
  assert.equal(k({ display: 'none' }, 'p'), 'skip', 'a hidden block');
  assert.equal(k({ display: 'block' }), 'break');
  assert.equal(k({ display: 'flex' }), 'break');
  assert.equal(k({ display: 'inline-block' }), 'break');
  assert.equal(k({ display: 'inline', marginLeft: '12px' }), 'break');
  assert.equal(k({ display: 'inline', paddingRight: '0.5em' }), 'break');
  assert.equal(k({ display: 'inline', marginLeft: '0px', paddingLeft: '0px' }), '');
  assert.equal(k({ display: 'contents' }), '');
  assert.equal(k({ display: 'inline' }, 'p'), 'break', 'a block tag is apart whatever its CSS');
  assert.equal(k({ display: 'block' }, 'nav'), 'skip');
  assert.equal(k({ display: 'block' }, 'script'), 'skip');
  assert.equal(POS.styleKind(() => { throw new Error('gone'); })(h('div')), 'break', 'no style: the tag decides');
  assert.equal(POS.styleKind(() => null)(h('span')), '');
});

test('the run-together example from the owner’s test, as links laid out side by side, reads with spaces', () => {
  const nav = h('div', h('a', 'Home'), h('a', 'Systems'), h('a', 'Our story'), h('a', 'The team'), h('a', 'Blog'));
  const kind = POS.styleKind((el) => (el.nodeName === 'A' ? { display: 'inline', marginRight: '24px' } : { display: 'block' }));
  assert.equal(POS.wordsOf(nav, kind), 'Home Systems Our story The team Blog');
});

test('header, footer and aside are left out too; script and style are never read', () => {
  const body = h('body', h('header', 'Site name'), h('script', 'var x = 1;'), h('p', 'Words.'), h('aside', 'Related'), h('style', 'p{}'), h('footer', '© 2026'));
  assert.equal(POS.wordsOf(body), 'Words.');
});

test('the page tray and box mode read the words this way, not by Range.toString() or textContent', () => {
  const tray = read('content/page-tray.js');
  assert.match(tray, /before: POS\.wordsBefore\(body, \{ node: range\.startContainer, offset: range\.startOffset \}, side, kind\)/);
  assert.match(tray, /after: POS\.wordsAfter\(body, \{ node: range\.endContainer, offset: range\.endOffset \}, side, kind\)/);
  assert.match(tray, /POS\.styleKind\(function \(el\) \{ return getComputedStyle\(el\); \}\)/);
  const box = read('content/box-mode.js');
  assert.match(box, /return el \? POS\.lastWordsOf\(el, readerKind, MAX_CONTEXT \* 2\) : '';/);
  assert.match(box, /after: next >= 0 \? firstWords\(firstTextOf\(blocks\[next\]\), MAX_CONTEXT\) : '',/);
  assert.doesNotMatch(box, /blocks\[next\]\.textContent/);
});

// ─── bounded: the walk never grows with the page ────────────────────────────

/** A page with `n` paragraphs before the quote's paragraph and `n` after. */
function bigPage(n, text = (i) => `Paragraph ${i} has words.`) {
  const before = Array.from({ length: n }, (_, i) => h('p', text(i)));
  const quoteP = h('p', 'The quote is here.');
  const after = Array.from({ length: n }, (_, i) => h('p', text(n + i)));
  const body = h('body', h('div', ...before), quoteP, h('div', ...after));
  return { body, quote: quoteP.childNodes[0] };
}

function countingKind() {
  const calls = { n: 0 };
  const kind = POS.styleKind((el) => { calls.n += 1; return { display: el.nodeName === 'P' || el.nodeName === 'DIV' || el.nodeName === 'BODY' ? 'block' : 'inline' }; });
  return { calls, kind };
}

test('20,000 paragraphs before and after the quote: the style is asked of a bounded few, and the words are the nearest ones', () => {
  const { body, quote } = bigPage(20000);
  const { calls, kind } = countingKind();
  const stats = {};
  const before = POS.wordsBefore(body, { node: quote, offset: 0 }, 600, kind, stats);
  assert.ok(calls.n < 60, `getStyle asked ${calls.n} times`);
  assert.ok(stats.visits < 150, `${stats.visits} nodes visited`);
  assert.ok(before.endsWith('Paragraph 19999 has words.'), 'the words next to the quote');
  assert.ok(before.length <= 600 && before.length > 500);
  calls.n = 0;
  const after = POS.wordsAfter(body, { node: quote, offset: quote.nodeValue.length }, 600, kind, stats);
  assert.ok(calls.n < 60, `getStyle asked ${calls.n} times`);
  assert.ok(after.startsWith('Paragraph 20000 has words. Paragraph 20001'));
});

test('20,000 EMPTY elements before the quote: the walk stops at its visit cap, not at the page’s start', () => {
  const empties = Array.from({ length: 20000 }, () => h('span'));
  const quoteP = h('p', 'The quote.');
  const body = h('body', h('div', h('p', 'Far away words.'), ...empties), quoteP);
  const { calls, kind } = countingKind();
  const stats = {};
  const before = POS.wordsBefore(body, { node: quoteP.childNodes[0], offset: 0 }, 600, kind, stats);
  assert.equal(stats.visits, POS.MAX_VISITS);
  assert.ok(calls.n <= POS.MAX_VISITS, `getStyle asked ${calls.n} times`);
  assert.equal(before, '', 'nothing in reach');
});

test('a nav with 20,000 links before the quote is skipped whole: one style call, not 20,000', () => {
  const links = Array.from({ length: 20000 }, (_, i) => h('a', `Link ${i}`));
  const quoteP = h('p', 'The quote.');
  const body = h('body', h('p', 'Intro words.'), h('nav', ...links), quoteP);
  const { calls, kind } = countingKind();
  const before = POS.wordsBefore(body, { node: quoteP.childNodes[0], offset: 0 }, 600, kind);
  assert.equal(before, 'Intro words.');
  assert.ok(calls.n < 10, `getStyle asked ${calls.n} times`);
});

test('the cap keeps the characters nearest the quote on each side', () => {
  const p = h('p', 'one two three four five six seven');
  const t = p.childNodes[0];
  assert.equal(POS.wordsBefore(p, { node: t, offset: 33 }, 10), 'six seven');
  assert.equal(POS.wordsAfter(p, { node: t, offset: 0 }, 10), 'one two th');
  assert.equal(POS.lastWordsOf(p, undefined, 5), 'seven');
  assert.equal(POS.wordsOf(p, undefined, 3), 'one');
});

test('an element point (a Range boundary between children) works both ways', () => {
  const p = h('p', h('b', 'Bold'), h('i', 'italic'), 'plain');
  const body = h('body', h('p', 'Before.'), p);
  assert.equal(POS.wordsBefore(body, { node: p, offset: 1 }, 600), 'Before. Bold');
  assert.equal(POS.wordsAfter(body, { node: p, offset: 1 }, 600), 'italicplain');
  assert.equal(POS.wordsAfter(body, { node: p, offset: 3 }, 600), '');
});
