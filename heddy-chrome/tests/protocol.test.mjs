// The heddy:add Heddy builds is one the site accepts. The site's validator is
// parseHeddyMessage in aitutors.me's lib/capture/protocol.ts; its heddy:add
// branch is ported below, line for line, with its two patterns copied
// verbatim, so this test fails if Heddy ever builds what the site refuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const P = load('./lib/protocol.js');

// ── copied from lib/capture/protocol.ts (aitutors.me, origin/main) ──
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_T = 24 * 60 * 60;
const seconds = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= MAX_T;
function siteParseAdd(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'not_heddy' };
  const m = data;
  if (m.type !== 'heddy:add') return { ok: false, reason: 'not_heddy' };
  if (m.v !== 1) return { ok: false, reason: 'version' };
  if (typeof m.cid !== 'string' || !UUID.test(m.cid)) return { ok: false, reason: 'bad' };
  if (typeof m.youtubeId !== 'string' || !YOUTUBE_ID.test(m.youtubeId)) return { ok: false, reason: 'bad' };
  const s = m.startSec ?? null;
  if (s !== null && !seconds(s)) return { ok: false, reason: 'bad' };
  if (m.then !== 'keep' && m.then !== 'classroom') return { ok: false, reason: 'bad' };
  return { ok: true, msg: { type: 'heddy:add', v: 1, cid: m.cid, youtubeId: m.youtubeId, startSec: s === null ? null : Math.floor(s), then: m.then } };
}
// ── end of copy ──

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';

test('Heddy’s patterns are the site’s, character for character', () => {
  assert.equal(P.YOUTUBE_ID.source, YOUTUBE_ID.source);
  assert.equal(P.UUID.source, UUID.source);
  assert.equal(P.UUID.flags, UUID.flags);
});

test('every heddy:add Heddy builds passes the site’s validator unchanged', () => {
  const cases = [
    { youtubeId: 'Fq2aPn3x_-A', startSec: null, then: 'keep' },
    { youtubeId: 'Fq2aPn3x_-A', startSec: 112, then: 'classroom' },
    { youtubeId: 'abcdefghijk', startSec: 112.9, then: 'keep' },
    { youtubeId: 'ABCDEFGHIJK', startSec: 0, then: 'classroom' },
    { youtubeId: '-----------', startSec: MAX_T, then: 'keep' },
  ];
  for (const c of cases) {
    const built = P.buildAdd({ cid: CID, ...c });
    const parsed = siteParseAdd(JSON.parse(JSON.stringify(built)));
    assert.equal(parsed.ok, true, JSON.stringify(c));
    assert.deepEqual(parsed.msg, built);
  }
});

test('buildAdd refuses what the site would refuse, rather than send it', () => {
  const ok = { cid: CID, youtubeId: 'Fq2aPn3x_-A', startSec: null, then: 'keep' };
  const bad = [
    { cid: 'not-a-uuid' },
    { cid: CID.replace(/-/g, '') },
    { youtubeId: 'short' },
    { youtubeId: 'Fq2aPn3x_-AB' },
    { youtubeId: 'Fq2aPn3x_-<' },
    { startSec: -1 },
    { startSec: MAX_T + 1 },
    { startSec: NaN },
    { startSec: '12' },
    { then: 'watch' },
    { then: undefined },
  ];
  for (const b of bad) {
    const input = { ...ok, ...b };
    assert.throws(() => P.buildAdd(input), JSON.stringify(b));
    // And the site agrees it is bad, so the two stay in step.
    assert.equal(siteParseAdd({ type: 'heddy:add', v: 1, ...input }).ok, false, JSON.stringify(b));
  }
});

test('the video id comes only from a YouTube watch page', () => {
  assert.equal(P.youtubeIdFromUrl('https://www.youtube.com/watch?v=Fq2aPn3x_-A'), 'Fq2aPn3x_-A');
  assert.equal(P.youtubeIdFromUrl('https://www.youtube.com/watch?v=Fq2aPn3x_-A&t=112s&list=x'), 'Fq2aPn3x_-A');
  for (const url of [
    'https://www.youtube.com/shorts/Fq2aPn3x_-A',
    'https://www.youtube.com/embed/Fq2aPn3x_-A',
    'https://www.youtube.com/live/Fq2aPn3x_-A',
    'https://www.youtube.com/shorts/x?v=Fq2aPn3x_-A',
    'https://www.youtube.com/playlist?v=Fq2aPn3x_-A',
    'https://www.youtube.com/',
    'https://m.youtube.com/watch?v=Fq2aPn3x_-A',
    'http://www.youtube.com/watch?v=Fq2aPn3x_-A',
    'https://www.youtube.com.evil.example/watch?v=Fq2aPn3x_-A',
    'https://www.youtube.com/watch?v=<script>',
    'https://www.youtube.com/watch',
    'not a url',
  ]) {
    assert.equal(P.youtubeIdFromUrl(url), null, url);
  }
});

test('From m:ss: whole seconds from 1 s; anything else is the whole video', () => {
  assert.equal(P.startSecFor('from', 112.7), 112);
  assert.equal(P.startSecFor('from', 0.4), null);
  assert.equal(P.startSecFor('from', NaN), null);
  assert.equal(P.startSecFor('from', null), null);
  assert.equal(P.startSecFor('whole', 112), null);
  assert.equal(P.startSecFor(undefined, 112), null);
});

test('parseExternal answers only v1 heddy:ready / heddy:result with a UUID cid', () => {
  assert.deepEqual(P.parseExternal({ type: 'heddy:ready', v: 1, cid: CID.toUpperCase() }), { kind: 'ready', cid: CID });
  assert.equal(P.parseExternal({ type: 'heddy:ready', v: 2, cid: CID }), null);
  assert.equal(P.parseExternal({ type: 'heddy:ready', v: 1, cid: 'x' }), null);
  assert.equal(P.parseExternal({ type: 'heddy:add', v: 1, cid: CID }), null);
  assert.equal(P.parseExternal([{ type: 'heddy:ready', v: 1, cid: CID }]), null);
  assert.equal(P.parseExternal({ type: 'heddy:result', v: 1, cid: CID }), null, 'ok is required');
  const r = P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, topicId: 'map-scales', topic: 'Maths · Map scales' });
  assert.deepEqual(r, { kind: 'result', cid: CID, ok: true, error: null, topicId: 'map-scales', topic: 'Maths · Map scales' });
  const hostile = P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: false, error: '<img src=x onerror=alert(1)>', topicId: '../../admin', topic: 'x'.repeat(500) });
  assert.deepEqual(hostile, { kind: 'result', cid: CID, ok: false, error: null, topicId: null, topic: null });
});

test('clockOf prints times as the site does', () => {
  assert.equal(P.clockOf(112), '1:52');
  assert.equal(P.clockOf(5), '0:05');
  assert.equal(P.clockOf(3725), '1:02:05');
});

test('the protocol file names the site files it mirrors', () => {
  assert.match(read('lib/protocol.js'), /lib\/capture\/protocol\.ts/);
});
