// Manrope ships inside the extension (SIL OFL 1.1). The popup and options
// page load it from fonts/ with @font-face; the page surfaces register the
// same bytes with new FontFace(bytes), so no page can probe for a font URL.
// The popup's own two files are web accessible only because the popup is now
// a frame in the page (lib/panel.js), and only at a per-session dynamic URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT, load, read, manifest, shippedFiles } from './helpers.mjs';
import { renderFontData, FACES } from '../scripts/build-fonts.mjs';

const WOFF2 = ['fonts/manrope-latin.woff2', 'fonts/manrope-latin-ext.woff2'];
const PAGE_SURFACES = ['lib/toast.js', 'content/youtube.js', 'content/page-tray.js', 'content/box-mode.js', 'lib/snap.js'];

test('the font files and their licence are in fonts/, and they are real woff2', () => {
  for (const f of WOFF2) {
    assert.ok(existsSync(join(ROOT, f)), `${f} is missing`);
    const head = readFileSync(join(ROOT, f)).subarray(0, 4).toString('latin1');
    assert.equal(head, 'wOF2', `${f} is not woff2`);
    assert.ok(statSync(join(ROOT, f)).size < 64 * 1024, `${f} is bigger than a subset should be`);
  }
  const ofl = read('fonts/OFL.txt');
  assert.match(ofl, /SIL Open Font License, Version 1\.1/);
  assert.match(ofl, /Manrope Project Authors/);
  for (const f of [...WOFF2, 'fonts/OFL.txt']) assert.ok(shippedFiles().includes(f), `${f} does not ship`);
});

test('lib/font-data.js is up to date with fonts/ (run node scripts/build-fonts.mjs)', () => {
  assert.equal(read('lib/font-data.js'), renderFontData());
  assert.deepEqual(FACES.map((f) => f.file), WOFF2);
});

/** Every @font-face block in a stylesheet. */
const fontFaces = (css) => css.match(/@font-face\s*\{[^}]*\}/g) || [];

for (const css of ['popup/popup.css', 'options/options.css']) {
  test(`${css}: every @font-face is a bundled file, swapped, 500–800`, () => {
    const src = read(css);
    const faces = fontFaces(src);
    assert.equal(faces.length, WOFF2.length, 'one @font-face per bundled subset');
    const urls = [];
    for (const face of faces) {
      assert.match(face, /font-family:\s*"Manrope"/);
      assert.match(face, /font-display:\s*swap/);
      assert.match(face, /font-weight:\s*500 800/);
      for (const [, u] of face.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) urls.push(u);
    }
    // No url() anywhere in the stylesheet points outside the extension.
    for (const [, u] of src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      assert.ok(!/^(https?:)?\/\/|^data:/.test(u), `${css} loads ${u}`);
      assert.ok(existsSync(join(ROOT, dirname(css), u)), `${css} names ${u}, which is not bundled`);
    }
    assert.deepEqual(urls.map((u) => join(dirname(css), u)).sort(), [...WOFF2].sort());
    assert.match(src, /--sans:\s*"Manrope"/, 'the stack still leads with Manrope');
  });
}

test('every page surface uses the one stack, which leads with the private family', () => {
  const F = load('./lib/fonts.js');
  assert.equal(F.SANS, '"Heddy Manrope",Manrope,Roboto,Arial,sans-serif');
  for (const f of PAGE_SURFACES) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
    assert.ok(code.includes(F.SANS), `${f} does not use the stack`);
    // Take the stack out: any Manrope left is one that skips the bundled face.
    assert.doesNotMatch(code.split(F.SANS).join(''), /Manrope/, `${f} names Manrope outside the stack`);
    assert.doesNotMatch(code, /@font-face/, `${f} declares an @font-face (a URL a page could see)`);
  }
});

test('the font files are injected first, wherever page UI is injected or declared', () => {
  const FONT = ['lib/font-data.js', 'lib/fonts.js'];
  const { CONTENT_FILES, PAGE_FILES } = load('./lib/courier.js');
  const { BOX_FILES, FONT_FILES } = load('./lib/snap.js');
  assert.deepEqual(FONT_FILES, FONT);
  for (const list of [CONTENT_FILES, PAGE_FILES, BOX_FILES, manifest().content_scripts[0].js]) {
    assert.deepEqual(list.slice(0, 2), FONT);
  }
});

test('the dropped-pictures line gets the fonts injected before it shows', () => {
  const src = read('lib/snap.js');
  const at = src.indexOf('func: showDroppedLine');
  const before = src.slice(Math.max(0, at - 400), at);
  assert.match(before, /files:\s*FONT_FILES/);
});

test('the page surfaces need no web-accessible font: only the panel’s frame, at a dynamic URL', () => {
  const war = manifest().web_accessible_resources;
  assert.equal(war.length, 1);
  assert.equal(war[0].use_dynamic_url, true);
  const fonts = war[0].resources.filter((r) => r.startsWith('fonts/'));
  assert.deepEqual(fonts.sort(), [...WOFF2].sort(), 'the two the popup’s @font-face names, nothing else');
  for (const f of PAGE_SURFACES) assert.doesNotMatch(read(f), /getURL\(['"]fonts\//, `${f} loads a font URL`);
});

/** A document with a FontFaceSet, and a FontFace that records what it was given. */
function fakes() {
  const made = [];
  class FakeFontFace {
    constructor(family, source, descriptors) { this.family = family; this.source = source; this.descriptors = descriptors; made.push(this); }
  }
  const added = [];
  const doc = { fonts: { add: (f) => added.push(f) } };
  return { FakeFontFace, doc, added, made };
}

test('load registers each bundled face under "Heddy Manrope", from bytes, with its range', () => {
  globalThis.HeddyFontData = load('./lib/font-data.js');
  const F = load('./lib/fonts.js');
  const { FakeFontFace, doc, added } = fakes();
  assert.equal(F.load(doc, FakeFontFace), 2);
  assert.equal(added.length, 2);
  added.forEach((face, i) => {
    assert.equal(face.family, 'Heddy Manrope');
    assert.ok(face.source instanceof ArrayBuffer, 'a FontFace from bytes, not a URL');
    const want = readFileSync(join(ROOT, WOFF2[i]));
    assert.ok(Buffer.from(face.source).equals(want), `${WOFF2[i]} bytes differ`);
    assert.equal(face.descriptors.weight, '500 800');
    assert.equal(face.descriptors.display, 'swap');
    assert.equal(face.descriptors.unicodeRange, FACES[i].unicodeRange);
  });
});

test('a second load for the same document adds nothing (every gesture re-injects the file)', () => {
  const F = load('./lib/fonts.js');
  const { FakeFontFace, doc, added } = fakes();
  F.load(doc, FakeFontFace);
  assert.equal(F.load(doc, FakeFontFace), 0);
  assert.equal(added.length, 2);
});

test('without FontFace, document.fonts or the data, load does nothing and throws nothing', () => {
  const F = load('./lib/fonts.js');
  const { FakeFontFace, doc } = fakes();
  assert.equal(F.load({}, FakeFontFace), 0);
  if (typeof globalThis.FontFace !== 'function') assert.equal(F.load(doc), 0);
  const saved = globalThis.HeddyFontData;
  globalThis.HeddyFontData = undefined;
  try { assert.equal(F.load(fakes().doc, FakeFontFace), 0); } finally { globalThis.HeddyFontData = saved; }
});

test('a face that fails to build leaves the others and the fallback stack', () => {
  const F = load('./lib/fonts.js');
  let n = 0;
  class Flaky { constructor() { if (n++ === 0) throw new Error('bad'); } }
  const { doc, added } = fakes();
  assert.equal(F.load(doc, Flaky), 1);
  assert.equal(added.length, 1);
  assert.match(F.SANS, /^"Heddy Manrope",Manrope,Roboto,Arial,sans-serif$/);
});
