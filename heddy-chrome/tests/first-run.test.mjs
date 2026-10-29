// How families find Heddy (PRD D8): a fresh install opens the first-run page
// on aitutors.me once, in Heddy's language; an update opens nothing; and
// aitutors.me can ask "is Heddy here?" with heddy:ping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
const { createCourier } = load('./lib/courier.js');
const { createCidStore } = load('./lib/cid-store.js');

const PROD = 'https://aitutors.me';
const DEV = 'http://localhost:3000';

function setup({ dev = false, lang, ui = 'en-GB' } = {}) {
  const tabsCreated = [];
  const session = {};
  const chrome = {
    runtime: { id: 'heddy', getManifest: () => ({ version: '0.2.0' }) },
    i18n: { getUILanguage: () => ui },
    storage: {
      session: { get: async (k) => ({ [k]: session[k] }), set: async (o) => Object.assign(session, o) },
      local: { get: async () => ({ devOrigin: dev }) },
      sync: { get: async () => (lang ? { lang } : {}) },
    },
    tabs: { create: async (o) => { tabsCreated.push(o); } },
  };
  const courier = createCourier({ chrome, store: createCidStore(), randomUUID: () => 'x', setTimeout: () => {} });
  return { courier, tabsCreated, session };
}

const site = (origin = PROD) => ({ origin, url: `${origin}/study/clips`, tab: { id: 5, windowId: 1 } });

test('install opens exactly one tab: the first-run page in Heddy’s language', async () => {
  const en = setup();
  await en.courier.installed({ reason: 'install' });
  assert.deepEqual(en.tabsCreated, [{ url: `${PROD}/heddy-chrome/welcome` }]);

  const zh = setup({ lang: 'zh_CN' });
  await zh.courier.installed({ reason: 'install' });
  assert.deepEqual(zh.tabsCreated, [{ url: `${PROD}/zh/heddy-chrome/welcome` }]);
});

test('with no choice stored, a Chinese Chrome gets the /zh page', async () => {
  const s = setup({ ui: 'zh-CN' });
  await s.courier.installed({ reason: 'install' });
  assert.deepEqual(s.tabsCreated, [{ url: `${PROD}/zh/heddy-chrome/welcome` }]);
});

test('the developer switch sends the first-run page to localhost:3000', async () => {
  const s = setup({ dev: true });
  await s.courier.installed({ reason: 'install' });
  assert.deepEqual(s.tabsCreated, [{ url: `${DEV}/heddy-chrome/welcome` }]);
});

test('an update of Heddy, of Chrome or of a shared module opens nothing', async () => {
  const s = setup();
  for (const reason of ['update', 'chrome_update', 'shared_module_update', undefined]) await s.courier.installed({ reason });
  await s.courier.installed(undefined);
  assert.deepEqual(s.tabsCreated, []);
});

test('heddy:ping from aitutors.me gets the version, and changes nothing', async () => {
  const s = setup();
  const before = JSON.stringify(s.session);
  const reply = await s.courier.external({ type: 'heddy:ping', v: 1 }, site());
  assert.deepEqual(reply, { type: 'heddy:pong', v: 1, version: '0.2.0' });
  assert.equal(JSON.stringify(s.session), before);
  assert.deepEqual(s.tabsCreated, []);
});

test('heddy:ping is answered only for allowed senders', async () => {
  const s = setup();
  assert.equal(await s.courier.external({ type: 'heddy:ping', v: 1 }, site('https://evil.example')), null);
  assert.equal(await s.courier.external({ type: 'heddy:ping', v: 1 }, site(DEV)), null, 'dev origin while the switch is off');
  assert.equal(await s.courier.external({ type: 'heddy:ping', v: 1 }, { ...site(), url: 'https://evil.example/x' }), null, 'origin and url disagree');
  assert.equal(await s.courier.external({ type: 'heddy:ping', v: 1 }, null), null);
  const d = setup({ dev: true });
  assert.equal((await d.courier.external({ type: 'heddy:ping', v: 1 }, site(DEV))).type, 'heddy:pong');
});

test('only that shape is a ping', async () => {
  const s = setup();
  for (const m of [{ type: 'heddy:ping' }, { type: 'heddy:ping', v: 2 }, { type: 'heddy:ping', v: '1' }, { type: 'heddy:pong', v: 1 }, ['heddy:ping'], 'heddy:ping', null]) {
    assert.equal(await s.courier.external(m, site()), null, JSON.stringify(m));
  }
});

test('background wires onInstalled to the courier; the popup’s first-time link is the same page', () => {
  assert.match(read('background.js'), /chrome\.runtime\.onInstalled\.addListener\(function \(details\) \{\s*courier\.installed\(details\);/);
  const popup = read('popup/popup.js');
  assert.match(popup, /openSite\(C\.welcomeUrl\(origin, lang\)\)/);
  assert.match(popup, /return renderFirstTime\(body, origin, lang\);/);
});

test('opening a tab needs no tabs permission (D3 unchanged)', () => {
  assert.ok(!manifest().permissions.includes('tabs'));
});
