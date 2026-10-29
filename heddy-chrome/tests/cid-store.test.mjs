// D19: Heddy answers a cid once, only to the window it opened, and drops a
// payload nobody claimed within 10 minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { createCidStore, HOLD_MS, RESULT_MS } = load('./lib/cid-store.js');
const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ORIGIN = 'https://aitutors.me';
const PAYLOAD = { type: 'heddy:add', v: 1, cid: CID, youtubeId: 'Fq2aPn3x_-A', startSec: null, then: 'keep' };

function setup() {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const store = createCidStore({ now: clock.now });
  store.put(CID, { payload: PAYLOAD, origin: ORIGIN, tabId: 7, then: 'keep', youtubeId: 'Fq2aPn3x_-A', startSec: null });
  store.setWindow(CID, 42);
  return { store, clock };
}

test('the hold is ten minutes', () => {
  assert.equal(HOLD_MS, 10 * 60 * 1000);
});

test('a cid is answered once, then forgotten', () => {
  const { store } = setup();
  assert.deepEqual(store.claim(CID, { origin: ORIGIN, windowId: 42 }), PAYLOAD);
  assert.equal(store.claim(CID, { origin: ORIGIN, windowId: 42 }), null);
});

test('cids match whatever their case', () => {
  const { store } = setup();
  assert.deepEqual(store.claim(CID.toUpperCase(), { origin: ORIGIN, windowId: 42 }), PAYLOAD);
});

test('an unknown cid gets nothing', () => {
  const { store } = setup();
  assert.equal(store.claim('11111111-2222-4333-8444-555555555555', { origin: ORIGIN, windowId: 42 }), null);
});

test('an unclaimed payload is held until just before 10 minutes and dropped at 10', () => {
  const a = setup();
  a.clock.advance(HOLD_MS - 1);
  assert.equal(a.store.minutesLeft(CID), 1);
  assert.deepEqual(a.store.claim(CID, { origin: ORIGIN, windowId: 42 }), PAYLOAD);

  const b = setup();
  b.clock.advance(HOLD_MS);
  assert.equal(b.store.claim(CID, { origin: ORIGIN, windowId: 42 }), null);
  assert.equal(b.store.size(), 0);
});

test('only the origin and window Heddy opened may claim it', () => {
  const { store } = setup();
  assert.equal(store.claim(CID, { origin: 'http://localhost:3000', windowId: 42 }), null);
  assert.equal(store.claim(CID, { origin: ORIGIN, windowId: 43 }), null);
  // Neither attempt used it up.
  assert.deepEqual(store.claim(CID, { origin: ORIGIN, windowId: 42 }), PAYLOAD);
});

test('before Chrome reports the window id, the origin alone decides', () => {
  let t = 0;
  const store = createCidStore({ now: () => t });
  store.put(CID, { payload: PAYLOAD, origin: ORIGIN });
  assert.deepEqual(store.claim(CID, { origin: ORIGIN, windowId: 99 }), PAYLOAD);
});

test('a result is taken once, only after the claim, and only by the same window', () => {
  const { store, clock } = setup();
  assert.equal(store.takeResult(CID, { origin: ORIGIN, windowId: 42 }), null, 'before the claim');
  store.claim(CID, { origin: ORIGIN, windowId: 42 });
  assert.equal(store.takeResult(CID, { origin: ORIGIN, windowId: 41 }), null, 'another window');
  clock.advance(RESULT_MS - 1);
  const meta = store.takeResult(CID, { origin: ORIGIN, windowId: 42 });
  assert.equal(meta.tabId, 7);
  assert.equal(meta.then, 'keep');
  assert.equal(store.takeResult(CID, { origin: ORIGIN, windowId: 42 }), null, 'twice');
});

test('a result that never comes is forgotten after 30 minutes', () => {
  const { store, clock } = setup();
  store.claim(CID, { origin: ORIGIN, windowId: 42 });
  clock.advance(RESULT_MS);
  assert.equal(store.takeResult(CID, { origin: ORIGIN, windowId: 42 }), null);
});

test('the state survives a service worker restart, clock and all', () => {
  const { store, clock } = setup();
  const saved = JSON.parse(JSON.stringify(store.toJSON()));
  const again = createCidStore({ now: clock.now });
  again.load(saved);
  clock.advance(HOLD_MS - 1);
  assert.deepEqual(again.claim(CID, { origin: ORIGIN, windowId: 42 }), PAYLOAD);
  assert.equal(again.claim(CID, { origin: ORIGIN, windowId: 42 }), null);

  const late = createCidStore({ now: () => clock.now() + 1 });
  late.load(saved);
  assert.equal(late.claim(CID, { origin: ORIGIN, windowId: 42 }), null, 'expired across the restart');
});

test('a junk saved state loads as empty', () => {
  const store = createCidStore();
  store.load('junk');
  assert.equal(store.size(), 0);
  store.load(undefined);
  assert.equal(store.size(), 0);
});
