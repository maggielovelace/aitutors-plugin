// The words around a quote (a card's before / after, a picture's caption
// and the words below it). Owner's real test, 2026-10-30: a snippet's
// before read "HomeSystems Our storyThe teamBlogWork with us Contact us",
// because Range.toString() and textContent run neighbouring elements
// together. lib/pos.js wordsBetween puts one space where elements stand
// apart, none inside a word, and leaves nav, header, footer and aside out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const POS = load('./lib/pos.js');

// A DOM-like tree with parentNode, as wordsBetween walks it.
function h(tag, ...kids) {
  const el = { nodeType: 1, nodeName: tag.toUpperCase(), childNodes: [], parentNode: null };
  for (const k of kids) {
    const c = typeof k === 'string' ? { nodeType: 3, nodeName: '#text', nodeValue: k, childNodes: [], parentNode: null } : k;
    c.parentNode = el;
    el.childNodes.push(c);
  }
  return el;
}

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
  const before = POS.wordsBetween(body, null, { node: quote, offset: 0 });
  assert.equal(before, 'Scales Maps are models of the world.');
  assert.doesNotMatch(before, /Home|Systems|Contact/);
});

test('the words after a quote, a block apart, never run together', () => {
  const { body, p1 } = site();
  const words = p1.childNodes[2]; // " of the world."
  assert.equal(POS.wordsBetween(body, { node: words, offset: 4 }, null), 'the world. A scale bar shows how far.');
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
  assert.equal(POS.wordsBetween(body, null, { node: blogText, offset: 0 }, kind), 'Home Systems Our story The team');
  assert.equal(POS.wordsBetween(nav, { node: blogText, offset: 4 }, null, kind), 'Work with us Contact us');
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
  assert.match(tray, /var before = wordsBetween\(rootEl, null, \{ node: range\.startContainer, offset: range\.startOffset \}\);/);
  assert.match(tray, /var after = wordsBetween\(rootEl, \{ node: range\.endContainer, offset: range\.endOffset \}, null\);/);
  assert.match(tray, /POS\.styleKind\(function \(el\) \{ return getComputedStyle\(el\); \}\)/);
  const box = read('content/box-mode.js');
  assert.match(box, /return el \? POS\.wordsOf\(el, readerKind\) : '';/);
  assert.match(box, /after: next >= 0 \? firstWords\(textOf\(blocks\[next\]\), MAX_CONTEXT\) : '',/);
  assert.doesNotMatch(box, /blocks\[next\]\.textContent/);
});
