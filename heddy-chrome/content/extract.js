// content/extract.js — Clip this page: the readable part of a page as Markdown
// (PRD-v0.96.0 D5, D20, D21; Must 6).
//
// Runs only when the child asks (the popup's Clip this page, or Clip the whole
// page in the tray's › menu), in the tab activeTab opened to Heddy. Nothing is
// downloaded: images become links ([Image: alt](url)), and the window on
// aitutors.me does the saving. Scripts, styles, forms, navigation, sidebars,
// footers and hidden elements are left out.
//
// Why a small extractor of our own and not Mozilla Readability (Apache-2.0,
// ~2,700 lines) or Defuddle (MIT, a bundled build): Heddy is a public repo
// whose review rests on being small enough to read, and the site only needs
// the article's words in order, as Markdown, under 200 KB. One readable file
// with tests does that; the scoring below is Readability's core idea (the
// element whose paragraphs hold the most text is the article) without its
// site-specific rules. If real pages show it is not enough, vendoring
// Defuddle as one file with its licence header is the next step.
//
// It works on any DOM-like tree (nodeType, nodeName, childNodes, getAttribute,
// textContent), so the tests drive it without a browser.
(function (root) {
  // Never part of an article.
  var SKIP = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, CANVAS: 1,
    FORM: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, NAV: 1, ASIDE: 1, FOOTER: 1, DIALOG: 1,
    LINK: 1, META: 1, HEAD: 1, AUDIO: 1, VIDEO: 1, MAP: 1, 'HEDDY-TRAY': 1, 'HEDDY-TOAST': 1,
  };
  var SKIP_ROLES = { navigation: 1, banner: 1, complementary: 1, contentinfo: 1, dialog: 1, alertdialog: 1, search: 1, menu: 1, menubar: 1 };
  var BLOCK = {
    ADDRESS: 1, ARTICLE: 1, BLOCKQUOTE: 1, DD: 1, DETAILS: 1, DIV: 1, DL: 1, DT: 1, FIGCAPTION: 1, FIGURE: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HEADER: 1, HR: 1, LI: 1, MAIN: 1, OL: 1, P: 1, PRE: 1,
    SECTION: 1, SUMMARY: 1, TABLE: 1, UL: 1, BODY: 1, HTML: 1,
  };

  function name(n) {
    return String(n.nodeName || '').toUpperCase();
  }

  function attr(n, a) {
    return typeof n.getAttribute === 'function' ? n.getAttribute(a) : null;
  }

  function kids(n) {
    return Array.prototype.slice.call(n.childNodes || []);
  }

  function skipped(n, isHidden) {
    if (n.nodeType !== 1) return false;
    if (SKIP[name(n)]) return true;
    if (attr(n, 'hidden') !== null || attr(n, 'aria-hidden') === 'true') return true;
    if (SKIP_ROLES[String(attr(n, 'role') || '').toLowerCase()]) return true;
    return !!(isHidden && isHidden(n));
  }

  function ws(s) {
    return String(s).replace(/[\s ]+/g, ' ');
  }

  /** An absolute http(s) or mailto address, or null (javascript:, data: and
   *  the like are dropped, keeping only the words). */
  function absolute(href, base) {
    if (!href) return null;
    try {
      var u = new URL(href, base);
      return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  // ─── finding the article ───────────────────────────────────────────────────

  function textLength(n, isHidden) {
    if (n.nodeType === 3) return ws(n.nodeValue || '').trim().length;
    if (n.nodeType !== 1 || skipped(n, isHidden)) return 0;
    return kids(n).reduce(function (sum, k) { return sum + textLength(k, isHidden); }, 0);
  }

  function each(n, fn, isHidden) {
    kids(n).forEach(function (k) {
      if (k.nodeType !== 1 || skipped(k, isHidden)) return;
      fn(k);
      each(k, fn, isHidden);
    });
  }

  /** The element that holds the article: the one <article>, else <main>, else
   *  the element whose paragraphs carry the most text (each paragraph scores
   *  its parent fully and its grandparent by half). Falls back to the body. */
  function pickRoot(doc, isHidden) {
    var body = doc.body || doc.documentElement || doc;
    var articles = [];
    var mains = [];
    var scores = [];
    function score(el, s) {
      for (var i = 0; i < scores.length; i++) if (scores[i].el === el) { scores[i].s += s; return; }
      scores.push({ el: el, s: s });
    }
    each(body, function (el) {
      var nm = name(el);
      if (nm === 'ARTICLE') articles.push(el);
      if (nm === 'MAIN' || attr(el, 'role') === 'main') mains.push(el);
      if (nm === 'P' || nm === 'PRE' || nm === 'BLOCKQUOTE') {
        var len = textLength(el, isHidden);
        if (len < 25) return;
        if (el.parentNode) score(el.parentNode, len);
        if (el.parentNode && el.parentNode.parentNode) score(el.parentNode.parentNode, len / 2);
      }
    }, isHidden);
    if (articles.length === 1 && textLength(articles[0], isHidden) >= 200) return articles[0];
    if (mains.length === 1 && textLength(mains[0], isHidden) >= 200) return mains[0];
    var best = null;
    scores.forEach(function (x) { if (!best || x.s > best.s) best = x; });
    return best ? best.el : body;
  }

  // ─── Markdown ──────────────────────────────────────────────────────────────

  function inline(n, ctx) {
    if (n.nodeType === 3) return ws(n.nodeValue || '');
    if (n.nodeType !== 1 || skipped(n, ctx.isHidden)) return '';
    var nm = name(n);
    var inner = function () { return kids(n).map(function (k) { return inline(k, ctx); }).join(''); };
    switch (nm) {
      case 'BR':
        return '\n';
      case 'IMG': {
        var src = absolute(attr(n, 'src'), ctx.base);
        if (!src || src.indexOf('mailto:') === 0) return '';
        var alt = ws(attr(n, 'alt') || '').trim().replace(/[[\]]/g, '');
        ctx.images += 1;
        return '[' + (alt ? ctx.imageLabel + ': ' + alt : ctx.imageLabel) + '](' + src + ')';
      }
      case 'A': {
        var text = inner().trim();
        var href = absolute(attr(n, 'href'), ctx.base);
        if (!text) return '';
        return href && href !== text ? '[' + text.replace(/[[\]]/g, '') + '](' + href + ')' : text;
      }
      case 'STRONG': case 'B': {
        var b = inner().trim();
        return b ? '**' + b + '**' : '';
      }
      case 'EM': case 'I': {
        var i = inner().trim();
        return i ? '*' + i + '*' : '';
      }
      case 'CODE': case 'KBD': case 'SAMP': {
        var c = (n.textContent || '').replace(/`/g, "'");
        return c ? '`' + c + '`' : '';
      }
      default:
        return inner();
    }
  }

  function clean(s) {
    return s.split('\n').map(function (l) { return l.replace(/ +/g, ' ').trim(); }).join('\n').replace(/\n{2,}/g, '\n').trim();
  }

  function table(n, ctx) {
    var rows = [];
    each(n, function (el) { if (name(el) === 'TR') rows.push(el); }, ctx.isHidden);
    var lines = rows.map(function (tr) {
      var cells = kids(tr).filter(function (c) { return name(c) === 'TD' || name(c) === 'TH'; });
      return '| ' + cells.map(function (c) { return clean(inline(c, ctx)).replace(/\n/g, ' ').replace(/\|/g, '\\|'); }).join(' | ') + ' |';
    }).filter(function (l) { return l !== '|  |'; });
    if (!lines.length) return '';
    var cols = (lines[0].match(/ \| /g) || []).length + 1;
    var sep = '|' + new Array(cols + 1).join(' --- |');
    return [lines[0], sep].concat(lines.slice(1)).join('\n');
  }

  /** Append the Markdown blocks of `n`'s children to `out`. */
  function blocks(n, ctx, out, depth) {
    var run = '';
    function flush() {
      var t = clean(run);
      if (t) out.push(t);
      run = '';
    }
    kids(n).forEach(function (k) {
      if (k.nodeType === 3) { run += inline(k, ctx); return; }
      if (k.nodeType !== 1 || skipped(k, ctx.isHidden)) return;
      var nm = name(k);
      if (!BLOCK[nm]) { run += inline(k, ctx); return; }
      flush();
      if (/^H[1-6]$/.test(nm)) {
        var h = clean(inline(k, ctx)).replace(/\n/g, ' ');
        if (h) out.push(new Array(Number(nm[1]) + 1).join('#') + ' ' + h);
      } else if (nm === 'P' || nm === 'DT' || nm === 'DD' || nm === 'FIGCAPTION' || nm === 'SUMMARY' || nm === 'ADDRESS') {
        var p = clean(inline(k, ctx));
        if (p) out.push(p);
      } else if (nm === 'HR') {
        out.push('---');
      } else if (nm === 'PRE') {
        var code = String(k.textContent || '').replace(/\s+$/, '').replace(/```/g, "'''");
        if (code.trim()) out.push('```\n' + code + '\n```');
      } else if (nm === 'BLOCKQUOTE') {
        var q = [];
        blocks(k, ctx, q, depth);
        if (q.length) out.push(q.join('\n\n').split('\n').map(function (l) { return l ? '> ' + l : '>'; }).join('\n'));
      } else if (nm === 'UL' || nm === 'OL') {
        var items = [];
        var n2 = 0;
        kids(k).forEach(function (li) {
          if (li.nodeType !== 1 || name(li) !== 'LI' || skipped(li, ctx.isHidden)) return;
          n2 += 1;
          var parts = [];
          blocks(li, ctx, parts, depth + 1);
          if (!parts.length) return;
          var mark = nm === 'OL' ? n2 + '. ' : '- ';
          var pad = new Array(mark.length + 1).join(' ');
          items.push(mark + parts.join('\n').split('\n').map(function (l, i) { return i === 0 ? l : pad + l; }).join('\n'));
        });
        if (items.length) out.push(items.join('\n'));
      } else if (nm === 'TABLE') {
        var t = table(k, ctx);
        if (t) out.push(t);
      } else {
        blocks(k, ctx, out, depth);
      }
    });
    flush();
  }

  /** The Markdown of an element. `imageLabel` is the word before an image's
   *  alt text ("Image"). Returns { markdown, images }. */
  function toMarkdown(el, opts) {
    var o = opts || {};
    var ctx = { base: o.base || 'about:blank', isHidden: o.isHidden || null, images: 0, imageLabel: o.imageLabel || 'Image' };
    var out = [];
    blocks(el, ctx, out, 0);
    return { markdown: out.join('\n\n'), images: ctx.images };
  }

  /** The page in this tab: { url, title, markdown, images }. */
  function extractPage(doc, opts) {
    var o = opts || {};
    var isHidden = o.isHidden || null;
    var el = pickRoot(doc, isHidden);
    var md = toMarkdown(el, { base: o.base, isHidden: isHidden, imageLabel: o.imageLabel });
    return { url: o.base || '', title: ws(doc.title || '').trim(), markdown: md.markdown, images: md.images };
  }

  var api = { pickRoot: pickRoot, toMarkdown: toMarkdown, extractPage: extractPage, absolute: absolute };
  root.HeddyExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
