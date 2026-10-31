// lib/snap.js — Snap a picture (PRD-v0.96.0 D30, D33; artifact R3b · 00,
// R3b · 01, R3b · 04, R3b · 05).
//
// Three parts, one file, because they share the timing rules:
//   createGate      tells one click/press from two (pure, clock injected)
//   createSnap      the background's side: starts box mode in the tab, cuts
//                   a box from a screenshot (for the cards, lib/cards.js, and
//                   Copy picture), and the whole-tab snap
//   mountButton     the popup footer's Snap a picture icon
//
// The ways in (D30, as Round 5 has them): the panel's icon (click = box mode,
// double-click within ~250 ms = the whole visible tab as a picture card),
// right-click an image → "Add picture to Heddy" (that picture as a card), and
// Ctrl Shift K (twice within 0.4 s = the whole visible tab as a card). Every one is a user gesture, which is
// what lets activeTab allow captureVisibleTab and the box-mode script.
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));
  var DOUBLE_CLICK_MS = 250;
  var DOUBLE_PRESS_MS = 400;
  var COMMAND = 'snap-picture';
  var MENU_ID = 'heddy-snap-image';
  // Manrope for the shadow-root UI (lib/fonts.js); first in every injection.
  var FONT_FILES = ['lib/font-data.js', 'lib/fonts.js'];
  // What box mode needs in the page, injected on the gesture (activeTab):
  // its own script, and the layer that numbers the cards on the page.
  var BOX_FILES = FONT_FILES.concat(['lib/messages.js', 'lib/i18n.js', 'lib/marks.js', 'lib/pos.js', 'content/cards-layer.js', 'content/box-mode.js']);
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

  /** Runs in the page: the one-line notice after a navigation cleared the
   *  cards. Text only; gone after 4 s. */
  function showDroppedLine(text) {
    if (!text || document.querySelector('heddy-box-mode')) return;
    var host = document.createElement('heddy-note');
    var shadow = host.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = ':host{all:initial;position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647}' +
      'span{display:block;background:#002147;color:#fff;border-radius:999px;padding:7px 14px;font:600 12.5px "Heddy Manrope",Manrope,Roboto,Arial,sans-serif;white-space:nowrap}';
    var line = document.createElement('span');
    line.setAttribute('role', 'status');
    line.textContent = text;
    shadow.appendChild(style);
    shadow.appendChild(line);
    document.documentElement.appendChild(host);
    setTimeout(function () { host.remove(); }, 4000);
  }

  /** deps: {chrome, sender (lib/tools.js createSender), crop (HeddyCrop),
   *  makers: {createImageBitmap, OffscreenCanvas, Blob}, later,
   *  showPanel(tab) → Promise: opens Heddy's panel on that page if closed} */
  function createSnap(deps) {
    var chrome = deps.chrome;
    var K = deps.crop;
    var T = deps.tools;
    var later = deps.later || setTimeout;
    var pressGate = {};

    function capture(windowId) {
      function once() { return chrome.tabs.captureVisibleTab(windowId, { format: 'png' }); }
      return once().catch(function () {
        return new Promise(function (resolve) { later(resolve, CAPTURE_RETRY_MS); }).then(once);
      });
    }

    /** One box cut from a screenshot of the visible tab: {png, box}. Box
     *  mode hides itself, the panel and the page's numbers first. */
    function cropOne(tab, rect, vw, vh) {
      var r = K.clampBox(rect, vw, vh);
      if (!r) return Promise.reject(new Error('too_small'));
      return capture(tab.windowId).then(function (shot) {
        return K.cropShot(shot, [r], vw, vh, deps.makers);
      }).then(function (out) { return out[0]; });
    }

    /** Box mode in the tab, optionally with the box drawn on the image the
     *  child right-clicked. The pictures it keeps are cards (lib/cards.js). */
    function start(tab, opts) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      return Promise.resolve()
        .then(function () { return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: BOX_FILES }); })
        .then(function () {
          return chrome.tabs.sendMessage(tab.id, Object.assign({ type: 'heddy-box:start' }, opts || {}));
        })
        .then(function () { return { ok: true }; }, function () { return { ok: false }; });
    }

    /** The panel opened (if it is closed), then box mode: what box mode
     *  keeps lands as a card the child can see (D55). */
    function withPanel(tab, opts) {
      return Promise.resolve(deps.showPanel ? deps.showPanel(tab) : null)
        .catch(function () {})
        .then(function () { return start(tab, opts); });
    }

    /** The whole visible tab as the next picture card (a double click on the
     *  snap icon, or Ctrl Shift K twice), as the Heddy menu's Whole visible
     *  page does. Box mode stays on, so the child can save or add another. */
    function whole(tab) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      return withPanel(tab, { whole: true, keep: true });
    }

    /** A watch page's address at the player's second (the desk's crest, Ask
     *  {professor}: the contract's § 6), as youtube.com/watch?v={id}&t={s}.
     *  Any other page, or no time, keeps its address. */
    function atMoment(url, t) {
      var id = P.youtubeIdFromUrl(url);
      if (!id || typeof t !== 'number' || !isFinite(t) || t < 0) return url;
      return 'https://www.youtube.com/watch?v=' + id + '&t=' + Math.floor(t);
    }

    /** heddy-ui:tool from the words tray (lib/tools.js sendTool), or the
     *  desk's crest. The address and title come from the tab, not the page. */
    function wordsTool(tab, m) {
      if (T.TOOLS.indexOf(m.tool) < 0) return Promise.resolve({ ok: false });
      return deps.sender.tool(
        { tool: m.tool, url: atMoment(tab.url, m.t), title: tab.title, quote: m.quote, context: m.context },
        { tabId: tab.id, windowId: tab.windowId }
      );
    }

    /** chrome.runtime.onMessage: the popup's icon and box mode in a page.
     *  Resolves to the reply, or undefined for a message that is not ours. */
    function internal(message, sender) {
      if (!message || typeof message !== 'object' || !sender || sender.id !== chrome.runtime.id) return undefined;
      // Heddy's own pages (the popup, now a frame in the page or a small
      // window) carry a sender.tab too; like content scripts' it is not theirs.
      var own = /^chrome-extension:/.test(String(sender.url || ''));
      var tab = own ? null : sender.tab;
      switch (message.type) {
        case 'heddy-ui:snap': {
          // From the panel, which names the tab. Box mode leaves the panel
          // open beside it (R5b): its cards fill as pictures are kept, and
          // box mode hides it only for each screenshot. The whole tab takes
          // the panel off the page first, so it is not in the picture.
          if (tab) return Promise.resolve({ ok: false });
          return chrome.tabs.get(message.tabId).then(function (t) {
            return message.mode === 'whole' ? start(t, { whole: true, keep: true }) : start(t);
          }, function () { return { ok: false }; });
        }
        case 'heddy-box:crop':
          // Copy picture (the Heddy menu): the crop only, kept nowhere.
          if (!tab || sender.frameId) return Promise.resolve({ ok: false });
          return cropOne(tab, message.rect, message.vw, message.vh).then(
            function (img) { return { ok: true, png: img.png }; },
            function () { return { ok: false }; }
          );
        case 'heddy-ui:undo-card':
          // The "Card made" toast's Undo, from the page it showed on.
          if (!tab || !P.cardIdsOf(message.cardIds)) return Promise.resolve({ ok: false });
          return deps.sender.undoCards(message.cardIds, { tabId: tab.id, windowId: tab.windowId });
        case 'heddy-ui:tool':
          // From the page tray (its tab), or the popup (which names the tab).
          if (tab) return wordsTool(tab, message);
          return chrome.tabs.get(message.tabId).then(function (t) { return wordsTool(t, message); }, function () { return { ok: false }; });
        default:
          return undefined;
      }
    }

    /** chrome.commands.onCommand: once = box mode, twice in 0.4 s = whole
     *  tab; either way with the panel open beside it. */
    function command(name, tab) {
      if (name !== COMMAND || !tab || tab.id == null) return false;
      var g = pressGate[tab.id];
      if (!g) {
        g = pressGate[tab.id] = createGate({
          waitMs: DOUBLE_PRESS_MS,
          later: later,
          clear: deps.clear || clearTimeout,
          // Picture mode always opens the panel (D64): Save to Jotters is there.
          onSingle: function () { delete pressGate[tab.id]; withPanel(tab); },
          onDouble: function () { delete pressGate[tab.id]; whole(tab); },
        });
      }
      g.hit();
      return true;
    }

    /** chrome.contextMenus.onClicked on an image: "Add picture to Heddy".
     *  The picture becomes the next card and box mode stays on beside the
     *  panel. A picture inside a frame starts box mode without a box: box
     *  mode runs in the top page only. */
    function menuClicked(info, tab) {
      if (!info || info.menuItemId !== MENU_ID || !tab) return false;
      var opts = info.frameId ? {} : { srcUrl: typeof info.srcUrl === 'string' ? info.srcUrl : '', keep: true };
      withPanel(tab, opts);
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

    /** One line at the top of a page (the cards a navigation cleared).
     *  Best effort: activeTab may not reach the new page. */
    function showLine(tabId, text) {
      return chrome.scripting.executeScript({ target: { tabId: tabId }, files: FONT_FILES })
        .catch(function () {})
        .then(function () { return chrome.scripting.executeScript({ target: { tabId: tabId }, func: showDroppedLine, args: [String(text || '')] }); })
        .catch(function () {});
    }

    return {
      start: start,
      whole: whole,
      cropOne: cropOne,
      showLine: showLine,
      internal: internal,
      command: command,
      menuClicked: menuClicked,
      installMenu: installMenu,
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

    // Both leave the panel open beside box mode (R5b): its cards fill as
    // pictures are kept, the whole tab among them.
    function go(mode) {
      var done = function () { btn.removeAttribute('aria-pressed'); };
      Promise.resolve()
        .then(function () { return chromeApi.runtime.sendMessage({ type: 'heddy-ui:snap', mode: mode, tabId: opts.tab.id }); })
        .then(done, done);
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
    showDroppedLine: showDroppedLine,
    BOX_FILES: BOX_FILES,
    FONT_FILES: FONT_FILES,
    SNAP_ICON: SNAP_ICON,
    createGate: createGate,
    createSnap: createSnap,
    shortcutLabel: shortcutLabel,
    mountButton: mountButton,
  };
  root.HeddySnap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
