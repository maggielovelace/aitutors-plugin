// The bar under selected words and under a picture, and its Heddy ▾ (Round 9,
// D85; artifact #web frames r9f1 and r9f1t): [Text view | Picture view] ·
// Heddy ▾, the same drop-down for both. The old words tray (+ Add · Explain ·
// Make a card · Ask Heddy ›) is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const TT = load('./lib/tray-tools.js');
globalThis.HeddyMessages = load('./lib/messages.js');
const I = load('./lib/i18n.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
const tray = read('content/page-tray.js');

const words = (o) => TT.menuFor('words', o).map((r) => (r.sep ? '—' : I.t('en', r.label, 'Mentor') + (r.tag ? ' [' + I.t('en', 'menuInDesk') + ']' : '')));

test('words, the desk open: Ask Mentor about this · Make a card (in Heddy’s desk), a rule, Copy words · Select the whole paragraph', () => {
  assert.deepEqual(words({ deskOpen: true }), [
    "Ask Mentor about this [in Heddy's desk]", "Make a card [in Heddy's desk]", '—', 'Copy words', 'Select the whole paragraph',
  ]);
});

test('words, the desk closed: Add to Sources comes first, and opens the desk (D85)', () => {
  assert.equal(words({ deskOpen: false })[0], 'Add to Sources');
  assert.equal(TT.menuFor('words', { deskOpen: false })[0].act, 'add');
  assert.match(tray, /if \(id === 'add'\) return add\(s\);/);
  assert.match(tray, /sel\.addRange\(s\.range\);[^]*return send\(\{ type: 'heddy-cards:collect' \}\);/);
});

test('a picture: Ask Mentor about it · Make a card (in Heddy’s desk), a rule, Copy picture · Whole visible page; no Explain', () => {
  const rows = TT.menuFor('picture', { any: true });
  assert.deepEqual(rows.map((r) => (r.sep ? '—' : I.t('en', r.label, 'Mentor'))), ['Ask Mentor about it', 'Make a card', '—', 'Copy picture', 'Whole visible page']);
  for (const kind of ['picture', 'words']) assert.ok(!TT.menuFor(kind, {}).some((r) => /explain/i.test(r.act || '')), kind);
});

test('the same switch on both bars, with the artifact’s line icons', () => {
  assert.deepEqual(TT.switchRows('text').map((r) => [r.label, r.icon, r.pressed]), [['modeTextView', 'text', true], ['modePictureView', 'pic', false]]);
  for (const k of ['ask', 'card', 'copy', 'page', 'text', 'pic', 'plus', 'read', 'jot', 'get']) assert.ok(TT.SV[k], k);
  assert.equal(TT.SV.ask, '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H10l-4.5 3.5V16h-1a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/><path d="M8.5 10.5h7"/>', 'the artifact’s SV.ask, exactly');
});

test('every label in both languages, the professor’s name where it is named', () => {
  for (const kind of ['picture', 'words']) {
    for (const r of TT.menuFor(kind, { deskOpen: false, any: true }).filter((x) => !x.sep)) assert.ok(en[r.label] && zh[r.label], r.label);
  }
  assert.equal(I.t('zh_CN', 'menuAskAboutThis', 'Newton'), '问 Newton 这段话');
  assert.equal(I.t('en', 'menuAskAboutIt', 'Newton'), 'Ask Newton about it');
  assert.deepEqual(['modeTextView', 'modePictureView', 'menuAddToSources', 'menuInDesk'].map((k) => zh[k].message), ['文字视图', '图片视图', '加到来源', '在 Heddy 书桌里']);
});

test('the words bar sends Ask and Make a card to the desk (heddy-page:ask), never a window; Picture view starts box mode', () => {
  assert.match(tray, /if \(id === 'ask' \|\| id === 'card'\) return ask\(id, s\);/);
  assert.match(tray, /return send\(\{ type: 'heddy-page:ask', intent: intent, quote: s\.quote, before: s\.before, after: s\.after \}\);/);
  assert.match(tray, /if \(b && b\.start\) return b\.start\(\);\s*return send\(\{ type: 'heddy-page:picture' \}\);/);
  assert.doesNotMatch(tray, /sendTool|heddy-ui:tool|heddy-ui:page/);
  assert.match(tray, /'<style>' \+ CSS \+ '<\/style><div class="hbar" role="toolbar"><span class="sg" role="group"><\/span>'/, 'the artifact’s .hbar');
  const { PAGE_FILES } = load('./lib/courier.js');
  assert.ok(PAGE_FILES.indexOf('lib/tray-tools.js') >= 0 && PAGE_FILES.indexOf('lib/tray-tools.js') < PAGE_FILES.indexOf('content/page-tray.js'));
});

test('with the desk open, a finished selection shows the bar under the words too (D85)', () => {
  assert.match(read('content/panel.js'), /if \(root\.__heddyPage && root\.__heddyPage\.showBar\) root\.__heddyPage\.showBar\(\);/);
  assert.match(tray, /showBar: function \(\) \{\s*return langReady\.then\(showTray\);/);
});

test('no free-rounds line in the extension: it is printed only inside aitutors.me (owner, 2026-10-29)', () => {
  for (const [k, v] of Object.entries(en)) assert.doesNotMatch(v.message, /free rounds|rounds a week/i, k);
});
