// heddy:box (D32, D33), exactly the shape in COMMON.md / the site's
// lib/capture/protocol.ts, and the checks every page-borne value passes.
// Round 9 (D78, D84): heddy:tool and its windows are gone; the tools open the
// desk's Ask view (tests/round9.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
const T = load('./lib/tools.js');
const K = globalThis.HeddyCrop;

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PNG = K.base64FromBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));
const BOX = { kind: 'web', vw: 1280, vh: 800, x: 200, y: 166, w: 270, h: 136 };
const IMG = { png: PNG, box: BOX };
const URL_ = 'https://www.ordnancesurvey.co.uk/blog/map-scales';

function bigPng(bytes) {
  const b = new Uint8Array(bytes);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return K.base64FromBytes(b);
}

test('heddy:box has exactly COMMON.md’s fields', () => {
  const m = T.buildBox({ cid: CID, url: URL_ + '#scales', title: 'Understanding map scales', images: [IMG], context: 'Scales are written three ways.' });
  assert.deepEqual(Object.keys(m).sort(), ['cid', 'context', 'images', 'title', 'type', 'url', 'v']);
  assert.equal(m.type, 'heddy:box');
  assert.equal(m.v, 1);
  assert.equal(m.url, URL_, 'no #fragment');
  assert.deepEqual(m.images, [{ png: PNG, box: BOX }]);
  assert.deepEqual(Object.keys(m.images[0].box).sort(), ['h', 'kind', 'vh', 'vw', 'w', 'x', 'y']);
});

test('heddy:box takes 1 to 4 images', () => {
  const b = (images) => () => T.buildBox({ cid: CID, url: URL_, title: 't', images, context: '' });
  assert.throws(b([]));
  assert.throws(b(undefined));
  assert.equal(b([IMG, IMG, IMG, IMG])().images.length, 4);
  assert.throws(b([IMG, IMG, IMG, IMG, IMG]));
});

test('each png is base64 PNG without a data: prefix, at most 1 MB decoded', () => {
  const b = (png) => () => T.buildBox({ cid: CID, url: URL_, title: 't', images: [{ png, box: BOX }], context: '' });
  assert.throws(b('data:image/png;base64,' + PNG), 'prefix');
  assert.throws(b(K.base64FromBytes(new Uint8Array([255, 216, 255, 224]))), 'a JPEG');
  assert.throws(b(PNG + '!'), 'not base64');
  assert.ok(b(bigPng(1000000))());
  assert.throws(b(bigPng(1000001)), 'over 1 MB');
});

test('each box is {kind:"web", vw, vh > 0, x, y ≥ 0, w, h > 0}', () => {
  const b = (box) => () => T.buildBox({ cid: CID, url: URL_, title: 't', images: [{ png: PNG, box }], context: '' });
  assert.throws(b({ ...BOX, kind: 'page' }));
  assert.throws(b({ ...BOX, vw: 0 }));
  assert.throws(b({ ...BOX, x: -1 }));
  assert.throws(b({ ...BOX, w: 0 }));
  assert.throws(b({ ...BOX, h: NaN }));
  assert.ok(b({ ...BOX, x: 0, y: 0 })());
  // extra keys on a box are not carried
  assert.deepEqual(b({ ...BOX, evil: 1 })().images[0].box, BOX);
});

test('url is http(s) only; title and context are capped at 300 and cleaned', () => {
  const b = (o) => T.buildBox({ cid: CID, url: URL_, title: 't', images: [IMG], context: '', ...o });
  assert.throws(() => b({ url: 'javascript:alert(1)' }));
  assert.throws(() => b({ url: 'chrome://settings' }));
  assert.throws(() => b({ cid: 'nope' }));
  assert.equal(b({ title: 'x'.repeat(400) }).title.length, 300);
  assert.equal(b({ context: 'y'.repeat(400) }).context.length, 300);
  assert.equal(b({ context: 'a\u0000b\nc' }).context, 'a b c');
});

test('the 4-picture payload at the cap still fits Chrome messaging (64 MiB)', () => {
  const png = bigPng(1000000);
  const m = T.buildBox({ cid: CID, url: URL_, title: 't', images: [0, 1, 2, 3].map(() => ({ png, box: BOX })), context: '' });
  const size = JSON.stringify(m).length;
  assert.ok(size < 6 * 1024 * 1024, `about 5.3 MB, got ${size}`);
});

test('Round 9: no tool window and no window sender (D78); the pure checks stay', () => {
  for (const gone of ['buildTool', 'pageFor', 'createSender', 'sendTool', 'buildCardUndo', 'PAGES']) assert.equal(T[gone], undefined, gone);
  assert.equal(typeof T.buildBox, 'function');
  assert.deepEqual(T.TOOLS, ['explain', 'card', 'ask']);
});
