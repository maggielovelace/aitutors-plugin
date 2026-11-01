// The upload zip (scripts/package.mjs): exactly the shipped files, manifest at
// the root, nothing of the repository's own, and a store-ready manifest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT, read, manifest, shippedFiles } from './helpers.mjs';
import { zip, entries, storeManifest } from '../scripts/package.mjs';

/** The zip's entries, read back from its central directory: { name: bytes }. */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const at = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const body = buf.subarray(at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28), at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28) + size);
    out[name] = method === 8 ? inflateRawSync(body) : body;
    p += 46 + nameLen;
  }
  return out;
}

const files = unzip(zip(entries()));
const names = Object.keys(files);

test('the zip holds exactly the shipped files, manifest.json at its root, byte for byte', () => {
  assert.deepEqual(names, shippedFiles());
  assert.ok(names.includes('manifest.json'));
  for (const f of names) if (f !== 'manifest.json') assert.ok(files[f].equals(readFileSync(join(ROOT, f))), f);
});

test('nothing of the repository’s own is zipped', () => {
  for (const f of names) {
    assert.doesNotMatch(f, /^(tests|scripts|store|dist|node_modules|icons\/src)\//, f);
    assert.doesNotMatch(f, /(^|\/)(\.DS_Store|\._[^/]*|\.gitignore)$/, f);
    assert.doesNotMatch(f, /\.svg$/, f);
    assert.ok(!['README.md', 'README.zh-CN.md', 'package.json'].includes(f), f);
  }
  for (const f of ['background.js', 'PRIVACY.md', 'LICENSE', 'fonts/OFL.txt', 'icons/store-128.png', '_locales/en/messages.json', '_locales/zh_CN/messages.json']) assert.ok(names.includes(f), `${f} is missing`);
});

test('every file the manifest names is in the zip', () => {
  const m = manifest();
  const named = [
    m.background.service_worker, m.options_ui.page,
    ...Object.values(m.icons), ...Object.values(m.action.default_icon),
    ...m.content_scripts.flatMap((c) => c.js),
    ...m.web_accessible_resources.flatMap((w) => w.resources),
  ];
  for (const f of named) assert.ok(names.includes(f), `${f} is named in the manifest but not zipped`);
});

test('the store manifest drops localhost and nothing else; --dev keeps it', () => {
  const repo = manifest();
  const store = JSON.parse(files['manifest.json'].toString('utf8'));
  assert.deepEqual(store.externally_connectable.matches, ['https://aitutors.me/*']);
  assert.ok(!JSON.stringify(store).includes('localhost'));
  assert.deepEqual({ ...store, externally_connectable: null }, { ...repo, externally_connectable: null });
  assert.deepEqual(JSON.parse(storeManifest(read('manifest.json'), { dev: true })), repo);
  assert.throws(() => storeManifest(JSON.stringify({ ...repo, key: 'x' })), /"key"/);
});

test('the manifest is store-ready: no key, localised name and description within Chrome’s limits, all four icon sizes', () => {
  const m = manifest();
  assert.ok(!('key' in m));
  assert.ok(!('update_url' in m), 'the store sets update_url');
  assert.equal(m.name, '__MSG_extName__');
  assert.equal(m.description, '__MSG_extDescription__');
  assert.ok([...m.short_name].length <= 12, 'short_name: 12 characters');
  for (const loc of readdirSync(join(ROOT, '_locales'))) {
    const msg = JSON.parse(read(`_locales/${loc}/messages.json`));
    assert.ok([...msg.extName.message].length <= 75, `${loc} name: 75 characters`);
    assert.ok([...msg.extDescription.message].length <= 132, `${loc} description: 132 characters`);
  }
  assert.deepEqual(Object.keys(m.icons).sort(), ['128', '16', '32', '48']);
  for (const [size, f] of Object.entries(m.icons)) {
    const b = readFileSync(join(ROOT, f));
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [Number(size), Number(size)], f);
  }
});

test('dist/ is ignored by git and never scanned as shipped', () => {
  assert.match(read('.gitignore'), /^dist\/$/m);
  if (existsSync(join(ROOT, 'dist'))) assert.ok(!shippedFiles().some((f) => f.startsWith('dist/')));
});

/** RGBA rows of an 8-bit RGBA, non-interlaced PNG. */
function rgba(file) {
  const b = readFileSync(join(ROOT, file));
  assert.equal(b[25], 6, `${file} is not RGBA`);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  const idat = [];
  for (let p = 8; p < b.length;) {
    const len = b.readUInt32BE(p);
    if (b.toString('latin1', p + 4, p + 8) === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rows = [];
  let prev = Buffer.alloc(w * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (w * 4 + 1)];
    const line = Buffer.from(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)));
    for (let i = 0; i < line.length; i++) {
      const a = i >= 4 ? line[i - 4] : 0;
      const up = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      line[i] = (line[i] + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255;
    }
    rows.push(line);
    prev = line;
  }
  return { w, h, at: (x, y) => [...rows[y].subarray(x * 4, x * 4 + 4)] };
}

test('the store icon is the navy eyes crest at 96 px inside a transparent 16 px border (owner, 2026-11-01)', () => {
  const img = rgba('icons/store-128.png');
  assert.deepEqual([img.w, img.h], [128, 128]);
  for (let i = 0; i < 128; i++) {
    for (const [x, y] of [[i, 0], [i, 15], [i, 112], [i, 127], [0, i], [15, i], [112, i], [127, i]]) assert.equal(img.at(x, y)[3], 0, `${x},${y} is not transparent`);
  }
  // The crest's navy (#002147) fills the square, opaque, from 16 to 111.
  for (const [x, y] of [[20, 64], [107, 64], [64, 20], [64, 107]]) assert.deepEqual(img.at(x, y), [0x00, 0x21, 0x47, 255], `${x},${y}`);
  const sh = read('scripts/render-icons.sh');
  assert.match(sh, /rsvg-convert -w 96 -h 96 --page-width 128 --page-height 128 --left 16 --top 16 src\/eyes-mark\.svg -o store-128\.png/);
  assert.ok(!existsSync(join(ROOT, 'icons/src/store-128.svg')), 'the gold-ring face is retired');
});
