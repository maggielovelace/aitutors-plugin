// lib/cards.js — the numbered cards in Heddy's panel, and Save to Jotters
// (PRD-v0.96.0 D54, D55, D58; artifact R4 · B without drag, R5 · Chrome,
// R5b · C).
//
// Collecting (D55): each snippet and picture the child keeps from a page is a
// card in one numbered list, up to 10 snippets and 4 pictures, all from the
// same page. The panel draws the list (popup/popup.js), the page draws the
// same numbers beside each highlight and box (content/cards-layer.js), and
// box mode's + Picture adds to it (content/box-mode.js). Going to another
// page clears it. There is no reordering: the site draws saves in page order.
//
// Saving (D54): Save to Jotters sends every card, and optionally the whole
// page, in one heddy:save to /capture/save, where the child's own session
// saves them to the left page of that page's Jotter:
//
//   Heddy → page  {v:1, cid, type:'heddy:save', url, title, then:'save'|'jot', items}
//     items: {kind:'text', quote, before, after, pos}       quote ≤ 4000, before/after ≤ 300
//            {kind:'image', png, box, before, after, pos}   png and WebBox as heddy:box's
//            {kind:'page', markdown, cut?: true}            as heddy:page's
//     at most 10 text, 4 image and 1 page item; pos as lib/pos.js defines it.
//
// then:'jot' (Save and jot now) opens /capture/save in a tab, which the site
// turns into the notebook at the new save; then:'save' opens the usual
// window, which the site closes. Every card's text is page text, untrusted:
// it is cut and stripped here, and the site checks it again.
//
// The list lives in the background, in chrome.storage.session under
// heddyCards:<tabId>, so it outlives the panel, box mode, and a restart of
// the service worker (four 1 MB pictures as base64 fit its 10 MB).
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var T = root.HeddyTools || (typeof require === 'function' && require('./tools.js'));
  var POS = root.HeddyPos || (typeof require === 'function' && require('./pos.js'));

  var MAX_TEXT = 10;
  var MAX_IMAGES = 4;
  var MAX_QUOTE = 4000;
  var SIDE = 300;
  var MAX_TITLE = 300;
  var THEN = ['save', 'jot'];
  var KEY_PREFIX = 'heddyCards:';
  var CARD_ID = /^[a-z0-9-]{8,64}$/;

  // ─── pure rules ────────────────────────────────────────────────────────────

  function counts(cards) {
    var c = { text: 0, image: 0 };
    (cards || []).forEach(function (x) { if (x && c[x.kind] !== undefined) c[x.kind] += 1; });
    return c;
  }

  /** May one more card of this kind be added? */
  function room(cards, kind) {
    var c = counts(cards);
    if (kind === 'text') return c.text < MAX_TEXT;
    if (kind === 'image') return c.image < MAX_IMAGES;
    return false;
  }

  /** A card's number is its place in the list, from 1. */
  function numberOf(cards, id) {
    for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return i + 1;
    return 0;
  }

  /** The number of a text card with the same words in the same place, or 0. */
  function sameText(cards, card) {
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.kind === 'text' && c.quote === card.quote && c.pos.block === card.pos.block && c.pos.offset === card.pos.offset) return i + 1;
    }
    return 0;
  }

  /** The quote as heddy:save sends it: its line breaks kept (they are the
   *  page's), other control characters out, at most 4000 characters. */
  function cleanQuote(x) {
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, MAX_QUOTE);
  }

  function side(x) {
    return T.cleanText(x, SIDE);
  }

  function cleanPos(p) {
    return POS.isPos(p) ? { block: p.block, offset: p.offset } : null;
  }

  /** A text card from what the page read, or null. before/after are cut at
   *  the side away from the quote (the words next to it are kept). */
  function textCard(id, input) {
    if (!CARD_ID.test(String(id)) || !input) return null;
    var quote = cleanQuote(input.quote);
    var pos = cleanPos(input.pos);
    if (!quote || !pos) return null;
    var c = P.contextOf(input.before, input.after);
    return { id: id, kind: 'text', quote: quote, before: c.before, after: c.after, pos: pos };
  }

  function cleanRect(r) {
    var ok = r && [r.x, r.y, r.w, r.h].every(function (n) { return typeof n === 'number' && isFinite(n); }) && r.w > 0 && r.h > 0;
    return ok ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
  }

  /** A picture card: the crop ({png, box}), where it sits on the page (its
   *  page-coordinate rect, for the green outline), and its pos. */
  function imageCard(id, img, input) {
    if (!CARD_ID.test(String(id)) || !img || !T.isPng(img.png) || !T.isWebBox(img.box) || !input) return null;
    var pos = cleanPos(input.pos);
    var rect = cleanRect(input.page);
    if (!pos || !rect) return null;
    var b = img.box;
    return {
      id: id, kind: 'image', png: img.png,
      box: { kind: 'web', vw: b.vw, vh: b.vh, x: b.x, y: b.y, w: b.w, h: b.h },
      before: side(input.before), after: side(input.after), pos: pos, rect: rect,
    };
  }

  /** What the page draws: the number of every card, and a picture's rect. */
  function marks(cards) {
    return cards.map(function (c, i) {
      var m = { id: c.id, n: i + 1, kind: c.kind };
      if (c.kind === 'image') m.rect = c.rect;
      return m;
    });
  }

  /** What the panel draws: the number, two lines of the quote or the picture. */
  function forPanel(cards) {
    return cards.map(function (c, i) {
      return c.kind === 'text' ? { id: c.id, n: i + 1, kind: 'text', quote: c.quote } : { id: c.id, n: i + 1, kind: 'image', png: c.png };
    });
  }

  /** One card as a heddy:save item, in exactly the contract's shape. */
  function itemOf(c) {
    if (c.kind === 'text') return { kind: 'text', quote: c.quote, before: c.before, after: c.after, pos: { block: c.pos.block, offset: c.pos.offset } };
    return { kind: 'image', png: c.png, box: c.box, before: c.before, after: c.after, pos: { block: c.pos.block, offset: c.pos.offset } };
  }

  /** Check one item again as the builder sends it; throws on anything the
   *  site would refuse. */
  function cleanItem(it) {
    if (!it || typeof it !== 'object') throw new Error('bad item');
    if (it.kind === 'text') {
      var quote = cleanQuote(it.quote);
      if (!quote) throw new Error('no quote');
      var pt = cleanPos(it.pos);
      if (!pt) throw new Error('bad pos');
      var c = P.contextOf(it.before, it.after);
      return { kind: 'text', quote: quote, before: c.before, after: c.after, pos: pt };
    }
    if (it.kind === 'image') {
      if (!T.isPng(it.png) || !T.isWebBox(it.box)) throw new Error('bad image');
      var pi = cleanPos(it.pos);
      if (!pi) throw new Error('bad pos');
      var b = it.box;
      return { kind: 'image', png: it.png, box: { kind: 'web', vw: b.vw, vh: b.vh, x: b.x, y: b.y, w: b.w, h: b.h }, before: side(it.before), after: side(it.after), pos: pi };
    }
    if (it.kind === 'page') {
      var markdown = typeof it.markdown === 'string' ? it.markdown : '';
      if (!markdown.trim()) throw new Error('empty');
      var cut = P.cutMarkdown(markdown, P.MAX_PAGE_BYTES);
      var out = { kind: 'page', markdown: cut.markdown };
      if (cut.cut || it.cut === true) out.cut = true;
      return out;
    }
    throw new Error('bad kind');
  }

  /** heddy:save, or throws on anything the site's parser would refuse. */
  function buildSave(input) {
    if (!P.isCaptureId(input.cid)) throw new Error('bad cid');
    var url = T.cleanUrl(input.url);
    if (!url) throw new Error('bad url');
    if (THEN.indexOf(input.then) < 0) throw new Error('bad then');
    if (!Array.isArray(input.items) || !input.items.length) throw new Error('empty');
    var items = input.items.map(cleanItem);
    var n = { text: 0, image: 0, page: 0 };
    items.forEach(function (it) { n[it.kind] += 1; });
    if (n.text > MAX_TEXT || n.image > MAX_IMAGES || n.page > 1) throw new Error('too many');
    return { v: P.PROTOCOL_VERSION, cid: input.cid, type: 'heddy:save', url: url, title: T.cleanText(input.title, MAX_TITLE), then: input.then, items: items };
  }

  // ─── the background's side ─────────────────────────────────────────────────

  /** Runs in the page: keep the selection as card `id` (content/cards-layer.js). */
  function takeInPage(id) {
    var layer = globalThis.__heddyCards;
    return layer ? layer.take(id) : null;
  }

  /** Runs in the page: draw these numbers (content/cards-layer.js). */
  function syncInPage(list) {
    var layer = globalThis.__heddyCards;
    if (layer) layer.sync(list);
    return true;
  }

  /** Runs in the page: the whole page as Markdown (content/page-tray.js). */
  function extractInPage() {
    return globalThis.__heddyPage ? globalThis.__heddyPage.extract() : null;
  }

  /**
   * deps: { chrome, crop (HeddyCrop), openCapture (the courier's), sender
   * (lib/tools.js createSender), randomUUID, pageFiles (what the page needs
   * for taking words and drawing numbers), capture(tab, rect, vw, vh) →
   * Promise<{png, box}> (lib/snap.js's crop), droppedText() → Promise<string>,
   * showLine(tabId, text) }
   */
  function createCards(deps) {
    var chrome = deps.chrome;
    var session = chrome.storage && chrome.storage.session;
    var cache = {};
    // Tabs whose cards were cleared by a navigation, until the new page loads.
    var droppedOn = {};

    function keyOf(tabId) {
      return KEY_PREFIX + tabId;
    }

    function newId() {
      return String(deps.randomUUID()).toLowerCase();
    }

    function empty() {
      return { url: null, title: '', cards: [] };
    }

    function load(tabId) {
      var k = keyOf(tabId);
      if (Object.prototype.hasOwnProperty.call(cache, k)) return Promise.resolve(cache[k]);
      return Promise.resolve()
        .then(function () { return session.get(k); })
        .then(function (got) {
          var s = got && got[k];
          s = s && Array.isArray(s.cards) ? s : empty();
          cache[k] = s;
          return s;
        }, function () { return empty(); });
    }

    function store(tabId, s) {
      var k = keyOf(tabId);
      cache[k] = s;
      var o = {};
      o[k] = s;
      return Promise.resolve().then(function () { return session.set(o); }).catch(function () {});
    }

    function forget(tabId) {
      var k = keyOf(tabId);
      delete cache[k];
      return Promise.resolve().then(function () { return session.remove(k); }).catch(function () {});
    }

    /** The list for the page the tab shows now: another page's list is gone. */
    function current(tab) {
      var url = T.cleanUrl(tab && tab.url);
      return load(tab.id).then(function (s) {
        if (s.url && s.url !== url) {
          return forget(tab.id).then(function () { return Object.assign(empty(), { url: url }); });
        }
        if (!s.url) s = Object.assign(empty(), { url: url });
        return s;
      });
    }

    function inject(tabId) {
      return chrome.scripting.executeScript({ target: { tabId: tabId }, files: deps.pageFiles });
    }

    /** The page's numbers, and the panel told to draw the list again. */
    function changed(tabId, s) {
      var list = marks(s.cards);
      return Promise.resolve()
        .then(function () { return chrome.scripting.executeScript({ target: { tabId: tabId }, func: syncInPage, args: [list] }); })
        .catch(function () {})
        .then(function () { return Promise.resolve(chrome.runtime.sendMessage({ type: 'heddy-cards:changed', tabId: tabId })).catch(function () {}); })
        .catch(function () {});
    }

    function reply(s, extra) {
      return Object.assign({ ok: true, url: s.url, cards: forPanel(s.cards), counts: counts(s.cards) }, extra || {});
    }

    function get(tab) {
      return current(tab).then(function (s) { return reply(s); });
    }

    /** + Text: the selection in the page becomes the next card. */
    function addText(tab) {
      return current(tab).then(function (s) {
        if (!room(s.cards, 'text')) return reply(s, { ok: false, error: 'full_text' });
        var id = newId();
        return Promise.resolve()
          .then(function () { return inject(tab.id); })
          .then(function () { return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: takeInPage, args: [id] }); })
          .then(function (res) {
            var got = res && res[0] && res[0].result;
            var card = got && T.cleanUrl(got.url) === s.url ? textCard(id, got) : null;
            if (!card) return changed(tab.id, s).then(function () { return reply(s, { ok: false, error: 'no_selection' }); });
            var same = sameText(s.cards, card);
            if (same) return changed(tab.id, s).then(function () { return reply(s, { ok: false, error: 'same', n: same }); });
            if (!s.cards.length) s.title = T.cleanText(tab.title, MAX_TITLE);
            s.cards.push(card);
            return store(tab.id, s).then(function () { return changed(tab.id, s); }).then(function () { return reply(s, { n: s.cards.length }); });
          }, function () { return reply(s, { ok: false, error: 'page' }); });
      });
    }

    /** + Picture in box mode: the box, cut from a screenshot, is the next card. */
    function addImage(tab, m) {
      return current(tab).then(function (s) {
        if (!room(s.cards, 'image')) return reply(s, { ok: false, error: 'full_images' });
        return deps.capture(tab, m.rect, m.vw, m.vh).then(
          function (img) {
            var card = imageCard(newId(), img, m);
            if (!card) return reply(s, { ok: false, error: 'capture' });
            if (!s.cards.length) s.title = T.cleanText(tab.title, MAX_TITLE);
            s.cards.push(card);
            return store(tab.id, s).then(function () { return changed(tab.id, s); }).then(function () { return reply(s, { n: s.cards.length, id: card.id }); });
          },
          function (e) { return reply(s, { ok: false, error: e && (e.message === 'too_big' || e.message === 'too_small') ? e.message : 'capture' }); }
        );
      });
    }

    function remove(tab, id) {
      return current(tab).then(function (s) {
        s.cards = s.cards.filter(function (c) { return c.id !== id; });
        return store(tab.id, s).then(function () { return changed(tab.id, s); }).then(function () { return reply(s); });
      });
    }

    /** Save to Jotters (then 'save') or Save and jot now (then 'jot'): every
     *  card, and with `withPage` the whole page too. With no card, the page
     *  alone (Save page to Jotters). */
    function save(tab, then, withPage) {
      if (THEN.indexOf(then) < 0) return Promise.resolve({ ok: false });
      return current(tab).then(function (s) {
        var items = s.cards.map(itemOf);
        var page = withPage
          ? Promise.resolve()
            .then(function () { return inject(tab.id); })
            .then(function () { return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractInPage }); })
            .then(function (res) {
              var p = res && res[0] && res[0].result;
              if (!p || typeof p.markdown !== 'string' || !p.markdown.trim()) throw new Error('empty');
              return p.markdown;
            })
          : Promise.resolve(null);
        return page.then(function (markdown) {
          if (markdown) items.push({ kind: 'page', markdown: markdown });
          if (!items.length) return { ok: false, error: 'empty' };
          var title = T.cleanText(tab.title, MAX_TITLE) || s.title;
          var spec = {
            page: 'save',
            kind: 'save',
            windowId: tab.windowId,
            build: function (cid) { return buildSave({ cid: cid, url: s.url || tab.url, title: title, then: then, items: items }); },
            meta: { tabId: tab.id, title: title || null, then: then, cards: s.cards.map(function (c) { return c.id; }) },
          };
          // Save and jot now: a tab beside the page, which becomes the notebook.
          if (then === 'jot') spec.asTab = tab.id;
          return deps.openCapture(spec);
        }, function (e) { return { ok: false, error: e && e.message === 'empty' ? 'empty' : 'page' }; });
      });
    }

    /** The site saved: those cards leave the list (any added since stay). */
    function saved(meta) {
      if (!meta || meta.tabId == null || !Array.isArray(meta.cards)) return Promise.resolve();
      return load(meta.tabId).then(function (s) {
        var before = s.cards.length;
        s.cards = s.cards.filter(function (c) { return meta.cards.indexOf(c.id) < 0; });
        if (s.cards.length === before) return null;
        return store(meta.tabId, s).then(function () { return changed(meta.tabId, s); });
      });
    }

    /** Explain, Make a card or Ask Heddy on one card (card 1 in the panel),
     *  or on a picture box mode just cut. */
    function toolOn(tab, tool, card) {
      var where = { tabId: tab.id, windowId: tab.windowId };
      if (!card) return Promise.resolve({ ok: false });
      if (card.kind === 'text') {
        var c = P.contextOf(card.before, card.after);
        return deps.sender.tool({ tool: tool, url: tab.url, title: tab.title, quote: card.quote, context: c.before && c.after ? c.before + ' … ' + c.after : c.before || c.after }, where);
      }
      return deps.sender.tool({ tool: tool, url: tab.url, title: tab.title, quote: '', images: [{ png: card.png, box: card.box }], context: card.before }, where);
    }

    function tool(tab, m) {
      if (T.TOOLS.indexOf(m.tool) < 0) return Promise.resolve({ ok: false });
      return current(tab).then(function (s) {
        if (m.cardId) return toolOn(tab, m.tool, s.cards.filter(function (c) { return c.id === m.cardId; })[0]);
        return toolOn(tab, m.tool, s.cards[0]);
      });
    }

    /** Box mode's Heddy menu on the box being drawn: cut it, keep nothing. */
    function toolOnBox(tab, m) {
      if (T.TOOLS.indexOf(m.tool) < 0) return Promise.resolve({ ok: false });
      return deps.capture(tab, m.rect, m.vw, m.vh).then(
        function (img) { return toolOn(tab, m.tool, { kind: 'image', png: img.png, box: img.box, before: side(m.context) }); },
        function () { return { ok: false }; }
      );
    }

    /** What box mode needs when it opens: the counts, and the pictures
     *  already kept from this page, numbered, to anchor its bar. */
    function state(tab) {
      return current(tab).then(function (s) {
        var images = marks(s.cards).filter(function (x) { return x.kind === 'image'; });
        return { ok: true, counts: counts(s.cards), images: images, next: s.cards.length + 1 };
      });
    }

    function own(sender) {
      return /^chrome-extension:/.test(String(sender.url || ''));
    }

    function tabFor(message, sender) {
      if (!own(sender)) return Promise.resolve(sender.tab && !sender.frameId ? sender.tab : null);
      return Promise.resolve()
        .then(function () { return chrome.tabs.get(message.tabId); })
        .catch(function () { return null; });
    }

    var FROM_PANEL = { 'heddy-cards:get': 1, 'heddy-cards:add-text': 1, 'heddy-cards:remove': 1, 'heddy-cards:save': 1, 'heddy-cards:tool': 1 };
    var FROM_BOX = { 'heddy-box:state': 1, 'heddy-box:keep': 1, 'heddy-box:save': 1, 'heddy-box:tool': 1 };

    /** chrome.runtime.onMessage. Resolves to the reply, or undefined for a
     *  message that is not the cards'. The panel (Heddy's own page) names
     *  its tab; box mode is the page's top frame and its tab is its own. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || !sender || sender.id !== chrome.runtime.id) return undefined;
      var type = message.type;
      if (FROM_PANEL[type] && !own(sender)) return Promise.resolve({ ok: false });
      if (FROM_BOX[type] && (own(sender) || !sender.tab || sender.frameId)) return Promise.resolve({ ok: false });
      if (!FROM_PANEL[type] && !FROM_BOX[type]) return undefined;
      return tabFor(message, sender).then(function (tab) {
        if (!tab || tab.id == null || !T.cleanUrl(tab.url)) return { ok: false };
        switch (type) {
          case 'heddy-cards:get': return get(tab);
          case 'heddy-cards:add-text': return addText(tab);
          case 'heddy-cards:remove': return remove(tab, String(message.id || ''));
          case 'heddy-cards:save': return save(tab, message.then, message.page === true);
          case 'heddy-cards:tool': return tool(tab, message);
          case 'heddy-box:state': return state(tab);
          case 'heddy-box:keep': return addImage(tab, message);
          case 'heddy-box:save': {
            // Save to Jotters on the bar: every card, plus the box being drawn.
            var keep = message.box ? addImage(tab, message.box) : Promise.resolve({ ok: true });
            return keep.then(function (r) {
              if (!r.ok && r.error !== 'full_images') return r;
              return save(tab, 'save', false);
            });
          }
          case 'heddy-box:tool':
            return message.box ? toolOnBox(tab, Object.assign({ tool: message.tool }, message.box)) : tool(tab, message);
          default: return { ok: false };
        }
      });
    }

    /** chrome.tabs.onUpdated: another page (not a #fragment) clears the
     *  list; once the new page has loaded it says so in one line, if a
     *  picture or snippet was lost. */
    function tabUpdated(tabId, change) {
      var first = Promise.resolve();
      if (change && change.url) {
        var to = T.cleanUrl(change.url);
        first = load(tabId).then(function (s) {
          if (!s.url || s.url === to) return null;
          if (s.cards.length) droppedOn[tabId] = true;
          return forget(tabId);
        });
      }
      return first.then(function () {
        if (!droppedOn[tabId] || !change || change.status !== 'complete') return null;
        delete droppedOn[tabId];
        return Promise.resolve(deps.droppedText ? deps.droppedText() : '')
          .then(function (text) { return deps.showLine ? deps.showLine(tabId, text) : null; })
          .catch(function () {});
      });
    }

    function tabGone(tabId) {
      delete droppedOn[tabId];
      return forget(tabId);
    }

    return { internal: internal, saved: saved, tabUpdated: tabUpdated, tabGone: tabGone, load: load };
  }

  var api = {
    MAX_TEXT: MAX_TEXT,
    MAX_IMAGES: MAX_IMAGES,
    MAX_QUOTE: MAX_QUOTE,
    SIDE: SIDE,
    KEY_PREFIX: KEY_PREFIX,
    counts: counts,
    room: room,
    numberOf: numberOf,
    sameText: sameText,
    textCard: textCard,
    imageCard: imageCard,
    marks: marks,
    forPanel: forPanel,
    itemOf: itemOf,
    buildSave: buildSave,
    createCards: createCards,
  };
  root.HeddyCards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
