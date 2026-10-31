// The popup's rows. Round 5 (D55) replaced the page state's shortcut row
// ("Select some words · for Jot it · [key]") with the numbered cards; Round 8
// (D75) took the H row out of the YouTube state. Source pins, as the popup
// needs a browser; the rendered states were looked at by hand, the cards state
// in a headless Chrome against R5 · Chrome and R5b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

const src = read('popup/popup.js');

test('the page state has no shortcut row any more: R5 · Chrome and R5b draw the cards, + Text and + Picture instead', () => {
  assert.doesNotMatch(src, /chrome:\/\/extensions\/shortcuts/);
  assert.doesNotMatch(src, /selectSomeWords|setShortcut/);
  assert.doesNotMatch(src, /Ctrl Shift J|⌘ Shift J/, 'no default key printed');
});

test('the YouTube state has no H row any more (D75): H lives on the desk', () => {
  assert.doesNotMatch(src, /keyRow|jotLineSpoken/);
});

test('Save page to Jotters is never refused for length in the popup (the courier cuts it)', () => {
  assert.doesNotMatch(src, /too_long|pageTooLong|MAX_PAGE_BYTES/);
});

// ─── Round 5: the numbered cards (D54, D55) ─────────────────────────────────

const css = read('popup/popup.css');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));

test('Save to Jotters is the primary; Save and jot now is the link under it; then the line naming the Jotter (D54)', () => {
  assert.match(src, /button\('btn wide', null, 0, tr\('saveToJotters'\)\);\s*primary\.addEventListener\('click', function \(\) \{ save\(primary, err, 'save', false\); \}\);/);
  assert.match(src, /el\('button', 'lk go', tr\('saveAndJot'\)\);[^]*save\(jot, err, 'jot', false\)/);
  assert.match(src, /el\('p', 'fine', title \? tr\('saveGoesTo', title\) : tr\('saveGoesToNoTitle'\)\)/);
  assert.equal(en.saveGoesTo.message, 'Goes to the left page of your "$TITLE$" Jotter. You can jot it there.');
  assert.deepEqual([zh.saveToJotters.message, zh.saveAndJot.message], ['存到 Jotters', '存下，马上写批注']);
});

test('with no card, the page is the thing to save: Save page to Jotters sends a page item (heddy:save, then save)', () => {
  assert.match(src, /button\('btn wide', 'h-page', 16, tr\('clipThisPage'\)\);\s*page\.addEventListener\('click', function \(\) \{ save\(page, err, 'save', true\); \}\);/);
  assert.match(src, /save\(whole, err, 'save', true\)/, '"Save the whole page too" with cards');
  assert.doesNotMatch(src, /heddy-ui:page|heddy-ui:jot'/, 'new builds send heddy:save for everything the panel saves');
});

test('no drag handle and no thought field: the cards are a number, the words or the picture, and ✕ (D55)', () => {
  assert.doesNotMatch(src, /draggable|dragstart|thought/i);
  assert.match(src, /row\.appendChild\(el\('b', null, String\(card\.n\)\)\);/);
  assert.match(src, /x\.setAttribute\('aria-label', tr\('cardRemove', String\(card\.n\)\)\);/);
  assert.match(css, /\.c q \{[^}]*-webkit-line-clamp: 2;/, 'two lines of the quote');
});

test('the list scrolls inside the panel after about six cards', () => {
  assert.match(css, /\.cards \{[^}]*max-height: 334px; overflow-y: auto;/);
});

test('+ Text and + Picture stop at 10 snippets and 4 pictures, and say why', () => {
  assert.match(src, /if \(c\.text >= HeddyCards\.MAX_TEXT\) return fail\(err, 'cardsFullText'\);/);
  assert.match(src, /if \(c\.image >= HeddyCards\.MAX_IMAGES\) return fail\(err, 'cardsFullPictures'\);/);
  assert.match(src, /cardsCall\(\{ type: 'heddy-ui:snap', mode: 'box' \}, tab\);/, '+ Picture is box mode, beside the panel');
});

test('Explain · Make a card · Ask Heddy are small links acting on card 1', () => {
  assert.match(src, /ln\.title = tr\('toolsOnCard1'\);/);
  assert.equal(en.toolsOnCard1.message, 'On card 1');
});
