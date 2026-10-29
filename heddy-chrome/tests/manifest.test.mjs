// The manifest asks for exactly what Phase 1 uses, inside PRD-v0.96.0 D3.
// A permission beyond D3 is a decision for the owner, not a fix (PRD § Done When).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, load, manifest } from './helpers.mjs';

// D3, verbatim.
const D3_ALLOWED = ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage'];
const D3_NOT_REQUESTED = ['tabs', 'history', 'cookies', 'webRequest', 'declarativeNetRequest', 'sidePanel', '<all_urls>'];
const D3_HOSTS = ['https://www.youtube.com/watch*', 'https://aitutors.me/*', 'https://*.aitutors.me/*'];
// Phase 1 uses three of D3's five; contextMenus and commands arrive with
// Jot it and J in Phase 2.
const PHASE_1 = ['activeTab', 'scripting', 'storage'];
const EXTERNALLY_CONNECTABLE = ['https://aitutors.me/*', 'http://localhost:3000/*'];

test('permissions are exactly Phase 1’s, all of them inside D3', () => {
  const m = manifest();
  assert.deepEqual([...m.permissions].sort(), [...PHASE_1].sort());
  for (const p of m.permissions) assert.ok(D3_ALLOWED.includes(p), `${p} is not in D3`);
});

test('nothing D3 lists as not requested appears anywhere in the manifest', () => {
  const m = manifest();
  const all = [...(m.permissions || []), ...(m.optional_permissions || []), ...(m.host_permissions || []), ...(m.optional_host_permissions || [])];
  for (const p of D3_NOT_REQUESTED) assert.ok(!all.includes(p), `${p} is requested`);
  assert.ok(!all.some((h) => /^\*:\/\/|^https?:\/\/\*\/|^<all_urls>$/.test(h)), 'a wildcard host is requested');
  assert.equal(m.side_panel, undefined, 'side_panel is declared');
  assert.equal(m.web_accessible_resources, undefined, 'pages can load extension files');
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
    m.action.default_popup,
    m.options_ui.page,
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
