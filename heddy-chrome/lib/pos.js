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

  /** pos is two whole numbers ≥ 0. */
  function isPos(p) {
    return !!p && typeof p === 'object' &&
      typeof p.block === 'number' && Number.isInteger(p.block) && p.block >= 0 &&
      typeof p.offset === 'number' && Number.isInteger(p.offset) && p.offset >= 0;
  }

  var api = { BLOCK: BLOCK, OUTSIDE: OUTSIDE, textBlocks: textBlocks, textPos: textPos, imageBlock: imageBlock, imageAfterIndex: imageAfterIndex, isPos: isPos };
  root.HeddyPos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
