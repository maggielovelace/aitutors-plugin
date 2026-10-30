// The bar under a cropped picture (D58; artifact R5b · C, the owner's pick):
// Save to Jotters (gold) · + Picture · Heddy ▾, and the Heddy menu. Its
// states as pure rules, plus source pins for what needs a page to see. The
// rendered bar was compared with R5b · C in a headless Chrome (see the PR).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const B = load('./content/box-mode.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
const src = read('content/box-mode.js');
const BOX = { x: 0, y: 0, w: 300, h: 100 };

test('a box drawn, nothing kept: the bar shows, with + Picture', () => {
  assert.deepEqual(B.barModel(0, BOX), { showPlus: true, canDraw: true, showBar: true, collecting: false });
});

test('one kept and a second box drawn (R5b’s frame): + Picture, and the "1 kept" pill', () => {
  assert.deepEqual(B.barModel(1, BOX), { showPlus: true, canDraw: true, showBar: true, collecting: true });
});

test('three kept and a fourth drawn: + Picture still keeps it as the 4th', () => {
  assert.equal(B.barModel(3, BOX).showPlus, true);
});

test('four pictures kept: + Picture is hidden and no fifth box is drawn', () => {
  assert.deepEqual(B.barModel(4, null), { showPlus: false, canDraw: false, showBar: true, collecting: true });
  assert.equal(B.barModel(4, BOX).showPlus, false);
  assert.equal(B.MAX_PICTURES, 4);
});

test('kept pictures and nothing drawn: the bar stays under the last one, without + Picture', () => {
  assert.deepEqual(B.barModel(2, null), { showPlus: false, canDraw: true, showBar: true, collecting: true });
  assert.equal(B.barModel(0, null).showBar, false, 'nothing yet: the hint alone');
});

test('the Heddy menu: Explain this picture, Make a card, Ask Heddy about it, a rule, Copy picture, Whole visible page', () => {
  const rows = B.menuRows(0, BOX);
  assert.deepEqual(rows.map((r) => r.sep ? '—' : r.act), ['explain', 'card', 'ask', '—', 'copy', 'whole']);
  assert.deepEqual(rows.filter((r) => !r.sep).map((r) => en[r.label].message), ['Explain this picture', 'Make a card', 'Ask Heddy about it', 'Copy picture', 'Whole visible page']);
  assert.deepEqual(rows.filter((r) => !r.sep).map((r) => r.icon), ['search', 'star', 'quill', 'page', 'crop'], 'the artifact’s icons');
});

test('the menu with nothing to act on, and with four pictures kept', () => {
  const none = B.menuRows(0, null);
  assert.deepEqual(none.filter((r) => !r.sep && r.disabled).map((r) => r.act), ['explain', 'card', 'ask', 'copy']);
  assert.equal(B.menuRows(1, null).find((r) => r.act === 'explain').disabled, false, 'the last kept picture');
  assert.equal(B.menuRows(4, null).find((r) => r.act === 'whole').disabled, true, 'no room for the whole page');
  assert.equal(B.menuRows(3, null).find((r) => r.act === 'whole').disabled, false);
});

test('the bar is three buttons in R5b · C’s order: gold Save to Jotters, + Picture, a rule, Heddy with the eyes', () => {
  const tray = src.slice(src.indexOf("'<div class=\"tray\""), src.indexOf("'<div class=\"menu\""));
  const acts = [...tray.matchAll(/data-act="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(acts, ['save', 'plus', 'heddy']);
  assert.match(tray, /class="pri" data-act="save">' \+ icon\('save'\)/);
  assert.match(tray, /data-act="plus">' \+ icon\('crop'\)/);
  assert.match(tray, /<i><\/i><button type="button" data-act="heddy" aria-haspopup="menu" aria-expanded="false"><span class="hf">' \+ M\.use\('h-eyes', 16\)/);
  assert.match(src, /\.tray>button\.pri\{background:#DC9400;color:#002147\}/, 'gold');
});

test('the bar’s words, in both languages (D58)', () => {
  assert.match(src, /b\.save\.querySelector\('span'\)\.textContent = tr\('saveToJotters'\)/);
  assert.match(src, /b\.plus\.querySelector\('span'\)\.textContent = tr\('addPicture'\)/);
  assert.match(src, /b\.heddy\.querySelector\('span:last-child'\)\.textContent = tr\('barHeddy'\)/);
  assert.deepEqual(['saveToJotters', 'addPicture', 'barHeddy'].map((k) => en[k].message), ['Save to Jotters', '+ Picture', 'Heddy ▾']);
  assert.deepEqual(['saveToJotters', 'addPicture', 'barHeddy'].map((k) => zh[k].message), ['存到 Jotters', '+ 图片', 'Heddy ▾']);
});

test('+ Picture is hidden by the model; the pill reads "Box mode · N kept · Esc to stop"', () => {
  assert.match(src, /b\.plus\.hidden = !model\.showPlus;/);
  assert.match(src, /pill\(els\.hint, tr\('boxCollecting'\), tr\('boxKept', String\(kept\.length\)\), tr\('boxEscDone'\)\)/);
  assert.equal(`${en.boxCollecting.message} 1 kept ${en.boxEscDone.message}`, 'Box mode · 1 kept · Esc to stop');
});

test('kept boxes are cards: green, with their card number, drawn by the page’s card layer ("3 · kept" in box mode)', () => {
  const layer = read('content/cards-layer.js');
  assert.match(layer, /\.b\{position:absolute;box-sizing:border-box;border:2px solid #2f8a57/);
  assert.match(layer, /tab\.textContent = inBox \? tr\('boxKeptLabel', String\(c\.n\)\) : String\(c\.n\);/);
  assert.equal(en.boxKeptLabel.message, '$N$ · kept');
  assert.match(src, /root\.__heddyCards\.boxMode\(true\)/);
});

test('every screenshot is taken with box mode, the panel and the page’s numbers off the screen, then all come back', () => {
  assert.match(src, /function away\(on\) \{\s*if \(host\) host\.classList\.toggle\('away', on\);\s*if \(root\.__heddyCards\) root\.__heddyCards\.away\(on\);\s*if \(root\.__heddyPanel && root\.__heddyPanel\.away\) root\.__heddyPanel\.away\(on\);/);
  assert.match(src, /busy = true;\s*away\(true\);\s*return frames\(2\)/);
  assert.match(read('content/cards-layer.js'), /highlights\(!isAway && list\.length > 0\)/, 'the yellow highlight too');
});

test('box mode sits just under the panel, so the panel stays usable beside it (R5b)', () => {
  assert.match(src, /de\.insertBefore\(host, panel && panel\.parentNode === de \? panel : null\);/);
});

test('Esc leaves box mode and keeps the cards; the menu closes first if it is open', () => {
  assert.match(src, /if \(els && !els\.menu\.hidden\) return closeMenu\(\);\s*close\(\);/);
  assert.doesNotMatch(src, /heddy-box:cancel/);
});
