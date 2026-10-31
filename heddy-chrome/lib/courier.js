// lib/courier.js — what the background service worker does, with Chrome passed
// in so the tests can drive it with a fake (background.js only wires it up).
//
// Heddy was a courier (PRD-v0.96.0 Appendix A.5): it carried a payload to a
// window on aitutors.me and the child's own session there did the saving.
// Round 9 (D78) moved every save to Heddy's background (lib/heddy-api.js,
// lib/web-routes.js), so what is left here is the one deliberate trip that
// still opens a tab, Full desk ↗ (D71), with its heddy:ready / heddy:result
// handshake, plus the toolbar icon, the menus, the welcome page on first
// install and the links the child taps to go to aitutors.me.
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
  // /capture/clip's refusal of a video with no captions (D59).
  var NO_CAPTIONS = 'no_captions';
  var ICONS = {
    idle: { 16: 'icons/toolbar-16.png', 32: 'icons/toolbar-32.png' },
    ready: { 16: 'icons/toolbar-ready-16.png', 32: 'icons/toolbar-ready-32.png' },
    saved: { 16: 'icons/toolbar-saved-16.png', 32: 'icons/toolbar-saved-32.png' },
  };
  // What the background injects into a tab that reached a watch page by
  // YouTube's in-page navigation (the manifest's content script only runs on
  // a full load of a watch URL). Same list as the manifest's content_scripts.
  var CONTENT_FILES = ['lib/font-data.js', 'lib/fonts.js', 'lib/font-desk-data.js', 'lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/config.js', 'lib/marks.js', 'lib/toast.js', 'lib/jot-key.js', 'lib/desk-model.js', 'lib/film-strip.js', 'lib/desk-ask.js', 'lib/ask-view.js', 'lib/desk-shell.js', 'lib/desk-tray.js', 'content/youtube-selectors.js', 'content/desk.js', 'content/youtube.js'];
  // The desk's jots carried by Full desk (D71): at most this many ids, which
  // leave the desk's store once the site has kept the clip.
  var MAX_JOT_IDS = 200;
  var DESK_PREFIX = 'deskJots:';
  // What a gesture injects into any page for Jot it and Save page to Jotters
  // (Phase 2), and for the panel's cards: lib/pos.js places a snippet on its
  // page, content/cards-layer.js draws the cards' numbers (Round 5).
  var PAGE_FILES = ['lib/font-data.js', 'lib/fonts.js', 'lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/marks.js', 'lib/toast.js', 'lib/tray-tools.js', 'lib/tools.js', 'content/extract.js', 'content/page-tray.js', 'lib/pos.js', 'content/cards-layer.js'];
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

    /** Hold a payload for a /capture page and open it in a tab beside the
     *  tab it came from. `spec`: { page, kind, build(cid) → payload, meta,
     *  asTab }. Only Full desk ↗ comes here now (D71, D78): a tab the child
     *  asked for, never a window. */
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
          return persist()
            .then(function () { return openTab(url, spec.asTab); })
            .then(function (created) {
              if (created && created.id != null) store.setTab(cid, created.id, created.windowId);
              return persist().then(function () { return { ok: true, cid: cid }; });
            });
        })
        .catch(function (err) {
          store.drop(cid);
          var error = err && err.message === 'empty' ? 'empty' : null;
          return persist().then(function () { return error ? { ok: false, error: error } : { ok: false }; });
        });
    }

    /** Full desk ↗ (the desk, D71): the video to My Clips and Classroom, in
     *  a new tab beside the video, carrying the desk's jots. (Add to My Clips
     *  from the popup is a background request since Round 9, D86.) */
    function capture(input) {
      var meta = { tabId: input.tabId, then: input.then, youtubeId: input.youtubeId, startSec: input.startSec == null ? null : Math.floor(input.startSec) };
      if (input.jotIds && input.jotIds.length) meta.jotIds = input.jotIds;
      return openCapture({
        page: 'clip',
        kind: 'clip',
        windowId: input.windowId,
        asTab: input.tabId == null ? null : input.tabId,
        build: function (cid) {
          return P.buildAdd({ cid: cid, youtubeId: input.youtubeId, startSec: input.startSec, endSec: input.endSec, jots: input.jots, then: input.then });
        },
        meta: meta,
      });
    }

    /** Full desk's jots are on aitutors.me now (the result's jotsSaved): they leave the desk's store
     *  (the desk redraws from chrome.storage.onChanged). Jots made since stay. */
    function dropCarriedJots(meta) {
      if (!meta.jotIds || !meta.jotIds.length || !P.isYoutubeId(meta.youtubeId)) return Promise.resolve();
      var key = DESK_PREFIX + meta.youtubeId;
      var gone = {};
      meta.jotIds.forEach(function (id) { gone[id] = true; });
      return Promise.resolve()
        .then(function () { return chrome.storage.local.get(key); })
        .then(function (got) {
          var list = got && Array.isArray(got[key]) ? got[key] : [];
          var keep = list.filter(function (j) { return !(j && gone[j.id]); });
          if (keep.length === list.length) return null;
          if (!keep.length) return chrome.storage.local.remove(key);
          var o = {};
          o[key] = keep;
          return chrome.storage.local.set(o);
        })
        .catch(function () {});
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
      // A video with no captions is not kept (D59): the page says so, then
      // Heddy closes its tab and says the same on the video.
      if (!result.ok && result.error === NO_CAPTIONS && kind === 'clip') {
        var none = { type: 'heddy-ui:toast', kind: 'no_captions' };
        if (meta.captureTabId == null) return tellTab(meta.tabId, none);
        later(function () { closeCaptureTab(meta).then(function () { return tellTab(meta.tabId, none); }); }, TAB_CLOSE_MS);
        return Promise.resolve();
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
      // (Round 9, D78: Heddy opens no save, page, card, room or Undo window,
      // so only Full desk's 'clip' result comes back; the site still answers
      // older installs' windows itself.)
      if (kind !== 'clip') return Promise.resolve();
      // The window says it saved Full desk's jots (contract Changes, site 4):
      // only then do they leave the desk.
      if (result.jotsSaved != null) dropCarriedJots(meta);
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

    /** The files that make the page tray, injected on a gesture (activeTab). */
    function injectPage(tabId) {
      return chrome.scripting.executeScript({ target: { tabId: tabId }, files: PAGE_FILES });
    }

    /** The jot-selection command: inject the tray into the tab the gesture
     *  came from and show it under the selection. */
    function showTray(tab) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      return Promise.resolve()
        .then(function () { return injectPage(tab.id); })
        .then(function () { return chrome.tabs.sendMessage(tab.id, { type: 'heddy-ui:tray' }); })
        .then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
    }

    /** "Save to Jotters" on a selection (D54, D55): the words become a card
     *  and the panel opens on them (lib/cards.js collect). It writes no jot. */
    function menuClicked(info, tab) {
      if (!info || info.menuItemId !== MENU_ID) return Promise.resolve(null);
      if (!tab || tab.id == null || !deps.collect) return Promise.resolve({ ok: false });
      return Promise.resolve(deps.collect(tab)).then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
    }

    function command(name, tab) {
      if (name !== COMMAND) return Promise.resolve(null);
      var t = tab ? Promise.resolve(tab) : chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0]; }, function () { return null; });
      return t.then(showTray);
    }

    /** Heddy's "Save to Jotters" item on a selection, in Heddy's language
     *  (D36). Only this id is replaced, never removeAll: snap adds its own. */
    function installMenus(lang) {
      var title = I.t(lang, 'saveToJotters');
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
          // Full desk only: Add to My Clips ('keep') is lib/web-routes.js's.
          if (!P.isYoutubeId(message.youtubeId) || message.then !== 'classroom') return Promise.resolve({ ok: false });
          // From the YouTube page itself, the video must be the one it shows.
          if (tab && P.youtubeIdFromUrl(sender.url || tab.url) !== message.youtubeId) return Promise.resolve({ ok: false });
          // Full desk's jots come only from the desk, on its own page (D71).
          var jots = tab && message.then === 'classroom' && Array.isArray(message.jots) ? message.jots : null;
          var jotIds = jots && Array.isArray(message.jotIds) && message.jotIds.length <= MAX_JOT_IDS
            ? message.jotIds.filter(function (id) { return typeof id === 'string' && id.length <= 64; })
            : null;
          return capture({
            youtubeId: message.youtubeId,
            startSec: message.startSec == null ? null : message.startSec,
            endSec: message.endSec == null ? null : message.endSec,
            jots: jots,
            jotIds: jotIds,
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
            // My Clips, Jotters, a card's deck, the kid sign-in door (the
            // desk signed out), and the plans page (the locked block's See
            // plans ↗, D92; exactly /pricing): each a link the child taps (D78).
            var to = /^\/study\/(clips|jotters|cards)(\/|$)/.test(u.pathname) || (u.pathname === '/auth/login' && u.search === '?door=kid') || (u.pathname === '/pricing' && !u.search && !u.hash);
            if (C.allowedOrigins(dev).indexOf(u.origin) < 0 || !to) return { ok: false };
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

  var api = { SESSION_KEY: SESSION_KEY, SAVED_MS: SAVED_MS, TAB_CLOSE_MS: TAB_CLOSE_MS, CANCELLED: CANCELLED, NO_CAPTIONS: NO_CAPTIONS, ICONS: ICONS, CONTENT_FILES: CONTENT_FILES, PAGE_FILES: PAGE_FILES, MENU_ID: MENU_ID, COMMAND: COMMAND, MAX_JOT_IDS: MAX_JOT_IDS, DESK_PREFIX: DESK_PREFIX, contentTab: contentTab, createCourier: createCourier };
  root.HeddyCourier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
