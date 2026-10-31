// The bar under a cropped picture (D58 as Round 7's D64 and Round 9's D85
// have it): the [Text view | Picture view] switch · + Picture (gold) ·
// Heddy ▾, the Heddy menu, and
// the small bar Text mode leaves. Its states as pure rules, plus source pins
// for what needs a page to see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const B = load('./content/box-mode.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
const src = read('content/box-mode.js');
const BOX = { x: 0, y: 0, w: 300, h: 100 };

const pick = (m) => ({ showPlus: m.showPlus, canDraw: m.canDraw, showBar: m.showBar, collecting: m.collecting });

test('a box drawn, nothing kept: the bar shows, with + Picture', () => {
  assert.deepEqual(pick(B.barModel(0, BOX)), { showPlus: true, canDraw: true, showBar: true, collecting: false });
  assert.equal(B.barModel(0, BOX).mode, 'picture', 'box mode is Picture mode');
});

test('one kept and a second box drawn (R5b’s frame): + Picture, and the "1 kept" pill', () => {
  assert.deepEqual(pick(B.barModel(1, BOX)), { showPlus: true, canDraw: true, showBar: true, collecting: true });
});

test('three kept and a fourth drawn: + Picture still keeps it as the 4th', () => {
  assert.equal(B.barModel(3, BOX).showPlus, true);
});

test('four pictures kept: + Picture is hidden and no fifth box is drawn', () => {
  assert.deepEqual(pick(B.barModel(4, null)), { showPlus: false, canDraw: false, showBar: true, collecting: true });
  assert.equal(B.barModel(4, BOX).showPlus, false);
  assert.equal(B.MAX_PICTURES, 4);
});

test('kept pictures and nothing drawn: the bar stays under the last one, without + Picture', () => {
  assert.deepEqual(pick(B.barModel(2, null)), { showPlus: false, canDraw: true, showBar: true, collecting: true });
  assert.equal(B.barModel(0, null).showBar, false, 'nothing yet: no bar under a box');
});

// ─── Round 7 (D64): the Text | Picture switch ───────────────────────────────

test('Picture mode with nothing drawn: the small bar holds the switch and the hint; once a bar is under a box, it goes', () => {
  assert.deepEqual([B.barModel(0, null, 'picture').showDock, B.barModel(0, null, 'picture').line], [true, 'boxHintBefore']);
  assert.equal(B.barModel(0, BOX, 'picture').showDock, false, 'the bar under the box carries the switch');
  assert.equal(B.barModel(2, null, 'picture').showDock, false, 'the bar under the last kept one');
});

test('Text mode: only the small bar, "Select words: each one is added"; nothing is drawn, nothing is kept', () => {
  const m = B.barModel(3, BOX, 'text');
  assert.deepEqual(m, { mode: 'text', showPlus: false, canDraw: false, showBar: false, showDock: true, collecting: false, line: 'textModeLine' });
  assert.equal(en.textModeLine.message, 'Select words: each one is added');
  assert.equal(zh.textModeLine.message, '选中文字：每段都会加进来');
});

test('the switch: Text view then Picture view, the one that is on pressed, with the artifact’s line icons (D85)', () => {
  assert.deepEqual(B.switchModel('picture').map((b) => [b.mode, b.pressed, b.icon]), [['text', false, 'text'], ['picture', true, 'pic']]);
  assert.deepEqual(B.switchModel('text').map((b) => b.pressed), [true, false]);
  assert.deepEqual(B.switchModel('text').map((b) => en[b.label].message), ['Text view', 'Picture view']);
  assert.deepEqual(B.switchModel('text').map((b) => zh[b.label].message), ['文字视图', '图片视图']);
});

test('Heddy ▾ (D85): Ask {professor} about it · Make a card, each "in Heddy’s desk", a rule, Copy picture · Whole visible page; no Explain', () => {
  const rows = B.menuRows(0, BOX);
  assert.deepEqual(rows.map((r) => r.sep ? '—' : r.act), ['ask', 'card', '—', 'copy', 'whole']);
  const I = load('./lib/i18n.js');
  assert.deepEqual(rows.filter((r) => !r.sep).map((r) => I.t('en', r.label, 'Mentor')), ['Ask Mentor about it', 'Make a card', 'Copy picture', 'Whole visible page']);
  assert.deepEqual(rows.filter((r) => !r.sep).map((r) => !!r.tag), [true, true, false, false]);
  assert.equal(en.menuInDesk.message, 'in Heddy’s desk'.replace('’', "'"));
  assert.deepEqual(rows.filter((r) => !r.sep).map((r) => r.icon), ['ask', 'card', 'copy', 'page'], 'the artifact’s SV icons');
  assert.ok(!rows.some((r) => r.act === 'explain'), 'Explain is a chip in Ask now');
});

test('the menu with nothing to act on, and with four pictures kept', () => {
  const none = B.menuRows(0, null);
  assert.deepEqual(none.filter((r) => !r.sep && r.disabled).map((r) => r.act), ['ask', 'card', 'copy']);
  assert.equal(B.menuRows(1, null).find((r) => r.act === 'ask').disabled, false, 'the last kept picture');
  assert.equal(B.menuRows(4, null).find((r) => r.act === 'whole').disabled, true, 'no room for the whole page');
  assert.equal(B.menuRows(3, null).find((r) => r.act === 'whole').disabled, false);
});

test('the bar is the artifact’s .hbar: the switch, gold + Picture, then Heddy ▾ with the eyes; no Save to Jotters (D64, D85)', () => {
  const tray = src.slice(src.indexOf("'<div class=\"tray hbar\""), src.indexOf("'<div class=\"menu hmenu\""));
  const acts = [...tray.matchAll(/data-act="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(acts, ['plus', 'heddy']);
  assert.match(tray, /'<div class="tray hbar" role="toolbar" hidden>' \+ switchHtml\(\) \+\s*'<button type="button" class="pri" data-act="plus">' \+ TT\.sv\('plus'\)/);
  assert.match(src, /'<div class="dock" role="toolbar" hidden>' \+ switchHtml\(\)/, 'the small bar has the same switch');
  assert.doesNotMatch(src, /saveToJotters|heddy-box:save|saveAll/, 'saving happens only in the desk');
  assert.match(tray, /<button type="button" class="hd2" data-act="heddy" aria-haspopup="menu" aria-expanded="false"><span class="eyes">' \+ M\.use\('h-eyes', 20\)/);
  assert.match(src, /\.tray>\.pri\{[^}]*background:#DC9400;color:#002147/, 'gold');
  const TT = load('./lib/tray-tools.js');
  assert.match(TT.CSS, /\.hbar\{display:flex;gap:6px;align-items:center;background:#0d2a52;border-radius:14px;padding:6px/, 'the artifact’s .hbar');
  assert.match(TT.CSS, /\.hmenu\{position:absolute;box-sizing:border-box;width:300px;background:#fff;border:1px solid #d9dde3;border-radius:14px/, 'the artifact’s .hmenu');
});

test('the bar’s words, in both languages (D85)', () => {
  assert.match(src, /b\.plus\.querySelector\('span'\)\.textContent = tr\('webAddPicture'\)/, 'the + is the icon, not the label');
  assert.match(src, /b\.heddy\.querySelector\('span:last-child'\)\.textContent = tr\('barHeddyMenu'\)/);
  assert.match(src, /b\[row\.act\]\.querySelector\('span'\)\.textContent = tr\(row\.label, professor\)/, 'the professor’s name');
  assert.match(src, /sw\.setAttribute\('aria-label', tr\('modeSwitchLabel'\)\)/);
  assert.deepEqual(['webAddPicture', 'barHeddyMenu', 'menuInDesk'].map((k) => zh[k].message), ['图片', 'Heddy ▾', '在 Heddy 书桌里']);
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

test('Esc in Picture mode switches to Text and keeps the cards; the menu closes first if it is open', () => {
  assert.match(src, /if \(e\.key !== 'Escape' \|\| state !== 'picture'\) return;[^]*if \(els && !els\.menu\.hidden\) return closeMenu\(\);\s*toText\(\);/);
  assert.doesNotMatch(src, /heddy-box:cancel/);
  const panel = read('content/panel.js');
  assert.match(panel, /if \(e\.key !== 'Escape' \|\| e\.defaultPrevented \|\| mode\(\) === 'picture'\) return;/, 'the panel stays open on that Esc');
});

test('switching to Text leaves the small bar only while the panel is open, and it goes when the panel closes', () => {
  assert.match(src, /function toText\(\) \{\s*close\(\);\s*if \(panelOpen\(\)\) \{\s*build\(\);\s*state = 'text';/);
  assert.match(src, /function panelClosed\(\) \{\s*if \(state === 'text'\) close\(\);/);
  assert.match(read('content/panel.js'), /root\.__heddyBoxMode\.panelClosed\(\)/);
  assert.match(src, /:host\(\.text\)\{pointer-events:none\}/, 'the page under it stays the page');
});

test('the switch’s class does not collide with the box’s corner handles (nw, ne, sw, se)', () => {
  const classes = [...src.matchAll(/class="([\w ]+)"/g)].flatMap((m) => m[1].split(' '));
  assert.ok(classes.includes('msw'));
  const switchCss = [...src.matchAll(/'\.(\w+)[{ ]/g)].map((m) => m[1]);
  for (const corner of ['nw', 'ne', 'sw', 'se']) assert.ok(!switchCss.includes(corner), `no top-level .${corner} rule`);
});

test('the panel is told which mode is on, both ways', () => {
  assert.match(src, /state = 'picture';\s*tellMode\('picture'\);/);
  assert.match(src, /if \(was === 'picture'\) tellMode\('text'\);/);
  assert.match(read('content/panel.js'), /tell\(\{ heddyPanel: 'mode', mode: m === 'picture' \? 'picture' : 'text' \}\)/);
});
