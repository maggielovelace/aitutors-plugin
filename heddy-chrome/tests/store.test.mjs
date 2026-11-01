// The Web Store listing in store/: the summary fits Chrome's 132 characters,
// both languages lead with "Works with aitutors.me", every permission the
// manifest asks for is justified in privacy-answers.md, and the pictures are
// the sizes the store accepts. store/ itself never ships in the package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, load, read, manifest, shippedFiles } from './helpers.mjs';

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

test('the English listing names every tool 0.8.1 ships, and the for-schools line', () => {
  const d = between(read('store/listing.en.md'), 'description');
  for (const s of ['Watch with Heddy', 'EN | 中', 'Jot', 'Digest', 'Insights', 'Quiz', 'Bilingual', 'line being spoken', 'Save to My Jotters', 'Full desk', 'Add to My Clips', 'Sources', '+ Text', '+ Picture', 'Save n to my Jotters', 'Save this page to my Jotters', 'Mentor', 'Save to Jotters', 'Add picture to Heddy', 'Explain', 'Make a card', 'Snap a picture', 'up to four pictures', 'Copy picture', 'Undo', 'Open in Jotter', 'only when you ask', 'no analytics', 'FOR SCHOOLS']) {
    assert.ok(d.includes(s), `missing: ${s}`);
  }
  assert.doesNotMatch(d, /Jot it with Heddy|Jot this picture with Heddy/, 'Round 5: Heddy writes no jot from a page');
  assert.match(read('store/listing.en.md'), /\| Category \| Education \|/);
});

for (const { file } of LISTINGS) {
  test(`${file}: no price, and never a tutor who hands over the answer`, () => {
    const d = between(read(file), 'description');
    assert.doesNotMatch(d, /£|\$|€|price|pricing|subscription|free trial|per month|价格|订阅|免费试用|每月|英镑/i, 'no pricing in the listing');
    assert.doesNotMatch(d, /gives? (you )?(the )?answers?|answers? for you|does your homework|solves? it for you|直接给(你)?答案|替你做/i, 'the hint-ladder promise');
  });
}

test('the Chinese listing uses full-width punctuation and 「」 quotes, not straight quotes', () => {
  const d = between(read('store/listing.zh-CN.md'), 'description');
  assert.doesNotMatch(d, /["“”]/, 'straight or curly double quotes');
  assert.doesNotMatch(d, /[一-鿿][,;:?!]/, 'a half-width mark after a Chinese character');
  assert.match(d, /「和 Heddy 一起看」/);
});

test('privacy-answers.md justifies every permission and host in the manifest, and nothing more', () => {
  const src = read('store/privacy-answers.md').split('## Permission justifications')[1].split('\n## ')[0];
  const m = manifest();
  const rows = [...src.matchAll(/^\| (?:Host )?(`[^|]+`) \|/gm)].map((r) => r[1]);
  const named = rows.flatMap((r) => [...r.matchAll(/`([^`]+)`/g)].map((x) => x[1]));
  assert.deepEqual([...named].sort(), [...m.permissions, ...m.host_permissions].sort());
  const all = read('store/privacy-answers.md');
  assert.match(all, /not using remote code/);
  for (const k of ['sell or transfer', 'unrelated to my item', 'creditworthiness']) assert.ok(all.includes(k), k);
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

// ─── every request and every stored key is named in the privacy answers ─────

const PRIVACY_DOCS = ['store/privacy-answers.md', 'PRIVACY.md'];
const JS = shippedFiles().filter((f) => /\.(js|mjs)$/.test(f));

/** Code with comments removed, so a comment cannot satisfy or trip a scan. */
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');

/** Every request path the extension can make: the three PATHS tables. */
function requestPaths() {
  const desk = load('./lib/desk-api.js').PATHS;
  const heddy = read('lib/heddy-api.js').match(/var PATHS = \{([^}]*)\}/)[1];
  const base = read('lib/heddy-api.js').match(/var BASE = '([^']+)'/)[1];
  const web = [...heddy.matchAll(/BASE \+ '([^']+)'/g)].map((m) => base + m[1]);
  return [load('./lib/who.js').PATH, ...Object.values(desk), ...web];
}

test('every request path the shipped code can make is named in privacy-answers.md and PRIVACY.md', () => {
  const paths = requestPaths();
  // The scan is not vacuous: the twelve of 0.8.1 are all found.
  assert.equal(paths.length, 12, paths.join(' '));
  for (const p of ['/api/learn/heddy/me', '/api/learn/heddy/desk/quiz', '/api/learn/heddy/desk/keypoints', '/api/learn/heddy/ask']) assert.ok(paths.includes(p), p);
  for (const doc of PRIVACY_DOCS) {
    const src = read(doc);
    for (const p of paths) assert.ok(src.includes('`GET ' + p + '`') || src.includes('`POST ' + p + '`') || src.includes('`' + p + '`'), `${doc} does not name ${p}`);
  }
});

test('no /api/ path is written anywhere in shipped code except the three PATHS tables', () => {
  const owners = new Set(['lib/who.js', 'lib/desk-api.js', 'lib/heddy-api.js']);
  for (const f of JS) {
    if (owners.has(f)) continue;
    assert.doesNotMatch(code(f), /['"`]\/api\//, `${f} writes an /api/ path outside the PATHS tables`);
  }
});

/** Every chrome.storage key: each `var …KEY|PREFIX = '…'` and the desk's PREF table. */
function storageKeys() {
  const keys = new Set();
  for (const f of JS) {
    for (const m of code(f).matchAll(/var (\w*(?:KEY|PREFIX)) = '([^']+)'/g)) keys.add(m[2]);
  }
  const pref = code('content/desk.js').match(/var PREF = \{([^}]*)\}/);
  assert.ok(pref, 'content/desk.js has no PREF table');
  for (const m of pref[1].matchAll(/'([^']+)'/g)) keys.add(m[1]);
  return [...keys];
}

test('every chrome.storage key in the shipped code is named in privacy-answers.md and PRIVACY.md', () => {
  const keys = storageKeys();
  for (const k of ['lang', 'deskJots:', 'deskWidth', 'digestView', 'seenFirstRun', 'devOrigin', 'heddyCids', 'heddyCards:']) assert.ok(keys.includes(k), `scan missed ${k}`);
  for (const doc of PRIVACY_DOCS) {
    const src = read(doc);
    for (const k of keys) assert.ok(src.includes('`' + k + '`'), `${doc} does not name the storage key ${k}`);
  }
});

test('chrome.storage is only ever called with a named key, never a string or object literal', () => {
  let calls = 0;
  for (const f of JS) {
    for (const m of code(f).matchAll(/storage\.(?:local|sync|session)\.(?:get|set|remove)\(([^)]*)\)|\bsession\.(?:get|set|remove)\(([^)]*)\)/g)) {
      calls++;
      const arg = m[1] !== undefined ? m[1] : m[2];
      assert.doesNotMatch(arg, /['"`{]/, `${f}: storage call with a literal key: ${m[0]}`);
    }
  }
  assert.ok(calls >= 20, `only ${calls} storage calls seen`);
});
