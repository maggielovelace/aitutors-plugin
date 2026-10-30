// Renders the Chrome Web Store screenshots (1280 × 800) and the small promo
// tile (440 × 280) into store/screenshots/.
//
// Each screenshot uses the extension's real popup, tray, toast and box mode,
// with a stubbed `chrome`, on neutral stand-in pages: no real site's branding
// or artwork, no real people. Every request is answered from this folder or
// refused, so rendering touches no network either.
//
//   PLAYWRIGHT=/path/to/playwright/index.mjs node store/render/render.mjs
//
// Not shipped: tests/helpers.mjs leaves store/ out of the store build.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'store', 'screenshots');
const EXT = 'https://heddy.test/ext/';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

/** Answers heddy.test from the extension folder and the stand-in hosts from
 *  pages.mjs; refuses everything else. */
async function offline(context) {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin + '/ext/' === EXT && url.pathname.startsWith('/ext/')) {
      const file = join(ROOT, decodeURIComponent(url.pathname.slice(5)));
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[extname(file)] || 'application/octet-stream', body: readFileSync(file) });
    }
    const page = PAGES[url.origin + url.pathname];
    if (page) return route.fulfill({ status: 200, contentType: 'text/html', body: page });
    return route.abort();
  });
}

// ─── a stubbed chrome ────────────────────────────────────────────────────────

/** Runs in every page before its scripts. opts.popup describes the popup's tab. */
function stubChrome(opts) {
  const listeners = [];
  const local = opts.local || {};
  window.__sent = [];
  window.chrome = {
    runtime: {
      id: 'heddy',
      sendMessage: (m) => { window.__sent.push(m); return Promise.resolve(opts.replies && opts.replies[m && m.type] || { ok: true }); },
      onMessage: { addListener: (f) => listeners.push(f) },
      openOptionsPage: () => {},
      getManifest: () => ({ version: '0.2.0' }),
    },
    i18n: { getUILanguage: () => (opts.lang === 'zh_CN' ? 'zh-CN' : 'en-GB') },
    storage: {
      local: { get: () => Promise.resolve(local), set: () => Promise.resolve() },
      sync: { get: () => Promise.resolve(opts.lang ? { lang: opts.lang } : {}), set: () => Promise.resolve() },
      session: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener: () => {} },
    },
    commands: { getAll: () => Promise.resolve(opts.commands || []) },
    tabs: {
      query: () => Promise.resolve(opts.tab ? [opts.tab] : []),
      create: () => Promise.resolve(),
    },
    scripting: {
      executeScript: (o) => {
        if (o.files) return Promise.resolve([]);
        const src = String(o.func);
        if (/currentTime/.test(src)) return Promise.resolve([{ result: opts.video || null }]);
        if (/selection\(\)/.test(src)) return Promise.resolve([{ result: opts.selection || null }]);
        return Promise.resolve([{ result: null }]);
      },
    },
  };
  /** What the background would send this tab. */
  window.__heddyTell = (msg) => new Promise((resolve) => {
    let answered = false;
    for (const f of listeners) f(msg, { id: 'heddy' }, (x) => { answered = true; resolve(x); });
    setTimeout(() => { if (!answered) resolve(null); }, 400);
  });
}

async function inject(page, files) {
  for (const f of files) await page.addScriptTag({ url: EXT + f });
}

const FONT = ['lib/font-data.js', 'lib/fonts.js'];
const PAGE_FILES = [...FONT, 'lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/marks.js', 'lib/toast.js', 'lib/tray-tools.js', 'lib/tools.js', 'content/extract.js', 'content/page-tray.js'];
const YT_FILES = [...FONT, 'lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/marks.js', 'lib/toast.js', 'lib/jot-key.js', 'content/youtube-selectors.js', 'content/youtube.js'];
const BOX_FILES = [...FONT, 'lib/messages.js', 'lib/i18n.js', 'lib/marks.js', 'content/box-mode.js'];

// The browser window's page area inside a 1280 × 800 shot.
const VIEW = { width: 1224, height: 576 };

async function pageShot(browser, { url, files, stub, act }) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  await offline(context);
  const page = await context.newPage();
  await page.addInitScript(stubChrome, stub || {});
  await page.goto(url);
  await inject(page, files);
  await page.evaluate(() => document.fonts.ready);
  if (act) await act(page);
  await page.waitForTimeout(350);
  const png = await page.screenshot();
  await context.close();
  return png;
}

async function popupShot(browser, stub) {
  const context = await browser.newContext({ viewport: { width: 360, height: 600 }, deviceScaleFactor: 1 });
  await offline(context);
  const page = await context.newPage();
  await page.addInitScript(stubChrome, stub);
  await page.goto(EXT + 'popup/popup.html');
  await page.waitForSelector('#body > *');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const png = await page.locator('#pop').screenshot();
  const fam = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  await context.close();
  return { png, fonts: fam };
}

// ─── the frame: caption bar, browser window, the popup over it ───────────────

const b64 = (buf) => 'data:image/png;base64,' + Buffer.from(buf).toString('base64');

function frameHtml({ title, line, address, pageImg, popupImg, popupRight = 16, extraHtml = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${EXT}store/render/frame.css"></head>
<body><div class="shot">
  <header class="cap"><span class="mk" id="mk"></span><div><h1></h1><p></p></div></header>
  <div class="win">
    <div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="omni"></span><span class="tb"><span class="pin" id="pin"></span></span></div>
    <div class="page"><img class="pg" src="${pageImg}" alt="">${popupImg ? `<img class="pop" style="right:${popupRight}px" src="${popupImg}" alt="">` : ''}${extraHtml}</div>
  </div>
</div>
<script src="${EXT}lib/marks.js"></script>
<script>
  const M = HeddyMarks;
  document.querySelector('h1').textContent = ${JSON.stringify(title)};
  document.querySelector('.cap p').textContent = ${JSON.stringify(line)};
  document.querySelector('.omni').textContent = ${JSON.stringify(address)};
  document.body.insertAdjacentHTML('afterbegin', M.sprite(['h-eyes']));
  document.getElementById('mk').insertAdjacentHTML('beforeend', M.use('h-eyes', 52));
  document.getElementById('pin').insertAdjacentHTML('beforeend', M.use('h-eyes', 20));
</script></body></html>`;
}

async function compose(browser, name, html, size = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  await offline(context);
  const page = await context.newPage();
  await page.route('https://heddy.test/frame', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://heddy.test/frame');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight));
  const file = join(OUT, name);
  writeFileSync(file, await page.screenshot());
  await context.close();
  console.log(name, 'fonts:', [...new Set(fonts)].join(', ') || 'none');
}

// ─── the shots ───────────────────────────────────────────────────────────────

const YT_URL = 'https://www.youtube.com/watch?v=Fq2aPn3x_-A';
const ARTICLE = 'https://www.example.org/notes/reading-map-scales';
const INSTALL = 'https://www.example.org/heddy-install';
const QUOTE = 'On a 1:50 000 map, 2 cm represents 1 km on the ground.';
const ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const JOTTER = '7ba7b810-9dad-41d1-80b4-00c04fd430c9';
const SEEN = { seenFirstRun: true };

async function selectQuote(page) {
  await page.evaluate((q) => {
    const p = [...document.querySelectorAll('p')].find((x) => x.textContent.includes(q));
    const node = p.firstChild;
    const at = node.textContent.indexOf(q);
    const r = document.createRange();
    r.setStart(node, at);
    r.setEnd(node, at + q.length);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, QUOTE);
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    // 1 · YouTube: the two buttons after Share, and the popup.
    const video = { t: 168, duration: 564, title: 'Using scales on maps', channel: 'Sample Geography' };
    const yt = await pageShot(browser, { url: YT_URL, files: YT_FILES, stub: { local: SEEN } });
    const ytPop = await popupShot(browser, { local: SEEN, tab: { id: 1, windowId: 1, url: YT_URL, title: 'Using scales on maps' }, video });
    console.log('popup fonts:', [...new Set(ytPop.fonts)].join(', '));
    await compose(browser, '01-youtube.png', frameHtml({
      title: 'Watch with Heddy, or add it to My Clips',
      line: 'Two buttons on every YouTube video. H jots the line being spoken.',
      address: 'youtube.com/watch?v=…', pageImg: b64(yt), popupImg: b64(ytPop.png),
    }));

    // 2 · Selected words: the tray.
    const tray = await pageShot(browser, {
      url: ARTICLE, files: PAGE_FILES, stub: { local: SEEN },
      act: async (page) => { await selectQuote(page); await page.evaluate(() => window.__heddyTell({ type: 'heddy-ui:tray' })); },
    });
    await compose(browser, '02-selection-tray.png', frameHtml({
      title: 'Select words, then Jot it',
      line: 'Or Explain, Make a card, or Ask Heddy. Nothing is kept until you tap Keep.',
      address: 'example.org/notes/reading-map-scales', pageImg: b64(tray),
    }));

    // 3 · Snap a picture: box mode, a box drawn over the diagram.
    const box = await pageShot(browser, {
      url: ARTICLE, files: BOX_FILES, stub: { local: SEEN },
      act: async (page) => {
        await page.evaluate(() => window.__heddyTell({ type: 'heddy-box:start', id: 'collection-01' }));
        await page.waitForTimeout(250);
        const r = await page.evaluate(() => { const b = document.querySelector('figure svg').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
        await page.mouse.move(r.x + 14, r.y + 12);
        await page.mouse.down();
        await page.mouse.move(r.x + r.w * 0.6, r.y + r.h * 0.55, { steps: 6 });
        await page.mouse.move(r.x + r.w - 14, r.y + r.h - 12, { steps: 6 });
        await page.mouse.up();
      },
    });
    await compose(browser, '03-snap-picture.png', frameHtml({
      title: 'Snap a picture',
      line: 'Box a diagram and jot it, up to four pictures in one jot. Or copy it.',
      address: 'example.org/notes/reading-map-scales', pageImg: b64(box),
    }));

    // 4 · The Jotted toast, with Undo.
    const toast = await pageShot(browser, {
      url: ARTICLE, files: PAGE_FILES, stub: { local: SEEN },
      act: async (page) => {
        await selectQuote(page);
        await page.evaluate(({ q, id, jotter }) => window.__heddyTell({ type: 'heddy-ui:toast', kind: 'jotted', quote: q, jotId: id, jotterId: jotter, href: 'https://aitutors.me/study/jotters/' + jotter }), { q: QUOTE, id: ID, jotter: JOTTER });
      },
    });
    await compose(browser, '04-jotted-toast.png', frameHtml({
      title: 'Jotted, with where it came from',
      line: 'Changed your mind? Undo. Your Jotter is one tap away.',
      address: 'example.org/notes/reading-map-scales', pageImg: b64(toast),
    }));

    // 5 · Install: three steps, and the first-time popup.
    const steps = await pageShot(browser, { url: INSTALL, files: FONT, stub: {} });
    const firstPop = await popupShot(browser, { local: {}, tab: { id: 1, windowId: 1, url: INSTALL, title: 'Heddy' } });
    await compose(browser, '05-install.png', frameHtml({
      title: 'Add it, pin it, sign in as the child',
      line: 'No account in Heddy itself: everything is kept on aitutors.me.',
      address: 'example.org', pageImg: b64(steps), popupImg: b64(firstPop.png),
    }));

    // The small promo tile.
    await compose(browser, 'promo-440x280.png', `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${EXT}store/render/frame.css"></head>
<body class="tilebody"><div class="tile"><span class="mk" id="mk"></span><h1></h1><p></p><span class="pill"></span></div>
<script src="${EXT}lib/marks.js"></script><script>
  document.body.insertAdjacentHTML('afterbegin', HeddyMarks.sprite(['h-eyes']));
  document.getElementById('mk').insertAdjacentHTML('beforeend', HeddyMarks.use('h-eyes', 64));
  document.querySelector('h1').textContent = 'Heddy for Chrome';
  document.querySelector('p').textContent = 'Keep what you find.';
  document.querySelector('.pill').textContent = 'Works with aitutors.me';
</script></body></html>`, { width: 440, height: 280 });
  } finally {
    await browser.close();
  }
}

await run();
