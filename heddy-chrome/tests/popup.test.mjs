// The popup's rows. Round 5 (D55) replaced the page state's shortcut row
// ("Select some words · for Jot it · [key]") with the numbered cards; Round 8
// (D75) took the H row out of the YouTube state. Source pins, as the popup
// needs a browser; the rendered states were looked at by hand, the cards state
// in a headless Chrome against R5 · Chrome and R5b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, load as loadMod } from './helpers.mjs';

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

// ─── Round 9: the web desk's Sources (D81–D83; popup/web-desk.js) ─────────

const desk = read('popup/web-desk.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));

test('one save (D82): "Save n to my Jotters", the article checkbox with its ⓘ, then Read it · Jot it · Get it; no Save and jot now', () => {
  assert.match(desk, /n \? \(n === 1 \? tr\('saveOne'\) : tr\('saveN', String\(n\)\)\) : tr\('savePage'\)/);
  assert.match(desk, /\[\['read', 'stepRead'\], \['jot', 'stepJot'\], \['get', 'stepGet'\]\]/);
  assert.deepEqual(['saveN', 'saveArticle', 'saveArticleWhy', 'stepRead', 'stepJot', 'stepGet'].map((k) => en[k].message), [
    'Save $N$ to my Jotters', "Also keep the article's text", "The page's main text, without menus or ads. It goes on the Jotter's left page.", 'Read it', 'Jot it', 'Get it',
  ]);
  assert.deepEqual(['webTabSources', 'saveArticle', 'saveN', 'stepRead', 'stepJot', 'stepGet'].map((k) => zh[k].message), ['来源', '同时保留文章正文', '存 $N$ 条到我的 Jotters', '读', '记', '懂']);
  for (const gone of ['saveAndJot', 'savePageToo', 'saveGoesTo', 'toolsOnCard1', 'clipThisPage']) assert.equal(en[gone], undefined, gone);
});

test('nothing picked (D82): the empty box, the page card, "Save this page to my Jotters", and no checkbox; it saves the article', () => {
  assert.match(desk, /if \(n\) \{\s*var chk = el\('label', 'chk'/, 'the checkbox only with sources');
  assert.match(desk, /call\(\{ type: 'heddy-web:save', article: n \? st\.article : true \}\)/);
  assert.equal(en.savePage.message, 'Save this page to my Jotters');
  assert.equal(en.webPageCardHead.message, 'Or keep the page');
});

test('the ⓘ shows on hover and on tap, and a tap never ticks the box', () => {
  const css = load9().CSS;
  assert.match(css, /\.cd \.inf:hover em,\.cd \.inf:focus-visible em,\.cd \.inf\.show em\{display:block\}/);
  assert.match(desk, /inf\.addEventListener\('click', function \(ev\) \{\s*ev\.preventDefault\(\);\s*ev\.stopPropagation\(\);\s*inf\.classList\.toggle\('show'\);/);
});

test('saving and saved happen in the desk (D83): the spinner and dimmed cards, then the green card with Open my Jotter ↗ and Undo', () => {
  assert.match(desk, /el\('ul', 'cl' \+ \(st\.saving \? ' dim' : ''\)\)/);
  assert.match(desk, /go\.appendChild\(el\('span', 'spin'\)\);/);
  assert.match(desk, /open\.addEventListener\('click', function \(\) \{ openSite\(s\.href\); \}\);/, 'the only tab, on tap');
  assert.match(desk, /call\(\{ type: 'heddy-web:undo-save', saveId: s\.saveId \}\)/);
  assert.equal(en.savedOpen.message, 'Open my Jotter ↗');
  assert.equal(en.savedFine.message, 'Open is the only thing that leaves this page.');
});

test('the cards stay exactly as today (D81): ⠿, the number, ↑ ↓ ✕, Alt+↑ / Alt+↓; + Text / + Picture stop at 10 and 4 and say why', () => {
  assert.match(desk, /var gp = el\('span', 'gp', '⠿'\);/);
  assert.match(desk, /if \(!e\.altKey \|\| \(e\.key !== 'ArrowUp' && e\.key !== 'ArrowDown'\) \|\| busy\(\)\) return;/);
  assert.match(desk, /x\.setAttribute\('aria-label', tr\('cardRemove', String\(card\.n\)\)\);/);
  assert.match(desk, /if \(st\.counts\.text >= CARDS\.MAX_TEXT\) return fail\('cardsFullText'\);/);
  assert.match(desk, /if \(st\.counts\.image >= CARDS\.MAX_IMAGES\) return fail\('cardsFullPictures'\);/);
  assert.match(desk, /call\(\{ type: 'heddy-ui:snap', mode: 'box' \}\);/, '+ Picture is box mode, beside the desk');
  assert.match(load9().CSS, /\.cd \.cl \.t\{[^}]*-webkit-line-clamp:2;/, 'two lines of the quote');
});

test('no Explain · Make a card · Ask Heddy line under the save any more (D82): asking is the crest', () => {
  assert.doesNotMatch(desk, /heddy-cards:tool|toolsOnCard1/);
  assert.match(desk, /A\.openAsk\(\{ about: 'page' \}, api, 'ask'\);/);
});

function load9() {
  globalThis.HeddyMarks = globalThis.HeddyMarks || loadMod('./lib/marks.js');
  return { CSS: desk.slice(desk.indexOf('var CSS = ['), desk.indexOf("].join('\\n');")) };
}
