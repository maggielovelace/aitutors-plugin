// Phase 2's messages (D18, D20): heddy:moment, heddy:undo, heddy:jot and
// heddy:page, each checked against the site's own validator. The branches of
// parseHeddyMessage in aitutors.me's lib/capture/protocol.ts (origin/main) are
// ported below line for line, so this fails if Heddy builds what it refuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const P = load('./lib/protocol.js');

// ── copied from lib/capture/protocol.ts (aitutors.me, origin/main) ──
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_URL = 2048;
const MAX_FIELD = 20_000;
const MAX_MARKDOWN = 1_000_000;
const MAX_T = 24 * 60 * 60;
const str = (x, max) => typeof x === 'string' && x.length <= max;
const httpUrl = (x) => str(x, MAX_URL) && /^https?:\/\//i.test(x);
const seconds = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= MAX_T;
function siteParse(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, reason: 'not_heddy' };
  if (m.v !== 1) return { ok: false, reason: 'version' };
  const bad = { ok: false, reason: 'bad' };
  if (typeof m.cid !== 'string' || !UUID.test(m.cid)) return bad;
  const text = (k) => (m[k] === undefined || m[k] === null ? '' : m[k]);
  switch (m.type) {
    case 'heddy:moment':
      if (typeof m.youtubeId !== 'string' || !YOUTUBE_ID.test(m.youtubeId) || !seconds(m.t)) return bad;
      return { ok: true };
    case 'heddy:undo':
      if (typeof m.jotId !== 'string' || !UUID.test(m.jotId)) return bad;
      return { ok: true };
    case 'heddy:page': {
      const title = text('title');
      if (!httpUrl(m.url) || !str(title, MAX_FIELD) || !str(m.markdown, MAX_MARKDOWN) || !m.markdown.trim()) return bad;
      return { ok: true };
    }
    case 'heddy:jot': {
      const title = text('title');
      const quote = text('quote');
      const context = text('context');
      if (!httpUrl(m.url) || !str(title, MAX_FIELD) || !str(quote, MAX_FIELD) || !str(context, MAX_FIELD) || !quote.trim()) return bad;
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'not_heddy' };
  }
}
// ── end of copy ──

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const JOT = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const wire = (m) => JSON.parse(JSON.stringify(m));

test('heddy:moment: the video and the second; join only when there was one', () => {
  const m = P.buildMoment({ cid: CID, youtubeId: 'Fq2aPn3x_-A', t: 168.9 });
  assert.deepEqual(m, { type: 'heddy:moment', v: 1, cid: CID, youtubeId: 'Fq2aPn3x_-A', t: 168 });
  assert.equal(siteParse(wire(m)).ok, true);
  const j = P.buildMoment({ cid: CID, youtubeId: 'Fq2aPn3x_-A', t: 168, join: 2 });
  assert.equal(j.join, 2);
  assert.equal(siteParse(wire(j)).ok, true, 'the site ignores join until it reads it');
  assert.equal(P.buildMoment({ cid: CID, youtubeId: 'Fq2aPn3x_-A', t: 1, join: 99 }).join, 10);
  for (const bad of [{ t: -1 }, { t: NaN }, { t: MAX_T + 1 }, { youtubeId: 'short' }, { cid: 'x' }, { join: -1 }]) {
    assert.throws(() => P.buildMoment({ cid: CID, youtubeId: 'Fq2aPn3x_-A', t: 1, ...bad }), JSON.stringify(bad));
  }
});

test('heddy:undo carries a jot id and nothing else', () => {
  const u = P.buildUndo({ cid: CID, jotId: JOT.toUpperCase() });
  assert.deepEqual(u, { type: 'heddy:undo', v: 1, cid: CID, jotId: JOT });
  assert.equal(siteParse(wire(u)).ok, true);
  assert.throws(() => P.buildUndo({ cid: CID, jotId: '../x' }));
});

test('heddy:jot: the quote, ≤ 300 characters each side, the title, the URL without #', () => {
  const j = P.buildJot({
    cid: CID,
    url: 'https://www.ordnancesurvey.co.uk/map-scales?x=1#section-2',
    title: '  Understanding\nmap scales ',
    quote: 'On a 1:50 000 map, 2 cm represents 1 km on the ground.',
    before: 'x'.repeat(500) + ' The scale is printed in the margin. ',
    after: ' Grid squares on Landranger maps are 1 km across' + 'y'.repeat(500),
  });
  assert.equal(j.url, 'https://www.ordnancesurvey.co.uk/map-scales?x=1');
  assert.equal(j.title, 'Understanding map scales');
  const [before, after] = j.context.split(' … ');
  assert.ok(before.length <= 300 && after.length <= 300, `${before.length} / ${after.length}`);
  assert.ok(before.endsWith('The scale is printed in the margin.'), 'cut on the side away from the quote');
  assert.ok(after.startsWith('Grid squares on Landranger maps'));
  assert.equal(siteParse(wire(j)).ok, true);
});

test('heddy:jot keeps the child’s line breaks, drops control characters, caps the quote', () => {
  const j = P.buildJot({ cid: CID, url: 'https://a.example/', title: '', quote: 'one\ntwo\u0007 ', before: '', after: '' });
  assert.equal(j.quote, 'one\ntwo');
  assert.equal(j.context, '');
  assert.equal(P.buildJot({ cid: CID, url: 'https://a.example/', quote: 'q'.repeat(30000) }).quote.length, MAX_FIELD);
  assert.equal(P.buildJot({ cid: CID, url: 'https://a.example/', quote: 'q', before: 'only before' }).context, 'only before');
});

test('heddy:jot refuses what the site would refuse: no words, not http(s), too long an address', () => {
  for (const bad of [
    { quote: '   ' },
    { url: 'chrome://extensions' },
    { url: 'javascript:alert(1)' },
    { url: 'file:///Users/x' },
    { url: 'https://a.example/' + 'p'.repeat(3000) },
    { cid: 'x' },
  ]) {
    assert.throws(() => P.buildJot({ cid: CID, url: 'https://a.example/', quote: 'q', ...bad }), JSON.stringify(bad).slice(0, 60));
  }
});

test('heddy:page: Markdown up to 200 KB of UTF-8 bytes, not characters', () => {
  assert.equal(P.MAX_PAGE_BYTES, 200 * 1024);
  const ok = P.buildPage({ cid: CID, url: 'https://a.example/p#top', title: 'P', markdown: 'a'.repeat(P.MAX_PAGE_BYTES) });
  assert.equal(ok.url, 'https://a.example/p');
  assert.equal(siteParse(wire(ok)).ok, true);
  assert.throws(() => P.buildPage({ cid: CID, url: 'https://a.example/', markdown: 'a'.repeat(P.MAX_PAGE_BYTES + 1) }), /too_long/);
  // 70 000 Chinese characters are 210 000 bytes: too long, though fewer characters.
  assert.throws(() => P.buildPage({ cid: CID, url: 'https://a.example/', markdown: '比'.repeat(70000) }), /too_long/);
  assert.throws(() => P.buildPage({ cid: CID, url: 'https://a.example/', markdown: ' \n ' }), /empty/);
});

test('utf8Bytes counts as TextEncoder does', () => {
  const enc = new TextEncoder();
  for (const s of ['', 'abc', 'é', '比例尺', '😀', 'a😀b', '\ud800']) assert.equal(P.utf8Bytes(s), enc.encode(s).length, JSON.stringify(s));
});

test('a result’s quote, time and jot id are read; anything else in them is dropped', () => {
  const r = P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, quote: ' On a map\u0000 ', t: 168.7, jotId: JOT.toUpperCase() });
  assert.equal(r.quote, 'On a map');
  assert.equal(r.t, 168);
  assert.equal(r.jotId, JOT);
  const h = P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, quote: 42, t: -5, jotId: '../../x' });
  assert.deepEqual([h.quote, h.t, h.jotId], [null, null, null]);
});
