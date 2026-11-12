// Renders the store icons from icons/src/eyes-mark.svg:
//   store/icons/edge-logo-300.png       Edge Add-ons store logo (300 × 300, transparent margin)
//   store/icons/appstore-icon-1024.png  App Store icon (1024 × 1024, full bleed, no transparency)
//   store/icons/mac-icon-1024.png       macOS app icon master (the rounded crest on Apple's 824 px grid)
//
//   PLAYWRIGHT=/path/to/playwright/index.mjs node store/render/icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'store', 'icons');
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const mark = readFileSync(join(ROOT, 'icons', 'src', 'eyes-mark.svg'), 'utf8');
// The App Store masks the corners itself, so its icon is a plain square.
const square = mark.replace(/<rect width="48" height="48" rx="11"/, '<rect width="48" height="48"');

async function render(name, size, svg, inset, opaque) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const s = size - inset * 2;
  await page.setContent(`<html><body style="margin:0;background:${opaque ? '#002147' : 'transparent'}">
    <div style="position:absolute;left:${inset}px;top:${inset}px;width:${s}px;height:${s}px">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`);
  writeFileSync(join(OUT, name), await page.screenshot({ omitBackground: !opaque }));
  await browser.close();
  console.log(name);
}

mkdirSync(OUT, { recursive: true });
await render('edge-logo-300.png', 300, mark, 38, false); // the 128 px icon's 16 px margin, scaled
await render('appstore-icon-1024.png', 1024, square, 0, true);
await render('mac-icon-1024.png', 1024, mark, 100, false);
