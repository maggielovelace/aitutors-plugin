// lib/courier.js — what the background service worker does, with Chrome passed
// in so the tests can drive it with a fake (background.js only wires it up).
//
// Heddy is a courier (PRD-v0.96.0 Appendix A.5): it carries a payload to a
// window on aitutors.me and the child's own session there does the saving.
// It holds no credential and makes no request of its own.
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var C = root.HeddyConfig || (typeof require === 'function' && require('./config.js'));
  var I = root.HeddyI18n || (typeof require === 'function' && require('./i18n.js'));

  var SESSION_KEY = 'heddyCids';
  var SAVED_MS = 2000;
  // Watch with Heddy and Add to My Clips open /capture/clip in a tab next to
  // the video (owner, 2026-10-30). Heddy closes it this long after an ok
  // result: after the kid sign-in redirect the page cannot close itself.
  var TAB_CLOSE_MS = 1000;
  // heddy:result's error when the child taps Cancel or Close on a capture page.
  var CANCELLED = 'cancelled';
  var ICONS = {
    idle: { 16: 'icons/toolbar-16.png', 32: 'icons/toolbar-32.png' },
    ready: { 16: 'icons/toolbar-ready-16.png', 32: 'icons/toolbar-ready-32.png' },
    saved: { 16: 'icons/toolbar-saved-16.png', 32: 'icons/toolbar-saved-32.png' },
  };
  // What the background injects into a tab that reached a watch page by
  // YouTube's in-page navigation (the manifest's content script only runs on
  // a full load of a watch URL). Same list as the manifest's content_scripts.
  var CONTENT_FILES = ['lib/font-data.js', 'lib/fonts.js', 'lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/marks.js', 'lib/toast.js', 'lib/jot-key.js', 'content/youtube-selectors.js', 'content/youtube.js'];
  // What a gesture injects into any page for Jot it and Clip this page (Phase 2).
  var PAGE_FILES = ['lib/font-data.js', 'lib/fonts.js', 'lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/marks.js', 'lib/toast.js', 'lib/tray-tools.js', 'lib/tools.js', 'content/extract.js', 'content/page-tray.js'];
  var MENU_ID = 'heddy-jot';
  // manifest.json "commands": jot the selected words. No default key (owner,
  // 2026-10-29); the child binds one at chrome://extensions/shortcuts.
  var COMMAND = 'jot-selection';

  /** The tab of a content script, or null for Heddy's own pages. The popup
   *  now lives in a frame inside the page (or a small window of its own), so
   *  it has a sender.tab too, but like the old toolbar popup it names the tab
   *  it acts on, and its frame's URL is not that page's. */
  function contentTab(sender) {
    return /^chrome-extension:/.test(String(sender.url || '')) ? null : sender.tab || null;
  }

  function createCourier(deps) {
    var chrome = deps.chrome;
    var store = deps.store;
    var randomUUID = deps.randomUUID;
    var later = deps.setTimeout || setTimeout;

    var ready = Promise.resolve()
      .then(function () { return chrome.storage.session.get(SESSION_KEY); })
      .then(function (got) { store.load(got && got[SESSION_KEY]); })
      .catch(function () {});

    function persist() {
      return Promise.resolve()
        .then(function () { var o = {}; o[SESSION_KEY] = store.toJSON(); return chrome.storage.session.set(o); })
        .catch(function () {});
    }

    function devMode() {
      return chrome.storage.local.get(C.DEV_KEY).then(
        function (got) { return !!got && got[C.DEV_KEY] === true; },
        function () { return false; }
      );
    }

    function setIcon(tabId, state) {
      if (tabId == null) return Promise.resolve();
      return Promise.resolve()
        .then(function () { return chrome.action.setIcon({ tabId: tabId, path: ICONS[state] }); })
        .catch(function () {});
    }

    /** The resting icon for a tab: the green dot on a watch page, else idle. */
    function restIcon(tabId) {
      return Promise.resolve()
        .then(function () { return chrome.tabs.get(tabId); })
        .then(function (tab) { return setIcon(tabId, tab && P.youtubeIdFromUrl(tab.url) ? 'ready' : 'idle'); })
        .catch(function () {});
    }

    function tellTab(tabId, message) {
      if (tabId == null) return Promise.resolve();
      return Promise.resolve()
        .then(function () { return chrome.tabs.sendMessage(tabId, message); })
        .catch(function () {});
    }

    /** The capture tab, straight after the tab it came from. A tab Chrome
     *  can no longer find still gets the capture, at the end of the strip. */
    function openTab(url, fromTabId) {
      return (fromTabId != null ? chrome.tabs.get(fromTabId) : Promise.reject(new Error('no tab')))
        .then(
          function (t) { return chrome.tabs.create({ url: url, openerTabId: t.id, index: t.index + 1, windowId: t.windowId, active: true }); },
          function () { return chrome.tabs.create({ url: url, active: true }); }
        );
    }

    /** Hold a payload for a /capture window and open it. `spec`:
     *  { page: 'clip'|'jot'|'page', kind, build(cid) → payload, meta, windowId, focused, asTab }.
     *  A J's window and an Undo's do not take focus (D18): the child keeps
     *  watching while the site saves. `asTab` (the YouTube tab's id) opens
     *  the page in a new tab beside it instead of a window. */
    function openCapture(spec) {
      var payload;
      var cid = String(randomUUID()).toLowerCase();
      return ready
        .then(devMode)
        .then(function (dev) {
          payload = spec.build(cid);
          var origin = C.captureOrigin(dev);
          store.put(cid, Object.assign({ payload: payload, origin: origin, kind: spec.kind }, spec.meta));
          var url = C.captureUrl(origin, spec.page, cid);
          if (spec.asTab !== undefined) {
            return persist()
              .then(function () { return openTab(url, spec.asTab); })
              .then(function (created) {
                if (created && created.id != null) store.setTab(cid, created.id, created.windowId);
                return persist().then(function () { return { ok: true, cid: cid }; });
              });
          }
          return persist()
            .then(function () {
              return (spec.windowId != null ? chrome.windows.get(spec.windowId) : chrome.windows.getLastFocused()).catch(function () { return null; });
            })
            .then(function (win) {
              var created = Object.assign({ url: url, type: 'popup', focused: spec.focused !== false }, C.windowBounds(win));
              return chrome.windows.create(created);
            })
            .then(function (created) {
              if (created && created.id != null) store.setWindow(cid, created.id);
              return persist().then(function () { return { ok: true, cid: cid }; });
            });
        })
        .catch(function (err) {
          store.drop(cid);
          var error = err && err.message === 'empty' ? 'empty' : null;
          return persist().then(function () { return error ? { ok: false, error: error } : { ok: false }; });
        });
    }

    /** Add to My Clips / Watch with Heddy: in a new tab beside the video. */
    function capture(input) {
      return openCapture({
        page: 'clip',
        kind: 'clip',
        windowId: input.windowId,
        asTab: input.tabId == null ? null : input.tabId,
        build: function (cid) { return P.buildAdd({ cid: cid, youtubeId: input.youtubeId, startSec: input.startSec, then: input.then }); },
        meta: { tabId: input.tabId, then: input.then, youtubeId: input.youtubeId, startSec: input.startSec == null ? null : Math.floor(input.startSec) },
      });
    }

    /** heddy:result: the tick on the toolbar, the toast, and the pause. Each
     *  window's result means something different; anything the site refused
     *  that is not listed here, its window explains itself and stays open. */
    function deliverResult(result, meta, origin) {
      var kind = meta.kind || 'clip';
      // Cancel or Close on any capture page (owner, 2026-10-30): the page
      // cannot always close itself (a tab after the sign-in redirect), so
      // Heddy closes what it opened, at once, and shows nothing.
      if (!result.ok && result.error === CANCELLED) return closeCapture(meta);
      if (kind === 'card_undo') {
        return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: result.ok ? 'card_undone' : 'card_undo_failed' });
      }
      if (kind === 'undo') {
        return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: result.ok ? 'undone' : 'undo_failed' });
      }
      if (!result.ok) {
        // J's refusals (Keep and jot, cant_keep, "We don't have this video
        // yet") stay in the site's window, with Close. Only a clip's refusal
        // by the family's settings gets Heddy's toast (Phase 1).
        if (kind === 'clip' && result.error === 'cant_keep') return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: 'cant_keep' });
        return Promise.resolve();
      }
      setIcon(meta.tabId, 'saved');
      later(function () { restIcon(meta.tabId); }, SAVED_MS);
      if (kind === 'moment') {
        return tellTab(meta.tabId, {
          type: 'heddy-ui:toast',
          kind: 'note',
          t: result.t != null ? result.t : meta.startSec,
          quote: result.quote,
          jotId: result.jotId,
          topic: result.topic,
          topicLang: result.lang,
          title: meta.title,
          href: C.jotterUrl(origin, meta.youtubeId),
        });
      }
      // The Jot it and Clip this page windows close about 1 s after an ok
      // result (owner, 2026-10-29), so the page shows what was kept.
      if (kind === 'jot') {
        return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: 'jotted', quote: result.quote, jotId: result.jotId, jotterId: result.jotterId, href: C.jotterById(origin, result.jotterId) });
      }
      // A picture jot (lib/tools.js): the same toast as Jot it, with no quote
      // (a picture has none). Its Undo names the Jotter, which deletes the
      // jot with its crops through the Jotters route. Box mode is no tray, so the toaster is put in
      // the tab first (it ignores a second injection).
      if (kind === 'box') {
        return Promise.resolve()
          .then(function () { return chrome.scripting.executeScript({ target: { tabId: meta.tabId }, files: PAGE_FILES }); })
          .catch(function () {})
          .then(function () {
            return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: 'jotted', jotId: result.jotId, jotterId: result.jotterId, href: C.jotterById(origin, result.jotterId) });
          });
      }
      // Tool windows (lib/tools.js; owner, 2026-10-29). Make a card closes
      // after Keep card: "Card made", Undo (its cards), Open in Jotter. The
      // room (Explain, Ask Heddy) stays open and says nothing on the page,
      // unless "Jot it with this" saved a jot: then the Jotted toast.
      if (kind === 'card' || kind === 'room') {
        var toast = null;
        if (kind === 'card' && result.cardIds) {
          toast = { type: 'heddy-ui:toast', kind: 'card', cardIds: result.cardIds, href: C.jotterById(origin, result.jotterId) };
        } else if (kind === 'room' && result.jotId) {
          toast = { type: 'heddy-ui:toast', kind: 'jotted', quote: result.quote, jotId: result.jotId, jotterId: result.jotterId, href: C.jotterById(origin, result.jotterId) };
        }
        if (!toast) return Promise.resolve();
        return Promise.resolve()
          .then(function () { return chrome.scripting.executeScript({ target: { tabId: meta.tabId }, files: PAGE_FILES }); })
          .catch(function () {})
          .then(function () { return tellTab(meta.tabId, toast); });
      }
      if (kind === 'page') {
        return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: 'clipped', title: meta.title, cut: meta.cut === true, href: C.jotterById(origin, result.jotterId) });
      }
      if (kind !== 'clip') return Promise.resolve();
      // "from m:ss" is where the site says the kept clip starts (its `t`):
      // the child may choose another start there, or Part of it. Heddy's own
      // start stands in when the site sends none.
      var startSec = result.t != null ? result.t : meta.startSec;
      var toast = { type: 'heddy-ui:toast', kind: 'clip', topic: result.topic, topicLang: result.lang, startSec: startSec, href: C.clipsUrl(origin, { momentId: result.momentId, topicId: result.topicId, youtubeId: meta.youtubeId }) };
      function clipToast() {
        var steps = [tellTab(meta.tabId, toast)];
        if (meta.then === 'classroom') steps.push(tellTab(meta.tabId, { type: 'heddy-ui:pause' }));
        return Promise.all(steps);
      }
      if (meta.captureTabId == null) return clipToast();
      // The capture tab: Heddy closes it about 1 s later and the toast shows
      // on the video once the child is back on it. The reply to the site is
      // not held for that.
      later(function () { closeCaptureTab(meta).then(clipToast); }, TAB_CLOSE_MS);
      return Promise.resolve();
    }

    /** Close a capture tab after its ok result. The YouTube tab comes back to
     *  the front only if the capture tab is still the one in front: Keep and
     *  watch has by then opened the Classroom in a tab of its own, and the
     *  child may have moved on, so neither is taken away from them. */
    function closeCaptureTab(meta) {
      var id = meta.captureTabId;
      return Promise.resolve()
        .then(function () { return chrome.tabs.get(id); })
        .then(function (cap) {
          if (!cap || !cap.active || meta.tabId == null) return null;
          return chrome.tabs.update(meta.tabId, { active: true });
        })
        .catch(function () {})
        .then(function () { return chrome.tabs.remove(id); })
        .catch(function () {});
    }

    /** Close the tab or window Heddy opened for a cid. A capture tab follows
     *  closeCaptureTab's rule; a window is removed. A tab capture's windowId
     *  is the YouTube window, so it is never the one removed. */
    function closeCapture(meta) {
      if (meta.captureTabId != null) return closeCaptureTab(meta);
      if (meta.windowId == null) return Promise.resolve();
      return Promise.resolve()
        .then(function () { return chrome.windows.remove(meta.windowId); })
        .catch(function () {});
    }

    /** chrome.tabs.onRemoved: a capture tab the child closed takes its cid
     *  with it, quietly (nothing is shown on the video). */
    function tabRemoved(tabId) {
      return ready.then(function () {
        if (store.dropTab(tabId)) return persist();
      });
    }

    /** J: one heddy:moment, in a window that does not take focus. */
    function moment(input) {
      return openCapture({
        page: 'jot',
        kind: 'moment',
        windowId: input.windowId,
        focused: false,
        build: function (cid) { return P.buildMoment({ cid: cid, youtubeId: input.youtubeId, t: input.t, tEnd: input.tEnd }); },
        meta: { tabId: input.tabId, youtubeId: input.youtubeId, startSec: Math.floor(input.t), title: input.title },
      });
    }

    /** Undo on the toast: heddy:undo, in a window that does not take focus. */
    function undo(input) {
      return openCapture({
        page: 'jot',
        kind: 'undo',
        windowId: input.windowId,
        focused: false,
        build: function (cid) { return P.buildUndo({ cid: cid, jotId: input.jotId, jotterId: input.jotterId }); },
        meta: { tabId: input.tabId },
      });
    }

    /** Jot it: heddy:jot, in a window that takes focus (the child adds a thought there). */
    function jot(input) {
      return openCapture({
        page: 'jot',
        kind: 'jot',
        windowId: input.windowId,
        build: function (cid) { return P.buildJot({ cid: cid, url: input.url, title: input.title, quote: input.quote, before: input.before, after: input.after }); },
        meta: { tabId: input.tabId },
      });
    }

    /** Clip this page: heddy:page. Past 200 KB of UTF-8 it keeps the first
     *  part (`cut: true`), and the toast after the save says so. */
    function page(input) {
      var meta = { tabId: input.tabId, title: null, cut: false };
      return openCapture({
        page: 'page',
        kind: 'page',
        windowId: input.windowId,
        build: function (cid) {
          var p = P.buildPage({ cid: cid, url: input.url, title: input.title, markdown: input.markdown });
          meta.title = p.title || null;
          meta.cut = p.cut === true;
          return p;
        },
        meta: meta,
      });
    }

    /** The files that make the page tray, injected on a gesture (activeTab). */
    function injectPage(tabId) {
      return chrome.scripting.executeScript({ target: { tabId: tabId }, files: PAGE_FILES });
    }

    /** The context menu (selection) and the jot-selection command: inject the
     *  tray into the tab the gesture came from. The menu item is already the
     *  child's choice of Jot it, so it jots; the command shows the tray. */
    function gesture(what, tab) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      return Promise.resolve()
        .then(function () { return injectPage(tab.id); })
        .then(function () { return chrome.tabs.sendMessage(tab.id, { type: what === 'menu' ? 'heddy-ui:jot-selection' : 'heddy-ui:tray' }); })
        .then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
    }

    function menuClicked(info, tab) {
      if (!info || info.menuItemId !== MENU_ID) return Promise.resolve(null);
      return gesture('menu', tab);
    }

    function command(name, tab) {
      if (name !== COMMAND) return Promise.resolve(null);
      var t = tab ? Promise.resolve(tab) : chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0]; }, function () { return null; });
      return t.then(function (x) { return gesture('command', x); });
    }

    /** Heddy's "Jot it with Heddy" item, in Heddy's language (D36). Only this
     *  id is replaced, never removeAll: Phase 3 adds its own items. */
    function installMenus(lang) {
      var title = I.t(lang, 'menuJotIt');
      return Promise.resolve()
        .then(function () { return chrome.contextMenus.remove(MENU_ID); })
        .catch(function () {})
        .then(function () { return chrome.contextMenus.create({ id: MENU_ID, title: title, contexts: ['selection'] }); })
        .catch(function () {});
    }

    function isPing(message) {
      return !!message && typeof message === 'object' && !Array.isArray(message) && message.type === 'heddy:ping' && message.v === P.PROTOCOL_VERSION;
    }

    /** chrome.runtime.onInstalled (PRD D8): a fresh install opens the
     *  first-run page on aitutors.me in Heddy's language, once. An update of
     *  Heddy or of Chrome opens nothing. tabs.create needs no permission. */
    function installed(details) {
      if (!details || details.reason !== 'install') return Promise.resolve(null);
      return Promise.all([devMode(), I.currentLang(chrome)])
        .then(function (got) { return chrome.tabs.create({ url: C.welcomeUrl(C.captureOrigin(got[0]), got[1]) }); })
        .catch(function () { return null; });
    }

    /** chrome.runtime.onMessageExternal: heddy:ready and heddy:result from a
     *  page on aitutors.me. Resolves to the reply (null = nothing for you). */
    function external(message, sender) {
      return ready.then(devMode).then(function (dev) {
        var origin = sender && (sender.origin || C.originOf(sender.url));
        if (!origin || C.allowedOrigins(dev).indexOf(origin) < 0) return null;
        if (sender.url && C.originOf(sender.url) !== origin) return null;
        // heddy:ping (D8): aitutors.me asks whether Heddy is installed, to hide
        // its "Clip the web with Heddy" links. The answer is the version and
        // nothing else; nothing is held or changed.
        if (isPing(message)) return { type: 'heddy:pong', v: P.PROTOCOL_VERSION, version: chrome.runtime.getManifest().version };
        var m = P.parseExternal(message);
        if (!m) return null;
        var who = { origin: origin, windowId: sender.tab ? sender.tab.windowId : null, tabId: sender.tab ? sender.tab.id : null };
        if (m.kind === 'ready') {
          var payload = store.claim(m.cid, who);
          return persist().then(function () { return payload; });
        }
        var meta = store.takeResult(m.cid, who);
        // The site sends 'cancelled' on Cancel or Close even after an earlier
        // result for the same cid (a duplicate's ok, a failure): still close.
        if (!meta && !m.ok && m.error === CANCELLED) {
          var spot = store.takeDone(m.cid, who);
          return persist().then(function () {
            return spot ? closeCapture(spot).then(function () { return { ok: true }; }) : null;
          });
        }
        return persist().then(function () {
          if (!meta) return null;
          return deliverResult(m, meta, origin).then(function () { return { ok: true }; });
        });
      });
    }

    /** chrome.runtime.onMessage: Heddy's own popup and content script. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || !sender || sender.id !== chrome.runtime.id) return Promise.resolve(null);
      var tab = contentTab(sender);
      switch (message.type) {
        case 'heddy-ui:capture': {
          if (!P.isYoutubeId(message.youtubeId) || (message.then !== 'keep' && message.then !== 'classroom')) return Promise.resolve({ ok: false });
          // From the YouTube page itself, the video must be the one it shows.
          if (tab && P.youtubeIdFromUrl(sender.url || tab.url) !== message.youtubeId) return Promise.resolve({ ok: false });
          return capture({
            youtubeId: message.youtubeId,
            startSec: message.startSec == null ? null : message.startSec,
            then: message.then,
            tabId: tab ? tab.id : message.tabId,
            windowId: tab ? tab.windowId : message.windowId,
          });
        }
        case 'heddy-ui:moment': {
          // J, from a watch page: the video must be the one that page shows.
          if (!tab || !P.isYoutubeId(message.youtubeId) || P.youtubeIdFromUrl(sender.url || tab.url) !== message.youtubeId) return Promise.resolve({ ok: false });
          if (typeof message.t !== 'number' || !isFinite(message.t) || message.t < 0) return Promise.resolve({ ok: false });
          return moment({
            youtubeId: message.youtubeId,
            t: message.t,
            tEnd: typeof message.tEnd === 'number' ? message.tEnd : null,
            title: typeof message.title === 'string' ? message.title.slice(0, 200) : null,
            tabId: tab.id,
            windowId: tab.windowId,
          });
        }
        case 'heddy-ui:undo':
          // buildUndo refuses anything but a jot id, so a bad one opens nothing.
          return undo({ jotId: message.jotId, jotterId: message.jotterId == null ? null : message.jotterId, tabId: tab ? tab.id : null, windowId: tab ? tab.windowId : message.windowId });
        case 'heddy-ui:jot':
        case 'heddy-ui:page': {
          // From a page, only that page's own address; the popup names its tab.
          if (tab && P.pageUrl(message.url) !== P.pageUrl(sender.url || tab.url)) return Promise.resolve({ ok: false });
          var input = Object.assign({}, message, { tabId: tab ? tab.id : message.tabId, windowId: tab ? tab.windowId : message.windowId });
          return message.type === 'heddy-ui:jot' ? jot(input) : page(input);
        }
        case 'heddy-ui:watch-page':
          return setIcon(tab && tab.id, message.on ? 'ready' : 'idle').then(function () { return { ok: true }; });
        case 'heddy-ui:open':
          return devMode().then(function (dev) {
            var href = typeof message.href === 'string' ? message.href : '';
            var u;
            try { u = new URL(href); } catch (e) { return { ok: false }; }
            if (C.allowedOrigins(dev).indexOf(u.origin) < 0 || !/^\/study\/(clips|jotters)(\/|$)/.test(u.pathname)) return { ok: false };
            return chrome.tabs.create({ url: u.href, openerTabId: tab ? tab.id : undefined }).then(
              function () { return { ok: true }; },
              function () { return { ok: false }; }
            );
          });
        default:
          return Promise.resolve(null);
      }
    }

    /** chrome.tabs.onUpdated: a tab that reached a watch page by YouTube's own
     *  navigation gets the content script (it ignores a second injection). */
    function tabUpdated(tabId, change, tab) {
      var url = (tab && tab.url) || change.url;
      if (!(change.url || change.status === 'complete') || !P.youtubeIdFromUrl(url)) return Promise.resolve();
      return Promise.resolve()
        .then(function () { return chrome.scripting.executeScript({ target: { tabId: tabId }, files: CONTENT_FILES }); })
        .catch(function () {})
        .then(function () { return setIcon(tabId, 'ready'); });
    }

    return { ready: ready, openCapture: openCapture, capture: capture, external: external, internal: internal, tabUpdated: tabUpdated, tabRemoved: tabRemoved, menuClicked: menuClicked, command: command, installMenus: installMenus, installed: installed };
  }

  var api = { SESSION_KEY: SESSION_KEY, SAVED_MS: SAVED_MS, TAB_CLOSE_MS: TAB_CLOSE_MS, CANCELLED: CANCELLED, ICONS: ICONS, CONTENT_FILES: CONTENT_FILES, PAGE_FILES: PAGE_FILES, MENU_ID: MENU_ID, COMMAND: COMMAND, contentTab: contentTab, createCourier: createCourier };
  root.HeddyCourier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
