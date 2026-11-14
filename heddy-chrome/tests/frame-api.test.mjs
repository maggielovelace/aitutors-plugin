// lib/frame-api.js — the panel's frame on Safari may not call tabs.* or scripting.* itself.
//
// 2026-11-14, Mac and iPhone: "This webpage was reloaded because a problem occurred" on every click of Heddy.
// Safari's log named it (22 times): "Received an invalid message WebExtensionContext_TabsGet from WebContent
// process", then the process ended. The panel's frame runs in the page's process, which WebKit does not let call
// the privileged extension APIs; it ends the process that tries. So there the popup's `chrome` is a stand-in that
// asks the background. These tests keep every script of popup.html behind it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, load, manifest } from './helpers.mjs';

const FA = load('./lib/frame-api.js');
const { PAGE_FILES } = load('./lib/courier.js');

const SAFARI = 'safari-web-extension://6E1D/popup/popup.html?tab=7&host=panel';
const TAB = { id: 7, windowId: 3, index: 2, active: true, url: 'https://sparxmaths.com/', title: 'Sparx Maths' };

/** A window: framed (parent is another window) or not. */
function win(protocol, framed) {
  const w = { location: { protocol } };
  w.parent = framed ? { other: true } : w;
  return w;
}

/** chrome as the frame has it on Safari: the privileged calls end the page (here: throw KILLED). */
function frameChrome(sendMessage) {
  const killed = (name) => () => { throw new Error('KILLED: ' + name); };
  return {
    runtime: { id: 'heddy', sendMessage, getURL: (p) => 'safari-web-extension://6E1D/' + p },
    storage: { local: {}, sync: {} },
    i18n: {},
    tabs: { get: killed('tabs.get'), query: killed('tabs.query'), create: killed('tabs.create'), sendMessage: killed('tabs.sendMessage') },
    scripting: { executeScript: killed('scripting.executeScript') },
    action: { setPopup: killed('action.setPopup') },
    windows: { create: killed('windows.create') },
    commands: { getAll: killed('commands.getAll') },
  };
}

/** The background's chrome, recording what the bridge really calls. */
function bgChrome() {
  const calls = { get: [], created: [], sent: [], injected: [] };
  const chrome = {
    runtime: { id: 'heddy' },
    tabs: {
      get: async (id) => { calls.get.push(id); return { ...TAB, id }; },
      create: async (p) => { calls.created.push(p); return { id: 99 }; },
      sendMessage: async (id, m) => { calls.sent.push({ id, m }); return { ok: true }; },
    },
    scripting: {
      executeScript: async (inj) => { calls.injected.push(inj); return [{ frameId: 0, result: inj.func ? 'ran ' + FA.nameOf(inj.func) : undefined }]; },
    },
  };
  return { chrome, calls };
}

const FRAME = { id: 'heddy', url: SAFARI, tab: TAB, frameId: 12 };

test('only a frame on Safari gets the stand-in: Chrome, Edge and Safari’s own toolbar popup keep chrome itself', () => {
  const chrome = frameChrome(async () => null);
  assert.equal(FA.wrap(chrome, win('chrome-extension:', true)), chrome, 'Chrome’s panel frame');
  assert.equal(FA.wrap(chrome, win('chrome-extension:', false)), chrome, 'Chrome’s popup');
  assert.equal(FA.wrap(chrome, win('safari-web-extension:', false)), chrome, 'Safari’s toolbar popup is privileged');
  const framed = FA.wrap(chrome, win('safari-web-extension:', true));
  assert.notEqual(framed, chrome);
  assert.equal(framed.bridged, true);
});

test('the stand-in holds the open APIs as they are, and nothing privileged but tabs and scripting, which it asks for', () => {
  const chrome = frameChrome(async () => null);
  const f = FA.wrap(chrome, win('safari-web-extension:', true));
  assert.equal(f.runtime, chrome.runtime);
  assert.equal(f.storage, chrome.storage);
  assert.equal(f.i18n, chrome.i18n);
  // A call nobody thought of is a script error in the frame (undefined), never Safari ending the child's page.
  for (const ns of FA.PRIVILEGED) {
    if (ns === 'tabs' || ns === 'scripting') assert.notEqual(f[ns], chrome[ns], ns);
    else assert.equal(f[ns], undefined, ns);
  }
  assert.deepEqual(Object.keys(f.tabs).sort(), ['create', 'get', 'query', 'sendMessage']);
  assert.deepEqual(Object.keys(f.scripting), ['executeScript']);
});

test('in the frame every privileged call becomes one runtime.sendMessage; the real tabs and scripting are never touched', async () => {
  const sent = [];
  const chrome = frameChrome(async (m) => { sent.push(m); return { ok: true, result: m.api === 'tabs.query' ? [TAB] : TAB }; });
  const f = FA.wrap(chrome, win('safari-web-extension:', true));
  await f.tabs.get(7);
  await f.tabs.query({ active: true, currentWindow: true });
  await f.tabs.create({ url: 'https://aitutors.me/study' });
  await f.tabs.sendMessage(7, { type: 'heddy-ui:open-desk' });
  await f.scripting.executeScript({ target: { tabId: 7 }, files: PAGE_FILES });
  await f.scripting.executeScript({ target: { tabId: 7 }, func: FA.FUNCS.selection });
  await f.scripting.executeScript({ target: { tabId: 7 }, world: 'MAIN', func: FA.FUNCS.readStoryboard });
  await f.scripting.executeScript({ target: { tabId: 7 }, func: FA.FUNCS.seek, args: ['video', 12] });
  assert.deepEqual(sent, [
    { type: 'heddy-frame:call', api: 'tabs.get', tabId: 7 },
    { type: 'heddy-frame:call', api: 'tabs.query' },
    { type: 'heddy-frame:call', api: 'tabs.create', url: 'https://aitutors.me/study' },
    { type: 'heddy-frame:call', api: 'tabs.sendMessage', tabId: 7, message: { type: 'heddy-ui:open-desk' } },
    { type: 'heddy-frame:call', api: 'scripting.executeScript', tabId: 7, files: PAGE_FILES },
    { type: 'heddy-frame:call', api: 'scripting.executeScript', tabId: 7, func: 'selection', args: [] },
    { type: 'heddy-frame:call', api: 'scripting.executeScript', tabId: 7, world: 'MAIN', func: 'readStoryboard', args: [] },
    { type: 'heddy-frame:call', api: 'scripting.executeScript', tabId: 7, func: 'seek', args: ['video', 12] },
  ]);
});

test('a function that is not one of FUNCS cannot go (it cannot travel in a message): refused in the frame, nothing sent', async () => {
  const sent = [];
  const f = FA.wrap(frameChrome(async (m) => { sent.push(m); return { ok: true }; }), win('safari-web-extension:', true));
  await assert.rejects(f.scripting.executeScript({ target: { tabId: 7 }, func: function () { return 1; } }), /not a page function/);
  assert.equal(sent.length, 0);
});

test('a refusal from the background rejects, as chrome’s own call would: the popup’s "can’t read this page" follows', async () => {
  const f = FA.wrap(frameChrome(async () => ({ ok: false, error: 'files' })), win('safari-web-extension:', true));
  await assert.rejects(f.scripting.executeScript({ target: { tabId: 7 }, files: ['x.js'] }), /heddy-frame: files/);
  const silent = FA.wrap(frameChrome(async () => undefined), win('safari-web-extension:', true));
  await assert.rejects(silent.tabs.get(7), /refused/);
});

// ─── the background ─────────────────────────────────────────────────────────

test('the bridge makes the real call for the frame’s own tab and answers {ok, result}', async () => {
  const b = bgChrome();
  const bridge = FA.createBridge({ chrome: b.chrome, files: PAGE_FILES });
  assert.deepEqual(await bridge.internal({ type: FA.TYPE, api: 'tabs.get', tabId: 7 }, FRAME), { ok: true, result: TAB });
  assert.deepEqual(await bridge.internal({ type: FA.TYPE, api: 'tabs.query' }, FRAME), { ok: true, result: [TAB] });
  assert.deepEqual(await bridge.internal({ type: FA.TYPE, api: 'tabs.sendMessage', tabId: 7, message: { type: 'heddy-ui:open-desk' } }, FRAME), { ok: true, result: { ok: true } });
  assert.deepEqual(b.calls.sent, [{ id: 7, m: { type: 'heddy-ui:open-desk' } }]);
  const files = await bridge.internal({ type: FA.TYPE, api: 'scripting.executeScript', tabId: 7, files: PAGE_FILES }, FRAME);
  assert.deepEqual(files, { ok: true, result: [{ result: null }] });
  assert.deepEqual(b.calls.injected[0], { target: { tabId: 7 }, files: PAGE_FILES });
  const ran = await bridge.internal({ type: FA.TYPE, api: 'scripting.executeScript', tabId: 7, world: 'MAIN', func: 'readStoryboard', args: [] }, FRAME);
  assert.deepEqual(ran, { ok: true, result: [{ result: 'ran readStoryboard' }] });
  assert.equal(b.calls.injected[1].func, FA.FUNCS.readStoryboard, 'the background’s own copy of the function');
  assert.equal(b.calls.injected[1].world, 'MAIN');
});

test('the bridge is for Heddy’s own page only, and a frame only acts on the tab it is in', async () => {
  const b = bgChrome();
  const bridge = FA.createBridge({ chrome: b.chrome, files: PAGE_FILES });
  const call = { type: FA.TYPE, api: 'tabs.get', tabId: 7 };
  assert.equal(bridge.internal({ type: 'heddy-cards:get' }, FRAME), undefined, 'not its message');
  assert.deepEqual(await bridge.internal(call, { id: 'heddy', url: 'https://sparxmaths.com/', tab: TAB, frameId: 0 }), { ok: false, error: 'sender' }, 'a content script');
  assert.deepEqual(await bridge.internal(call, { id: 'another', url: SAFARI, tab: TAB }), { ok: false, error: 'sender' }, 'another extension');
  assert.deepEqual(await bridge.internal({ ...call, tabId: 8 }, FRAME), { ok: false, error: 'tab' }, 'another tab');
  assert.equal(b.calls.get.length, 0);
  // Safari's toolbar popup is in no tab: it names its tab, as it always has (lib/cards.js tabFor).
  assert.equal((await bridge.internal(call, { id: 'heddy', url: SAFARI })).ok, true);
  assert.deepEqual(await bridge.internal({ type: FA.TYPE, api: 'tabs.get' }, { id: 'heddy', url: SAFARI }), { ok: false, error: 'tab' });
});

test('the bridge injects only the page’s files and runs only FUNCS; it opens only http(s) tabs', async () => {
  const b = bgChrome();
  const bridge = FA.createBridge({ chrome: b.chrome, files: PAGE_FILES });
  const inj = (m) => bridge.internal({ type: FA.TYPE, api: 'scripting.executeScript', tabId: 7, ...m }, FRAME);
  assert.deepEqual(await inj({ files: ['background.js'] }), { ok: false, error: 'files' });
  assert.deepEqual(await inj({ files: [] }), { ok: false, error: 'files' });
  assert.deepEqual(await inj({ func: 'constructor' }), { ok: false, error: 'func' });
  assert.deepEqual(await inj({ func: 'function () { steal() }' }), { ok: false, error: 'func' });
  assert.equal(b.calls.injected.length, 0);
  const open = (url) => bridge.internal({ type: FA.TYPE, api: 'tabs.create', url }, FRAME);
  assert.deepEqual(await open('javascript:alert(1)'), { ok: false, error: 'url' });
  assert.deepEqual(await open('safari-web-extension://6E1D/options/options.html'), { ok: false, error: 'url' });
  assert.deepEqual(await open('https://aitutors.me/study'), { ok: true, result: { id: 99 } });
  assert.deepEqual(b.calls.created, [{ url: 'https://aitutors.me/study' }]);
  assert.deepEqual(await bridge.internal({ type: FA.TYPE, api: 'windows.create' }, FRAME), { ok: false, error: 'api' });
});

test('end to end: the frame’s stand-in through the bridge reads the page as chrome would have', async () => {
  const b = bgChrome();
  const bridge = FA.createBridge({ chrome: b.chrome, files: PAGE_FILES });
  const f = FA.wrap(frameChrome((m) => bridge.internal(JSON.parse(JSON.stringify(m)), FRAME)), win('safari-web-extension:', true));
  assert.deepEqual(await f.tabs.get(7), TAB);
  assert.deepEqual(await f.scripting.executeScript({ target: { tabId: 7 }, func: FA.FUNCS.mode }), [{ result: 'ran mode' }]);
});

test('every page function stands alone (it is sent to the page as text): no outer name in it', () => {
  for (const [name, fn] of Object.entries(FA.FUNCS)) {
    const ctx = vm.createContext({ document: { querySelector: () => null, getElementById: () => null }, isFinite });
    ctx.globalThis = ctx;
    assert.doesNotThrow(() => vm.runInContext('(' + fn.toString() + ')', ctx), name);
    assert.doesNotMatch(fn.toString(), /\b(FUNCS|chrome|root|nameOf)\b/, name);
  }
  // Run for real: no box mode, no video.
  const ctx = vm.createContext({ document: { querySelector: () => null, getElementById: () => null }, isFinite });
  ctx.globalThis = ctx;
  const run = (name, ...args) => vm.runInContext('(' + FA.FUNCS[name].toString() + ')', ctx)(...args);
  assert.equal(run('mode'), 'text');
  assert.equal(run('stopBox'), true);
  assert.equal(run('readStoryboard'), null);
  assert.equal(run('currentTime', 'video'), null);
  assert.deepEqual({ ...run('readVideo', { video: 'v', title: 't', channel: 'c' }) }, { t: null, duration: null, title: null, channel: null });
});

// ─── the popup's scripts stay behind it ─────────────────────────────────────

const html = read('popup/popup.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((x) => ('popup/' + x[1]).replace(/^popup\/\.\.\//, ''));
const PRIV = new RegExp('\\bchrome\\.(' + FA.PRIVILEGED.join('|') + ')\\b');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');

test('popup.html loads lib/frame-api.js first, and it is web accessible (the frame is in a page)', () => {
  assert.equal(scripts[0], 'lib/frame-api.js');
  assert.ok(manifest().web_accessible_resources[0].resources.includes('lib/frame-api.js'));
});

test('popup.js and web-desk.js use the stand-in for `chrome`, taken before anything else', () => {
  const popup = read('popup/popup.js');
  assert.match(popup, /^\(function \(\) \{\n(?:\s*\/\/.*\n)*\s*var chrome = HeddyFrameApi\.wrap\(globalThis\.chrome \|\| globalThis\.browser, window\);/m);
  const desk = read('popup/web-desk.js');
  assert.match(desk, /^\(function \(root\) \{\n(?:\s*\/\/.*\n)*\s*var FA = root\.HeddyFrameApi;\n\s*var chrome = FA \? FA\.wrap\(root\.chrome \|\| root\.browser, root\) : root\.chrome;/m);
  // The language is read through it too (lib/i18n.js would otherwise take the global).
  assert.match(popup, /I\.currentLang\(chrome\),/);
});

test('no script of popup.html reaches a privileged API on the real chrome: each uses the stand-in, or a chrome it is handed', () => {
  // Factories the background builds with its own chrome (never run in the popup), and the Snap button, which is
  // handed the popup's `chrome`: the stand-in on Safari.
  const HANDED = { 'lib/courier.js': /var chrome = deps\.chrome;/, 'lib/cards.js': /var chrome = deps\.chrome;/, 'lib/snap.js': /var chrome = deps\.chrome;/, 'lib/frame-api.js': /function createBridge\(deps\) \{\n\s*var chrome = deps\.chrome;/ };
  const WRAPPED = { 'popup/popup.js': 1, 'popup/web-desk.js': 1 };
  const touching = scripts.filter((f) => PRIV.test(code(f)));
  assert.deepEqual(touching.sort(), [...Object.keys(HANDED), ...Object.keys(WRAPPED)].sort());
  for (const [f, how] of Object.entries(HANDED)) {
    assert.match(read(f), how, f);
    assert.doesNotMatch(code(f), /\b(root|globalThis|window|self)\.chrome\.(tabs|scripting|action|windows|commands)\b/, f);
  }
  for (const f of scripts) assert.doesNotMatch(code(f), /\bbrowser\.(tabs|scripting|action|windows|commands)\b/, f);
  // The Snap button asks only what the stand-in has (commands is absent there, so the key line keeps its default).
  const snap = read('lib/snap.js');
  const button = snap.slice(snap.indexOf('function mountButton'), snap.indexOf('var api = {'));
  assert.deepEqual([...new Set([...button.matchAll(/chromeApi\.(\w+)/g)].map((x) => x[1]))].sort(), ['commands', 'runtime']);
  assert.match(button, /if \(chromeApi\.commands && chromeApi\.commands\.getAll\)/);
  assert.match(read('popup/popup.js'), /HeddySnap\.mountButton\(\$\('snap'\), \{ chrome: chrome,/);
});

test('every function the popup runs in the page is one of FUNCS (by name), and only tabs/scripting calls the stand-in has', () => {
  for (const f of ['popup/popup.js', 'popup/web-desk.js']) {
    const src = code(f);
    const funcs = [...src.matchAll(/\bfunc:\s*([^,}\n]+)/g)].map((x) => x[1].trim());
    assert.ok(funcs.length > 0, f);
    for (const fn of funcs) {
      const m = /^(?:PF|FA\.FUNCS)\.(\w+)$/.exec(fn);
      assert.ok(m, `${f}: func: ${fn}`);
      assert.equal(typeof FA.FUNCS[m[1]], 'function', `${f}: ${fn}`);
    }
    const used = [...new Set([...src.matchAll(/\bchrome\.(tabs|scripting|action|windows|commands|contextMenus|menus|cookies|webNavigation)\.(\w+)/g)].map((x) => x[1] + '.' + x[2]))];
    const have = ['tabs.get', 'tabs.query', 'tabs.create', 'tabs.sendMessage', 'scripting.executeScript'];
    // A call behind `if (!chrome.<ns> || …) return …` is safe: the stand-in has no <ns>, so Safari's frame takes the fallback.
    const guarded = (u) => new RegExp('if \\(!chrome\\.' + u.split('.')[0] + ' \\|\\|[^\\n]*\\) return').test(src);
    for (const u of used) assert.ok(have.includes(u) || guarded(u), `${f} calls chrome.${u}, which the Safari frame cannot`);
  }
});

// ─── the wiring ─────────────────────────────────────────────────────────────

test('background.js loads the bridge and asks it first; it injects only the page’s files', () => {
  const bg = read('background.js');
  assert.match(bg, /importScripts\([^)]*'lib\/frame-api\.js'\)/);
  assert.match(bg, /HeddyFrameApi\.createBridge\(\{ chrome: chrome, files: HeddyCourier\.PAGE_FILES \}\)/);
  assert.match(bg, /var mine = frameBridge\.internal\(message, sender\) \|\| routes\.internal\(message, sender\)/);
});

test('Safari: "the cards changed" also goes by the page to the frame, a hint with no data; Chrome is told once, as before', async () => {
  const bg = read('background.js');
  assert.match(bg, /relay: safari \? function \(tabId, told\) \{\s*return Promise\.resolve\(chrome\.tabs\.sendMessage\(tabId, \{ type: 'heddy-panel:cards', note: told\.note \|\| null \}\)\)/);
  assert.match(bg, /\} : null,/);
  assert.match(read('lib/cards.js'), /deps\.relay \? Promise\.resolve\(deps\.relay\(tabId, told\)\)\.catch\(function \(\) \{\}\) : undefined;/);
  assert.match(read('content/panel.js'), /if \(message\.type === 'heddy-panel:cards'\) \{\s*tell\(\{ heddyPanel: 'cards', note: message\.note === 'full_text' \? 'full_text' : null \}\);/);
  assert.match(read('popup/popup.js'), /if \(e\.data\.heddyPanel === 'cards' && desk\) desk\.refresh\(e\.data\.note === 'full_text' \? 'full_text' : undefined\);/);
});
