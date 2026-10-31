// The Web Store listing in store/: the summary fits Chrome's 132 characters,
// both languages lead with "Works with aitutors.me", every permission the
// manifest asks for is justified in privacy-answers.md, and the pictures are
// the sizes the store accepts. store/ itself never ships in the package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, read, manifest, shippedFiles } from './helpers.mjs';

const between = (src, name) => {
  const m = src.match(new RegExp(`<!-- ${name}:start -->\\n([\\s\\S]*?)\\n<!-- ${name}:end -->`));
  assert.ok(m, `no ${name} block`);
  return m[1];
};

const LISTINGS = [
  { file: 'store/listing.en.md', lead: 'Works with aitutors.me.' },
  { file: 'store/listing.zh-CN.md', lead: '配合 aitutors.me 使用。' },
];

for (const { file, lead } of LISTINGS) {
  test(`${file}: the summary is one line of at most 132 characters, led by "works with aitutors.me"`, () => {
    const summary = between(read(file), 'summary');
    assert.ok(!summary.includes('\n'), 'the summary is one line');
    assert.ok([...summary].length <= 132, `${[...summary].length} characters`);
    assert.ok(summary.startsWith(lead), summary);
  });

  test(`${file}: the description starts with "works with aitutors.me" and keeps the promises`, () => {
    const d = between(read(file), 'description');
    assert.equal(d.split('\n')[0], lead);
    assert.ok([...d].length <= 16000, 'the store allows 16 000 characters');
    // D43: no default key for Jot it; Ctrl Shift J is DevTools on Windows.
    assert.doesNotMatch(d, /Ctrl Shift J|Ctrl\+Shift\+J/);
    assert.match(d, /Ctrl Shift K/);
    assert.match(d, /aitutors\.me/);
  });
}

test('the English listing names every tool that shipped, and the for-schools line', () => {
  const d = between(read('store/listing.en.md'), 'description');
  for (const s of ['Watch with Heddy', 'Add to My Clips', 'line being spoken', 'Save to Jotters', 'Save and jot now', '+ Text', 'Add picture to Heddy', 'Explain', 'Make a card', 'Ask Heddy', 'Save page to Jotters', 'Snap a picture', 'up to four pictures', 'Copy picture', 'Undo', 'Open in Jotter', 'until you tap Keep', 'only request of its own', 'keeps nothing it hears', 'only when you ask', 'FOR SCHOOLS']) {
    assert.ok(d.includes(s), `missing: ${s}`);
  }
  assert.doesNotMatch(d, /Jot it with Heddy|Jot this picture with Heddy/, 'Round 5: Heddy writes no jot from a page');
  assert.match(read('store/listing.en.md'), /\| Category \| Education \|/);
});

test('the Chinese listing uses full-width punctuation and 「」 quotes, not straight quotes', () => {
  const d = between(read('store/listing.zh-CN.md'), 'description');
  assert.doesNotMatch(d, /["“”]/, 'straight or curly double quotes');
  assert.doesNotMatch(d, /[一-鿿][,;:?!]/, 'a half-width mark after a Chinese character');
  assert.match(d, /「和 Heddy 一起看」/);
});

test('privacy-answers.md justifies every permission and host in the manifest, and nothing more', () => {
  const src = read('store/privacy-answers.md');
  const m = manifest();
  const rows = [...src.matchAll(/^\| (?:Host )?(`[^|]+`) \|/gm)].map((r) => r[1]);
  const named = rows.flatMap((r) => [...r.matchAll(/`([^`]+)`/g)].map((x) => x[1]));
  assert.deepEqual([...named].sort(), [...m.permissions, ...m.host_permissions].sort());
  assert.match(src, /not using remote code/);
  for (const k of ['sell or transfer', 'unrelated to my item', 'creditworthiness']) assert.ok(src.includes(k), k);
});

/** Width and height from a PNG's IHDR. */
function pngSize(file) {
  const b = readFileSync(join(ROOT, file));
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG', `${file} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('three to five 1280 × 800 screenshots and a 440 × 280 promo tile', () => {
  const dir = 'store/screenshots';
  const shots = readdirSync(join(ROOT, dir)).filter((f) => /^\d\d-.*\.png$/.test(f));
  assert.ok(shots.length >= 3 && shots.length <= 5, `${shots.length} screenshots`);
  for (const f of shots) assert.deepEqual(pngSize(`${dir}/${f}`), { w: 1280, h: 800 }, f);
  assert.deepEqual(pngSize(`${dir}/promo-440x280.png`), { w: 440, h: 280 });
  const listing = read('store/listing.en.md');
  for (const f of [...shots, 'promo-440x280.png']) assert.ok(listing.includes(`${dir}/${f}`), `${f} is not in the listing`);
});

test('store/ is never part of the package', () => {
  assert.ok(!shippedFiles().some((f) => f.startsWith('store/')));
});

test('website content is declared Yes (owner, 2026-10-30), with no fallback, and PRIVACY.md says the same', () => {
  const src = read('store/privacy-answers.md');
  assert.match(src, /^\| Website content \| \*\*Yes\*\* \|$/m);
  assert.doesNotMatch(src, /If the reviewer/);
  for (const k of ['Save to my Jotters', 'Add to Sources', 'Snap a picture', 'Ask {professor}', 'to aitutors.me', 'never sold', 'no credential']) assert.ok(src.includes(k), k);
  assert.match(read('PRIVACY.md'), /declared as \*\*website content\*\*/);
  assert.match(read('README.zh-CN.md'), /申报为「网站内容」/);
});
