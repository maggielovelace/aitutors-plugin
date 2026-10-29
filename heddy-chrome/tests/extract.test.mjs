// Clip this page (D5, D20, Must 6): the readable article as Markdown, images as
// links, scripts, styles, menus and hidden things left out. Driven with a tiny
// DOM-like tree, so no browser is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const X = load('./content/extract.js');

function h(tag, attrs, ...children) {
  const el = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    attrs: attrs || {},
    childNodes: [],
    parentNode: null,
    getAttribute(a) { return Object.prototype.hasOwnProperty.call(this.attrs, a) ? String(this.attrs[a]) : null; },
    get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(''); },
  };
  for (const c of children.flat()) {
    const node = typeof c === 'string' ? { nodeType: 3, nodeValue: c, parentNode: el } : c;
    node.parentNode = el;
    el.childNodes.push(node);
  }
  return el;
}

const LONG = 'On a 1:50 000 map, 2 cm represents 1 km on the ground, and the scale is printed in the margin of every sheet. ';

function page() {
  const body = h('body', {},
    h('nav', {}, h('a', { href: '/' }, 'Home'), h('a', { href: '/shop' }, 'Shop')),
    h('header', { role: 'banner' }, h('p', {}, 'Site banner words that are not the article at all, really not.')),
    h('script', {}, 'window.track("x")'),
    h('style', {}, 'p{color:red}'),
    h('div', { id: 'content' },
      h('h1', {}, 'Understanding map scales'),
      h('p', {}, LONG, h('a', { href: '/grid' }, 'Grid squares'), ' are ', h('strong', {}, '1 km'), ' across.'),
      h('p', {}, LONG),
      h('figure', {}, h('img', { src: '/img/scale.png', alt: 'A scale [bar]' }), h('figcaption', {}, 'A scale bar')),
      h('img', { src: 'data:image/png;base64,AAAA', alt: 'tracking' }),
      h('ul', {}, h('li', {}, 'Ratio'), h('li', {}, 'Words'), h('li', {}, h('p', {}, 'Bar'), h('ul', {}, h('li', {}, 'nested')))),
      h('ol', {}, h('li', {}, 'Measure'), h('li', {}, 'Convert')),
      h('blockquote', {}, h('p', {}, 'Maps are models.')),
      h('pre', {}, 'cm × 50 000 = cm'),
      h('table', {}, h('tr', {}, h('th', {}, 'Scale'), h('th', {}, '2 cm is')), h('tr', {}, h('td', {}, '1:50 000'), h('td', {}, '1 km'))),
      h('p', { hidden: '' }, 'hidden words'),
      h('div', { 'aria-hidden': 'true' }, 'aria hidden words'),
      h('form', {}, h('input', { value: 'search' })),
      h('a', { href: 'javascript:alert(1)' }, 'click me'),
    ),
    h('aside', {}, h('p', {}, 'Related: buy a compass today, it is the best compass in the shop.')),
    h('footer', {}, 'Copyright'),
  );
  return { title: ' Understanding map scales | OS ', body };
}

test('the article is the element whose paragraphs hold the most text', () => {
  const doc = page();
  assert.equal(X.pickRoot(doc).attrs.id, 'content');
});

test('one <article> or <main> with text wins outright', () => {
  const article = h('article', {}, h('p', {}, LONG + LONG));
  const doc = { body: h('body', {}, h('div', {}, h('p', {}, LONG), h('p', {}, LONG), h('p', {}, LONG)), article) };
  assert.equal(X.pickRoot(doc), article);
});

test('Markdown: headings, emphasis, absolute links, lists, quotes, code, tables', () => {
  const r = X.extractPage(page(), { base: 'https://www.ordnancesurvey.co.uk/guides/map-scales' });
  const md = r.markdown;
  assert.equal(r.title, 'Understanding map scales | OS');
  assert.match(md, /^# Understanding map scales/);
  assert.match(md, /\[Grid squares\]\(https:\/\/www\.ordnancesurvey\.co\.uk\/grid\) are \*\*1 km\*\* across\./);
  assert.match(md, /- Ratio\n- Words\n- Bar\n  - nested/);
  assert.match(md, /1\. Measure\n2\. Convert/);
  assert.match(md, /> Maps are models\./);
  assert.match(md, /```\ncm × 50 000 = cm\n```/);
  assert.match(md, /\| Scale \| 2 cm is \|\n\| --- \| --- \|\n\| 1:50 000 \| 1 km \|/);
  assert.match(md, /A scale bar/);
});

test('images are links to where they are, never fetched; data: images are dropped', () => {
  const r = X.extractPage(page(), { base: 'https://www.ordnancesurvey.co.uk/guides/map-scales', imageLabel: 'Image' });
  assert.match(r.markdown, /\[Image: A scale bar\]\(https:\/\/www\.ordnancesurvey\.co\.uk\/img\/scale\.png\)/);
  assert.doesNotMatch(r.markdown, /!\[/, 'no Markdown image syntax a renderer would load');
  assert.doesNotMatch(r.markdown, /data:image/);
  assert.equal(r.images, 1);
});

test('scripts, styles, menus, sidebars, footers, forms and hidden things are left out', () => {
  const md = X.extractPage(page(), { base: 'https://x.example/' }).markdown;
  for (const gone of ['track', 'color:red', 'Home', 'Shop', 'banner', 'compass', 'Copyright', 'hidden words', 'search', 'javascript']) {
    assert.doesNotMatch(md, new RegExp(gone), gone);
  }
  assert.match(md, /click me/, 'a javascript: link keeps its words only');
});

test('an isHidden check (computed style in the page) is honoured', () => {
  const doc = { body: h('body', {}, h('p', { class: 'x' }, 'shown'), h('p', { class: 'gone' }, 'not shown')) };
  const md = X.toMarkdown(doc.body, { isHidden: (el) => el.attrs.class === 'gone' }).markdown;
  assert.equal(md, 'shown');
});

test('page text is data: markup in it stays text', () => {
  const doc = { body: h('body', {}, h('p', {}, '<img src=x onerror=alert(1)>')) };
  assert.equal(X.toMarkdown(doc.body).markdown, '<img src=x onerror=alert(1)>');
});

test('menus, sidebars and footers inside the article are left out too', () => {
  const article = h('article', {},
    h('p', {}, LONG + LONG),
    h('nav', {}, h('a', { href: '/next' }, 'Next chapter')),
    h('aside', {}, h('p', {}, 'Sponsored box')),
    h('footer', {}, 'Share this'),
    h('div', { role: 'navigation' }, 'Breadcrumbs'),
  );
  const md = X.extractPage({ body: h('body', {}, article) }, { base: 'https://x.example/' }).markdown;
  for (const gone of ['Next chapter', 'Sponsored', 'Share this', 'Breadcrumbs']) assert.doesNotMatch(md, new RegExp(gone), gone);
});
