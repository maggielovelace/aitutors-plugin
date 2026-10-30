// lib/pos.js — where a saved piece sat on its page (PRD-v0.96.0 D54; the
// Round 5 contract's `pos`).
//
// The site draws a web Jotter's left page in the page's own order, so every
// heddy:save item carries pos = { block, offset }:
//
//   block   the index of the item's nearest text block, among the page's text
//           blocks in reading order. A text block is a p, li, h1–h6,
//           blockquote, pre, td, figcaption or dd that holds non-whitespace
//           text and is not inside nav, header, footer, aside, script or style.
//   offset  for words, the character offset of the quote's start inside that
//           block's textContent. For a picture, 0.
//
// A picture's block is the last text block (in reading order) that starts
// above the box's top edge, or 0 when none does.
//
// Blocks nest (an li holding a p, a blockquote holding a p): each one counts,
// in the order its start tag comes, and words belong to the innermost one.
// Words that start outside every text block (loose text in a div, or inside a
// nav) take the first text block after them, at offset 0.
//
// Pure: it works on any DOM-like tree (nodeType, nodeName, childNodes,
// nodeValue, textContent), so the tests drive it without a browser.
(function (root) {
  var BLOCK = { P: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, BLOCKQUOTE: 1, PRE: 1, TD: 1, FIGCAPTION: 1, DD: 1 };
  var OUTSIDE = { NAV: 1, HEADER: 1, FOOTER: 1, ASIDE: 1, SCRIPT: 1, STYLE: 1 };

  function name(n) {
    return String(n.nodeName || '').toUpperCase();
  }

  function kids(n) {
    return n.childNodes || [];
  }

  function isText(n) {
    // Text and CDATA: what textContent is made of.
    return n.nodeType === 3 || n.nodeType === 4;
  }

  function hasWords(el) {
    return /\S/.test(String(el.textContent || ''));
  }

  /** Every text block under `rootEl`, in reading order. */
  function textBlocks(rootEl) {
    var out = [];
    (function walk(n) {
      var list = kids(n);
      for (var i = 0; i < list.length; i++) {
        var k = list[i];
        if (k.nodeType !== 1 || OUTSIDE[name(k)]) continue;
        if (BLOCK[name(k)] && hasWords(k)) out.push(k);
        walk(k);
      }
    })(rootEl);
    return out;
  }

  /**
   * pos of a point in the page (a Range's start: a node and an offset in it,
   * a character offset for a text node, a child index for an element).
   * `lead` moves the offset on past white space the quote begins with.
   * Returns { block, offset }; a page with no text block at all gives 0, 0.
   */
  function textPos(rootEl, node, offset, lead) {
    var blocks = [];
    var open = []; // text blocks around the walk, innermost last: { el, index, chars }
    var found = null; // { stack: [...], blocksBefore }
    var after = null; // the first block that starts after the point

    function at() {
      if (found) return;
      found = { stack: open.map(function (o) { return { index: o.index, chars: o.chars }; }), seen: blocks.length };
    }

    function count(n) {
      var len = String(n.nodeValue || '').length;
      for (var i = 0; i < open.length; i++) open[i].chars += len;
    }

    (function walk(n, outside) {
      var list = kids(n);
      for (var i = 0; i <= list.length; i++) {
        // An element point sits before its child number `offset`.
        if (n === node && !isText(n) && i === offset) at();
        if (i === list.length) break;
        var k = list[i];
        if (isText(k)) {
          if (k === node) {
            var o = Math.max(0, Math.min(offset, String(k.nodeValue || '').length));
            for (var j = 0; j < open.length; j++) open[j].chars += o;
            at();
            for (var m = 0; m < open.length; m++) open[m].chars += String(k.nodeValue || '').length - o;
          } else {
            count(k);
          }
          continue;
        }
        if (k.nodeType !== 1) continue;
        var out = outside || !!OUTSIDE[name(k)];
        var isBlock = !out && BLOCK[name(k)] && hasWords(k);
        if (isBlock) {
          if (found && after === null) after = blocks.length;
          open.push({ el: k, index: blocks.length, chars: 0 });
          blocks.push(k);
        }
        walk(k, out);
        if (isBlock) open.pop();
      }
    })(rootEl, false);

    if (!blocks.length) return { block: 0, offset: 0 };
    if (found && found.stack.length) {
      var inner = found.stack[found.stack.length - 1];
      var len = String(blocks[inner.index].textContent || '').length;
      return { block: inner.index, offset: Math.min(inner.chars + Math.max(0, lead || 0), len) };
    }
    if (found && after !== null) return { block: after, offset: 0 };
    // Past the last block, or the point was never met: the last block.
    return { block: found ? blocks.length - 1 : 0, offset: 0 };
  }

  /** A picture's block: the last one (in reading order) whose top is above
   *  the box's top edge. `tops` are the blocks' tops, in page coordinates,
   *  in reading order. */
  function imageBlock(tops, boxTop) {
    var best = 0;
    for (var i = 0; i < tops.length; i++) if (tops[i] < boxTop) best = i;
    return best;
  }

  /** The words after a picture: the first block (in reading order) whose top
   *  is at or below the box's bottom edge, or ''. */
  function imageAfterIndex(tops, boxBottom) {
    for (var i = 0; i < tops.length; i++) if (tops[i] >= boxBottom) return i;
    return -1;
  }

  // ─── the words around a quote (before / after) ─────────────────────────────
  //
  // Range.toString() and textContent run neighbouring elements together:
  // a nav of links read as "HomeSystems Our storyThe teamBlog" (owner's real
  // test, 2026-10-30). wordsBefore / wordsAfter read the words either side
  // of a quote with a space wherever an element starts or ends that the reader sees as apart
  // (a block, a list item, a link laid out as a box), and nowhere else, so a
  // word split by inline markup (im<b>port</b>ant) stays one word. Nav,
  // header, footer and aside are left out, as textBlocks leaves them out,
  // unless the quote itself is inside one.

  var NEVER = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  var APART = {
    P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, DL: 1, DT: 1, DD: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    SECTION: 1, ARTICLE: 1, MAIN: 1, NAV: 1, HEADER: 1, FOOTER: 1, ASIDE: 1, TABLE: 1, THEAD: 1,
    TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1, BLOCKQUOTE: 1, PRE: 1, FIGURE: 1,
    FIGCAPTION: 1, FORM: 1, FIELDSET: 1, BR: 1, HR: 1, IMG: 1, BUTTON: 1, OPTION: 1, ADDRESS: 1,
    DETAILS: 1, SUMMARY: 1,
  };

  /** By tag alone: 'skip' (never read), 'break' (a space either side), or
   *  '' (inline: no space). */
  function tagKind(el) {
    var n = name(el);
    if (NEVER[n] || OUTSIDE[n]) return 'skip';
    return APART[n] ? 'break' : '';
  }

  /** In the page: tagKind, plus what the page's CSS says. Hidden is skipped;
   *  anything not laid out inline (a link as a block, a flex item, an
   *  inline-block) is apart; an inline element with space beside it
   *  (margin or padding left or right) is apart too. getStyle(el) →
   *  {display, marginLeft, marginRight, paddingLeft, paddingRight} or null. */
  function styleKind(getStyle) {
    return function (el) {
      var k = tagKind(el);
      if (k === 'skip') return k;
      var st = null;
      try { st = getStyle(el); } catch (e) { st = null; }
      if (!st) return k;
      var d = String(st.display || '');
      if (d === 'none') return 'skip';
      if (k === 'break') return k;
      if (d && d !== 'inline' && d !== 'contents') return 'break';
      var room = [st.marginLeft, st.marginRight, st.paddingLeft, st.paddingRight].some(function (v) { return parseFloat(v) > 0; });
      return room ? 'break' : '';
    };
  }

  // The walk goes OUTWARD from the quote and stops once it has `max`
  // characters, or after MAX_VISITS nodes, so it never grows with the page:
  // auto-add (D65) runs it on every selection, and kind() may ask the page
  // for an element's style. kind() is asked once per element it reaches.
  var MAX_VISITS = 2000;

  function ancestorsOf(node) {
    var out = [];
    for (var n = node; n; n = n.parentNode) out.push(n);
    return out;
  }

  function childAt(n, i) {
    var list = kids(n);
    return i >= 0 && i < list.length ? list[i] : null;
  }

  // The page's own sibling links; by index for a DOM-like tree without them.
  function sibling(n, step) {
    var own = step > 0 ? n.nextSibling : n.previousSibling;
    if (own !== undefined) return own;
    var p = n.parentNode;
    if (!p) return null;
    var list = kids(p);
    for (var i = 0; i < list.length; i++) if (list[i] === n) return childAt(p, i + step);
    return null;
  }

  /**
   * One walk from a point, forwards (dir 1, the words after it) or
   * backwards (dir -1, the words before it), inside rootEl. point: {node,
   * offset} as a Range boundary, or null for rootEl's start (forwards) or
   * end (backwards). A space wherever an element stands apart, white space
   * folded; at most `max` characters, the ones nearest the point.
   * stats, if given, counts {visits, kinds}.
   */
  function wordsFrom(rootEl, point, dir, max, kind, stats) {
    var classify = kind || tagKind;
    var holds = point ? ancestorsOf(point.node) : [];
    var parts = [];
    var have = 0;
    var visits = 0;
    var seen = typeof Map === 'function' ? new Map() : null;
    var st = stats || {};
    st.visits = 0;
    st.kinds = 0;

    function kindOf(el) {
      if (seen && seen.has(el)) return seen.get(el);
      st.kinds += 1;
      var c = classify(el);
      if (c === 'skip' && holds.indexOf(el) >= 0) c = '';
      if (seen) seen.set(el, c);
      return c;
    }

    function add(t) {
      if (!t) return;
      parts.push(t);
      have += t.replace(/\s+/g, ' ').length;
    }

    // The cursor: a node, and whether the walk is entering it or has left it.
    var n, entering;
    if (!point) {
      n = rootEl;
      entering = false;
      var first = childAt(rootEl, dir > 0 ? 0 : kids(rootEl).length - 1);
      if (first) { n = first; entering = true; }
    } else if (isText(point.node)) {
      var v = String(point.node.nodeValue || '');
      add(dir > 0 ? v.slice(point.offset) : v.slice(0, point.offset));
      n = point.node;
      entering = false;
    } else {
      var next = childAt(point.node, dir > 0 ? point.offset : point.offset - 1);
      if (next) { n = next; entering = true; } else { n = point.node; entering = false; }
    }

    while (n && have < max && visits < MAX_VISITS) {
      visits += 1;
      if (entering) {
        if (isText(n)) {
          add(String(n.nodeValue || ''));
          entering = false;
          continue;
        }
        if (n.nodeType === 1) {
          var c = kindOf(n);
          if (c === 'skip') { entering = false; continue; }
          if (c === 'break') add(' ');
          var inner = childAt(n, dir > 0 ? 0 : kids(n).length - 1);
          if (inner) { n = inner; continue; }
        }
        entering = false;
        continue;
      }
      // Leaving n.
      if (n.nodeType === 1 && n !== rootEl && kindOf(n) === 'break') add(' ');
      if (n === rootEl) break;
      var sib = sibling(n, dir);
      if (sib) { n = sib; entering = true; } else { n = n.parentNode; entering = false; }
    }
    st.visits = visits;

    var text = (dir > 0 ? parts : parts.reverse()).join('').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return dir > 0 ? text.slice(0, max).trim() : text.slice(text.length - max).trim();
  }

  /** The words after a point (a quote's end), at most `max` characters. */
  function wordsAfter(rootEl, point, max, kind, stats) {
    return wordsFrom(rootEl, point, 1, max, kind, stats);
  }

  /** The words before a point (a quote's start), at most `max` characters. */
  function wordsBefore(rootEl, point, max, kind, stats) {
    return wordsFrom(rootEl, point, -1, max, kind, stats);
  }

  /** An element's first `max` characters of words. */
  function wordsOf(el, kind, max) {
    return el ? wordsFrom(el, null, 1, max || 300, kind) : '';
  }

  /** An element's last `max` characters of words (its last sentence lives
   *  there). */
  function lastWordsOf(el, kind, max) {
    return el ? wordsFrom(el, null, -1, max || 300, kind) : '';
  }

  /** pos is two whole numbers ≥ 0. */
  function isPos(p) {
    return !!p && typeof p === 'object' &&
      typeof p.block === 'number' && Number.isInteger(p.block) && p.block >= 0 &&
      typeof p.offset === 'number' && Number.isInteger(p.offset) && p.offset >= 0;
  }

  var api = { BLOCK: BLOCK, OUTSIDE: OUTSIDE, tagKind: tagKind, styleKind: styleKind, MAX_VISITS: MAX_VISITS, wordsBefore: wordsBefore, wordsAfter: wordsAfter, wordsOf: wordsOf, lastWordsOf: lastWordsOf, textBlocks: textBlocks, textPos: textPos, imageBlock: imageBlock, imageAfterIndex: imageAfterIndex, isPos: isPos };
  root.HeddyPos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
