// The manifest asks for exactly what Phase 1 uses, inside PRD-v0.96.0 D3.
// A permission beyond D3 is a decision for the owner, not a fix (PRD § Done When).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, load, read, manifest } from './helpers.mjs';

// D3, verbatim.
const D3_ALLOWED = ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage'];
const D3_NOT_REQUESTED = ['tabs', 'history', 'cookies', 'webRequest', 'declarativeNetRequest', 'sidePanel', '<all_urls>'];
const D3_HOSTS = ['https://www.youtube.com/watch*', 'https://aitutors.me/*', 'https://*.aitutors.me/*'];
// Phase 2 uses all five: contextMenus for "Jot it with Heddy" on a selection,
// commands for Ctrl Shift J (D7 as amended by D17).
const PHASE_2 = ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage'];
const EXTERNALLY_CONNECTABLE = ['https://aitutors.me/*', 'http://localhost:3000/*'];

test('permissions are exactly Phase 2’s, all of them inside D3', () => {
  const m = manifest();
  assert.deepEqual([...m.permissions].sort(), [...PHASE_2].sort());
  for (const p of m.permissions) assert.ok(D3_ALLOWED.includes(p), `${p} is not in D3`);
});

test('nothing D3 lists as not requested appears anywhere in the manifest', () => {
  const m = manifest();
  const all = [...(m.permissions || []), ...(m.optional_permissions || []), ...(m.host_permissions || []), ...(m.optional_host_permissions || [])];
  for (const p of D3_NOT_REQUESTED) assert.ok(!all.includes(p), `${p} is requested`);
  assert.ok(!all.some((h) => /^\*:\/\/|^https?:\/\/\*\/|^<all_urls>$/.test(h)), 'a wildcard host is requested');
  assert.equal(m.side_panel, undefined, 'side_panel is declared');
  // The panel (owner, 2026-10-30) is popup.html in a frame in the page, so
  // exactly the popup's own files are web accessible, at a dynamic URL.
  assert.equal(m.web_accessible_resources.length, 1);
  assert.equal(m.web_accessible_resources[0].use_dynamic_url, true, 'a page cannot probe for Heddy by URL');
  assert.equal(m.optional_permissions, undefined);
  assert.equal(m.optional_host_permissions, undefined);
});

test('host permissions are exactly D3’s three', () => {
  assert.deepEqual(manifest().host_permissions, D3_HOSTS);
});

test('externally_connectable is exactly aitutors.me and the dev origin (D19, Must 13)', () => {
  const m = manifest();
  assert.deepEqual(m.externally_connectable, { matches: EXTERNALLY_CONNECTABLE });
});

test('the config’s origins are the externally_connectable origins', () => {
  const C = load('./lib/config.js');
  const origins = EXTERNALLY_CONNECTABLE.map((p) => p.replace(/\/\*$/, ''));
  assert.deepEqual(C.allowedOrigins(true), origins);
  assert.deepEqual(C.allowedOrigins(false), [origins[0]]);
});

test('the content script runs on YouTube watch pages only, and the courier injects the same files', () => {
  const m = manifest();
  assert.equal(m.content_scripts.length, 1);
  assert.deepEqual(m.content_scripts[0].matches, ['https://www.youtube.com/watch*']);
  assert.notEqual(m.content_scripts[0].all_frames, true);
  const { CONTENT_FILES } = load('./lib/courier.js');
  assert.deepEqual(m.content_scripts[0].js, CONTENT_FILES);
});

test('every file the manifest names exists', () => {
  const m = manifest();
  const files = [
    m.background.service_worker,
    m.options_ui.page,
    ...m.web_accessible_resources.flatMap((w) => w.resources),
    ...Object.values(m.icons),
    ...Object.values(m.action.default_icon),
    ...m.content_scripts.flatMap((c) => c.js),
  ];
  for (const f of files) assert.ok(existsSync(join(ROOT, f)), `${f} is missing`);
  const { ICONS } = load('./lib/courier.js');
  for (const state of Object.values(ICONS)) for (const f of Object.values(state)) assert.ok(existsSync(join(ROOT, f)), `${f} is missing`);
});

test('the background is a classic worker, so it stays WebExtension-plain (D12)', () => {
  const m = manifest();
  assert.equal(m.manifest_version, 3);
  assert.equal(m.background.type, undefined);
});

test('one command, with NO default key (owner, 2026-10-29), and it is the one the courier answers', () => {
  const m = manifest();
  const { COMMAND } = load('./lib/courier.js');
  assert.ok(Object.keys(m.commands).includes(COMMAND));
  assert.equal(m.commands[COMMAND].suggested_key, undefined, 'the child binds it at chrome://extensions/shortcuts');
  assert.match(m.commands[COMMAND].description, /^__MSG_\w+__$/);
  assert.ok(!Object.keys(m.commands).some((k) => k.startsWith('_execute')), 'no _execute_ command');
});

test('the page tray is injected on a gesture, never declared as a content script', () => {
  const m = manifest();
  const { PAGE_FILES } = load('./lib/courier.js');
  for (const f of PAGE_FILES) assert.ok(existsSync(join(ROOT, f)), `${f} is missing`);
  assert.ok(!m.content_scripts.some((c) => c.js.includes('content/page-tray.js')), 'page-tray must not run uninvited');
  assert.ok(PAGE_FILES.indexOf('lib/tray-tools.js') < PAGE_FILES.indexOf('content/page-tray.js'));
  assert.ok(PAGE_FILES.indexOf('content/extract.js') < PAGE_FILES.indexOf('content/page-tray.js'));
});

test('Snap a picture’s shortcut is Ctrl Shift K (⌘ Shift K on a Mac), one Chrome command', () => {
  const m = manifest();
  assert.ok(m.commands['snap-picture']);
  assert.deepEqual(m.commands['snap-picture'].suggested_key, { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' });
  assert.ok(Object.keys(m.commands).length <= 4, 'Chrome allows four suggested shortcuts');
});

test('box mode’s files are injected, never declared as content scripts on every page', () => {
  const m = manifest();
  const { BOX_FILES } = load('./lib/snap.js');
  for (const c of m.content_scripts) assert.ok(!c.js.includes('content/box-mode.js'));
  for (const f of BOX_FILES) assert.ok(existsSync(join(ROOT, f)), `${f} is missing`);
});

test('the toolbar icon has no default_popup: a click opens the panel, which Chrome does not close on blur (owner, 2026-10-30)', () => {
  const m = manifest();
  assert.equal(m.action.default_popup, undefined);
  const bg = read('background.js');
  assert.match(bg, /chrome\.action\.onClicked\.addListener\(function \(tab\) \{\s*panel\.clicked\(tab\);/);
  assert.match(bg, /'lib\/panel\.js'/);
});

test('the web-accessible files are exactly the popup page and what it loads, nothing else', () => {
  const war = manifest().web_accessible_resources[0];
  const html = read('popup/popup.html');
  const css = read('popup/popup.css');
  const fromPopup = (rel) => join('popup', rel).replace(/\\/g, '/');
  const loads = [
    'popup/popup.html',
    ...[...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map((x) => fromPopup(x[1])),
    ...[...css.matchAll(/url\("([^"]+)"\)/g)].map((x) => fromPopup(x[1])),
  ].map((f) => f.replace(/^popup\/\.\.\//, ''));
  assert.deepEqual([...war.resources].sort(), [...new Set(loads)].sort());
  assert.deepEqual(war.matches, ['<all_urls>']);
  assert.ok(!war.resources.some((r) => r.startsWith('content/') && r !== 'content/youtube-selectors.js'), 'no content script is web accessible');
});

