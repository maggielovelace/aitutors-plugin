// Save into (site PRD-v0.122.0 R30, R14 and Appendix A; artifact
// 8wyNVxSwnQGYBikHswnaxe, Round 8, Proposal 1): the list's answers
// (lib/heddy-api.js), the rules (lib/save-into.js), the save's body
// (lib/cards.js, lib/web-routes.js) and the web desk's use of them
// (popup/web-desk.js). The Into line is drawn into a fake document whose
// innerHTML throws, so a title can only ever go in as text.
//
// Local time is pinned to Shanghai (UTC+8), so a local day and a UTC day
// differ for part of every day and "local midnight" means something.
process.env.TZ = 'Asia/Shanghai';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
globalThis.HeddyTools = load('./lib/tools.js');
globalThis.HeddyDeskAsk = load('./lib/desk-ask.js');
const SI = load('./lib/save-into.js');
const H = load('./lib/heddy-api.js');
const W = load('./lib/web-routes.js');
const C = load('./lib/cards.js');
const I = globalThis.HeddyI18n;
const en = I.translator('en');
const zh = I.translator('zh_CN');

const J27 = 'a7b0c0de-0000-4000-8000-000000000027';
const J24 = 'a7b0c0de-0000-4000-8000-000000000024';
const J31 = 'a7b0c0de-0000-4000-8000-000000000031';
const PAGE_J = 'a7b0c0de-0000-4000-8000-000000000099';
const NOW = new Date(2026, 10, 2, 15, 0, 0); // 2026-11-02 15:00 local
const LIST = [
  { id: J27, key: 'JOT-27', title: 'Photosynthesis homework', at: NOW.getTime() - 10 * 60000 },
  { id: J24, key: 'JOT-24', title: 'Cells and tissues', at: NOW.getTime() - 3 * 86400000 },
  { id: J31, key: 'JOT-31', title: 'Biology log · Vol. 1', at: NOW.getTime() - 4 * 86400000 },
];

// ─── the list's answers (App. A 1) ─────────────────────────────────────────

test('the list: only a signed-in child sees it; signed out, a grown-up, a 503 and anything odd hide it (never "no Jotters")', () => {
  const known = { show: false, known: true, jotters: [] };
  const failed = { show: false, known: false, jotters: [] };
  assert.deepEqual(H.parseJotters({ status: 200, data: { signedIn: false, jotters: [] } }), known, 'signed out: the role is known');
  assert.deepEqual(H.parseJotters({ status: 200, data: { signedIn: true, role: 'parent', jotters: [] } }), known, 'a grown-up');
  assert.deepEqual(H.parseJotters({ status: 200, data: { signedIn: true, role: 'parent', jotters: [{ id: J27, key: 'JOT-27', title: 'x' }], page: { id: J24 } } }), known, 'a grown-up, whatever comes with it (no list, no hint)');
  assert.deepEqual(H.parseJotters({ status: 503, data: { error: 'failed' } }), failed, '503: hide, keep the default');
  assert.deepEqual(H.parseJotters({ status: 503, data: { signedIn: true, role: 'child', jotters: [] } }), failed, 'a 503 is never an empty list');
  assert.deepEqual(H.parseJotters({ status: 401, data: null }), failed);
  assert.deepEqual(H.parseJotters({ status: 0, data: null }), failed, 'no answer at all');
  assert.deepEqual(H.parseJotters({ status: 200, data: { signedIn: true, role: 'child' } }), failed, 'no array');
  assert.deepEqual(H.parseJotters({ status: 200, data: { signedIn: true, role: 'teacher', jotters: [] } }), failed, 'a role it does not know');
  assert.deepEqual(H.parseJotters({ status: 200, data: { signedIn: true, role: 'child', jotters: [] } }), { show: true, known: true, jotters: [], page: undefined }, 'a child with no Jotters yet still sees the line');
});

test('the list: each Jotter keeps only id (a UUID), key (JOT-n), title (as text) and when it was last saved; at most 30, in the site’s order', () => {
  const rows = [
    { id: J27, key: 'JOT-27', title: '  Photosynthesis\n homework ', updatedAt: '2026-11-01T09:00:00Z', lastSavedAt: '2026-11-02T06:50:00Z', extra: 'dropped' },
    { id: J24, key: '<b>JOT</b>', title: 'Cells', updatedAt: '2026-10-30T09:00:00Z', lastSavedAt: null },
    { id: 'not-a-uuid', key: 'JOT-1', title: 'x' },
    { id: J27, key: 'JOT-27', title: 'duplicate' },
    null,
  ];
  const r = H.parseJotters({ status: 200, data: { signedIn: true, role: 'child', jotters: rows } });
  assert.equal(r.show, true);
  assert.deepEqual(r.jotters, [
    { id: J27, key: 'JOT-27', title: 'Photosynthesis homework', at: Date.parse('2026-11-02T06:50:00Z') },
    { id: J24, key: null, title: 'Cells', at: Date.parse('2026-10-30T09:00:00Z') },
  ]);
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `a7b0c0de-0000-4000-8000-${String(i).padStart(12, '0')}`, key: `JOT-${i}`, title: `T${i}` }));
  const r30 = H.parseJotters({ status: 200, data: { signedIn: true, role: 'child', jotters: many } });
  assert.equal(r30.jotters.length, 30);
  assert.equal(r30.jotters[0].key, 'JOT-0', 'newest-saved first, as sent');
});

test('the list is one GET from the background, through desk-api’s call (the browser’s cookie), with the tab’s address as ?url=, and the desk asks for it by message', async () => {
  const calls = [];
  const api = H.createHeddyApi({ call: async (method, path, params, body) => { calls.push({ method, path, params, body }); return { status: 200, data: { signedIn: true, role: 'child', jotters: [] } }; }, origin: async () => 'https://aitutors.me', fetchImpl: async () => null });
  assert.deepEqual(await api.jotters('https://example.org/leaf'), { show: true, known: true, jotters: [], page: undefined });
  await api.jotters(null);
  assert.deepEqual(calls, [
    { method: 'GET', path: '/api/learn/heddy/jotters', params: { url: 'https://example.org/leaf' }, body: undefined },
    { method: 'GET', path: '/api/learn/heddy/jotters', params: null, body: undefined },
  ]);
  // The query as desk-api's call writes it, end to end.
  const fetches = [];
  const D = load('./lib/desk-api.js');
  const desk = D.createDeskApi({ chrome: { runtime: { id: 'heddy' }, storage: { local: { get: async () => ({}) } } }, fetchImpl: async (u, init) => { fetches.push([u, init.method, init.credentials]); return { status: 200, json: async () => ({ signedIn: true, role: 'child', jotters: [], page: null }) }; }, setTimeout: () => 1, clearTimeout: () => {} });
  await H.createHeddyApi({ call: desk.call, origin: desk.origin, fetchImpl: async () => null }).jotters('https://example.org/leaf?a=1&b=2');
  assert.deepEqual(fetches, [['https://aitutors.me/api/learn/heddy/jotters?url=https%3A%2F%2Fexample.org%2Fleaf%3Fa%3D1%26b%3D2', 'GET', 'include']]);
  assert.match(read('popup/web-desk.js'), /call\(\{ type: 'heddy-web:jotters' \}\)/);
});

test('the page hint: present names this page’s Jotter; an explicit null is "New / A new Jotter for this page"; missing is a neutral "This page’s Jotter"', () => {
  const child = (extra) => H.parseJotters({ status: 200, data: { signedIn: true, role: 'child', jotters: [{ id: J27, key: 'JOT-27', title: 'Photosynthesis homework' }], ...extra } });
  const present = child({ page: { id: J24, key: 'JOT-24', title: ' Cells and\ntissues ', extra: 1 } });
  assert.deepEqual(present.page, { id: J24, key: 'JOT-24', title: 'Cells and tissues' });
  assert.equal(child({ page: null }).page, null, 'said plainly: no Jotter yet');
  assert.equal(child({}).page, undefined, 'a site without the hint yet: not known');
  assert.equal(child({ page: { id: 'nope', key: 'JOT-1', title: 'x' } }).page, undefined, 'unreadable: not known, never "New"');
  assert.deepEqual(child({ page: { id: J24, key: '<b>', title: 'Cells' } }).page, { id: J24, key: null, title: 'Cells' });
  // Through chrome.runtime messaging an undefined field arrives missing; null survives.
  const wire = (r) => JSON.parse(JSON.stringify(r));
  assert.equal('page' in wire(child({})), false);
  assert.equal(wire(child({ page: null })).page, null);

  const tgt = (r) => SI.withList(SI.freshInto('https://example.org/leaf'), wire(r)).target;
  assert.deepEqual(tgt(present), { kind: 'page', id: J24, key: 'JOT-24', title: 'Cells and tissues' });
  assert.deepEqual(tgt(child({ page: null })), { kind: 'new' });
  assert.deepEqual(tgt(child({})), { kind: 'page', id: null, key: null, title: '' });
  const line = (r) => { const t = tgt(r); return drawn({ open: false, target: t, page: wire(r).page }).v.line.children.map((c) => [c.className, c.textContent]); };
  assert.deepEqual(line(present), [['l', 'Into'], ['ky', 'JOT-24'], ['t', 'Cells and tissues'], ['cv', '▾']]);
  assert.deepEqual(line(child({ page: null })), [['l', 'Into'], ['ky new', 'New'], ['t', 'A new Jotter for this page'], ['cv', '▾']]);
  assert.deepEqual(line(child({})), [['l', 'Into'], ['t', "This page's Jotter"], ['cv', '▾']], 'missing: no New chip, no key');
  const first = (r) => drawn({ target: tgt(r), page: wire(r).page, jotters: [...LIST] }).all.filter((e) => e.getAttribute('role') === 'option').map((o) => o.textContent.replace(/\d+ min|[A-Z][a-z]{2}$/, ''));
  assert.deepEqual(first(present).slice(0, 2), ['JOT-24Cells and tissues', 'JOT-27Photosynthesis homework'], 'This page names it, and Recent does not repeat it');
  assert.equal(first(child({ page: null }))[0], 'NewA new Jotter for this page');
  assert.equal(first(child({}))[0], "This page's Jotter");
  assert.equal(SI.buttonLabel(en, 2, tgt(present)), 'Save 2 to JOT-24');
  assert.equal(SI.buttonLabel(en, 2, tgt(child({}))), 'Save 2 to my Jotters', 'not known: the existing words');
  for (const r of [present, child({ page: null }), child({})]) assert.deepEqual(SI.bodyOf(tgt(r)), {}, 'no jotterId for This page: the site picks it (R8)');
  assert.equal(drawn({ target: tgt(child({})) }).all.some((e) => e.className === 'kp'), false, 'no Keep saving for a Jotter not known');
  assert.equal(zh('intoThisPageJotter'), '这一页的 Jotter');
});

test('a Jotter this desk just saved this page into is kept when an older site sends no hint, and dropped when the site does send one', () => {
  const into = SI.freshInto('https://example.org/leaf');
  into.page = { id: J24, key: null, title: 'Cells' };
  into.learned = true;
  SI.withList(into, { show: true, known: true, jotters: LIST });
  assert.deepEqual(into.page, { id: J24, key: 'JOT-24', title: 'Cells and tissues' }, 'kept, and its key filled from the list');
  SI.withList(into, { show: true, known: true, jotters: LIST, page: null });
  assert.equal(into.page, null);
  assert.equal(into.learned, false);
});

// ─── the default, and keep saving (R14) ────────────────────────────────────

test('the default, in order: today’s keep saving, then this page’s Jotter, then a new Jotter for this page', () => {
  const keep = { jotterId: J27, key: 'JOT-27', title: 'Photosynthesis homework', day: '2026-11-02' };
  const page = { id: PAGE_J, key: 'JOT-9', title: 'This page' };
  assert.deepEqual(SI.defaultTarget(keep, page), { kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' });
  assert.deepEqual(SI.defaultTarget(null, page), { kind: 'page', id: PAGE_J, key: 'JOT-9', title: 'This page' });
  assert.deepEqual(SI.defaultTarget(null, null), { kind: 'new' });
  assert.deepEqual(SI.defaultTarget(null, { id: 'nope', title: 'x' }), { kind: 'new' }, 'a page Jotter with no real id is not trusted');
});

test('a save sends jotterId only for a Jotter the child chose; "This page" (known or new) omits it and the site picks (R8)', () => {
  assert.deepEqual(SI.bodyOf({ kind: 'jotter', id: J27, key: 'JOT-27', title: 't' }), { jotterId: J27 });
  assert.deepEqual(SI.bodyOf({ kind: 'new' }), {});
  assert.deepEqual(SI.bodyOf({ kind: 'page', id: PAGE_J, key: 'JOT-9', title: 't' }), {}, 'this page’s Jotter: the site already picks it');
  assert.deepEqual(SI.bodyOf({ kind: 'jotter', id: 'not-a-uuid' }), {});
  assert.deepEqual(SI.bodyOf(null), {});
  assert.deepEqual(SI.bodyOf(SI.defaultTarget(null, null)), {}, 'the default for a child who never opens the list sends nothing new');
});

test('keep saving lasts until LOCAL midnight (not UTC), then reads as nothing', () => {
  const stored = SI.keepFor({ kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' }, new Date(2026, 10, 2, 9, 30));
  assert.deepEqual(stored, { jotterId: J27, key: 'JOT-27', title: 'Photosynthesis homework', day: '2026-11-02' });
  assert.deepEqual(Object.keys(stored).sort(), ['day', 'jotterId', 'key', 'title'], 'only the Jotter’s id, key, title and the day');
  assert.deepEqual(SI.keepOf(stored, new Date(2026, 10, 2, 23, 59, 59, 999)), stored, 'one millisecond before midnight: still on');
  assert.equal(SI.keepOf(stored, new Date(2026, 10, 3, 0, 0, 0, 0)), null, 'midnight: gone');
  assert.equal(SI.keepOf(stored, new Date(2026, 10, 1, 12, 0)), null, 'a day from the future is not today either');
  // 2026-11-02 20:00 UTC is 2026-11-03 04:00 in Shanghai: the local day counts.
  const utcEvening = new Date(Date.UTC(2026, 10, 2, 20, 0));
  assert.equal(SI.localDay(utcEvening), '2026-11-03');
  assert.equal(SI.keepOf(stored, utcEvening), null);
  assert.equal(SI.keepOf({ ...stored, day: '2026-11-03' }, utcEvening).jotterId, J27);
  assert.equal(SI.keepOf({ ...stored, jotterId: 'x' }, new Date(2026, 10, 2)), null, 'a stored id that is not a UUID is ignored');
  assert.equal(SI.keepOf(null, NOW), null);
  assert.equal(SI.keepFor({ kind: 'new' }, NOW), null, 'nothing to keep for a new Jotter');
  assert.equal(SI.msToMidnight(new Date(2026, 10, 2, 23, 0, 0)), 3600000);
});

test('picking another option ends keep saving; picking its own Jotter keeps it (R14)', () => {
  const keep = { jotterId: J27, key: 'JOT-27', title: 'P', day: '2026-11-02' };
  assert.equal(SI.pick({ kind: 'jotter', id: J24, key: 'JOT-24', title: 'C' }, keep).keep, null);
  assert.equal(SI.pick({ kind: 'new' }, keep).keep, null, '"A new Jotter for this page" is another option');
  assert.equal(SI.pick({ kind: 'jotter', id: J27, key: 'JOT-27', title: 'P' }, keep).keep, keep);
  assert.equal(SI.pick({ kind: 'jotter', id: J24 }, null).keep, null);
});

test('the desk stores keep saving under one named key in chrome.storage.local, clears an old one on open, and re-checks midnight before a save', () => {
  assert.equal(SI.INTO_KEY, 'heddySaveInto');
  const desk = read('popup/web-desk.js');
  assert.match(desk, /if \(!k\) return chrome\.storage\.local\.remove\(SI\.INTO_KEY\);/);
  assert.match(desk, /o\[SI\.INTO_KEY\] = k;\s*return chrome\.storage\.local\.set\(o\);/);
  assert.match(desk, /var keep = SI\.keepOf\(raw, new Date\(\)\);[^]*?if \(raw && !keep\) setKeep\(null\);[^]*?SI\.withKeep\(st\.into, keep\);/, 'an old day is deleted when the panel opens');
  assert.match(desk, /if \(st\.into\.show && expireKeep\(\)\) \{ draw\(\); return; \}/, 'past midnight with the panel open: show the new target before sending');
  assert.match(desk, /if \(into\.keep && !r\.keep\) setKeep\(null\);/, 'picking another option clears the stored value');
});

// ─── keep saving while the list loads or fails (review 1) ──────────────────

const KEEP = { jotterId: J27, key: 'JOT-27', title: 'Photosynthesis homework', day: '2026-11-02' };
const K27 = { kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' };

test('today’s keep saving shows at once and holds Save until the list answers', () => {
  const into = SI.withKeep(SI.freshInto('https://example.org/leaf'), KEEP);
  assert.equal(into.mode, 'wait');
  assert.equal(into.show, true);
  assert.deepEqual(into.target, K27);
  assert.equal(SI.saveHeld(into), true);
  assert.deepEqual(SI.targetOf(into), K27, 'the line shows the keep target');
  const none = SI.withKeep(SI.freshInto('https://example.org/leaf'), null);
  assert.equal(none.mode, 'off');
  assert.equal(SI.saveHeld(none), false, 'no keep saving: nothing to wait for');
  const desk = read('popup/web-desk.js');
  assert.match(desk, /var waiting = SI\.saveHeld\(st\.into\);\s*if \(waiting && !st\.saving\) \{[^}]*go\.disabled = true;/, 'the button is disabled, with no click');
  assert.match(desk, /if \(st\.saving \|\| SI\.saveHeld\(st\.into\)\) return;/);
});

test('when the list answers: a child gets the list (keep still the target); signed out or a grown-up turns it all off; a failure keeps the keep target and sends its jotterId', () => {
  const child = SI.withList(SI.withKeep(SI.freshInto('u'), KEEP), { show: true, known: true, jotters: LIST, page: null });
  assert.equal(child.mode, 'list');
  assert.equal(SI.saveHeld(child), false);
  assert.deepEqual(SI.bodyOf(SI.targetOf(child)), { jotterId: J27 });

  for (const r of [{ show: false, known: true, jotters: [] }]) {
    const off = SI.withList(SI.withKeep(SI.freshInto('u'), KEEP), r);
    assert.equal(off.mode, 'off', 'signed out or a grown-up');
    assert.deepEqual(SI.bodyOf(SI.targetOf(off)), {}, 'no jotterId once the role is known not to be a child');
  }

  for (const r of [{ show: false, known: false, jotters: [] }, { ok: false }, null]) {
    const kept = SI.withList(SI.withKeep(SI.freshInto('u'), KEEP), r);
    assert.equal(kept.mode, 'keep', JSON.stringify(r));
    assert.equal(SI.saveHeld(kept), false, 'Save works again');
    assert.deepEqual(SI.bodyOf(SI.targetOf(kept)), { jotterId: J27 }, 'still saves into the keep target; the site checks it');
    assert.deepEqual(kept.jotters.map((j) => j.key), ['JOT-27'], 'the list offers the keep Jotter (and This page)');
  }
  const noKeep = SI.withList(SI.freshInto('u'), { show: false, known: false, jotters: [] });
  assert.equal(noKeep.mode, 'off');
  assert.deepEqual(SI.bodyOf(SI.targetOf(noKeep)), {}, 'a failure with no keep saving: the default, as before');
});

// ─── a single-page site moves on (review 2) ────────────────────────────────

test('another page: the old page’s Jotter is forgotten, an unpicked target is "This page" again, a picked Jotter stays; the desk asks again and drops late answers', () => {
  const into = SI.withList(SI.freshInto('https://example.org/a'), { show: true, known: true, jotters: LIST, page: { id: J24, key: 'JOT-24', title: 'Cells and tissues' } });
  assert.equal(into.target.id, J24);
  SI.withNavigation(into, 'https://example.org/b');
  assert.equal(into.url, 'https://example.org/b');
  assert.equal(into.page, undefined);
  assert.equal(into.learned, false);
  assert.deepEqual(into.target, SI.UNKNOWN, 'not the old page’s JOT-24');
  const picked = SI.freshInto('https://example.org/a');
  Object.assign(picked, { mode: 'list', show: true, target: { ...K27 }, picked: true });
  SI.withNavigation(picked, 'https://example.org/b');
  assert.deepEqual(picked.target, K27, 'a Jotter the child picked stays picked');
  const kept = SI.withKeep(SI.freshInto('https://example.org/a'), KEEP);
  SI.withNavigation(kept, 'https://example.org/b');
  assert.deepEqual(kept.target, K27, 'keep saving applies on every page (R14)');

  const desk = read('popup/web-desk.js');
  assert.match(desk, /if \(typeof r\.url === 'string' && r\.url && r\.url !== st\.into\.url\) \{[^]*?if \(st\.into\.url\) \{ SI\.withNavigation\(st\.into, r\.url\); loadJotters\(\); \}/, 'the tab URL comes from heddy-cards:get');
  assert.match(desk, /var seq = \+\+loadSeq;\s*return call\(\{ type: 'heddy-web:jotters' \}\)\.then\(function \(r\) \{\s*if \(seq !== loadSeq\) return;/, 'a late answer for the previous page is dropped');
  assert.match(read('lib/cards.js'), /return Object\.assign\(\{ ok: true, url: s\.url,/, 'heddy-cards:get names the page');
});

// ─── the key box, the list, the button ─────────────────────────────────────

test('the key box filters here: "31", "jot31", "JOT-31" find JOT-31; other words find titles; empty shows all', () => {
  const keys = (q) => SI.filterJotters(LIST, q).map((j) => j.key);
  assert.deepEqual(keys(''), ['JOT-27', 'JOT-24', 'JOT-31']);
  assert.deepEqual(keys('  '), ['JOT-27', 'JOT-24', 'JOT-31']);
  for (const q of ['31', 'jot31', 'JOT-31', 'jot-31', ' JOT 31 ']) assert.deepEqual(keys(q), ['JOT-31'], q);
  assert.deepEqual(keys('2'), ['JOT-27', 'JOT-24'], 'a key’s first digits');
  assert.deepEqual(keys('JOT-'), ['JOT-27', 'JOT-24', 'JOT-31']);
  assert.deepEqual(keys('cells'), ['JOT-24']);
  assert.deepEqual(keys('99'), []);
  assert.deepEqual(keys('7'), [], 'digits match from the start of the number, not inside it');
});

test('the options: "This page" first (its Jotter, or a new one), then Recent without repeating this page’s Jotter', () => {
  const o = SI.optionsOf(LIST, null, '');
  assert.deepEqual(o.map((x) => x.kind + ':' + (x.key || '')), ['new:', 'jotter:JOT-27', 'jotter:JOT-24', 'jotter:JOT-31']);
  const withPage = SI.optionsOf(LIST, { id: J24, key: 'JOT-24', title: 'Cells and tissues' }, '');
  assert.deepEqual(withPage.map((x) => x.kind + ':' + x.key), ['page:JOT-24', 'jotter:JOT-27', 'jotter:JOT-31']);
  assert.deepEqual(SI.optionsOf(LIST, null, '31').map((x) => x.key || 'new'), ['new', 'JOT-31'], 'the key box never hides "This page"');
  assert.deepEqual([SI.step(-1, 1, 4), SI.step(0, 1, 4), SI.step(3, 1, 4), SI.step(0, -1, 4), SI.step(-1, -1, 4), SI.step(0, 1, 0)], [0, 1, 0, 3, 3, -1]);
});

test('the button names its target: "Save 2 to JOT-27", the title when there is no key, the existing words for a new Jotter', () => {
  const j = { kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' };
  assert.equal(SI.buttonLabel(en, 2, j), 'Save 2 to JOT-27');
  assert.equal(SI.buttonLabel(en, 1, j), 'Save 1 to JOT-27');
  assert.equal(SI.buttonLabel(en, 0, j), 'Save this page to JOT-27');
  assert.equal(SI.buttonLabel(en, 2, { ...j, key: null }), 'Save 2 to Photosynthesis homework');
  assert.equal(SI.buttonLabel(en, 1, { kind: 'page', id: PAGE_J, key: 'JOT-9', title: 'x' }), 'Save 1 to JOT-9', 'this page’s Jotter, once known, is named too');
  assert.equal(SI.buttonLabel(en, 2, { kind: 'new' }), 'Save 2 to my Jotters');
  assert.equal(SI.buttonLabel(en, 1, { kind: 'new' }), 'Save 1 to my Jotters');
  assert.equal(SI.buttonLabel(en, 0, { kind: 'new' }), 'Save this page to my Jotters');
  assert.equal(SI.buttonLabel(zh, 2, j), '存 2 条到 JOT-27');
  assert.equal(SI.buttonLabel(zh, 0, j), '把这一页存到 JOT-27');
  assert.equal(SI.buttonLabel(zh, 2, { kind: 'new' }), '存 2 条到我的 Jotters');
});

test('the short times: now, 10 min, 3 h, a weekday, then a date (en and zh)', () => {
  const t = (ms, lang = 'en') => SI.relTime(lang === 'en' ? en : zh, lang, NOW.getTime() - ms, NOW);
  assert.equal(t(20000), 'now');
  assert.equal(t(10 * 60000), '10 min');
  assert.equal(t(3 * 3600000), '3 h');
  assert.equal(t(10 * 60000, 'zh_CN'), '10 分钟');
  assert.match(t(3 * 86400000), /^[A-Z][a-z]{2}$/, 'a weekday, e.g. Fri');
  assert.match(t(3 * 86400000, 'zh_CN'), /^周./);
  assert.match(t(20 * 86400000), /^\d{1,2} [A-Z][a-z]{2}$/, 'e.g. 13 Oct');
  assert.equal(SI.relTime(en, 'en', null, NOW), '');
});

// ─── jotter_gone (App. A 6) ────────────────────────────────────────────────

test('jotter_gone: the 404 is read as such, nothing is kept, and the desk is set back to "This page" with the message', () => {
  assert.deepEqual(H.parseSave({ status: 404, data: { ok: false, error: 'jotter_gone' } }), { ok: false, error: 'jotter_gone' });
  const g = SI.afterGone(null, { kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' });
  assert.deepEqual(g, { keep: null, page: null, target: { kind: 'new' }, picked: false, open: false, query: '', error: { key: 'intoGone', name: 'JOT-27' } });
  const page = { id: PAGE_J, key: 'JOT-9', title: 'This page' };
  assert.deepEqual(SI.afterGone(page, { kind: 'jotter', id: J27, key: 'JOT-27' }).target, { kind: 'page', id: PAGE_J, key: 'JOT-9', title: 'This page' }, 'another Jotter went: this page’s stays');
  assert.deepEqual(SI.afterGone({ id: J27, key: 'JOT-27', title: 'P' }, { kind: 'jotter', id: J27, key: 'JOT-27' }).target, { kind: 'new' }, 'this page’s own Jotter went');
  assert.equal(SI.afterGone(null, { kind: 'jotter', id: J27, key: null, title: 'Photosynthesis homework' }).error.name, 'Photosynthesis homework');
  assert.equal(en('intoGone', 'JOT-27'), "JOT-27 isn't there any more, so nothing was saved. Pick another Jotter.");
  assert.equal(zh('intoGone', 'JOT-27'), 'JOT-27 已经不在了，所以什么都没存。请另选一个 Jotter。');
  const desk = read('popup/web-desk.js');
  assert.match(desk, /if \(r\.error === 'jotter_gone' && into\.kind === 'jotter'\) return jotterGone\(into\);/);
  const gone = desk.slice(desk.indexOf('function jotterGone(gone) {'), desk.indexOf('function fail(key, args) {'));
  assert.match(gone, /var g = SI\.afterGone\(st\.into\.page, gone\);\s*setKeep\(null\);/, 'keep saving cleared');
  assert.match(gone, /st\.error = \{ key: g\.error\.key[^}]*\};\s*\/\/[^\n]*\n\s*draw\(\);\s*return loadJotters\(\);/, 'drawn at once (the spinner goes), then the list fetched again');
  const save = desk.slice(desk.indexOf('    function save() {'), desk.indexOf('/** "1 snippet and 2 pictures'));
  assert.ok(save.indexOf('st.saving = false;') < save.indexOf("return jotterGone(into);"), 'saving is over before jotterGone draws');
});

// ─── the body (App. A 5) ───────────────────────────────────────────────────

const ITEM = { kind: 'text', quote: 'light energy', before: '', after: '', pos: { block: 0, offset: 0 } };

test('the save body carries jotterId only when one was chosen, and only as a UUID', () => {
  const base = { url: 'https://example.org/leaf', title: 'Leaf', items: [ITEM] };
  assert.equal('jotterId' in C.buildWebSave(base), false, 'omitted by default');
  assert.equal('jotterId' in C.buildWebSave({ ...base, jotterId: null }), false);
  assert.equal(C.buildWebSave({ ...base, jotterId: J27 }).jotterId, J27);
  assert.throws(() => C.buildWebSave({ ...base, jotterId: 'j_1' }), /bad jotter/);
  assert.throws(() => C.buildWebSave({ ...base, jotterId: 27 }), /bad jotter/);
});

test('the background passes the desk’s jotterId to the save, and nothing when there is none; only Heddy’s own page may ask', async () => {
  const saves = [];
  const listed = [];
  const chrome = {
    runtime: { id: 'heddy', sendMessage: async () => {} },
    tabs: { get: async (id) => ({ id, url: 'https://example.org/leaf#part-2', title: 'Leaf' }), sendMessage: async () => {} },
    storage: { local: { get: async () => ({}) } },
  };
  const routes = W.createWebRoutes({
    chrome,
    api: { jotters: async (url) => { listed.push(url); return { show: true, jotters: [] }; } },
    cards: { saveWeb: async (tab, article, jotterId) => { saves.push([tab.id, article, jotterId]); return { ok: true }; }, undoSave: async () => ({ ok: true }) },
    showPanel: async () => {},
  });
  const frame = { id: 'heddy', url: 'chrome-extension://heddy/popup/popup.html' };
  const page = { id: 'heddy', url: 'https://example.org/leaf', tab: { id: 7 }, frameId: 0 };
  await routes.internal({ type: 'heddy-web:save', tabId: 7, article: false, jotterId: J27 }, frame);
  await routes.internal({ type: 'heddy-web:save', tabId: 7, article: true }, frame);
  assert.deepEqual(saves, [[7, false, J27], [7, true, null]]);
  assert.deepEqual(await routes.internal({ type: 'heddy-web:jotters', tabId: 7, url: 'https://evil.example/' }, frame), { show: true, jotters: [] });
  assert.deepEqual(listed, ['https://example.org/leaf'], 'the tab’s own address (no #), never one the message names');
  assert.deepEqual(await routes.internal({ type: 'heddy-web:jotters', tabId: 7 }, page), { ok: false }, 'a web page cannot read the list');
  const desk = read('popup/web-desk.js');
  assert.match(desk, /call\(Object\.assign\(\{ type: 'heddy-web:save', article: n \? st\.article : true \}, SI\.bodyOf\(into\)\)\)/);
  assert.match(desk, /function target\(\) \{\s*return SI\.targetOf\(st\.into\);/);
  assert.deepEqual(SI.targetOf({ ...SI.freshInto('u'), target: { kind: 'jotter', id: J27 } }), { kind: 'new' }, 'no line shown, no jotterId sent');
});

// ─── the view: text only, ARIA, keys ───────────────────────────────────────

/** A document just big enough for lib/save-into.js's draw, where every HTML sink throws. */
function fakeDoc() {
  const listeners = [];
  class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.on = {}; this.className = ''; this.id = ''; this._text = ''; this.hidden = false; this.value = ''; this.parent = null; }
    set innerHTML(_) { throw new Error('innerHTML used'); }
    get innerHTML() { throw new Error('innerHTML read'); }
    set outerHTML(_) { throw new Error('outerHTML used'); }
    insertAdjacentHTML() { throw new Error('insertAdjacentHTML used'); }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set textContent(v) { this.children = []; this._text = String(v); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(t, fn) { (this.on[t] = this.on[t] || []).push(fn); }
    fire(t, ev = {}) { const e = { target: this, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...ev }; let n = this; while (n) { (n.on[t] || []).forEach((fn) => fn(e)); if (e.stopped) break; n = n.parent; } return e; }
    contains(x) { for (let n = x; n; n = n.parent) if (n === this) return true; return false; }
    focus() { doc.activeElement = this; }
    all() { return [this, ...this.children.flatMap((c) => c.all())]; }
  }
  const doc = {
    activeElement: null,
    createElement: (t) => new El(t),
    addEventListener: (...a) => listeners.push(a),
    removeEventListener: () => {},
  };
  return doc;
}

function drawn(over = {}) {
  const doc = fakeDoc();
  const got = { picks: [], keeps: [], opens: [], queries: [] };
  const v = SI.draw({
    doc, tr: en, lang: 'en', now: () => NOW,
    target: { kind: 'jotter', id: J27, key: 'JOT-27', title: 'Photosynthesis homework' },
    keep: null, jotters: LIST, page: null, open: true, query: '', busy: false,
    onPick: (t) => got.picks.push(t), onKeep: (on) => got.keeps.push(on), onOpen: (o, back) => got.opens.push([o, back]), onQuery: (q) => got.queries.push(q),
    ...over,
  });
  return { doc, v, got, all: v.el.all() };
}

test('titles are drawn as text only: a title full of HTML lands verbatim in textContent, and no HTML sink is touched', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const { v, all } = drawn({ jotters: [{ id: J24, key: 'JOT-24', title: evil, at: NOW.getTime() }], target: { kind: 'jotter', id: J24, key: 'JOT-24', title: evil } });
  assert.ok(all.filter((e) => e.className === 't').some((e) => e.textContent === evil), 'on the line');
  assert.ok(all.some((e) => e.getAttribute('role') === 'option' && e.textContent.includes(evil)), 'in the list');
  assert.ok(!all.some((e) => e.tagName === 'IMG'));
  assert.equal(v.el.textContent.includes(evil), true);
  const src = read('lib/save-into.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
  assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, 'the module has no HTML sink at all');
});

test('the line: INTO, the key chip, the title, ▾; a "today" tag only while keep saving names it; ARIA button + listbox', () => {
  const { v, all } = drawn({ open: false });
  const line = v.line;
  assert.equal(line.tagName, 'BUTTON');
  assert.equal(line.getAttribute('aria-haspopup'), 'listbox');
  assert.equal(line.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(line.children.map((c) => c.textContent), ['Into', 'JOT-27', 'Photosynthesis homework', '▾']);
  const list = all.find((e) => e.getAttribute('role') === 'listbox');
  assert.equal(line.getAttribute('aria-controls'), list.id);
  const kept = drawn({ open: false, keep: { jotterId: J27, key: 'JOT-27', title: 'P', day: '2026-11-02' } });
  assert.deepEqual(kept.v.line.children.map((c) => c.textContent), ['Into', 'JOT-27', 'Photosynthesis homework', 'today', '▾']);
  const fresh = drawn({ open: false, target: { kind: 'new' } });
  assert.deepEqual(fresh.v.line.children.map((c) => [c.className, c.textContent]), [['l', 'Into'], ['ky new', 'New'], ['t', 'A new Jotter for this page'], ['cv', '▾']]);
});

test('the list, as the artifact: This page, Recent (key chip, title, time), the key box, a rule, Keep saving; the chosen one selected', () => {
  const { all } = drawn();
  const pop = all.find((e) => e.className === 'ip');
  const order = pop.all().filter((e) => ['sec', 'it', 'sr', 'kp'].includes(e.className.split(' ')[0]) || e.tagName === 'HR').map((e) => e.tagName === 'HR' ? 'hr' : e.className.split(' ')[0] === 'sec' ? 'sec:' + e.textContent : e.className.split(' ')[0] === 'sr' ? 'box' : e.className.split(' ')[0] === 'kp' ? 'keep:' + e.textContent : 'opt:' + e.textContent);
  assert.deepEqual(order, ['sec:This page', 'opt:NewA new Jotter for this page', 'sec:Recent', 'opt:JOT-27Photosynthesis homework10 min', 'opt:JOT-24Cells and tissuesFri', 'opt:JOT-31Biology log · Vol. 1Thu', 'box', 'hr', 'keep:Keep saving into JOT-27 today']);
  const opts = all.filter((e) => e.getAttribute('role') === 'option');
  assert.deepEqual(opts.map((o) => o.getAttribute('aria-selected')), ['false', 'true', 'false', 'false']);
  assert.equal(all.find((e) => e.className === 'sr').getAttribute('placeholder'), 'Type a key, e.g. JOT-31');
  assert.equal(drawn({ target: { kind: 'new' } }).all.some((e) => e.className === 'kp'), false, 'no Keep saving for a new Jotter (nothing to keep)');
});

test('keys: ↓ ↑ move, Enter picks, Esc closes and gives focus back (and does not close the panel); typing filters; a tap picks', () => {
  const { v, got, all } = drawn();
  const box = v.box;
  const pop = all.find((e) => e.className === 'ip');
  const opts = () => v.el.all().filter((e) => e.getAttribute('role') === 'option');
  assert.equal(box.getAttribute('aria-activedescendant'), opts()[1].id, 'starts on the chosen one');
  box.fire('keydown', { key: 'ArrowDown' });
  assert.equal(box.getAttribute('aria-activedescendant'), opts()[2].id);
  box.fire('keydown', { key: 'Enter' });
  assert.deepEqual(got.picks.at(-1), { kind: 'jotter', id: J24, key: 'JOT-24', title: 'Cells and tissues' });
  box.fire('keydown', { key: 'ArrowUp' });
  box.fire('keydown', { key: 'ArrowUp' });
  box.fire('keydown', { key: 'Enter' });
  assert.deepEqual(got.picks.at(-1), { kind: 'new' });
  const esc = box.fire('keydown', { key: 'Escape' });
  assert.equal(esc.stopped, true, 'the panel’s own Esc never hears it');
  assert.deepEqual(got.opens.at(-1), [false, true]);
  box.value = '31';
  box.fire('input');
  assert.deepEqual(got.queries, ['31']);
  assert.deepEqual(opts().map((o) => o.textContent.slice(0, 6)), ['NewA n', 'JOT-31']);
  assert.equal(box.getAttribute('aria-activedescendant'), opts()[1].id, 'a typed key lands on its first match');
  box.fire('keydown', { key: 'Enter' });
  assert.equal(got.picks.at(-1).id, J31);
  opts()[0].fire('click');
  assert.deepEqual(got.picks.at(-1), { kind: 'new' });
  assert.ok(pop);
});

test('the line opens and closes the list; the keep box reports its tick; a busy save locks the line', () => {
  const closed = drawn({ open: false });
  closed.v.line.fire('click');
  assert.deepEqual(closed.got.opens, [[true, true]]);
  closed.v.line.fire('keydown', { key: 'ArrowDown' });
  assert.deepEqual(closed.got.opens.at(-1), [true, true]);
  const open = drawn();
  const cb = open.all.find((e) => e.className === 'kp').children[0];
  cb.checked = true;
  cb.fire('change');
  assert.deepEqual(open.got.keeps, [true]);
  const busy = drawn({ open: false, busy: true });
  assert.equal(busy.v.line.disabled, true);
  busy.v.line.fire('click');
  assert.deepEqual(busy.got.opens, []);
});

// ─── no new permission, the files ──────────────────────────────────────────

test('the version is 0.9.0 (Save into, a new feature)', () => {
  assert.equal(manifest().version, '0.9.0');
});

test('Save into asks for no new permission or host, and ships in the panel page', () => {
  const m = manifest();
  assert.deepEqual(m.permissions, ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage']);
  assert.deepEqual(m.host_permissions, ['https://www.youtube.com/watch*', 'https://aitutors.me/*', 'https://*.aitutors.me/*']);
  const html = read('popup/popup.html');
  assert.ok(html.indexOf('../lib/save-into.js') > 0 && html.indexOf('../lib/save-into.js') < html.indexOf('web-desk.js'), 'loaded before the desk');
  assert.ok(m.web_accessible_resources[0].resources.includes('lib/save-into.js'));
});

test('en and zh strings for Save into (zh: UK school terms in English, 「」 quotes, full-width punctuation)', () => {
  const keys = ['intoLabel', 'intoNewChip', 'intoNewPage', 'intoThisPage', 'intoRecent', 'intoKeyBox', 'intoKeep', 'intoToday', 'intoSaveN', 'intoGone'];
  const enM = JSON.parse(read('_locales/en/messages.json'));
  const zhM = JSON.parse(read('_locales/zh_CN/messages.json'));
  assert.deepEqual(keys.map((k) => enM[k].message), ['Into', 'New', 'A new Jotter for this page', 'This page', 'Recent', 'Type a key, e.g. JOT-31', 'Keep saving into $NAME$ today', 'today', 'Save $N$ to $NAME$', "$NAME$ isn't there any more, so nothing was saved. Pick another Jotter."]);
  for (const k of keys) {
    const m = zhM[k].message;
    assert.doesNotMatch(m, /[一-鿿][,;:?!.]/, `${k}: a half-width mark after a Chinese character`);
    assert.doesNotMatch(m, /["“”]/, `${k}: use 「」`);
    if (/Jotter/.test(enM[k].message)) assert.match(m, /Jotter/, `${k} keeps Jotter in English`);
  }
});
