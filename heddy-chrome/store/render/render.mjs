// Renders the Chrome Web Store screenshots (1280 × 800) and the small promo
// tile (440 × 280) into store/screenshots/.
//
// Each screenshot is the extension's real UI: the desk on YouTube is the
// manifest's own content scripts on a stand-in watch page, and the web desk is
// the real popup/popup.html in panel mode, both with a stubbed `chrome` that
// answers as aitutors.me would. The pages are neutral stand-ins (pages.mjs):
// no real site's branding or artwork, no real people, no child's data. Every
// request is answered from this folder or refused, so rendering touches no
// network either.
//
//   PLAYWRIGHT=/path/to/playwright/index.mjs node store/render/render.mjs
//
// Not shipped: scripts/shipped.mjs leaves store/ out of the store build.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'store', 'screenshots');
const EXT = 'https://heddy.test/ext/';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

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

// ─── what aitutors.me answers, for the stand-in video ────────────────────────

const VIDEO_ID = 'Fq2aPn3x_-A';
const YT_URL = 'https://www.youtube.com/watch?v=' + VIDEO_ID;
const MERCATOR = { code: 'GEOG', name: 'Mercator', nameZh: '墨卡托', sc: '#0d6882', scSoft: '#e1eff3' };
const LINES = [
  [0, 'Every map is much smaller than the land it shows.'],
  [6, 'So every map needs a scale, to tell us how much smaller.'],
  [13, 'The scale compares a distance on the map with the same distance on the ground.'],
  [21, 'There are three ways of writing it: as a ratio, as a line, or in words.'],
  [130, 'A ratio scale looks like this: one to fifty thousand.'],
  [137, 'One centimetre on the map stands for fifty thousand centimetres on the ground.'],
  [146, 'Fifty thousand centimetres is five hundred metres.'],
  [153, 'So two centimetres on the map is one kilometre on the ground.'],
  [161, 'If two villages are six centimetres apart, how far apart are they really?'],
  [170, 'Take a guess before we work it out together.'],
  [270, 'A line scale is drawn at the bottom of the map.'],
  [277, 'Lay a strip of paper along your route and mark both ends.'],
  [285, 'Then hold the strip against the line scale and read off the distance.'],
  [420, 'A route that bends needs a little more care.'],
  [427, 'Measure it in short straight pieces, then add them up.'],
];
const ZH = [
  '每张地图都比它所表示的土地小得多。', '所以每张地图都需要比例尺，告诉我们它缩小了多少。', '比例尺把地图上的距离和地面上的同一段距离作比较。',
  '比例尺有三种写法：比例式、线段式，或者用文字。', '比例式比例尺是这样的：一比五万。', '地图上的一厘米代表地面上的五万厘米。', '五万厘米就是五百米。',
  '所以地图上的两厘米就是地面上的一千米。', '如果两个村子在地图上相距六厘米，实际相距多远？', '先猜一猜，我们再一起算。',
  '线段比例尺画在地图的底部。', '把一张纸条沿着路线放好，标出两端。', '再把纸条放到线段比例尺上，读出距离。', '弯曲的路线需要多花点心思。', '把它分成一小段一小段直线来量，再加起来。',
];
const KEYPOINTS = {
  en: [
    'Mercator starts with why a map needs a scale at all: the map is smaller than the land, and the scale says by how much.',
    'A ratio scale such as 1:50 000 means one unit on the map is fifty thousand on the ground, so 2 cm stands for 1 km. Try the six-centimetre question before he answers it.',
    'A line scale is the quickest to use: mark the route on a strip of paper, then read it against the line.',
    'For a winding route, measure short straight pieces and add them together.',
  ],
  zh: [
    '墨卡托先讲地图为什么需要比例尺：地图比土地小，比例尺告诉我们小了多少。',
    '像 1:50 000 这样的比例式，表示地图上的一个单位等于地面上的五万个单位，所以 2 厘米代表 1 千米。在他讲答案之前，先试试那道六厘米的题。',
    '线段比例尺用起来最快：把路线标在纸条上，再对着线段读数。',
    '弯曲的路线，分成一小段一小段直线来量，再加起来。',
  ],
};
const QUIZ = {
  ok: true, checkId: '0f8fad5b-d9cb-469f-a165-70867728950e', subjectCode: 'GEOG', subject: 'Geography',
  tutor: { id: 'mercator', name: 'Mercator' }, topic: { id: 'map-scale', name: 'Map scales' }, range: { startSec: 0, endSec: 564 },
  predict: { prompt: 'On a 1:50 000 map, two villages are 6 cm apart. How far apart are they on the ground?', options: ['3 km', '6 km', '300 m'], hint: null },
  questions: [
    { prompt: 'On a 1:50 000 map, what does 2 cm on the map stand for?', options: ['1 km on the ground', '2 km on the ground', '50 m on the ground'], hint: 'One centimetre is fifty thousand centimetres. How many metres is that?' },
    { prompt: 'Which kind of scale do you use with a strip of paper?', options: ['A ratio scale', 'A line scale', 'A scale in words'], hint: 'Mercator holds the strip against something drawn at the bottom of the map.' },
    { prompt: 'How should you measure a route that bends?', options: ['In one straight line, end to end', 'In short straight pieces, added up', 'By counting the grid squares'], hint: 'Think about what happens to the bends if you go straight from end to end.' },
  ],
};
const JOTS = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', t: 137, kind: 'line', by: 'key', text: 'One centimetre on the map stands for fifty thousand centimetres on the ground.' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', t: 153, kind: 'line', by: 'key', text: 'So two centimetres on the map is one kilometre on the ground.' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000003', t: 158, kind: 'note', text: 'Strip of paper → line scale. Try the 6 cm question myself!' },
];

/** Runs in the watch page before its scripts: the background's answers, and
 *  the desk's closed shadow roots kept so the renderer can press its buttons. */
function stubDesk(d) {
  const orig = Element.prototype.attachShadow;
  window.__roots = [];
  Element.prototype.attachShadow = function (o) { const r = orig.call(this, o); window.__roots.push([this.tagName, r]); return r; };
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 564, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get: () => false, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', { get() { return window.__t ?? d.at; }, set(x) { window.__t = x; }, configurable: true });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
  const area = (o) => ({
    get: async (k) => { const ks = k == null ? Object.keys(o) : Array.isArray(k) ? k : [k]; const r = {}; ks.forEach((x) => { if (x in o) r[x] = o[x]; }); return r; },
    set: async (v) => { Object.assign(o, v); },
    remove: async (k) => { (Array.isArray(k) ? k : [k]).forEach((x) => delete o[x]); },
  });
  const lines = d.lines.map(([t, text]) => ({ t, text }));
  window.chrome = {
    runtime: {
      id: 'heddy',
      getURL: (p) => 'https://heddy.test/ext/' + p,
      sendMessage: async (m) => {
        if (m.type === 'heddy-desk:video') return { ok: true, signedIn: true, professor: d.professor, inMyClips: true, jotterHref: null, quiz: 'ready' };
        if (m.type === 'heddy-desk:transcript') {
          if (typeof m.zhFrom === 'number') return { ok: true, status: 'ok', lines, zh: { from: 0, to: 600, lines: lines.map((l, i) => ({ t: l.t, text: d.zh[i] })) }, zhState: 'ready' };
          return { ok: true, status: 'ok', lines, zh: null, zhState: 'idle' };
        }
        if (m.type === 'heddy-desk:keypoints') return { ok: true, status: 'ok', chapters: m.chapters.map((c, k) => ({ ...c, text: d.keypoints[m.lang][k] || null, points: [], written: true })) };
        if (m.type === 'heddy-desk:quiz') {
          if (m.action === 'start') return d.quiz;
          if (m.action === 'answer') { const right = [0, 1, 1][m.index] ?? 0; return { ok: true, correct: m.choice === right, correctIndex: right, explanation: d.explain[m.index] || '', misconception: null }; }
          if (m.action === 'finish') return { ok: true, correct: 2, misses: 1 };
          return { ok: true, minted: 1 };
        }
        return { ok: false };
      },
      connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} }, postMessage() {}, disconnect() {} }),
      onMessage: { addListener() {}, removeListener() {} },
    },
    i18n: { getUILanguage: () => (d.lang === 'zh_CN' ? 'zh-CN' : 'en-GB') },
    storage: {
      local: area(Object.assign({ seenFirstRun: true }, d.local || {})),
      sync: area({ lang: d.lang }),
      session: area({}),
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
}

const DESK = 'window.__roots.filter((x) => x[0] === "HEDDY-DESK").map((x) => x[1]).pop()';

/** The stand-in watch page with the desk open on `tab`. */
async function deskShot(browser, { tab, local, lang = 'en', act }) {
  const context = await browser.newContext({ viewport: RVIEW, deviceScaleFactor: 1 });
  await offline(context);
  const page = await context.newPage();
  await page.addInitScript(stubDesk, {
    at: 158, lang, local, professor: MERCATOR, lines: LINES, zh: ZH, keypoints: KEYPOINTS, quiz: QUIZ,
    explain: ['One centimetre stands for 50 000 cm, which is 500 m, so 2 cm is 1 km.', 'The line scale: mark the route on the strip, then read it against the line.', 'Short straight pieces follow the bends; one straight line would cut them off.'],
  });
  await page.goto(YT_URL);
  for (const f of MANIFEST.content_scripts[0].js) await page.addScriptTag({ url: EXT + f });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__roots.filter((x) => x[0] === 'HEDDY-ACTIONS').map((x) => x[1]).pop().querySelector('button').click());
  await page.waitForTimeout(900);
  if (tab) {
    await page.evaluate(`[...(${DESK}).querySelectorAll('.tabs .tab')].find((t) => t.textContent.trim().startsWith(${JSON.stringify(tab)})).click()`);
    await page.waitForTimeout(500);
  }
  if (act) await act(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot();
  await context.close();
  return png;
}

// ─── the web desk (popup.html in panel mode) ─────────────────────────────────

const ARTICLE = 'https://www.example.org/notes/reading-map-scales';
const QUOTE_A = 'On a 1:50 000 map, 2 cm represents 1 km on the ground.';
const QUOTE_B = 'The line scale is the easiest to use: lay a strip of paper along the route, mark the ends, then hold it against the line.';

/** Runs in popup.html?host=panel: the background's answers for one tab. */
function stubPanel(d) {
  const tab = { id: 7, windowId: 1, url: d.url, title: 'Reading map scales' };
  const area = (o) => ({ get: async () => o, set: async () => {}, remove: async () => {} });
  window.chrome = {
    runtime: {
      id: 'heddy',
      getURL: (p) => 'https://heddy.test/ext/' + p,
      getManifest: () => ({ version: '0.8.1' }),
      sendMessage: async (m) => {
        if (m.type === 'heddy-cards:get') return { ok: true, url: d.url, cards: d.cards, counts: { text: d.cards.filter((c) => c.kind === 'text').length, picture: d.cards.filter((c) => c.kind === 'image').length } };
        if (m.type === 'heddy-page:professor') return { ok: true, code: 'GEOG', name: 'Mercator' };
        if (m.type === 'heddy-web:ask-pending') return d.ask ? { ok: true, pending: { ctx: d.ask.ctx, intent: null } } : { ok: true, pending: null };
        return { ok: false };
      },
      connect: () => {
        const on = [];
        return {
          onMessage: { addListener: (f) => on.push(f) }, onDisconnect: { addListener() {} }, disconnect() {},
          postMessage() {
            const send = (event, ms) => setTimeout(() => on.forEach((f) => f({ event })), ms);
            send({ type: 'professor', code: 'GEOG', name: 'Mercator' }, 20);
            d.ask.reply.forEach((part, i) => send({ type: 'delta', text: part }, 40 + i * 20));
            send({ type: 'done', turnsLeft: null }, 60 + d.ask.reply.length * 20);
          },
        };
      },
      onMessage: { addListener() {} },
      openOptionsPage() {},
    },
    tabs: { get: async () => tab, query: async () => [tab], sendMessage: async () => {}, create: async () => {} },
    scripting: { executeScript: async () => [{ result: null }] },
    storage: { local: area({ seenFirstRun: true }), sync: area({ lang: 'en' }), session: area({}), onChanged: { addListener() {} } },
    i18n: { getUILanguage: () => 'en-GB' },
  };
}

const DOCK = 410;

/** The article narrowed beside the panel, as Heddy docks it. */
async function webShot(browser, { cards, ask, select }) {
  const context = await browser.newContext({ viewport: { width: RVIEW.width - DOCK, height: RVIEW.height }, deviceScaleFactor: 1 });
  await offline(context);
  const page = await context.newPage();
  await page.goto(ARTICLE);
  if (select) await page.evaluate(highlight, select);
  await page.evaluate(() => document.fonts.ready);
  const left = await page.screenshot();
  const panel = await context.newPage();
  await panel.setViewportSize({ width: DOCK, height: RVIEW.height });
  panel.on('pageerror', (e) => console.error('panel:', e.message));
  await panel.addInitScript(stubPanel, { url: ARTICLE, cards, ask });
  await panel.goto(EXT + 'popup/popup.html?tab=7&host=panel');
  await panel.waitForTimeout(900);
  if (ask && ask.question) {
    await panel.fill('.askb .fl', ask.question);
    await panel.press('.askb .fl', 'Enter');
    await panel.waitForTimeout(700);
  }
  await panel.evaluate(() => document.fonts.ready);
  await panel.waitForTimeout(200);
  const right = await panel.screenshot();
  await context.close();
  return { left, right };
}

/** Marks the picked words on the article the way the page layer numbers them. */
function highlight(marks) {
  for (const [n, q] of marks) {
    const p = [...document.querySelectorAll('p')].find((x) => x.textContent.includes(q));
    const node = p.firstChild;
    const at = node.textContent.indexOf(q);
    const r = document.createRange();
    r.setStart(node, at);
    r.setEnd(node, at + q.length);
    const m = document.createElement('mark');
    m.style.cssText = 'background:#fbeec4;border-radius:3px;padding:1px 0;box-shadow:0 0 0 1px #e8c86a';
    r.surroundContents(m);
    const b = document.createElement('b');
    b.textContent = n;
    b.style.cssText = 'display:inline-grid;place-items:center;width:18px;height:18px;margin-right:4px;border-radius:50%;background:#002147;color:#fff;font:700 11px Arial,sans-serif;vertical-align:2px';
    m.prepend(b);
  }
  const fig = document.querySelector('figure');
  fig.style.cssText += ';outline:2px solid #002147;outline-offset:4px;border-radius:8px;position:relative';
  const b = document.createElement('b');
  b.textContent = '3';
  b.style.cssText = 'position:absolute;left:-12px;top:-12px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#002147;color:#fff;font:700 12px Arial,sans-serif';
  fig.appendChild(b);
}

/** The article's map, as the picture card Snap a picture would keep. */
async function mapPicture(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  await offline(context);
  const page = await context.newPage();
  await page.goto(ARTICLE);
  const png = await page.locator('figure svg').screenshot();
  await context.close();
  return 'data:image/png;base64,' + png.toString('base64');
}

// ─── the frame: caption bar, browser window ──────────────────────────────────

// The browser window's page area inside a 1280 × 800 shot, and the larger
// viewport each page is rendered at and scaled into it, so the desk shows
// enough of itself (a 1280 × 800 window has room for little else).
const VIEW = { width: 1224, height: 576 };
const SCALE = 1.2;
const RVIEW = { width: Math.round(VIEW.width * SCALE), height: Math.round(VIEW.height * SCALE) };

const b64 = (buf) => 'data:image/png;base64,' + Buffer.from(buf).toString('base64');

function frameHtml({ title, line, address, pageImg, panelImg }) {
  const page = panelImg
    ? `<div style="display:flex;width:${VIEW.width}px;height:${VIEW.height}px"><img style="display:block;flex:none;width:${(RVIEW.width - DOCK) / SCALE}px;height:${VIEW.height}px" src="${pageImg}" alt=""><img style="display:block;flex:none;width:${DOCK / SCALE}px;height:${VIEW.height}px;box-shadow:-1px 0 0 #dde1e6" src="${panelImg}" alt=""></div>`
    : `<img class="pg" src="${pageImg}" alt="">`;
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${EXT}store/render/frame.css"></head>
<body><div class="shot">
  <header class="cap"><span class="mk" id="mk"></span><div><h1></h1><p></p></div></header>
  <div class="win">
    <div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="omni"></span><span class="tb"><span class="pin" id="pin"></span></span></div>
    <div class="page">${page}</div>
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
  writeFileSync(join(OUT, name), await page.screenshot());
  await context.close();
  console.log(name);
}

// ─── the shots ───────────────────────────────────────────────────────────────

const desk = (s) => `(${DESK}).querySelectorAll(${JSON.stringify(s)})`;

async function run() {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith('.png')) rmSync(join(OUT, f));
  const browser = await chromium.launch();
  try {
    const yt = 'youtube.com/watch?v=…';

    // 1 · The desk's Digest, following the player, with the professor's insights note.
    await compose(browser, '01-desk-digest.png', frameHtml({
      title: 'Study a video beside it',
      line: 'Watch with Heddy opens the desk: Jot, Digest, Insights and Quiz, in English or 中文.',
      address: yt, pageImg: b64(await deskShot(browser, { tab: 'Digest' })),
    }));

    // 2 · The Quiz: a question answered, with the hint used.
    await compose(browser, '02-desk-quiz.png', frameHtml({
      title: 'A quick quiz on the video',
      line: 'A hint when you want one. The questions you miss can become flashcards.',
      address: yt,
      pageImg: b64(await deskShot(browser, {
        tab: 'Quiz',
        act: async (page) => {
          const click = (s, i = 0) => page.evaluate(`${desk(s)}[${i}].click()`);
          await click('.cp-ask'); await page.waitForTimeout(400);
          // Predict: a guess, then on to the first question.
          await click('.vq-opt', 0); await click('.vq-row .vq-btn'); await page.waitForTimeout(250);
          await click('.vq-row .vq-btn'); await page.waitForTimeout(300);
          // Question 1: the hint open and an option picked, not yet checked.
          await page.evaluate(`[...${desk('.vq-btn.plain')}].find((b) => !b.disabled).click()`); await page.waitForTimeout(200);
          await click('.vq-opt', 0); await page.waitForTimeout(300);
        },
      })),
    }));

    // 3 · Jot: H took two lines and a note was typed.
    await compose(browser, '03-desk-jot.png', frameHtml({
      title: 'Press H to jot the line being spoken',
      line: 'Your jots wait on this computer until you Save to My Jotters.',
      address: yt, pageImg: b64(await deskShot(browser, { tab: 'Jot', local: { ['deskJots:' + VIDEO_ID]: JOTS } })),
    }));

    // 4 · Sources on a web page: two snippets and a picture, numbered.
    const picture = await mapPicture(browser);
    const cards = [
      { id: 'c1', n: 1, kind: 'text', quote: QUOTE_A },
      { id: 'c2', n: 2, kind: 'text', quote: QUOTE_B },
      { id: 'c3', n: 3, kind: 'image', png: picture },
    ];
    const src = await webShot(browser, { cards, select: [['1', QUOTE_A], ['2', QUOTE_B]] });
    await compose(browser, '04-web-sources.png', frameHtml({
      title: 'Keep words and pictures from any page',
      line: 'Each one is a numbered source. Save them to your Jotters, in your order.',
      address: 'example.org/notes/reading-map-scales', pageImg: b64(src.left), panelImg: b64(src.right),
    }));

    // 5 · Ask: the professor answers with a question back, not the answer.
    const ask = await webShot(browser, {
      cards,
      ask: {
        ctx: { about: 'words', n: 1, attach: { kind: 'text', quote: QUOTE_A, before: 'A map is much smaller than the land it shows.', after: 'So if two villages are 6 cm apart' } },
        question: 'Why is 2 cm one kilometre?',
        reply: ['Good question. Start with the 1. ', 'On a 1:50 000 map, 1 cm stands for 50 000 cm on the ground. ', 'How many metres is 50 000 cm? ', 'Once you have that, what would 2 cm be?'],
      },
      select: [['1', QUOTE_A], ['2', QUOTE_B]],
    });
    await compose(browser, '05-web-ask.png', frameHtml({
      title: 'Ask your professor about it',
      line: 'Questions and hints that help you work it out for yourself.',
      address: 'example.org/notes/reading-map-scales', pageImg: b64(ask.left), panelImg: b64(ask.right),
    }));

    // The small promo tile.
    await compose(browser, 'promo-440x280.png', `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${EXT}store/render/frame.css"></head>
<body class="tilebody"><div class="tile"><span class="mk" id="mk"></span><h1></h1><p></p><span class="pill"></span></div>
<script src="${EXT}lib/marks.js"></script><script>
  document.body.insertAdjacentHTML('afterbegin', HeddyMarks.sprite(['h-eyes']));
  document.getElementById('mk').insertAdjacentHTML('beforeend', HeddyMarks.use('h-eyes', 64));
  document.querySelector('h1').textContent = 'Heddy for Chrome';
  document.querySelector('p').textContent = 'Study videos and pages beside your professor.';
  document.querySelector('.pill').textContent = 'Works with aitutors.me';
</script></body></html>`, { width: 440, height: 280 });
  } finally {
    await browser.close();
  }
}

await run();
