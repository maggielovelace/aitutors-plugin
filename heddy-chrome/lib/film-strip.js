// lib/film-strip.js — the popup's Add to My Clips on a YouTube video
// (PRD-v0.96.0 D75, D76; artifact round-8-youtube-desk.html #popup, P2).
// Pure: popup/popup.js draws, this decides.
//
//   chipRange       Whole · The last 30 s · From now
//   dragTo          a handle dragged to a second; the window keeps ≥ 1 s
//   captureFields   the part as heddy-ui:capture sends it: nothing for the
//                   whole video, else startSec and/or endSec (D75)
//   spanText        "52 s", "2:54"
//   linkFor         the exact link, youtube.com/watch?v={id}[&t=] (D76)
//   thumbUrl        YouTube's own still, i.ytimg.com/vi/{id}/mqdefault.jpg (D76)
//   parseStoryboard YouTube's storyboard spec, read from the player; frameAt
//                   finds a frame's tile on its sheet. Only i.ytimg.com sheets
//                   are accepted, so the strip loads nothing from anywhere else.
(function (root) {
  var LAST = 30;
  var MIN_SPAN = 1;
  var THUMB_HOST = 'i.ytimg.com';
  var YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  var CHIPS = ['whole', 'last30', 'fromNow'];

  function num(x) {
    return typeof x === 'number' && isFinite(x);
  }

  function whole(duration) {
    return { start: 0, end: Math.max(MIN_SPAN, Math.floor(duration)) };
  }

  /** A chip's part in whole seconds, or null when it cannot be had (no length
   *  known, or the player too close to an edge for that chip). */
  function chipRange(chip, now, duration) {
    if (!num(duration) || duration < MIN_SPAN) return null;
    var d = Math.floor(duration);
    var n = num(now) ? Math.min(Math.max(0, Math.floor(now)), d) : null;
    if (chip === 'whole') return whole(duration);
    if (n === null) return null;
    if (chip === 'last30') return n >= MIN_SPAN ? { start: Math.max(0, n - LAST), end: n } : null;
    if (chip === 'fromNow') return d - n >= MIN_SPAN ? { start: n, end: d } : null;
    return null;
  }

  /** The chip a part is, or null for a part dragged by hand. */
  function chipOf(range, now, duration) {
    for (var i = 0; i < CHIPS.length; i++) {
      var r = chipRange(CHIPS[i], now, duration);
      if (r && r.start === range.start && r.end === range.end) return CHIPS[i];
    }
    return null;
  }

  /** `which` ('start' | 'end') dragged to `sec`: clamped to the video, and
   *  never closer than MIN_SPAN to the other handle. */
  function dragTo(range, which, sec, duration) {
    var d = Math.floor(duration);
    var s = Math.round(Math.min(Math.max(0, sec), d));
    if (which === 'start') return { start: Math.min(s, range.end - MIN_SPAN), end: range.end };
    return { start: range.start, end: Math.max(s, range.start + MIN_SPAN) };
  }

  /** The second under a point on the strip. */
  function secAt(x, width, duration) {
    if (!(width > 0)) return 0;
    return Math.min(Math.max(0, x / width), 1) * Math.floor(duration);
  }

  /** {left, width} of the window in percent of the strip. */
  function windowPct(range, duration) {
    var d = Math.max(MIN_SPAN, Math.floor(duration));
    return { left: (range.start / d) * 100, width: ((range.end - range.start) / d) * 100 };
  }

  /** What heddy-ui:capture carries for the part: {} for the whole video;
   *  a start from 0 is no start, an end at the video's end is no end. */
  function captureFields(range, duration) {
    var d = Math.floor(duration);
    var out = {};
    if (range.start >= 1) out.startSec = range.start;
    if (range.end < d) out.endSec = range.end;
    return out;
  }

  function clock(t) {
    var s = Math.max(0, Math.floor(t));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var ss = String(s % 60).padStart(2, '0');
    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
  }

  /** "52 s" under a minute (as the artifact prints it), else m:ss. `secWord`
   *  is the language's "$N$ s". */
  function spanText(span, secWord) {
    var s = Math.max(0, Math.round(span));
    return s < 60 ? secWord(String(s)) : clock(s);
  }

  /** The exact link the popup prints and copies: no scheme in `shown`. */
  function linkFor(youtubeId, startSec) {
    var path = 'youtube.com/watch?v=' + youtubeId + (startSec >= 1 ? '&t=' + Math.floor(startSec) : '');
    return { shown: path, href: 'https://www.' + path };
  }

  /** YouTube's own still for a video id, or null for anything else. */
  function thumbUrl(youtubeId) {
    return YOUTUBE_ID.test(String(youtubeId || '')) ? 'https://' + THUMB_HOST + '/vi/' + youtubeId + '/mqdefault.jpg' : null;
  }

  function isSheetUrl(href) {
    var u;
    try { u = new URL(href); } catch (e) { return false; }
    return u.protocol === 'https:' && u.hostname === THUMB_HOST;
  }

  /**
   * YouTube's storyboard spec ("base|w#h#count#cols#rows#ms#name#sigh|…", the
   * player response's playerStoryboardSpecRenderer.spec) as levels, or null.
   * Level L's sheet n is base with $L → L, $N → name ($M → n), plus &sigh=.
   */
  function parseStoryboard(spec) {
    if (typeof spec !== 'string' || spec.length > 4000) return null;
    var parts = spec.split('|');
    var base = parts[0];
    if (!isSheetUrl(base.replace('$L', '0').replace('$N', 'M0'))) return null;
    var levels = [];
    for (var i = 1; i < parts.length; i++) {
      var f = parts[i].split('#');
      if (f.length < 8) continue;
      var lv = { level: i - 1, w: +f[0], h: +f[1], count: +f[2], cols: +f[3], rows: +f[4], ms: +f[5], name: f[6], sigh: f[7] };
      if (!(lv.w > 0 && lv.h > 0 && lv.count > 0 && lv.cols > 0 && lv.rows > 0) || !/^[\w$-]{1,40}$/.test(lv.name) || !/^[\w$%=.-]{0,200}$/.test(lv.sigh)) continue;
      lv.base = base;
      levels.push(lv);
    }
    return levels.length ? levels : null;
  }

  /** The smallest level whose frames are at least `minH` tall (else the largest). */
  function pickLevel(levels, minH) {
    if (!levels || !levels.length) return null;
    var ok = levels.filter(function (l) { return l.h >= minH; }).sort(function (a, b) { return a.h - b.h; });
    return ok[0] || levels.slice().sort(function (a, b) { return b.h - a.h; })[0];
  }

  /** The tile of the frame at `t`: {url, col, row, cols, rows, w, h}, or null. */
  function frameAt(level, t, duration) {
    if (!level || !num(t)) return null;
    var idx = level.ms > 0 ? Math.floor((t * 1000) / level.ms) : Math.floor((t / Math.max(1, duration)) * level.count);
    idx = Math.min(Math.max(0, idx), level.count - 1);
    var per = level.cols * level.rows;
    var sheet = Math.floor(idx / per);
    var at = idx % per;
    var url = level.base.replace('$L', String(level.level)).replace('$N', level.name.replace('$M', String(sheet)));
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'sigh=' + level.sigh;
    if (!isSheetUrl(url)) return null;
    return { url: url, col: at % level.cols, row: Math.floor(at / level.cols), cols: level.cols, rows: level.rows, w: level.w, h: level.h };
  }

  var api = {
    LAST: LAST,
    MIN_SPAN: MIN_SPAN,
    CHIPS: CHIPS,
    chipRange: chipRange,
    chipOf: chipOf,
    dragTo: dragTo,
    secAt: secAt,
    windowPct: windowPct,
    captureFields: captureFields,
    clock: clock,
    spanText: spanText,
    linkFor: linkFor,
    thumbUrl: thumbUrl,
    isSheetUrl: isSheetUrl,
    parseStoryboard: parseStoryboard,
    pickLevel: pickLevel,
    frameAt: frameAt,
  };
  root.HeddyFilmStrip = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
