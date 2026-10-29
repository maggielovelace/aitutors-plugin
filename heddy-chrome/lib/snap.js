// lib/snap.js — Snap a picture (PRD-v0.96.0 D30, D33; artifact R3b · 00,
// R3b · 01, R3b · 04, R3b · 05).
//
// Three parts, one file, because they share the timing rules:
//   createGate      tells one click/press from two (pure, clock injected)
//   createSnap      the background's side: starts box mode in the tab, takes
//                   each kept box from a screenshot, sends heddy:box or
//                   heddy:tool, and the whole-tab snap
//   mountButton     the popup footer's Snap a picture icon
//
// The ways in (D30): the popup icon (click = box mode, double-click within
// ~250 ms = the whole visible tab), right-click an image → "Jot this picture
// with Heddy" (box mode with the box on the image), and Ctrl Shift K (twice
// within 0.4 s = the whole visible tab). Every one is a user gesture, which is
// what lets activeTab allow captureVisibleTab and the box-mode script.
(function (root) {
  var DOUBLE_CLICK_MS = 250;
  var DOUBLE_PRESS_MS = 400;
  var COMMAND = 'snap-picture';
  var MENU_ID = 'heddy-snap-image';
  // What box mode needs in the page, injected on the gesture (activeTab).
  var BOX_FILES = ['lib/messages.js', 'lib/i18n.js', 'lib/marks.js', 'content/box-mode.js'];
  // captureVisibleTab allows two calls a second; one retry after this.
  var CAPTURE_RETRY_MS = 600;
  // The crop-corners glyph (Jotters' Select area; the owner's ruling 29 Oct).
  var SNAP_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 2.5 V17 H21.5 M2.5 7 H17 V21.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** One hit waits `waitMs`, then onSingle; a second hit inside the wait
   *  cancels it and calls onDouble instead. */
  function createGate(opts) {
    var later = opts.later || setTimeout;
    var clear = opts.clear || clearTimeout;
    var timer = null;
    return {
      hit: function () {
        if (timer !== null) {
          clear(timer);
          timer = null;
          opts.onDouble();
          return 'double';
        }
        timer = later(function () {
          timer = null;
          opts.onSingle();
        }, opts.waitMs);
        return 'waiting';
      },
      pending: function () { return timer !== null; },
    };
  }

  // ─── the background's side ─────────────────────────────────────────────────

  /** Runs in the page: the viewport, for the whole-tab snap. */
  function readViewport() {
    return { vw: window.innerWidth, vh: window.innerHeight };
  }

  /** Runs in the page: the one-line notice after a navigation dropped the
   *  kept pictures. Text only; gone after 4 s. */
  function showDroppedLine(text) {
    if (!text || document.querySelector('heddy-box-mode')) return;
    var host = document.createElement('heddy-note');
    var shadow = host.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = ':host{all:initial;position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647}' +
      'span{display:block;background:#002147;color:#fff;border-radius:999px;padding:7px 14px;font:600 12.5px Manrope,Roboto,Arial,sans-serif;white-space:nowrap}';
    var line = document.createElement('span');
    line.setAttribute('role', 'status');
    line.textContent = text;
    shadow.appendChild(style);
    shadow.appendChild(line);
    document.documentElement.appendChild(host);
    setTimeout(function () { host.remove(); }, 4000);
  }

  /** deps: {chrome, sender (lib/tools.js createSender), crop (HeddyCrop),
   *  makers: {createImageBitmap, OffscreenCanvas, Blob}, later} */
  function createSnap(deps) {
    var chrome = deps.chrome;
    var K = deps.crop;
    var T = deps.tools;
    var later = deps.later || setTimeout;
    // tabId → { url, title, images: [{png, box}], context }: the pictures kept
    // for one jot. One page only (D33): a different address drops them.
    var sessions = {};
    var pressGate = {};
    // Tabs whose kept pictures were dropped by a navigation, until it loads.
    var droppedOn = {};

    function pageUrl(href) {
      return T.cleanUrl(href);
    }

    function capture(windowId) {
      function once() { return chrome.tabs.captureVisibleTab(windowId, { format: 'png' }); }
      return once().catch(function () {
        return new Promise(function (resolve) { later(resolve, CAPTURE_RETRY_MS); }).then(once);
      });
    }

    function cropOne(tab, rect, vw, vh) {
      var r = K.clampBox(rect, vw, vh);
      if (!r) return Promise.reject(new Error('too_small'));
      return capture(tab.windowId).then(function (shot) {
        return K.cropShot(shot, [r], vw, vh, deps.makers);
      }).then(function (out) { return out[0]; });
    }

    /** Box mode in the tab, optionally with the box drawn on the image the
     *  child right-clicked. */
    function start(tab, opts) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      delete sessions[tab.id];
      return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: BOX_FILES })
        .then(function () {
          return chrome.tabs.sendMessage(tab.id, Object.assign({ type: 'heddy-box:start' }, opts || {}));
        })
        .then(function () { return { ok: true }; }, function () { return { ok: false }; });
    }

    /** The whole visible tab, straight to the Jot it window. */
    function whole(tab) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      delete sessions[tab.id];
      return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readViewport })
        .then(function (res) {
          var v = res && res[0] && res[0].result;
          if (!v) throw new Error('no viewport');
          return cropOne(tab, { x: 0, y: 0, w: v.vw, h: v.vh }, v.vw, v.vh);
        })
        .then(function (img) {
          return deps.sender.box({ url: tab.url, title: tab.title, images: [img], context: '' }, { tabId: tab.id, windowId: tab.windowId });
        })
        .catch(function () { return { ok: false }; });
    }

    /** heddy-box:grab: keep one more box for this jot (or the only one). */
    function grab(tab, m) {
      var url = pageUrl(tab.url);
      if (!url) return Promise.resolve({ ok: false, error: 'page' });
      var s = sessions[tab.id];
      if (s && s.url !== url) {
        // The page changed while collecting: drop everything (D33).
        delete sessions[tab.id];
        return Promise.resolve({ ok: false, error: 'page_changed' });
      }
      if (s && s.images.length >= K.MAX_IMAGES) return Promise.resolve({ ok: false, error: 'full' });
      return cropOne(tab, m.rect, m.vw, m.vh).then(
        function (img) {
          var cur = sessions[tab.id] || (sessions[tab.id] = { url: url, title: tab.title, images: [], context: '' });
          if (cur.url !== url) return { ok: false, error: 'page_changed' };
          cur.images.push(img);
          // The cover's caption is the jot's context.
          if (cur.images.length === 1) cur.context = T.cleanText(m.context, T.MAX_CONTEXT);
          return { ok: true, n: cur.images.length };
        },
        function (e) { return { ok: false, error: e && (e.message === 'too_big' || e.message === 'too_small') ? e.message : 'capture' }; }
      );
    }

    /** heddy-box:send: Jot it, Explain, Make a card or Ask Heddy on the
     *  pictures kept. Explain and Make a card take one picture (D33). */
    function send(tab, action) {
      var s = sessions[tab.id];
      delete sessions[tab.id];
      if (!s || !s.images.length) return Promise.resolve({ ok: false });
      if (pageUrl(tab.url) !== s.url) return Promise.resolve({ ok: false, error: 'page_changed' });
      var where = { tabId: tab.id, windowId: tab.windowId };
      var input = { url: s.url, title: s.title, images: s.images, context: s.context };
      if (action === 'jot') return deps.sender.box(input, where);
      if (T.TOOLS.indexOf(action) < 0 || s.images.length > T.MAX_PICTURES[action]) return Promise.resolve({ ok: false });
      return deps.sender.tool(Object.assign({ tool: action, quote: '' }, input), where);
    }

    /** heddy-ui:tool from the words tray (lib/tools.js sendTool). The address
     *  and title come from the tab, not the page. */
    function wordsTool(tab, m) {
      if (T.TOOLS.indexOf(m.tool) < 0) return Promise.resolve({ ok: false });
      return deps.sender.tool(
        { tool: m.tool, url: tab.url, title: tab.title, quote: m.quote, context: m.context },
        { tabId: tab.id, windowId: tab.windowId }
      );
    }

    /** chrome.runtime.onMessage: the popup's icon and box mode in a page.
     *  Resolves to the reply, or undefined for a message that is not ours. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || !sender || sender.id !== chrome.runtime.id) return undefined;
      var tab = sender.tab;
      switch (message.type) {
        case 'heddy-ui:snap': {
          // From the popup, which has no tab of its own: it names the tab.
          if (tab) return Promise.resolve({ ok: false });
          return chrome.tabs.get(message.tabId).then(function (t) {
            return message.mode === 'whole' ? whole(t) : start(t);
          }, function () { return { ok: false }; });
        }
        case 'heddy-box:grab':
          if (!tab || sender.frameId) return Promise.resolve({ ok: false });
          return grab(tab, message);
        case 'heddy-box:send':
          if (!tab || sender.frameId) return Promise.resolve({ ok: false });
          return send(tab, message.action);
        case 'heddy-box:whole':
          if (!tab || sender.frameId) return Promise.resolve({ ok: false });
          return whole(tab);
        case 'heddy-box:cancel':
          if (tab) delete sessions[tab.id];
          return Promise.resolve({ ok: true });
        case 'heddy-ui:tool':
          if (!tab) return Promise.resolve({ ok: false });
          return wordsTool(tab, message);
        default:
          return undefined;
      }
    }

    /** chrome.commands.onCommand: once = box mode, twice in 0.4 s = whole tab. */
    function command(name, tab) {
      if (name !== COMMAND || !tab || tab.id == null) return false;
      var g = pressGate[tab.id];
      if (!g) {
        g = pressGate[tab.id] = createGate({
          waitMs: DOUBLE_PRESS_MS,
          later: later,
          clear: deps.clear || clearTimeout,
          onSingle: function () { delete pressGate[tab.id]; start(tab); },
          onDouble: function () { delete pressGate[tab.id]; whole(tab); },
        });
      }
      g.hit();
      return true;
    }

    /** chrome.contextMenus.onClicked on an image. A picture inside a frame
     *  starts box mode without a box: box mode runs in the top page only. */
    function menuClicked(info, tab) {
      if (!info || info.menuItemId !== MENU_ID || !tab) return false;
      var opts = info.frameId ? {} : { srcUrl: typeof info.srcUrl === 'string' ? info.srcUrl : '' };
      start(tab, opts);
      return true;
    }

    /** The context menu item (runtime.onInstalled). */
    function installMenu(title) {
      return Promise.resolve()
        .then(function () { return chrome.contextMenus.remove(MENU_ID); })
        .catch(function () {})
        .then(function () { return chrome.contextMenus.create({ id: MENU_ID, title: title, contexts: ['image'] }); })
        .catch(function () {});
    }

    /** A tab that navigated or closed loses what it was collecting. */
    function tabGone(tabId) {
      delete sessions[tabId];
      delete droppedOn[tabId];
    }

    /** The page navigated away while collecting: the kept pictures are
     *  dropped (D33), and the new page says so in one line once it has
     *  loaded. A same-page navigation (history.pushState) leaves box mode
     *  running, and box mode says it itself. The line is best effort:
     *  activeTab may not reach the new page. */
    function tabUpdated(tabId, change) {
      var s = sessions[tabId];
      if (s && change && change.url && pageUrl(change.url) !== s.url) {
        delete sessions[tabId];
        if (s.images.length) droppedOn[tabId] = true;
      }
      if (droppedOn[tabId] && change && change.status === 'complete') {
        delete droppedOn[tabId];
        return Promise.resolve(deps.droppedText ? deps.droppedText() : '')
          .then(function (text) {
            return chrome.scripting.executeScript({ target: { tabId: tabId }, func: showDroppedLine, args: [String(text || '')] });
          })
          .catch(function () {});
      }
      return Promise.resolve();
    }

    return {
      start: start,
      whole: whole,
      grab: grab,
      send: send,
      internal: internal,
      command: command,
      menuClicked: menuClicked,
      installMenu: installMenu,
      tabGone: tabGone,
      tabUpdated: tabUpdated,
      kept: function (tabId) { return sessions[tabId] ? sessions[tabId].images.length : 0; },
    };
  }

  // ─── the popup's icon ──────────────────────────────────────────────────────

  /** The shortcut as Chrome shows it (the child may have rebound it). */
  function shortcutLabel(commands) {
    var c = (commands || []).filter(function (x) { return x && x.name === COMMAND; })[0];
    return c && c.shortcut ? c.shortcut : null;
  }

  /** Snap a picture in the popup footer, just left of the settings cog
   *  (R3b · 05). btn is the footer's <button id="snap">; tr the popup's
   *  translator; tab the active tab. Click waits ~250 ms for a second click. */
  function mountButton(btn, opts) {
    var chromeApi = opts.chrome;
    var doc = btn.ownerDocument;
    var tr = opts.tr;
    btn.innerHTML = SNAP_ICON;
    btn.setAttribute('aria-label', tr('snapPicture'));
    btn.hidden = false;

    var tip = doc.createElement('span');
    tip.className = 'snaptip';
    tip.setAttribute('role', 'tooltip');
    tip.id = 'snaptip';
    var lines = [['b', tr('snapPicture')], ['span', tr('snapTipClick')], ['span', tr('snapTipDouble')], ['em', tr('snapTipKey', 'Ctrl Shift K')]];
    lines.forEach(function (l) {
      var e = doc.createElement(l[0]);
      e.textContent = l[1];
      tip.appendChild(e);
    });
    btn.setAttribute('aria-describedby', 'snaptip');
    (btn.closest('.pf') || btn.parentNode).appendChild(tip);
    if (chromeApi.commands && chromeApi.commands.getAll) {
      Promise.resolve(chromeApi.commands.getAll()).then(function (all) {
        var key = shortcutLabel(all);
        var em = tip.querySelector('em');
        if (key) em.textContent = tr('snapTipKey', key);
        else em.remove();
      }, function () {});
    }

    // The popup closes once the background has the tab (box mode drawn, or
    // the Jot it window opened), so the message is never cut off.
    function go(mode) {
      var close = opts.close || function () { root.close(); };
      Promise.resolve()
        .then(function () { return chromeApi.runtime.sendMessage({ type: 'heddy-ui:snap', mode: mode, tabId: opts.tab.id }); })
        .then(close, close);
    }
    var gate = createGate({
      waitMs: DOUBLE_CLICK_MS,
      later: opts.later,
      clear: opts.clear,
      onSingle: function () { go('box'); },
      onDouble: function () { go('whole'); },
    });
    btn.addEventListener('click', function () {
      // The pressed state while the popup waits to see if a second click comes.
      btn.setAttribute('aria-pressed', 'true');
      gate.hit();
    });
    return { gate: gate, tip: tip };
  }

  var api = {
    DOUBLE_CLICK_MS: DOUBLE_CLICK_MS,
    DOUBLE_PRESS_MS: DOUBLE_PRESS_MS,
    COMMAND: COMMAND,
    MENU_ID: MENU_ID,
    BOX_FILES: BOX_FILES,
    SNAP_ICON: SNAP_ICON,
    createGate: createGate,
    createSnap: createSnap,
    shortcutLabel: shortcutLabel,
    mountButton: mountButton,
  };
  root.HeddySnap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
