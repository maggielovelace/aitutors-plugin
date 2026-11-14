// PRD-v0.146.0 "Heddy in your browser", the extension's half: the welcome
// page's ?b= (P2), heddy:ping's pinned (P2), and which screen the popup draws
// (P3, B7–B9). The en ↔ zh_CN key parity is tests/messages.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
const C = load('./lib/config.js');
globalThis.HeddyConfig = C;
const S = load('./lib/popup-state.js');
const K = load('./lib/page-kind.js');
const { createCourier } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const UA = {
  chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
const SAFARI_BASE = 'safari-web-extension://8E2B4A0C/';

// ─── P2: which browser, and the welcome page's ?b= ──────────────────────────

test('browserOf: Chrome, Edge by brand or by Edg/, Safari on Mac, Safari on iPhone and on an iPad asking for desktop sites', () => {
  assert.equal(C.browserOf({ baseUrl: 'chrome-extension://x/', userAgent: UA.chrome, brands: [{ brand: 'Google Chrome' }] }), 'chrome');
  assert.equal(C.browserOf({ baseUrl: 'chrome-extension://x/', userAgent: UA.chrome, brands: [{ brand: 'Microsoft Edge' }, { brand: 'Chromium' }] }), 'edge');
  assert.equal(C.browserOf({ baseUrl: 'chrome-extension://x/', userAgent: UA.edge }), 'edge');
  assert.equal(C.browserOf({ baseUrl: SAFARI_BASE, userAgent: UA.mac, maxTouchPoints: 0 }), 'safari-mac');
  assert.equal(C.browserOf({ baseUrl: SAFARI_BASE, userAgent: UA.iphone }), 'safari-ios');
  assert.equal(C.browserOf({ baseUrl: SAFARI_BASE, userAgent: UA.mac, maxTouchPoints: 5 }), 'safari-ios', 'iPadOS reports a Mac');
  assert.equal(C.browserOf({}), 'chrome');
  assert.equal(C.browserOf(null), 'chrome');
});

test('detectBrowser reads the runtime’s own scheme and the navigator', () => {
  const g = (base, ua, brands) => ({ chrome: { runtime: { getURL: () => base } }, navigator: { userAgent: ua, userAgentData: brands ? { brands } : undefined, maxTouchPoints: 0 } });
  assert.equal(C.detectBrowser(g('chrome-extension://a/', UA.edge)), 'edge');
  assert.equal(C.detectBrowser(g(SAFARI_BASE, UA.mac)), 'safari-mac');
  assert.equal(C.detectBrowser(g('chrome-extension://a/', UA.chrome, [{ brand: 'Google Chrome' }])), 'chrome');
  assert.equal(C.detectBrowser({}), 'chrome', 'no chrome, no navigator');
});

test('welcomeUrl adds ?b= for the four browsers it knows, and nothing for anything else', () => {
  for (const b of ['chrome', 'edge', 'safari-mac', 'safari-ios']) {
    assert.equal(C.welcomeUrl('https://aitutors.me', 'en', b), `https://aitutors.me/heddy-chrome/welcome?b=${b}`);
  }
  assert.equal(C.welcomeUrl('https://aitutors.me', 'zh_CN', 'edge'), 'https://aitutors.me/zh/heddy-chrome/welcome?b=edge');
  assert.equal(C.welcomeUrl('https://aitutors.me', 'en'), 'https://aitutors.me/heddy-chrome/welcome', 'an old caller is unchanged');
  assert.equal(C.welcomeUrl('https://aitutors.me', 'en', 'firefox'), 'https://aitutors.me/heddy-chrome/welcome');
  assert.equal(C.welcomeUrl('https://aitutors.me', 'en', 'chrome&x=1'), 'https://aitutors.me/heddy-chrome/welcome');
});

function courierFor({ browser = 'chrome', action } = {}) {
  const tabs = [];
  const chrome = {
    runtime: { id: 'heddy', getManifest: () => ({ version: '0.10.0' }) },
    i18n: { getUILanguage: () => 'en-GB' },
    storage: { session: { get: async () => ({}), set: async () => {} }, local: { get: async () => ({}) }, sync: { get: async () => ({}) } },
    tabs: { create: async (o) => { tabs.push(o.url); } },
    action,
  };
  return { courier: createCourier({ chrome, store: createCidStore(), randomUUID: () => 'x', setTimeout: () => {}, browser }), tabs };
}
const site = { origin: 'https://aitutors.me', url: 'https://aitutors.me/heddy-chrome/welcome', tab: { id: 5, windowId: 1 } };
const PING = { type: 'heddy:ping', v: 1 };

test('install opens the welcome page with this browser’s ?b=', async () => {
  for (const b of ['chrome', 'edge', 'safari-mac', 'safari-ios']) {
    const s = courierFor({ browser: b });
    await s.courier.installed({ reason: 'install' });
    assert.deepEqual(s.tabs, [`https://aitutors.me/heddy-chrome/welcome?b=${b}`]);
  }
});

test('heddy:ping answers pinned: true / false from chrome.action.getUserSettings, keeping the old fields', async () => {
  for (const isOnToolbar of [true, false]) {
    const s = courierFor({ action: { getUserSettings: async () => ({ isOnToolbar }) } });
    assert.deepEqual(await s.courier.external(PING, site), { type: 'heddy:pong', v: 1, version: '0.10.0', pinned: isOnToolbar });
  }
});

test('heddy:ping answers pinned: null where the browser can’t tell: Safari, no API, an error, an odd answer', async () => {
  const cases = [
    { browser: 'safari-mac', action: { getUserSettings: async () => ({ isOnToolbar: true }) } },
    { browser: 'safari-ios', action: {} },
    { action: undefined },
    { action: {} },
    { action: { getUserSettings: async () => { throw new Error('no'); } } },
    { action: { getUserSettings: () => { throw new Error('sync'); } } },
    { action: { getUserSettings: async () => ({}) } },
    { action: { getUserSettings: async () => null } },
  ];
  for (const c of cases) {
    const reply = await courierFor(c).courier.external(PING, site);
    assert.equal(reply.pinned, null, JSON.stringify(c.browser || c.action && Object.keys(c.action)));
    assert.equal(reply.type, 'heddy:pong');
  }
});

test('the site’s current reader still accepts the answer (type, v, a short version)', async () => {
  const reply = await courierFor({ action: { getUserSettings: async () => ({ isOnToolbar: true }) } }).courier.external(PING, site);
  // lib/capture/presence.ts isHeddyPong on aitutors.me
  assert.ok(reply.type === 'heddy:pong' && reply.v === 1 && typeof reply.version === 'string' && reply.version.length > 0 && reply.version.length <= 40);
});

// ─── P3: which screen ───────────────────────────────────────────────────────

const OWN = 'heddyid';
const CHILD = { signedIn: true, role: 'child', firstName: 'Shan' };
const PARENT = { signedIn: true, role: 'parent' };
const OUT = { signedIn: false };
function input(url, extra = {}) {
  const site = /^https:\/\/(.+\.)?aitutors\.me\//.test(url);
  return { url, cant: url ? K.describe(url, OWN) : null, site, youtube: /youtube\.com\/watch\?v=/.test(url), ...extra };
}
const PAGES = {
  readable: 'https://en.wikipedia.org/wiki/Water_cycle',
  youtube: 'https://www.youtube.com/watch?v=Fq2aPn3x_-A',
  unreadable: 'chrome://extensions/',
  aitutors: 'https://aitutors.me/study',
};
const DONE = { seenFirstRun: true };

test('after the first time, each page gets its own screen; the web page and YouTube are the unchanged desks (B7)', () => {
  for (const me of [CHILD, OUT, null]) {
    assert.equal(S.choose(input(PAGES.readable, { local: DONE, me })), 'page');
    assert.equal(S.choose(input(PAGES.youtube, { local: DONE, me })), 'youtube');
    assert.equal(S.choose(input(PAGES.unreadable, { local: DONE, me })), 'cant');
    assert.equal(S.choose(input(PAGES.aitutors, { local: DONE, me })), 'site');
  }
  assert.equal(S.choose(input('', { local: DONE })), 'cant', 'an address the browser hid');
  assert.equal(S.choose(input('https://x.example/a.pdf', { local: DONE })), 'cant');
  assert.equal(S.choose(input('https://microsoftedge.microsoft.com/addons/detail/x', { local: DONE })), 'cant', 'Edge Add-ons keep extensions out too');
});

test('first time × signed in / out on a readable page and on YouTube', () => {
  for (const url of [PAGES.readable, PAGES.youtube]) {
    assert.equal(S.choose(input(url, { local: {}, me: null })), 'wait', 'ask /me first');
    assert.equal(S.choose(input(url, { local: {}, me: CHILD })), 'intro');
    assert.equal(S.choose(input(url, { local: {}, me: OUT })), 'first-out');
    assert.equal(S.choose(input(url, { local: {}, me: PARENT })), 'first-out', 'a grown-up: Heddy saves for a child');
  }
});

test('the first time never covers aitutors.me or a page Heddy can’t read: they lead with signing in already', () => {
  for (const me of [CHILD, OUT, null]) {
    assert.equal(S.choose(input(PAGES.unreadable, { local: {}, me })), 'cant');
    assert.equal(S.choose(input(PAGES.aitutors, { local: {}, me })), 'site');
  }
});

test('shown once: the signed-out first time stores "out", then the intro still comes on the first signed-in open', () => {
  assert.deepEqual(S.remember('first-out'), { seenFirstRun: 'out' });
  const local = S.remember('first-out');
  assert.equal(S.choose(input(PAGES.readable, { local, me: OUT })), 'page', 'not twice');
  assert.equal(S.choose(input(PAGES.readable, { local, me: CHILD })), 'intro');
  assert.equal(S.choose(input(PAGES.readable, { local, me: null })), 'wait');
  const done = S.remember(S.INTRO_DONE);
  assert.deepEqual(done, { seenFirstRun: true, seenIntro: true });
  assert.equal(S.choose(input(PAGES.readable, { local: done, me: CHILD })), 'page', 'Skip or the last card: never again');
  assert.equal(S.remember('page'), null);
});

test('an install from before 0.10 (seenFirstRun: true) never sees the intro and never waits for /me', () => {
  assert.equal(S.firstTimeOpen({ seenFirstRun: true }), false);
  assert.equal(S.choose(input(PAGES.readable, { local: { seenFirstRun: true }, me: null })), 'page');
  assert.equal(S.choose(input(PAGES.readable, { local: { seenIntro: true }, me: null })), 'page');
});

test('the popup draws the state lib/popup-state.js chooses, and the intro’s end is stored by name', () => {
  const pop = read('popup/popup.js');
  assert.match(pop, /return begin\(HeddyPopupState\.choose\(input\)\);/);
  assert.match(pop, /if \(state === 'wait'\) \{\s*return loadWho\(\)/);
  assert.match(pop, /var done = HeddyPopupState\.remember\(HeddyPopupState\.INTRO_DONE\);/);
  assert.match(read('popup/popup.html'), /<script src="\.\.\/lib\/page-kind\.js"><\/script>\s*<script src="\.\.\/lib\/popup-state\.js"><\/script>/);
});

test('no dead ends: Can’t read, aitutors.me and the first time each have one primary action and the three doors', () => {
  const pop = read('popup/popup.js');
  // Can't read: Open my Jotters (in) / Sign in (out).
  assert.match(pop, /hkButton\('save', 'jot', tr\('hkOpenJotters'\)/);
  assert.match(pop, /si\.appendChild\(hkButton\('save', 'user', tr\('whoSignIn'\)/);
  // aitutors.me: My Study (no due count reaches Heddy), carry on, Watch with Heddy.
  assert.match(pop, /hkButton\('save', 'cap', tr\('whoOpenStudy'\)/);
  assert.match(pop, /type: 'heddy-web:jotters'/);
  assert.match(pop, /tr\('hkWatchWith'\)/);
  // First time: three cards, Skip, Back / Next / Try it on this page.
  assert.match(pop, /var INTRO = \[\['s1', 'hkI1h', 'hkI1'\], \['s2', 'hkI2h', 'hkI2'\], \['s3', 'hkI3h', 'hkI3'\]\];/);
  assert.match(pop, /skip\.addEventListener\('click', introDone\);/);
  for (const f of ['intro-sources', 'intro-jot', 'intro-ask']) assert.match(read('popup/popup.css'), new RegExp(`url\\("img/${f}\\.png"\\)`));
});

test('the panel takes the 380 px screens', () => {
  assert.match(read('content/panel.js'), /var w = \(m\.w === 400 \|\| m\.w === 380 \? m\.w : WIDTH\) \+ 'px';/);
  assert.match(read('popup/popup.js'), /b\.contains\('yt'\) \? 400 : b\.contains\('hk'\) \? 380 : 360/);
});

test('Edge’s own pages and store get Edge’s words', () => {
  globalThis.HeddyMessages = load('./lib/messages.js');
  const I = load('./lib/i18n.js');
  const en = I.translator('en');
  assert.equal(en(K.describe('edge://settings/', OWN).chip, 'Edge'), 'Edge settings');
  assert.equal(en(K.describe('edge://extensions/', OWN).chip, 'Edge'), 'Extensions');
  assert.equal(en(K.describe('https://microsoftedge.microsoft.com/addons/x', OWN).chip), 'Edge Add-ons');
  assert.equal(en('hkWhyBrowser', 'Edge'), "It's one of Edge's own pages. Edge keeps its own pages private from every extension, Heddy included.");
});

test('Safari’s shortcuts are said to be unchangeable, Chrome’s and Edge’s go to their own page', () => {
  assert.deepEqual(C.SHORTCUTS_URL, { chrome: 'chrome://extensions/shortcuts', edge: 'edge://extensions/shortcuts' });
  const opts = read('options/options.js');
  assert.match(opts, /if \(SAFARI\) \{\s*var h = el\('div', 'howto'\);\s*h\.appendChild\(el\('p', null, tr\('setScSafari'\)\)\);/);
  globalThis.HeddyMessages = load('./lib/messages.js');
  assert.match(load('./lib/i18n.js').t('en', 'setScSafari'), /^Safari doesn't let you change/);
});

// ─── B9 data: latest jots (Can't read) and cards due (aitutors.me) ─────────

const H = load('./lib/heddy-api.js');
const J1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('recent-jots: two at most, each a checked deep link; signed out is no jots; a failure is never an empty list', () => {
  const ok = H.parseRecentJots({ status: 200, data: { signedIn: true, jots: [
    { id: 'j1', text: 'On a 1:50 000 map, 2 cm represents 1 km.', jotter: 'Geography · Maps', host: 'example.org', createdAt: '2026-11-14T10:00:00.000Z', href: `/study/jotters/${J1}?jot=j1` },
    { id: 'j2', text: 'evil', jotter: 'x', host: null, createdAt: 'x', href: 'https://evil.example/' },
    { id: 'j3', text: '', jotter: 'x', href: `/study/jotters/${J1}?jot=j3` },
    { id: 'j4', text: 'Second', jotter: 'Maps', host: 'youtube.com', createdAt: '2026-11-13T10:00:00.000Z', href: `/study/jotters/${J1}?jot=j4` },
    { id: 'j5', text: 'Third', jotter: 'Maps', href: `/study/jotters/${J1}?jot=j5` },
  ] } });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.jots.map((j) => j.text), ['On a 1:50 000 map, 2 cm represents 1 km.', 'Second']);
  assert.equal(ok.jots[0].at, Date.parse('2026-11-14T10:00:00.000Z'));
  assert.deepEqual(H.parseRecentJots({ status: 200, data: { signedIn: false } }), { ok: true, signedIn: false, jots: [] });
  for (const r of [{ status: 503, data: { signedIn: true, error: 'failed' } }, { status: 200, data: { signedIn: true } }, { status: 0, data: null }, null]) {
    assert.equal(H.parseRecentJots(r).ok, false, JSON.stringify(r));
  }
});

test('cards-due: an exact count and the review room; a failed or odd count is not ok, never 0', () => {
  assert.deepEqual(H.parseCardsDue({ status: 200, data: { signedIn: true, due: 7, href: '/study/cards/review' } }), { ok: true, signedIn: true, due: 7, href: '/study/cards/review' });
  assert.deepEqual(H.parseCardsDue({ status: 200, data: { signedIn: true, due: 0, href: '/study/cards/review' } }).due, 0);
  assert.deepEqual(H.parseCardsDue({ status: 200, data: { signedIn: false } }), { ok: true, signedIn: false });
  for (const d of [{ signedIn: true, error: 'failed' }, { signedIn: true, due: -1, href: '/study/cards/review' }, { signedIn: true, due: 2.5, href: '/study/cards/review' }, { signedIn: true, due: 3, href: 'https://evil.example/' }, { signedIn: true, due: '3', href: '/study/cards/review' }]) {
    assert.equal(H.parseCardsDue({ status: 200, data: d }).ok, false, JSON.stringify(d));
  }
  assert.equal(H.parseCardsDue({ status: 503, data: { signedIn: true, error: 'failed' } }).ok, false);
});

test('both are GETs through the desk’s call (the existing cookie and X-Heddy-Id), and only from Heddy’s own page', async () => {
  const calls = [];
  const api = H.createHeddyApi({ call: async (m, p) => { calls.push([m, p]); return { status: 200, data: { signedIn: true, due: 2, href: '/study/cards/review', jots: [] } }; }, origin: async () => 'https://aitutors.me', fetchImpl: () => { throw new Error('no'); } });
  await api.recentJots();
  await api.cardsDue();
  assert.deepEqual(calls, [['GET', '/api/learn/heddy/recent-jots'], ['GET', '/api/learn/heddy/cards-due']]);
  const routes = read('lib/web-routes.js');
  assert.match(routes, /'heddy-web:recent-jots': 1, 'heddy-web:cards-due': 1 \};/, 'FROM_DESK: Heddy’s own page only');
  assert.match(read('content/safari-site.js'), /'recent-jots', 'cards-due'\]\)/, 'Safari’s relay lets the two GETs through');
});

test('the popup shows latest jots only when the read worked, and Review N cards only for N > 0; else Open my Study', () => {
  const pop = read('popup/popup.js');
  assert.match(pop, /bgRead\('heddy-web:recent-jots'\)\.then\(function \(r\) \{\s*if \(!r \|\| !r\.ok \|\| !r\.signedIn \|\| !r\.jots \|\| !r\.jots\.length/);
  assert.match(pop, /if \(r && r\.ok && r\.signedIn && r\.due > 0\) \{[^]*tr\('hkReview', String\(r\.due\)\)[^]*return;\s*\}\s*primary\.appendChild\(hkButton\('save', 'cap', tr\('whoOpenStudy'\)/);
});

// ─── Safari: the popup's reads come from Heddy's own safari-web-extension page ──

test('Heddy’s own page in Safari may ask the desk’s reads, as in Chrome; a web page, another id, or no url may not', async () => {
  const R = load('./lib/web-routes.js');
  const asked = [];
  const tab = { id: 7, windowId: 1, url: 'https://aitutors.me/study', title: 'My Study' };
  const chrome = { runtime: { id: 'heddy', sendMessage: async () => {} }, tabs: { get: async () => tab, sendMessage: async () => {} }, scripting: { executeScript: async () => [] } };
  const api = { recentJots: async () => (asked.push('jots'), { ok: true, signedIn: true, jots: [] }), cardsDue: async () => (asked.push('due'), { ok: true, signedIn: true, due: 3, href: '/study/cards/review' }), jotters: async () => (asked.push('list'), { show: true, known: true, jotters: [] }) };
  const routes = R.createWebRoutes({ chrome, api, cards: {}, showPanel: () => {}, saveJots: async () => ({}) });
  const page = (url, id = 'heddy') => ({ id, url });
  for (const url of ['chrome-extension://heddy/popup/popup.html?tab=7', 'safari-web-extension://8E2B4A0C-1111-2222-3333-444455556666/popup/popup.html?tab=7']) {
    assert.equal((await routes.internal({ type: 'heddy-web:cards-due', tabId: 7 }, page(url))).due, 3, url);
    assert.equal((await routes.internal({ type: 'heddy-web:recent-jots', tabId: 7 }, page(url))).ok, true, url);
    assert.equal((await routes.internal({ type: 'heddy-web:jotters', tabId: 7 }, page(url))).show, true, url);
  }
  const before = asked.length;
  for (const s of [page('https://evil.example/x'), page('safari-web-extension://X/popup/popup.html', 'other'), page(''), { id: 'heddy' }]) {
    assert.deepEqual(await routes.internal({ type: 'heddy-web:cards-due', tabId: 7 }, s), { ok: false }, JSON.stringify(s));
  }
  assert.equal(asked.length, before, 'nothing was asked for a refused sender');
});
