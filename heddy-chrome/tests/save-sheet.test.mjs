// The Save-into SHEET and the saved card's Done (0.9.1; the owner's pick of
// 2026-11-07, proposal 1 "Tidy up in place" of artifact
// DCJkfgXkimHuMSJHX9jesq). In 0.9.0 the list was a pop-up anchored to the
// Into line that grew upwards with max-height calc(100vh − 220px): with a
// dozen Jotters its last rows and its key box were drawn over the Into line
// and the Save button. Now it is a sheet pinned inside the tab panel, its
// rows scroll inside it, and the search box is at its top. After a save the
// green card leads with Done, keeps Open my Jotter ↗, and Undo is a link.
process.env.TZ = 'Asia/Shanghai';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
const SI = load('./lib/save-into.js');
const en = globalThis.HeddyI18n.translator('en');

const J27 = 'a7b0c0de-0000-4000-8000-000000000027';
const NOW = new Date(2026, 10, 7, 15, 0, 0);
const LIST = Array.from({ length: 14 }, (_, i) => ({
  id: `a7b0c0de-0000-4000-8000-0000000000${String(10 + i)}`,
  key: `JOT-${30 + i}`,
  title: `Jotter number ${i}`,
  at: NOW.getTime() - i * 3600000,
}));
LIST[0] = { id: J27, key: 'JOT-27', title: 'Photosynthesis homework', at: NOW.getTime() - 600000 };

function fakeDoc() {
  const doc = { activeElement: null, listeners: [] };
  class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.on = {}; this.className = ''; this.id = ''; this._text = ''; this.hidden = false; this.value = ''; this.parent = null; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set textContent(v) { this.children = []; this._text = String(v); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(t, fn) { (this.on[t] = this.on[t] || []).push(fn); }
    fire(t, ev = {}) { const e = { target: this, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...ev }; let n = this; while (n) { (n.on[t] || []).forEach((fn) => fn(e)); if (e.stopped) break; n = n.parent; } return e; }
    contains(x) { for (let n = x; n; n = n.parent) if (n === this) return true; return false; }
    focus() { doc.activeElement = this; }
    all() { return [this, ...this.children.flatMap((c) => c.all())]; }
  }
  doc.createElement = (t) => new El(t);
  doc.addEventListener = (...a) => doc.listeners.push(a);
  doc.removeEventListener = (t, fn) => { doc.listeners = doc.listeners.filter((l) => !(l[0] === t && l[1] === fn)); };
  return doc;
}

function drawn(over = {}) {
  const doc = fakeDoc();
  const got = { opens: [] };
  const v = SI.draw({
    doc, tr: en, lang: 'en', now: () => NOW,
    target: { kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' },
    keep: null, jotters: LIST, page: null, open: true, query: '', busy: false,
    onPick: () => {}, onKeep: () => {}, onOpen: (o, back) => got.opens.push([o, back]), onQuery: () => {},
    ...over,
  });
  return { doc, v, got, all: v.el.all() };
}

const cls = (e) => e.className.split(' ')[0];

test('the version is 0.9.1', () => {
  assert.equal(manifest().version, '0.9.1');
});

test('the sheet is pinned INSIDE the tab panel: the line is not positioned, the panel is, and the sheet sits on its bottom edge', () => {
  const css = SI.css('S', 'M');
  assert.match(css, /\.cd\.web \.pn\{position:relative\}/, 'the tab panel is the containing block');
  assert.match(css, /\.cd \.ito\{position:static\}/, 'the line no longer anchors the list');
  const ip = /\.cd \.ito \.ip\{([^}]*)\}/.exec(css)[1];
  assert.match(ip, /position:absolute;left:0;right:0;bottom:0;top:min\(96px,18%\)/, 'bottom-anchored with a fixed top inset: never taller than the panel');
  assert.match(ip, /overflow:hidden/);
  assert.doesNotMatch(css, /bottom:calc\(100% \+ 6px\)/, 'not the 0.9.0 pop-up that grew upwards from the line');
  assert.doesNotMatch(css, /100vh/, 'no viewport-sized height that ignores the panel');
  const lb = /\.cd \.ito \.lb\{([^}]*)\}/.exec(css)[1];
  assert.match(lb, /overflow-y:auto/, 'the rows scroll inside the sheet');
  assert.match(lb, /overscroll-behavior:contain/);
  assert.match(lb, /min-height:0/, 'a flex child that can shrink, so the foot stays in the sheet');
  assert.match(css, /\.cd \.ito \.isc\{position:absolute;inset:0;z-index:4;/, 'the scrim covers the panel');
  assert.match(css, /\.cd \.ito \.ift\{flex:none/, 'Keep saving is pinned at the foot');
});

test('the sheet: grab handle, "Save into" + Cancel, the search box first, then the rows, then Keep saving; a dialog named Save into', () => {
  const { all } = drawn();
  const pop = all.find((e) => e.className === 'ip');
  assert.equal(pop.getAttribute('role'), 'dialog');
  assert.equal(pop.getAttribute('aria-label'), 'Save into');
  assert.deepEqual(pop.children.map(cls), ['gb', 'shd', 'sr', 'lb', 'ift']);
  const head = pop.children[1];
  assert.deepEqual(head.children.map((c) => [c.tagName, c.textContent]), [['B', 'Save into'], ['BUTTON', 'Cancel']]);
  assert.equal(pop.children[2].getAttribute('placeholder'), 'Search, or type a key like JOT-31');
  assert.equal(pop.children[3].getAttribute('role'), 'listbox');
  assert.equal(pop.children[3].children.filter((c) => c.getAttribute('role') === 'option').length, 15, 'This page + all 14 Jotters, scrolled inside');
  assert.match(pop.children[4].textContent, /^Keep saving into JOT-27 today$/);
  const scrim = all.find((e) => e.className === 'isc');
  assert.equal(scrim.hidden, false);
  assert.ok(all.indexOf(scrim) < all.indexOf(pop), 'the scrim is drawn under the sheet');
});

test('closed: the scrim and the sheet are hidden', () => {
  const { all } = drawn({ open: false });
  assert.equal(all.find((e) => e.className === 'isc').hidden, true);
  assert.equal(all.find((e) => e.className === 'ip').hidden, true);
});

test('Cancel, a tap on the scrim and Esc close it and give the focus back to the line', () => {
  const a = drawn();
  a.all.find((e) => e.className === 'shd').children[1].fire('click');
  a.all.find((e) => e.className === 'isc').fire('click');
  a.v.box.fire('keydown', { key: 'Escape' });
  assert.deepEqual(a.got.opens, [[false, true], [false, true], [false, true]]);
});

test('"/" goes to the search box while the sheet is open, never while typing in it, and the listener goes with the sheet', () => {
  const { doc, v } = drawn();
  const key = doc.listeners.find((l) => l[0] === 'keydown');
  assert.ok(key, 'a keydown listener while open');
  const outside = { key: '/', target: {}, preventDefault() { this.prevented = true; } };
  key[1](outside);
  assert.equal(doc.activeElement, v.box);
  assert.equal(outside.prevented, true);
  const inBox = { key: '/', target: v.box, preventDefault() { this.prevented = true; } };
  key[1](inBox);
  assert.equal(inBox.prevented, undefined, 'a "/" typed in the box is a character');
  v.cleanup();
  assert.equal(doc.listeners.filter((l) => l[0] === 'keydown').length, 0);
  assert.equal(drawn({ open: false }).doc.listeners.length, 0, 'nothing listens while closed');
});

// ─── the saved card ───────────────────────────────────────────────────────

const desk = read('popup/web-desk.js');
const savedCard = desk.slice(desk.indexOf('function savedCard()'), desk.indexOf('// ─── the list from the background'));

test('the saved card: Done (navy) then Open my Jotter ↗ (outlined) in a row, and Undo this save as a link under them', () => {
  assert.match(savedCard, /var done = btn\('o', null, tr\('savedDone'\)\);/);
  assert.match(savedCard, /var open = btn\('n', null, tr\('savedOpen'\)\);/);
  assert.match(savedCard, /var undo = btn\('ul', null, tr\('savedUndo'\)\);/);
  assert.match(savedCard, /row\.appendChild\(done\);\s*row\.appendChild\(open\);\s*c\.appendChild\(row\);/);
  assert.match(savedCard, /if \(s\.saveId\) c\.appendChild\(undo\);/, 'Undo under the row, and only when something new was saved');
  const ul = desk.split('\n').find((l) => l.includes("'.cd .okc .ul{"));
  assert.ok(ul, 'the link has its own rule');
  assert.match(ul, /justify-self:center;/);
  assert.match(ul, /text-decoration:underline;/);
  assert.doesNotMatch(savedCard, /savedFine/, 'the fine line is gone from the web desk, as in the artifact');
});

test('Done closes the card and opens nothing; the Into choice and Keep saving are left exactly as they are', () => {
  const handler = /done\.addEventListener\('click', function \(\) \{([\s\S]*?)\n      \}\);/.exec(savedCard)[1];
  assert.match(handler, /st\.saved = null;/);
  assert.match(handler, /draw\(\);/);
  assert.doesNotMatch(handler, /openSite|heddy-ui:open|window\.open/, 'Open is still the only thing that leaves the page (D78)');
  assert.doesNotMatch(handler, /st\.into|setKeep|freshInto/, 'the next save goes to the same Jotter');
  assert.doesNotMatch(handler, /heddy-web:undo|heddy-cards/, 'Done sends nothing');
});

test('Undo this save still undoes: it deletes the save and the cards come back', () => {
  assert.match(savedCard, /undo\.addEventListener\('click', function \(\) \{[\s\S]*call\(\{ type: 'heddy-web:undo-save', saveId: s\.saveId \}\)[\s\S]*st\.saved = null;[\s\S]*if \(Array\.isArray\(r\.cards\)\) return setState\(r\);/);
  assert.match(savedCard, /st\.error = \{ key: 'savedUndoFailed' \};/);
});

test('strings, en and zh, in both catalogs and in the bundled lib/messages.js', () => {
  const want = {
    intoSheetTitle: ['Save into', '保存到'],
    intoCancel: ['Cancel', '取消'],
    intoKeyBox: ['Search, or type a key like JOT-31', '搜索，或输入编号，如 JOT-31'],
    savedDone: ['Done', '完成'],
    savedUndo: ['Undo this save', '撤销这次保存'],
  };
  const enM = JSON.parse(read('_locales/en/messages.json'));
  const zhM = JSON.parse(read('_locales/zh_CN/messages.json'));
  const bundled = globalThis.HeddyMessages;
  for (const [k, [e, z]] of Object.entries(want)) {
    assert.equal(enM[k].message, e, `en ${k}`);
    assert.equal(zhM[k].message, z, `zh ${k}`);
    assert.equal(bundled.en[k].message, e, `bundled en ${k}`);
    assert.equal(bundled.zh_CN[k].message, z, `bundled zh ${k}`);
    assert.doesNotMatch(z, /[一-鿿][,;:?!.]/, `${k}: full-width punctuation after Chinese`);
  }
  assert.ok(enM.savedFine, 'savedFine stays: the YouTube desk (content/desk.js) still draws it');
});
