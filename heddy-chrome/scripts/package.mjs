// Builds the zip to upload to the Chrome Web Store:
//
//   node scripts/package.mjs            → dist/heddy-chrome-<version>.zip
//   node scripts/package.mjs --dev      → the same, keeping localhost:3000
//
// It zips exactly scripts/shipped.mjs's list (what the tests scan), with
// manifest.json at the zip's root. The store copy of the manifest drops
// http://localhost:3000/* from externally_connectable: that entry is only for
// people running aitutors.me on their own computer, and a reviewer would ask
// why a published extension listens to localhost. Everything else is the
// manifest as it is in the repository.
//
// No dependencies: the zip is written here with node:zlib, every entry dated
// 1980-01-01 so the same files always make the same bytes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';
import { ROOT, shippedFiles } from './shipped.mjs';

const DEV = process.argv.includes('--dev');
const TARGET = process.argv.find((arg) => arg.startsWith('--browser='))?.slice(10) ?? 'chrome';
const BROWSERS = ['chrome', 'edge', 'safari'];

/** The manifest the store receives. */
export function storeManifest(src, { dev = false, browser = 'chrome' } = {}) {
  if (!BROWSERS.includes(browser)) throw new Error('Unknown browser: ' + browser);
  const m = JSON.parse(src);
  if (browser !== 'chrome') delete m.minimum_chrome_version;
  if (browser === 'edge') delete m.update_url;
  if (browser === 'safari') {
    delete m.options_ui.open_in_tab;
    const mobileWatch = 'https://m.youtube.com/watch*';
    m.host_permissions.push(mobileWatch);
    if (dev) m.host_permissions.push('http://localhost:3000/*');
    m.content_scripts[0].matches.push(mobileWatch);
    m.browser_specific_settings = { safari: { strict_min_version: '17.4' } };
    // The panel uses the URL returned by Safari; this Chromium option is optional.
    for (const resource of m.web_accessible_resources) delete resource.use_dynamic_url;
  }
  if (!dev && m.externally_connectable && Array.isArray(m.externally_connectable.matches)) {
    m.externally_connectable.matches = m.externally_connectable.matches.filter((u) => !/^https?:\/\/localhost[:/]/.test(u));
  }
  if ('key' in m) throw new Error('manifest.json has a "key": the store assigns the id; remove it');
  return JSON.stringify(m, null, 2) + '\n';
}

/** A zip of [name, bytes] entries (deflated, or stored when that is smaller). */
export function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(stored ? 0 : 8, 8);
    head.writeUInt16LE(0, 10);
    head.writeUInt16LE(DOS_DATE, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    head.writeUInt16LE(0, 28);
    local.push(head, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(stored ? 0 : 8, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += head.length + nameBuf.length + body.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cenBuf, end]);
}

/** Apple's limits for a Safari web extension's resolved name and description. */
export const SAFARI_NAME_MAX = 40;
export const SAFARI_DESCRIPTION_MAX = 112;

/** [name, bytes] for every shipped file, the store manifest in place of the repository's. */
export function entries({ dev = false, browser = 'chrome' } = {}) {
  return shippedFiles().map((name) => {
    const data = readFileSync(join(ROOT, name));
    if (name === 'manifest.json') {
      return [name, Buffer.from(storeManifest(data.toString('utf8'), { dev, browser }))];
    }
    if (browser !== 'chrome' && /^_locales\/[^/]+\/messages\.json$/.test(name)) {
      const locale = JSON.parse(data.toString('utf8'));
      const label = browser === 'edge' ? 'Microsoft Edge' : 'Safari';
      locale.extName.message = locale.extName.message.replace('Chrome', label);
      if (browser === 'safari') {
        // Apple rejects the upload unless the resolved name is <= 40 characters
        // and the description <= 112 (App Store Connect messages.json check).
        locale.extName.message = locale.extName.message.split(/[:：]/)[0].trim();
        if (locale.extDescriptionSafari) locale.extDescription.message = locale.extDescriptionSafari.message;
        const where = name.split('/')[1];
        if (locale.extName.message.length > SAFARI_NAME_MAX) throw new Error(`${where}: Safari extName over ${SAFARI_NAME_MAX} characters`);
        if (locale.extDescription.message.length > SAFARI_DESCRIPTION_MAX) throw new Error(`${where}: Safari extDescription over ${SAFARI_DESCRIPTION_MAX} characters`);
      }
      return [name, Buffer.from(JSON.stringify(locale, null, 2) + '\n')];
    }
    return [name, data];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = entries({ dev: DEV, browser: TARGET });
  const version = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).version;
  const out = join(ROOT, 'dist', `heddy-${TARGET}-${version}${DEV ? '-dev' : ''}.zip`);
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const bytes = zip(list);
  writeFileSync(out, bytes);
  for (const [name, data] of list) console.log(String(data.length).padStart(9), name);
  console.log(`\n${list.length} files → ${out}`);
  console.log(`${bytes.length} bytes (${(bytes.length / 1024).toFixed(1)} KB)`);
}
