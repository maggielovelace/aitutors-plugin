// Loads the built zip, unpacked, in headless Chromium and fails on any
// install warning, manifest error, runtime error or page error.
//
//   node scripts/package.mjs
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/verify-zip.mjs [dist/heddy-chrome-<v>.zip]
//
// It opens the options page, the popup and a stand-in YouTube watch page (so
// the content scripts run). Every request leaves nowhere: aitutors.me answers
// "signed out" (401, which Chrome logs for the options page's who-is-signed-in
// question; that one line is expected) and the watch page is a local stand-in.
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { ROOT } from './shipped.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const version = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).version;
const file = process.argv[2] || join(ROOT, 'dist', `heddy-chrome-${version}.zip`);

/** Unzips scripts/package.mjs's output (deflate or stored, no data descriptors). */
function unzipTo(buf, dir) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(end + 16);
  for (let i = buf.readUInt16LE(end + 10); i > 0; i--) {
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const at = buf.readUInt32LE(p + 42);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const body = buf.subarray(start, start + buf.readUInt32LE(p + 20));
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), buf.readUInt16LE(p + 10) === 8 ? inflateRawSync(body) : body);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'heddy-zip-'));
unzipTo(readFileSync(file), dir);
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'heddy-profile-')), {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
});
const problems = [];
const expected = /Failed to load resource: the server responded with a status of 401/;
try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = sw.url().split('/')[2];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => problems.push(`${tag}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !expected.test(m.text())) problems.push(`${tag}: ${m.text()}`); });
  };
  await ctx.route('https://aitutors.me/**', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"signed_out"}' }));
  await ctx.route('https://www.youtube.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Stand-in - YouTube</title><ytd-watch-flexy><div id="primary"><div id="movie_player"><video></video></div><ytd-watch-metadata><div id="title"><h1>Stand-in</h1></div><div id="top-level-buttons-computed"></div></ytd-watch-metadata></div><div id="secondary"></div></ytd-watch-flexy>' }));

  // Developer mode on, so Chrome keeps the extension's runtime errors.
  const ext = await ctx.newPage();
  await ext.goto('chrome://extensions');
  await ext.evaluate(() => new Promise((res) => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, res)));
  // …and reload it, so an error while the service worker starts is kept too.
  await ext.evaluate((x) => new Promise((res) => chrome.developerPrivate.reload(x, { failQuietly: true }, res)), id);
  await ext.waitForTimeout(1500);

  for (const path of ['options/options.html', 'popup/popup.html']) {
    const page = await ctx.newPage();
    watch(page, path);
    await page.goto(`chrome-extension://${id}/${path}`);
    await page.waitForTimeout(1500);
    await page.close();
  }
  const yt = await ctx.newPage();
  watch(yt, 'youtube watch page');
  await yt.goto('https://www.youtube.com/watch?v=Xq3aPn3x_-A');
  await yt.waitForTimeout(2500);
  const drew = await yt.evaluate(() => [...document.querySelectorAll('*')].some((e) => e.tagName.startsWith('HEDDY-')));
  if (!drew) problems.push('youtube watch page: the content scripts drew nothing');
  await yt.close();

  const [info] = await ext.evaluate(() => new Promise((res) => chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true }, res)));
  for (const k of ['installWarnings', 'manifestErrors', 'runtimeErrors']) for (const e of info[k] || []) problems.push(`${k}: ${e.message || JSON.stringify(e)}`);
  if (info.state !== 'ENABLED') problems.push(`state: ${info.state}`);
  console.log(`${info.name} ${info.version} loaded from ${file} (id ${id}), ${info.state}`);
} finally {
  await ctx.close();
}
if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log('zero errors: no install warning, manifest error, runtime error or page error');
