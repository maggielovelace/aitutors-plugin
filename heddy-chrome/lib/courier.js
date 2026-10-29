// lib/courier.js — what the background service worker does, with Chrome passed
// in so the tests can drive it with a fake (background.js only wires it up).
//
// Heddy is a courier (PRD-v0.96.0 Appendix A.5): it carries a payload to a
// window on aitutors.me and the child's own session there does the saving.
// It holds no credential and makes no request of its own.
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var C = root.HeddyConfig || (typeof require === 'function' && require('./config.js'));

  var SESSION_KEY = 'heddyCids';
  var SAVED_MS = 2000;
  var ICONS = {
    idle: { 16: 'icons/toolbar-16.png', 32: 'icons/toolbar-32.png' },
    ready: { 16: 'icons/toolbar-ready-16.png', 32: 'icons/toolbar-ready-32.png' },
    saved: { 16: 'icons/toolbar-saved-16.png', 32: 'icons/toolbar-saved-32.png' },
  };
  // What the background injects into a tab that reached a watch page by
  // YouTube's in-page navigation (the manifest's content script only runs on
  // a full load of a watch URL). Same list as the manifest's content_scripts.
  var CONTENT_FILES = ['lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/marks.js', 'content/youtube-selectors.js', 'content/youtube.js'];

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

    /** Add to My Clips / Watch with Heddy: hold the payload, open the window. */
    function capture(input) {
      var payload;
      var cid = String(randomUUID()).toLowerCase();
      return ready
        .then(devMode)
        .then(function (dev) {
          payload = P.buildAdd({ cid: cid, youtubeId: input.youtubeId, startSec: input.startSec, then: input.then });
          var origin = C.captureOrigin(dev);
          store.put(cid, { payload: payload, origin: origin, tabId: input.tabId, then: payload.then, youtubeId: payload.youtubeId, startSec: payload.startSec });
          return persist()
            .then(function () {
              return (input.windowId != null ? chrome.windows.get(input.windowId) : chrome.windows.getLastFocused()).catch(function () { return null; });
            })
            .then(function (win) {
              var spec = Object.assign({ url: C.captureUrl(origin, 'clip', cid), type: 'popup', focused: true }, C.windowBounds(win));
              return chrome.windows.create(spec);
            })
            .then(function (created) {
              if (created && created.id != null) store.setWindow(cid, created.id);
              return persist().then(function () { return { ok: true, cid: cid }; });
            });
        })
        .catch(function () {
          store.drop(cid);
          return persist().then(function () { return { ok: false }; });
        });
    }

    /** heddy:result: the tick on the toolbar, the toast, and the pause. */
    function deliverResult(result, meta, origin) {
      if (result.ok) {
        setIcon(meta.tabId, 'saved');
        later(function () { restIcon(meta.tabId); }, SAVED_MS);
        var toast = { type: 'heddy-ui:toast', kind: 'clip', topic: result.topic, topicLang: result.lang, startSec: meta.startSec, href: C.clipsUrl(origin, { momentId: result.momentId, topicId: result.topicId, youtubeId: meta.youtubeId }) };
        var steps = [tellTab(meta.tabId, toast)];
        if (meta.then === 'classroom') steps.push(tellTab(meta.tabId, { type: 'heddy-ui:pause' }));
        return Promise.all(steps);
      }
      // The window stays open and explains every other refusal itself.
      if (result.error === 'cant_keep') return tellTab(meta.tabId, { type: 'heddy-ui:toast', kind: 'cant_keep' });
      return Promise.resolve();
    }

    /** chrome.runtime.onMessageExternal: heddy:ready and heddy:result from a
     *  page on aitutors.me. Resolves to the reply (null = nothing for you). */
    function external(message, sender) {
      return ready.then(devMode).then(function (dev) {
        var origin = sender && (sender.origin || C.originOf(sender.url));
        if (!origin || C.allowedOrigins(dev).indexOf(origin) < 0) return null;
        if (sender.url && C.originOf(sender.url) !== origin) return null;
        var m = P.parseExternal(message);
        if (!m) return null;
        var who = { origin: origin, windowId: sender.tab ? sender.tab.windowId : null };
        if (m.kind === 'ready') {
          var payload = store.claim(m.cid, who);
          return persist().then(function () { return payload; });
        }
        var meta = store.takeResult(m.cid, who);
        return persist().then(function () {
          if (!meta) return null;
          return deliverResult(m, meta, origin).then(function () { return { ok: true }; });
        });
      });
    }

    /** chrome.runtime.onMessage: Heddy's own popup and content script. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || !sender || sender.id !== chrome.runtime.id) return Promise.resolve(null);
      var tab = sender.tab;
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
        case 'heddy-ui:watch-page':
          return setIcon(tab && tab.id, message.on ? 'ready' : 'idle').then(function () { return { ok: true }; });
        case 'heddy-ui:open':
          return devMode().then(function (dev) {
            var href = typeof message.href === 'string' ? message.href : '';
            var u;
            try { u = new URL(href); } catch (e) { return { ok: false }; }
            if (C.allowedOrigins(dev).indexOf(u.origin) < 0 || u.pathname.indexOf('/study/clips') !== 0) return { ok: false };
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

    return { ready: ready, capture: capture, external: external, internal: internal, tabUpdated: tabUpdated };
  }

  var api = { SESSION_KEY: SESSION_KEY, SAVED_MS: SAVED_MS, ICONS: ICONS, CONTENT_FILES: CONTENT_FILES, createCourier: createCourier };
  root.HeddyCourier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
