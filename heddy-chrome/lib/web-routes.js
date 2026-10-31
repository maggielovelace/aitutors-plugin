// lib/web-routes.js — the background's side of Round 9 (PRD-v0.96.0 § 1i,
// D78–D86): what the web desk (popup/web-desk.js, in the panel's frame), the
// YouTube desk (content/desk.js), box mode's and the words bar's Heddy ▾
// (content/box-mode.js, content/page-tray.js) and the toasts ask of
// aitutors.me, answered through lib/heddy-api.js. Nothing here opens a
// window or a tab (D78): a save, an Undo, a card, a jot, a clip and the
// conversation are all requests from the background on the child's own
// aitutors.me sign-in.
//
// Who may ask what:
//   Heddy's own page (the panel's frame) names the tab it acts on, and the
//   page's address and title are read from that tab, never from the message.
//   A content script acts on its own tab, top frame only.
//
// Ask (D84): Heddy ▾'s Ask about it / Make a card on a picture or on words
// leaves the request here as the tab's pending ask, opens the panel (the web
// desk) if it is closed, and tells it; the desk takes it and opens its Ask
// view. The conversation itself is a Port ('heddy-ask'): the desk posts the
// turn, the background streams the site's lines back, checked.
(function (root) {
  var A = root.HeddyDeskAsk || (typeof require === 'function' && require('./desk-ask.js'));
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var T = root.HeddyTools || (typeof require === 'function' && require('./tools.js'));
  var C = root.HeddyConfig || (typeof require === 'function' && require('./config.js'));

  var PORT = 'heddy-ask';
  var PENDING_MS = 60000;
  var MAX_TITLE = 300;
  var MAX_FRONT = 500;
  var MAX_BACK = 2000;
  var MAX_JOT = 20000;
  var TOKEN = /^[A-Za-z0-9._~+/=:-]{1,2000}$/;

  function own(sender) {
    return /^chrome-extension:/.test(String(sender && sender.url || ''));
  }

  /** The video's address at the player's second (YouTube's crest). */
  function atMoment(url, t) {
    var vid = P.youtubeIdFromUrl(url);
    if (!vid) return url;
    var s = typeof t === 'number' && isFinite(t) && t >= 0 ? '&t=' + Math.floor(t) : '';
    return 'https://www.youtube.com/watch?v=' + vid + s;
  }

  /** The tab's own title, without YouTube's " - YouTube". */
  function titleOf(tab) {
    return T.cleanText(String(tab.title || '').replace(/\s+-\s+YouTube$/, ''), MAX_TITLE);
  }

  /** The contract's `source`, read from the tab (never from the desk). */
  function sourceOf(tab, t) {
    var url = T.cleanUrl(tab.url);
    if (!url) return null;
    var vid = P.youtubeIdFromUrl(url);
    if (vid) {
      var s = { kind: 'video', url: atMoment(url, t), title: titleOf(tab), youtubeId: vid };
      if (typeof t === 'number' && isFinite(t) && t >= 0) s.t = Math.floor(t);
      return s;
    }
    return { kind: 'page', url: url, title: titleOf(tab) };
  }

  /** A kept card's or jot's attached picture, as the contract carries it. */
  function pngOf(x) {
    return A.attachOf({ kind: 'image', png: x }) ? x : null;
  }

  /**
   * deps: { chrome, api (lib/heddy-api.js), cards (lib/cards.js's),
   *         showPanel(tab) → Promise, now? }
   */
  function createWebRoutes(deps) {
    var chrome = deps.chrome;
    var api = deps.api;
    var now = deps.now || Date.now;
    var pending = {}; // tabId → { ctx, intent, at }
    var professors = {}; // tabId → the professor's name the stream last named

    function tabOf(message, sender) {
      if (!sender || sender.id !== chrome.runtime.id) return Promise.resolve(null);
      if (own(sender)) {
        if (typeof message.tabId !== 'number') return Promise.resolve(null);
        return Promise.resolve().then(function () { return chrome.tabs.get(message.tabId); }).catch(function () { return null; });
      }
      return Promise.resolve(sender.tab && !sender.frameId ? sender.tab : null);
    }

    function tellTab(tabId, message) {
      return Promise.resolve().then(function () { return chrome.tabs.sendMessage(tabId, message); }).catch(function () {});
    }

    function origin() {
      return chrome.storage.local.get(C.DEV_KEY).then(
        function (got) { return C.captureOrigin(!!got && got[C.DEV_KEY] === true); },
        function () { return C.PROD_ORIGIN; }
      );
    }

    // ─── Ask: the pending request, and the desk opened on it ─────────────

    /** ctx: { about, n?, attach? }; intent 'ask' | 'explain' | 'card'. */
    function ask(tab, ctx, intent) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      pending[tab.id] = { ctx: { about: ctx.about, n: ctx.n || null, attach: A.attachOf(ctx.attach) }, intent: A.INTENTS.indexOf(intent) >= 0 ? intent : 'ask', at: now() };
      return Promise.resolve(deps.showPanel(tab))
        .catch(function () { return null; })
        .then(function () {
          // An open desk hears this at once; one that is just opening takes
          // the pending ask when it has drawn itself.
          return Promise.resolve(chrome.runtime.sendMessage({ type: 'heddy-web:ask', tabId: tab.id })).catch(function () {});
        })
        .then(function () { return { ok: true }; });
    }

    function takePending(tabId) {
      var p = pending[tabId];
      delete pending[tabId];
      if (!p || now() - p.at > PENDING_MS) return null;
      return { ctx: p.ctx, intent: p.intent };
    }

    // ─── the toasts' Undo, and Add to My Clips (D86) ─────────────────────

    function undoToast(tab, body, kinds) {
      return api.undo(body).then(function (r) {
        if (tab) tellTab(tab.id, { type: 'heddy-ui:toast', kind: r.ok ? kinds[0] : kinds[1] });
        return { ok: r.ok };
      });
    }

    /** The popup's Add to My Clips: a request, then the toast on the video. */
    function clip(tab, m) {
      return api.clip({ youtubeId: m.youtubeId, title: titleOf(tab), startSec: m.startSec, endSec: m.endSec }).then(function (r) {
        return origin().then(function (o) {
          var toast;
          var full = r.ok ? o + r.href : null;
          if (r.ok) {
            // What the site kept (site 13), else what was asked for; the
            // toast and the popup's Added card (owner: C1 + C3's toast).
            var from = r.startSec != null ? r.startSec : m.startSec == null ? null : Math.floor(m.startSec);
            toast = { type: 'heddy-ui:toast', kind: 'clip_added', duplicate: r.duplicate, startSec: from, endSec: r.endSec, notices: r.notices || [], momentId: r.momentId, href: full };
          }
          else if (r.error === 'no_captions') toast = { type: 'heddy-ui:toast', kind: 'no_captions' };
          else if (r.error === 'cant_keep') toast = { type: 'heddy-ui:toast', kind: 'cant_keep' };
          else if (r.error === 'signed_out') toast = { type: 'heddy-ui:toast', kind: 'signed_out', href: o + '/auth/login?door=kid' };
          if (toast) tellTab(tab.id, toast);
          return r.ok
            ? { ok: true, duplicate: r.duplicate, momentId: r.momentId, startSec: r.startSec, endSec: r.endSec, durationSec: r.durationSec, notices: r.notices || [], href: full }
            : { ok: false, error: r.error };
        });
      });
    }

    /** One Undo for the popup's Added card and the toast on the video: the
     *  toast says so, and an open popup hears it (heddy-clip:undone). */
    function undoClip(tab, momentId) {
      return api.undo({ kind: 'clip', momentId: momentId }).then(function (r) {
        if (r.ok) {
          tellTab(tab.id, { type: 'heddy-ui:toast', kind: 'clip_undone' });
          Promise.resolve(chrome.runtime.sendMessage({ type: 'heddy-clip:undone', tabId: tab.id, momentId: momentId })).catch(function () {});
        } else {
          tellTab(tab.id, { type: 'heddy-ui:toast', kind: 'clip_undo_failed' });
        }
        return { ok: r.ok };
      });
    }

    // ─── Keep card, Keep as a jot ────────────────────────────────────────

    function keepCard(tab, m) {
      var front = T.cleanText(m.front, MAX_FRONT);
      // `back` may be empty (site 7): the child writes it on aitutors.me.
      var back = typeof m.back === 'string' ? m.back.trim().slice(0, MAX_BACK) : '';
      if (!front || typeof m.draftToken !== 'string' || !TOKEN.test(m.draftToken)) return Promise.resolve({ ok: false, error: 'invalid' });
      var src = sourceOf(tab, m.t);
      if (!src) return Promise.resolve({ ok: false, error: 'invalid' });
      var body = { url: src.url, title: src.title, front: front, back: back, draftToken: m.draftToken };
      var png = pngOf(m.png);
      if (png) body.attach = { kind: 'image', png: png };
      return api.card(body).then(function (r) {
        if (!r.ok) return r;
        return origin().then(function (o) { return Object.assign({}, r, { deckHref: r.deckHref ? o + r.deckHref : null }); });
      });
    }

    /** The paragraph goes back byte for byte, as the site signed it (contract
     *  Changes, site 6): never trimmed or cut here. On YouTube the jot goes
     *  to the video's Jotter at `t` (site 14), and never with a picture. */
    function keepJot(tab, m) {
      var said = typeof m.text === 'string' && m.text.length <= MAX_JOT ? m.text : '';
      if (!said.trim() || typeof m.draftToken !== 'string' || !TOKEN.test(m.draftToken)) return Promise.resolve({ ok: false, error: 'invalid' });
      var src = sourceOf(tab, m.t);
      if (!src) return Promise.resolve({ ok: false, error: 'invalid' });
      var body = { url: src.url, title: src.title, text: said, draftToken: m.draftToken };
      var png = src.kind === 'page' ? pngOf(m.png) : null;
      if (png) body.png = png;
      else if (typeof m.quote === 'string' && m.quote.trim()) body.quote = m.quote.slice(0, 4000);
      if (src.kind === 'video' && typeof src.t === 'number') body.t = src.t;
      return api.jot(body);
    }

    // ─── messages ────────────────────────────────────────────────────────

    var FROM_DESK = { 'heddy-web:save': 1, 'heddy-web:undo-save': 1, 'heddy-web:ask-pending': 1 };
    var FROM_PAGE = { 'heddy-page:ask': 1, 'heddy-page:professor': 1 };

    /** chrome.runtime.onMessage. Resolves to the reply, or undefined for a
     *  message that is not ours. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') return undefined;
      var type = message.type;
      var mine = FROM_DESK[type] || FROM_PAGE[type] || type === 'heddy-web:card' || type === 'heddy-web:jot' || type === 'heddy-web:undo'
        || type === 'heddy-ui:undo' || type === 'heddy-ui:undo-card' || type === 'heddy-ui:undo-clip' || (type === 'heddy-ui:capture' && message.then === 'keep');
      if (!mine) return undefined;
      if (!sender || sender.id !== chrome.runtime.id) return Promise.resolve({ ok: false });
      if (FROM_DESK[type] && !own(sender)) return Promise.resolve({ ok: false });
      if (FROM_PAGE[type] && own(sender)) return Promise.resolve({ ok: false });
      return tabOf(message, sender).then(function (tab) {
        if (!tab || tab.id == null) return { ok: false };
        switch (type) {
          case 'heddy-web:save': return deps.cards.saveWeb(tab, message.article === true);
          case 'heddy-web:undo-save': return deps.cards.undoSave(tab, String(message.saveId || ''));
          case 'heddy-web:ask-pending': return { ok: true, pending: takePending(tab.id) };
          case 'heddy-web:card': return keepCard(tab, message);
          case 'heddy-web:jot': return keepJot(tab, message);
          case 'heddy-web:undo':
            // The Ask view's Undo on a kept card or jot; the popup's on a clip.
            if (message.kind === 'clip') return undoClip(tab, message.momentId);
            if (message.kind !== 'card' && message.kind !== 'jot') return { ok: false };
            return api.undo(message);
          case 'heddy-ui:undo-clip':
            // The Added toast's Undo, from the video's page.
            return undoClip(tab, message.momentId);
          case 'heddy-page:professor':
            // Heddy ▾ names the page's professor once the desk has met them.
            return { ok: true, name: professors[tab.id] || 'Mentor' };
          case 'heddy-page:ask': {
            // The words bar's Heddy ▾: Ask Mentor about this, Make a card.
            var attach = A.attachOf({ kind: 'text', quote: message.quote, before: message.before, after: message.after });
            if (!attach) return { ok: false };
            return ask(tab, { about: 'words', attach: attach }, message.intent === 'card' ? 'card' : 'ask');
          }
          case 'heddy-ui:undo':
            // The Jotted toast's Undo (heddy:undo's jotId and jotterId).
            return undoToast(own(sender) ? null : tab, { kind: 'jot', jotId: message.jotId, jotterId: message.jotterId }, ['undone', 'undo_failed']);
          case 'heddy-ui:undo-card':
            return undoToast(own(sender) ? null : tab, { kind: 'card', cardIds: message.cardIds }, ['card_undone', 'card_undo_failed']);
          case 'heddy-ui:capture':
            // Add to My Clips from the popup (D86): no tab, a toast.
            if (!P.isYoutubeId(message.youtubeId) || P.youtubeIdFromUrl(tab.url) !== message.youtubeId) return { ok: false };
            return clip(tab, message);
          default:
            return { ok: false };
        }
      });
    }

    /** chrome.runtime.onConnect: the Ask view's conversation. The first (and
     *  each) message is one turn: { tabId?, intent, state: {about, n,
     *  attach, items}, t?, lang }. Lines go back as {event}. */
    function connected(port) {
      if (!port || port.name !== PORT) return false;
      var sender = port.sender;
      if (!sender || sender.id !== chrome.runtime.id) { port.disconnect(); return true; }
      var running = null;
      port.onMessage.addListener(function (m) {
        if (!m || typeof m !== 'object' || A.INTENTS.indexOf(m.intent) < 0 || !m.state || typeof m.state !== 'object') return;
        if (running) running.stop();
        tabOf(m, sender).then(function (tab) {
          var src = tab && sourceOf(tab, m.t);
          if (!src) return post({ type: 'error', code: 'failed', message: '' });
          var state = A.fresh({ about: m.state.about, n: m.state.n, attach: m.state.attach });
          state.subject = A.SUBJECTS.indexOf(m.state.subject) >= 0 ? m.state.subject : null;
          state.items = Array.isArray(m.state.items) ? m.state.items.filter(function (i) { return i && (i.who === 'me' || i.who === 'tu' || i.who === 'card') && typeof (i.text || i.front) === 'string'; }) : [];
          state.items = state.items.map(function (i) { return i.who === 'card' ? { who: 'card', front: String(i.front), back: String(i.back || '') } : { who: i.who, text: String(i.text) }; });
          running = api.ask(A.body(state, m.intent, src, m.lang), function (ev) {
            if (ev.type === 'professor') professors[tab.id] = ev.name;
            post(ev);
          });
          return running.done;
        });
      });
      port.onDisconnect.addListener(function () { if (running) running.stop(); running = null; });
      function post(ev) {
        try { port.postMessage({ event: ev }); } catch (e) { if (running) running.stop(); }
      }
      return true;
    }

    function tabGone(tabId) {
      delete pending[tabId];
      delete professors[tabId];
    }

    return { internal: internal, connected: connected, ask: ask, takePending: takePending, tabGone: tabGone, sourceOf: sourceOf };
  }

  var api = { PORT: PORT, PENDING_MS: PENDING_MS, atMoment: atMoment, sourceOf: sourceOf, titleOf: titleOf, createWebRoutes: createWebRoutes };
  root.HeddyWebRoutes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
