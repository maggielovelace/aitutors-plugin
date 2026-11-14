// lib/frame-api.js — the panel's frame may not call every chrome.* API on Safari.
//
// What happened (2026-11-14, Mac and iPhone): the in-page panel (content/panel.js) is popup/popup.html in a frame
// inside the web page. Safari runs that frame in the PAGE's own process, which is not one of the extension's
// privileged processes. WebKit checks every extension API message against that (WebExtensionContext.messages.in,
// Validator=isLoadedAndPrivilegedMessage): tabs.*, scripting.*, action.*, windows.* and commands.* from such a
// process are an "invalid message", and Safari ends the process that sent one. Safari's log said exactly that,
// 22 times that day:
//     Message WebExtensionContext_TabsGet fails validation
//     Received an invalid message WebExtensionContext_TabsGet from WebContent process
//     WebProcessProxy::processDidTerminateOrFailedToLaunch: reason=Crash
// The child saw "This webpage was reloaded because a problem occurred". No script error, no crash report: the
// page did not crash, it was ended. The first call popup.js makes is chrome.tabs.get.
//
// runtime.sendMessage, runtime.connect, runtime.openOptionsPage and storage.* are open to any frame of the
// extension (Validator=isLoaded), which is all a content script has too. So on Safari, in a frame, the popup's
// `chrome` is the object wrap() returns: the open APIs as they are, and tabs / scripting as requests to the
// background (createBridge, below), which is privileged and makes the real call. Nothing else is on that object,
// so a call this file does not know is a script error in the frame, never the end of the child's page.
//
// A function cannot travel in a message, and the background may not build one from text. So every function the
// frame runs in the page lives here by name (FUNCS): the frame sends the name, the background runs its own copy.
//
// On Chrome and Edge, and in Safari's own toolbar popup, wrap() returns chrome itself: nothing changes there.
(function (root) {
  var TYPE = 'heddy-frame:call';

  // ─── what the frame runs in the page ───────────────────────────────────────
  // Each is sent to the page as text (chrome.scripting.executeScript func): no outer names inside.

  var FUNCS = {
    /** The page's selection (content/page-tray.js). */
    selection: function () { return globalThis.__heddyPage.selection(); },
    /** 'picture' while box mode draws in the page, else 'text'. */
    mode: function () { var b = globalThis.__heddyBoxMode; return b && b.mode ? b.mode() : 'text'; },
    /** + Text in the desk: box mode stops. */
    stopBox: function () { var b = globalThis.__heddyBoxMode; if (b && b.stop) b.stop(); return true; },
    /** The YouTube tab's video, title and channel. */
    readVideo: function (sel) {
      var v = document.querySelector(sel.video);
      var title = document.querySelector(sel.title);
      var channel = document.querySelector(sel.channel);
      return {
        t: v ? v.currentTime : null,
        duration: v && isFinite(v.duration) ? v.duration : null,
        title: title ? title.textContent.trim().slice(0, 200) : null,
        channel: channel ? channel.textContent.trim().slice(0, 100) : null,
      };
    },
    /** In the page's own world: YouTube's storyboard spec for the film strip (D75). Text only;
     *  lib/film-strip.js checks it. */
    readStoryboard: function () {
      try {
        var p = document.getElementById('movie_player');
        var r = p && typeof p.getPlayerResponse === 'function' ? p.getPlayerResponse() : null;
        var s = r && r.storyboards && r.storyboards.playerStoryboardSpecRenderer;
        return s && typeof s.spec === 'string' ? s.spec.slice(0, 4000) : null;
      } catch (e) {
        return null;
      }
    },
    /** Dragging the strip moves the video to that frame (D75). */
    seek: function (sel, s) { var v = document.querySelector(sel); if (v && isFinite(s)) v.currentTime = s; return true; },
    /** Where the video is now. */
    currentTime: function (sel) { var v = document.querySelector(sel); return v ? v.currentTime : null; },
  };

  function nameOf(func) {
    for (var k in FUNCS) if (Object.prototype.hasOwnProperty.call(FUNCS, k) && FUNCS[k] === func) return k;
    return null;
  }

  // ─── in the frame ─────────────────────────────────────────────────────────

  /** Heddy's page drawn in a frame, on Safari: the one place the privileged APIs end the page. */
  function needsBridge(win) {
    try {
      return !!win && !!win.location && win.location.protocol === 'safari-web-extension:' && !!win.parent && win.parent !== win;
    } catch (e) {
      return false;
    }
  }

  /** The `chrome` the popup's scripts use. chrome itself, except in a frame on Safari. */
  function wrap(chrome, win) {
    if (!chrome || !needsBridge(win)) return chrome;
    return facade(chrome);
  }

  function facade(chrome) {
    function ask(message) {
      return Promise.resolve()
        .then(function () { return chrome.runtime.sendMessage(Object.assign({ type: TYPE }, message)); })
        .then(function (reply) {
          if (!reply || reply.ok !== true) throw new Error('heddy-frame: ' + ((reply && reply.error) || 'refused'));
          return reply.result;
        });
    }
    return {
      bridged: true,
      // Open to any frame of the extension.
      runtime: chrome.runtime,
      storage: chrome.storage,
      i18n: chrome.i18n,
      // Privileged: asked of the background.
      tabs: {
        get: function (tabId) { return ask({ api: 'tabs.get', tabId: tabId }); },
        query: function () { return ask({ api: 'tabs.query' }); },
        create: function (props) { return ask({ api: 'tabs.create', url: props && props.url }); },
        sendMessage: function (tabId, message) { return ask({ api: 'tabs.sendMessage', tabId: tabId, message: message }); },
      },
      scripting: {
        executeScript: function (inj) {
          var m = { api: 'scripting.executeScript', tabId: inj && inj.target ? inj.target.tabId : null };
          if (inj && inj.world) m.world = inj.world;
          if (inj && inj.files) m.files = inj.files;
          else {
            var name = nameOf(inj && inj.func);
            if (!name) return Promise.reject(new Error('heddy-frame: not a page function of lib/frame-api.js'));
            m.func = name;
            m.args = (inj && inj.args) || [];
          }
          return ask(m);
        },
      },
    };
  }

  // ─── in the background ────────────────────────────────────────────────────

  /** deps: { chrome, files } — files: what the frame may inject (lib/courier.js PAGE_FILES).
   *  internal(message, sender) resolves to the reply, or is undefined for a message that is not the frame's. */
  function createBridge(deps) {
    var chrome = deps.chrome;
    var files = {};
    (deps.files || []).forEach(function (f) { files[f] = true; });

    /** Heddy's own page, in a frame or not. */
    function own(sender) {
      return !!sender && sender.id === chrome.runtime.id && /^(chrome-extension|safari-web-extension):\/\//.test(String(sender.url || ''));
    }

    /** The tab the frame is in. A frame may only act on its own tab; Safari's popup is not in one and names it. */
    function tabIdOf(message, sender) {
      var named = typeof message.tabId === 'number' ? message.tabId : null;
      var mine = sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
      if (mine !== null) return named === null || named === mine ? mine : null;
      return named;
    }

    function slim(tab, sender) {
      var t = tab || {};
      var fromSender = sender.tab || {};
      return { id: t.id, windowId: t.windowId, index: t.index, active: t.active, url: t.url || fromSender.url || '', title: t.title || fromSender.title || '' };
    }

    function run(message, sender) {
      var tabId = tabIdOf(message, sender);
      if (message.api === 'tabs.create') {
        if (!/^https?:\/\//.test(String(message.url || ''))) return Promise.reject(new Error('url'));
        return chrome.tabs.create({ url: message.url }).then(function (t) { return { id: t && t.id }; });
      }
      if (tabId === null) return Promise.reject(new Error('tab'));
      switch (message.api) {
        case 'tabs.get':
          return chrome.tabs.get(tabId).then(function (t) { return slim(t, sender); });
        case 'tabs.query':
          return chrome.tabs.get(tabId).then(function (t) { return [slim(t, sender)]; });
        case 'tabs.sendMessage':
          return Promise.resolve(chrome.tabs.sendMessage(tabId, message.message)).then(function (r) { return r === undefined ? null : r; });
        case 'scripting.executeScript': {
          var inj = { target: { tabId: tabId } };
          if (message.world === 'MAIN') inj.world = 'MAIN';
          if (Array.isArray(message.files)) {
            if (!message.files.length || !message.files.every(function (f) { return files[f] === true; })) return Promise.reject(new Error('files'));
            inj.files = message.files;
          } else {
            if (typeof message.func !== 'string' || !Object.prototype.hasOwnProperty.call(FUNCS, message.func)) return Promise.reject(new Error('func'));
            inj.func = FUNCS[message.func];
            inj.args = Array.isArray(message.args) ? message.args : [];
          }
          return chrome.scripting.executeScript(inj).then(function (res) {
            return (res || []).map(function (r) { return { result: r && r.result === undefined ? null : r && r.result }; });
          });
        }
        default:
          return Promise.reject(new Error('api'));
      }
    }

    function internal(message, sender) {
      if (!message || typeof message !== 'object' || message.type !== TYPE) return undefined;
      if (!own(sender)) return Promise.resolve({ ok: false, error: 'sender' });
      return Promise.resolve()
        .then(function () { return run(message, sender); })
        .then(
          function (result) { return { ok: true, result: result === undefined ? null : result }; },
          function (err) { return { ok: false, error: String((err && err.message) || 'failed').slice(0, 200) }; }
        );
    }

    return { internal: internal };
  }

  // What ends the page when a frame calls it on Safari (the tests keep the popup's scripts off these).
  var PRIVILEGED = ['tabs', 'scripting', 'action', 'windows', 'commands', 'contextMenus', 'menus', 'cookies', 'webNavigation'];

  var api = { TYPE: TYPE, FUNCS: FUNCS, PRIVILEGED: PRIVILEGED, nameOf: nameOf, needsBridge: needsBridge, wrap: wrap, facade: facade, createBridge: createBridge };
  root.HeddyFrameApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
