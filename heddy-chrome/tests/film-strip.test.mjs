// Round 8 (PRD-v0.96.0 D75, D76; artifact #popup P2): the popup's film strip,
// pure — the chips, the two handles, what the capture carries, the range
// words, the exact link, the real thumbnail, and YouTube's storyboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const F = load('./lib/film-strip.js');
const sec = (n) => `${n} s`;

test('the chips: Whole is the whole video, The last 30 s ends now, From now runs to the end', () => {
  assert.deepEqual(F.chipRange('whole', 31, 174.4), { start: 0, end: 174 });
  assert.deepEqual(F.chipRange('last30', 73.6, 174), { start: 43, end: 73 });
  assert.deepEqual(F.chipRange('last30', 12, 174), { start: 0, end: 12 }, 'near the start, from 0');
  assert.deepEqual(F.chipRange('fromNow', 21.9, 174), { start: 21, end: 174 });
  assert.equal(F.chipRange('last30', 0.4, 174), null, 'nothing has played');
  assert.equal(F.chipRange('fromNow', 174, 174), null, 'nothing is left');
  assert.equal(F.chipRange('fromNow', null, 174), null);
  assert.equal(F.chipRange('whole', 3, null), null, 'no length known');
  assert.equal(F.chipRange('nope', 3, 174), null);
});

test('a part is named by its chip, or by none once a handle was dragged', () => {
  assert.equal(F.chipOf({ start: 0, end: 174 }, 21, 174), 'whole');
  assert.equal(F.chipOf({ start: 21, end: 174 }, 21, 174), 'fromNow');
  assert.equal(F.chipOf({ start: 21, end: 73 }, 21, 174), null);
});

test('dragging a handle clamps to the video and keeps the window at least 1 s wide', () => {
  const r = { start: 21, end: 73 };
  assert.deepEqual(F.dragTo(r, 'start', -5, 174), { start: 0, end: 73 });
  assert.deepEqual(F.dragTo(r, 'start', 90, 174), { start: 72, end: 73 });
  assert.deepEqual(F.dragTo(r, 'end', 500, 174), { start: 21, end: 174 });
  assert.deepEqual(F.dragTo(r, 'end', 3, 174), { start: 21, end: 22 });
  assert.deepEqual(F.dragTo(r, 'end', 40.6, 174), { start: 21, end: 41 });
  assert.equal(F.secAt(186, 372, 174), 87);
  assert.equal(F.secAt(-10, 372, 174), 0);
  assert.equal(F.secAt(999, 372, 174), 174);
  assert.deepEqual(F.windowPct({ start: 0, end: 87 }, 174), { left: 0, width: 50 });
});

test('the capture carries nothing for the whole video, else the start and/or the end (D75)', () => {
  assert.deepEqual(F.captureFields({ start: 0, end: 174 }, 174.6), {});
  assert.deepEqual(F.captureFields({ start: 21, end: 73 }, 174), { startSec: 21, endSec: 73 });
  assert.deepEqual(F.captureFields({ start: 0, end: 73 }, 174), { endSec: 73 }, 'from the start: no start');
  assert.deepEqual(F.captureFields({ start: 21, end: 174 }, 174), { startSec: 21 }, 'to the end: no end');
});

test('the range reads "0:21 → 1:13 · 52 s"; a minute or more reads m:ss', () => {
  assert.equal(F.spanText(52, sec), '52 s');
  assert.equal(F.spanText(59.6, sec), '1:00');
  assert.equal(F.spanText(174, sec), '2:54');
  assert.equal(F.clock(73), '1:13');
  assert.equal(F.clock(3725), '1:02:05');
});

test('the exact link (D76): youtube.com/watch?v={id}, plus &t= for a part that does not start at 0', () => {
  assert.deepEqual(F.linkFor('Xq3aPn3x_-A', 0), { shown: 'youtube.com/watch?v=Xq3aPn3x_-A', href: 'https://www.youtube.com/watch?v=Xq3aPn3x_-A' });
  assert.deepEqual(F.linkFor('Xq3aPn3x_-A', 14.7), { shown: 'youtube.com/watch?v=Xq3aPn3x_-A&t=14', href: 'https://www.youtube.com/watch?v=Xq3aPn3x_-A&t=14' });
});

test('the real thumbnail (D76) is YouTube’s own still, and nothing for anything that is not a video id', () => {
  assert.equal(F.thumbUrl('Xq3aPn3x_-A'), 'https://i.ytimg.com/vi/Xq3aPn3x_-A/mqdefault.jpg');
  assert.equal(F.thumbUrl('../../evil'), null);
  assert.equal(F.thumbUrl(''), null);
});

// A storyboard spec in YouTube's own shape (fields shortened).
const SPEC = 'https://i.ytimg.com/sb/Xq3aPn3x_-A/storyboard3_L$L/$N.jpg?sqp=-oaymwENSDfyq4qpAwVwAcABBqLzl_8DBgjd|48#27#100#10#10#0#default#rs$AOn4CLA|80#45#88#10#10#2000#M$M#rs$AOn4CLB-x_|160#90#88#5#5#2000#M$M#rs$AOn4CLC';

test('the storyboard spec becomes levels; only i.ytimg.com sheets are taken', () => {
  const levels = F.parseStoryboard(SPEC);
  assert.equal(levels.length, 3);
  assert.deepEqual({ ...levels[1], base: undefined }, { level: 1, w: 80, h: 45, count: 88, cols: 10, rows: 10, ms: 2000, name: 'M$M', sigh: 'rs$AOn4CLB-x_', base: undefined });
  assert.equal(F.parseStoryboard(SPEC.replace('i.ytimg.com', 'evil.example')), null);
  assert.equal(F.parseStoryboard(SPEC.replace('https:', 'http:')), null);
  assert.equal(F.parseStoryboard(null), null);
  assert.equal(F.parseStoryboard('https://i.ytimg.com/x|garbage'), null);
  assert.equal(F.pickLevel(levels, 40).h, 45, 'the smallest frames at least 40 px tall');
  assert.equal(F.pickLevel(levels, 200).h, 90, 'else the largest');
});

test('a frame’s tile: its sheet, column and row, with the sheet URL on i.ytimg.com', () => {
  const lv = F.parseStoryboard(SPEC)[1];
  const f = F.frameAt(lv, 61, 174);
  // 61 s at 2 s a frame is frame 30: sheet 0, column 0, row 3.
  assert.equal(f.url, 'https://i.ytimg.com/sb/Xq3aPn3x_-A/storyboard3_L1/M0.jpg?sqp=-oaymwENSDfyq4qpAwVwAcABBqLzl_8DBgjd&sigh=rs$AOn4CLB-x_');
  assert.deepEqual([f.col, f.row, f.cols, f.rows, f.w, f.h], [0, 3, 10, 10, 80, 45]);
  const big = F.parseStoryboard(SPEC)[2];
  const g = F.frameAt(big, 61, 174);
  // frame 30 of 25 a sheet: sheet 1, the 6th tile, column 0, row 1.
  assert.match(g.url, /storyboard3_L2\/M1\.jpg/);
  assert.deepEqual([g.col, g.row], [0, 1]);
  assert.equal(F.frameAt(lv, 9999, 174).url.includes('/M0.jpg'), true, 'past the last frame, the last frame');
  assert.equal(F.frameAt(null, 3, 174), null);
});
