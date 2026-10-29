// The tools in the words tray and the popup (D15, D17, D20 tool; R2 · 03,
// round 2c, R3b · 05): Jot it is the one filled button, Explain, Make a card
// and Ask Heddy follow it outlined, in the desk's order, each with a window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const { TOOLS } = load('./lib/tray-tools.js');
const M = load('./lib/marks.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
const T = load('./lib/tools.js');

test('the desk’s order: Jot it, Explain, Make a card, Ask Heddy', () => {
  assert.deepEqual(TOOLS.map((t) => t.id), ['jot', 'explain', 'card', 'ask']);
});

test('exactly one primary, and it is Jot it (one filled button per tray, round 2c)', () => {
  const primaries = TOOLS.filter((t) => t.primary === true);
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].id, 'jot');
  for (const t of TOOLS.filter((x) => x.id !== 'jot')) assert.equal(t.primary, false, `${t.id} is outlined`);
});

test('every tool but Jot it is one heddy:tool knows, with a window', () => {
  for (const t of TOOLS.filter((x) => x.id !== 'jot')) {
    assert.ok(T.TOOLS.includes(t.id), t.id);
    assert.ok(['room', 'card'].includes(T.pageFor(t.id)), t.id);
  }
});

test('Ask Heddy wears the eyes mark (D34); every mark exists; every label in both languages', () => {
  assert.equal(TOOLS.find((t) => t.id === 'ask').mark, 'h-eyes');
  assert.equal(TOOLS.find((t) => t.id === 'ask').popupMark, 'h-eyes');
  for (const t of TOOLS) {
    assert.ok(M.SYMBOLS[t.mark], `${t.mark} missing`);
    if (t.popupMark) assert.ok(M.SYMBOLS[t.popupMark], `${t.popupMark} missing`);
    assert.ok(en[t.label] && zh[t.label], `${t.label} missing`);
  }
});

test('the page tray and the popup dispatch the three tools through sendTool / heddy-ui:tool', () => {
  const tray = read('content/page-tray.js');
  assert.match(tray, /if \(id === 'explain' \|\| id === 'card' \|\| id === 'ask'\) return tool\(id, s\);/);
  assert.match(tray, /HeddyTools\.sendTool\(id,/);
  const popup = read('popup/popup.js');
  assert.match(popup, /TOOLS\.filter\(function \(t\) \{ return !t\.primary; \}\)/, 'the popup draws only the outlined tools in its row');
  assert.match(popup, /type: 'heddy-ui:tool'/);
  const { PAGE_FILES } = load('./lib/courier.js');
  assert.ok(PAGE_FILES.indexOf('lib/tools.js') >= 0 && PAGE_FILES.indexOf('lib/tools.js') < PAGE_FILES.indexOf('content/page-tray.js'));
});

test('no free-rounds line in the extension: it is printed only inside aitutors.me (owner, 2026-10-29)', () => {
  for (const [k, v] of Object.entries(en)) assert.doesNotMatch(v.message, /free rounds|rounds a week/i, k);
});
