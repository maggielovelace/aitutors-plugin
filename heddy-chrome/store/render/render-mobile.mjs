// Renders the App Store screenshots for Heddy for Safari on iPhone and iPad:
//   store/screenshots/iphone/   1320 × 2868 (6.9")   panel on a web page
//   store/screenshots/ipad/     2064 × 2752 (13")    the desk on YouTube, and the panel
// and the same in store/screenshots/zh-CN/{iphone,ipad}/ with HEDDY_LANG=zh_CN.
//
// The same real UI and stubs as render.mjs (the desk's content scripts, popup.html in
// panel mode), placed where content/panel.js puts the panel on a touch screen: below
// 700 px wide, a bottom sheet 12 px in from the edges (its height read from panel.js);
// wider, docked on the right at 410 px. The iPhone set has no desk shots: the desk has
// no phone layout yet, and these must show what Heddy really draws.
//
//   PLAYWRIGHT=/path/to/playwright/index.mjs node store/render/render-mobile.mjs
//   HEDDY_LANG=zh_CN PLAYWRIGHT=… node store/render/render-mobile.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARTICLE, ASK, CAPTIONS, EXT, LANG, MANIFEST, QUOTE_A, QUOTE_B, ZH_SET,
  b64, deskShot, highlight, mapPicture, offline, stubPanel,
} from './render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

// Each device: the canvas in CSS px and its pixel ratio (canvas × scale = Apple's size),
// the caption band, and the screen drawn below it.
// `real` is the device's own Safari viewport width: pages render at it and are scaled
// into the drawn screen, so the panel's sheet comes out as tall as on the device.
const DEVICES = {
  iphone: { canvas: { width: 440, height: 956 }, scale: 3, band: 176, mark: false, screen: { x: 30, y: 190, width: 380, height: 752, radius: 40 }, bar: 60, barAt: 'bottom', title: 27, line: 15, real: 440 },
  ipad: { canvas: { width: 1032, height: 1376 }, scale: 2, band: 220, mark: true, screen: { x: 24, y: 244, width: 984, height: 1108, radius: 28 }, bar: 56, barAt: 'top', title: 40, line: 21, real: 1032 },
};
const NARROW = 700;
// The phone sheet's height, read from content/panel.js so the shots follow the code.
const SHEET = (() => {
  const m = readFileSync(join(ROOT, 'content', 'panel.js'), 'utf8').match(/max-width: 700px\) and \(pointer: coarse\).*?height: min\((\d+)dvh, (\d+)px\)/);
  if (!m) throw new Error('content/panel.js: phone sheet height not found');
  return { dvh: Number(m[1]), px: Number(m[2]) };
})();
const DOCK = 410;
const INSET = 12;

// The Jot caption on a touch screen: tap Jot (the desk's own hint says so), H on a keyboard.
const JOT = ZH_SET
  ? ['记下正在说的那一句', '点「记下」，或用键盘按 H。点「存到我的 Jotters」就进批注本。']
  : ['Jot the line being spoken', 'Tap Jot, or press H on a keyboard. Save to My Jotters puts your jots in your Jotter.'];
const cap = (k) => (k === 'jot' ? { title: JOT[0], line: JOT[1] } : { title: CAPTIONS[k][0], line: CAPTIONS[k][1] });

/** The page area inside the screen, below or above the address bar, in drawn px. */
function pageArea(dev) {
  return { width: dev.screen.width, height: dev.screen.height - dev.bar };
}

/** The same area in the device's own CSS px, and the factor between the two. */
function realArea(dev) {
  const a = pageArea(dev);
  const k = dev.real / a.width;
  return { width: dev.real, height: Math.round(a.height * k), k };
}

/** The article, with Heddy's panel where panel.js puts it on a touch screen. */
async function webTouch(browser, dev, { cards, ask, select }) {
  const shown = pageArea(dev);
  const area = realArea(dev);
  const narrow = area.width <= NARROW;
  const pageW = narrow ? area.width : area.width - DOCK;
  const panel = narrow
    ? { width: area.width - 2 * INSET, height: Math.min(Math.round(area.height * SHEET.dvh / 100), SHEET.px) }
    : { width: DOCK - INSET, height: area.height - 2 * INSET };
  const context = await browser.newContext({ viewport: { width: pageW, height: area.height }, deviceScaleFactor: Math.ceil(dev.scale / area.k * 2) / 2, hasTouch: true, isMobile: narrow });
  await offline(context);
  const page = await context.newPage();
  await page.goto('https://www.example.org/notes/reading-map-scales');
  if (select) await page.evaluate(highlight, select);
  await page.evaluate(() => document.fonts.ready);
  const left = await page.screenshot();
  const p = await context.newPage();
  await p.setViewportSize(panel);
  p.on('pageerror', (e) => console.error('panel:', e.message));
  await p.addInitScript(stubPanel, { url: 'https://www.example.org/notes/reading-map-scales', cards, ask, lang: LANG, version: MANIFEST.version });
  await p.goto(EXT + 'popup/popup.html?tab=7&host=panel');
  await p.waitForTimeout(900);
  if (ask && ask.question) {
    await p.fill('.askb .fl', ask.question);
    await p.press('.askb .fl', 'Enter');
    await p.waitForTimeout(700);
  }
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  const right = await p.screenshot();
  await context.close();
  const img = (src, css) => `<img alt="" src="${src}" style="position:absolute;display:block;${css}">`;
  const inner = narrow
    ? img(b64(left), `left:0;top:0;width:${pageW}px;height:${area.height}px`) +
        img(b64(right), `left:${INSET}px;bottom:${INSET}px;width:${panel.width}px;height:${panel.height}px;border-radius:16px;box-shadow:0 14px 36px rgba(0,20,50,.28),0 0 0 1px rgba(0,33,71,.12)`)
    : img(b64(left), `left:0;top:0;width:${pageW}px;height:${area.height}px`) +
        img(b64(right), `left:${pageW}px;top:${INSET}px;width:${panel.width}px;height:${panel.height}px;border-radius:16px`);
  // Drawn at the device's size, then scaled into the screen.
  return `<div style="position:absolute;left:0;top:0;width:${area.width}px;height:${area.height}px;transform:scale(${1 / area.k});transform-origin:0 0">${inner}</div>`;
}

/** The desk on the stand-in YouTube page, at the iPad's page width. */
async function deskTouch(browser, dev, opts) {
  const shown = pageArea(dev);
  const area = realArea(dev);
  const png = await deskShot(browser, { ...opts, viewport: { width: area.width, height: area.height }, scale: Math.ceil(dev.scale / area.k * 2) / 2 });
  return `<img alt="" src="${b64(png)}" style="position:absolute;display:block;left:0;top:0;width:${shown.width}px;height:${shown.height}px">`;
}

function frame(dev, { title, line, address, inner }) {
  const s = dev.screen;
  const area = pageArea(dev);
  const bar = `<div class="mbar" style="height:${dev.bar}px;${dev.barAt}:0"><span class="mfield">${address}</span></div>`;
  const pageTop = dev.barAt === 'top' ? dev.bar : 0;
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${EXT}store/render/frame.css"><style>
  .mshot { width: ${dev.canvas.width}px; height: ${dev.canvas.height}px; position: relative; overflow: hidden; }
  .mcap { height: ${dev.band}px; box-sizing: border-box; padding: 0 ${s.x + 10}px; display: flex; flex-direction: column; justify-content: center; gap: 10px; background: #002147; color: #f6f1e7; }
  .mcap .mk svg { display: block; border-radius: 10px; box-shadow: 0 0 0 2px rgba(246, 241, 231, .25); }
  .mcap h1 { margin: 0; font: 800 ${dev.title}px/1.15 "Manrope", "PingFang SC", sans-serif; letter-spacing: -.01em; }
  .mcap p { margin: 0; font: 500 ${dev.line}px/1.4 "Manrope", "PingFang SC", sans-serif; color: rgba(246, 241, 231, .84); }
  .mscreen { position: absolute; left: ${s.x}px; top: ${s.y}px; width: ${s.width}px; height: ${s.height}px; border-radius: ${s.radius}px; overflow: hidden; background: #fff;
    box-shadow: 0 0 0 8px #1b2433, 0 24px 60px rgba(0, 33, 71, .28); }
  .mpage { position: absolute; left: 0; top: ${pageTop}px; width: ${area.width}px; height: ${area.height}px; overflow: hidden; }
  .mbar { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; background: #f2f2f4; border-${dev.barAt === 'top' ? 'bottom' : 'top'}: 1px solid #dcdde1; }
  .mfield { width: 74%; height: ${Math.round(dev.bar * 0.62)}px; border-radius: 12px; background: #e3e4e8; display: flex; align-items: center; justify-content: center; font: 500 ${Math.round(dev.bar * 0.26)}px Arial, sans-serif; color: #3c4043; }
</style></head><body><div class="mshot">
  <header class="mcap">${dev.mark ? '<span class="mk" id="mk"></span>' : ''}<h1></h1><p></p></header>
  <div class="mscreen"><div class="mpage">${inner}</div>${bar}</div>
</div>
<script src="${EXT}lib/marks.js"></script>
<script>
  document.querySelector('h1').textContent = ${JSON.stringify(title)};
  document.querySelector('.mcap p').textContent = ${JSON.stringify(line)};
  document.body.insertAdjacentHTML('afterbegin', HeddyMarks.sprite(['h-eyes']));
  const mk = document.getElementById('mk');
  if (mk) mk.insertAdjacentHTML('beforeend', HeddyMarks.use('h-eyes', 48));
</script></body></html>`;
}

async function compose(browser, dev, out, name, html) {
  const context = await browser.newContext({ viewport: dev.canvas, deviceScaleFactor: dev.scale });
  await offline(context);
  const page = await context.newPage();
  await page.route('https://heddy.test/frame', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://heddy.test/frame');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  writeFileSync(join(out, name), await page.screenshot());
  await context.close();
  console.log(join(out, name).slice(ROOT.length + 1));
}

async function run() {
  const browser = await chromium.launch();
  try {
    const picture = await mapPicture(browser);
    const cards = [
      { id: 'c1', n: 1, kind: 'text', quote: QUOTE_A },
      { id: 'c2', n: 2, kind: 'text', quote: QUOTE_B },
      { id: 'c3', n: 3, kind: 'image', png: picture },
    ];
    const select = [['1', QUOTE_A], ['2', QUOTE_B]];
    const ask = {
      ctx: { about: 'words', n: 1, attach: { kind: 'text', quote: QUOTE_A, before: 'A map is much smaller than the land it shows.', after: 'So if two villages are 6 cm apart' } },
      question: ASK.question, reply: ASK.reply,
    };
    const site = 'example.org';
    const yt = 'youtube.com';

    for (const [key, dev] of Object.entries(DEVICES)) {
      const out = join(ROOT, 'store', 'screenshots', ...(ZH_SET ? ['zh-CN'] : []), key);
      mkdirSync(out, { recursive: true });
      for (const f of readdirSync(out)) if (f.endsWith('.png')) rmSync(join(out, f));
      const shots = [];
      if (key === 'ipad') {
        shots.push(['01-desk-digest.png', 'digest', yt, () => deskTouch(browser, dev, { tab: 'Digest', local: { digestView: 'bi' } })]);
        shots.push(['02-desk-jot.png', 'jot', yt, () => deskTouch(browser, dev, { tab: 'Jot', local: { ['deskJots:Fq2aPn3x_-A']: JOTS } })]);
      }
      shots.push([`0${shots.length + 1}-web-sources.png`, 'sources', site, () => webTouch(browser, dev, { cards, select })]);
      shots.push([`0${shots.length + 1}-web-ask.png`, 'ask', site, () => webTouch(browser, dev, { cards, ask, select })]);
      for (const [name, k, address, inner] of shots) {
        await compose(browser, dev, out, name, frame(dev, { ...cap(k), address, inner: await inner() }));
      }
    }
  } finally {
    await browser.close();
  }
}

// The desk's jots on the iPad Jot shot: the same as render.mjs's.
const JOTS = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', t: 137, kind: 'line', by: 'key', text: 'One centimetre on the map stands for fifty thousand centimetres on the ground.' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', t: 153, kind: 'line', by: 'key', text: 'So two centimetres on the map is one kilometre on the ground.' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000003', t: 158, kind: 'note', text: ZH_SET ? '纸条 → 线段比例尺，6 厘米那题自己先试！' : 'Strip of paper → line scale. Try 6 cm myself!' },
];

await run();
