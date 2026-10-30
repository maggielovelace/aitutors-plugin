// lib/panel.js — Heddy's panel: what a click on the toolbar icon opens
// (owner, 2026-10-30). Chrome closes a default_popup the moment focus leaves
// it, so the popup now lives in a frame inside the page instead, drawn by
// content/panel.js top right, and stays until the child closes it: its ✕,
// Esc, or the icon again.
//
// The frame IS popup/popup.html, unchanged, so every chrome.* call it makes
// still works. On a page Chrome keeps from extensions (chrome://, the Web
// Store, another extension's page) nothing can be drawn in the page, so the
// same popup opens in a small window of its own near the top right instead,
// which also stays until it is closed.
//
// Chrome passed in, so the tests drive it with a fake (background.js wires it).
(function (root) {
  var PANEL_FILES = ['content/panel.js'];
  var PAGE = 'popup/popup.html';
  // chrome.storage.session: tab id → the fallback window open for it.
  var WINDOWS_KEY = 'heddyPanelWindows';
  // The fallback window, from the browser window it belongs to. The popup
  // resizes it to its content once drawn (popup.js).
  var WINDOW = { width: 376, height: 520, right: 16, top: 80 };

  /** popup.html?tab=<id>&host=panel|window: the tab it acts on, and where it is drawn. */
  function pageUrl(getURL, tabId, host) {
    return getURL(PAGE) + '?tab=' + encodeURIComponent(String(tabId)) + '&host=' + host;
  }

  function windowBounds(win) {
    var b = { width: WINDOW.width, height: WINDOW.height };
    if (win && typeof win.left === 'number' && typeof win.width === 'number') {
      b.left = Math.max(win.left, win.left + win.width - WINDOW.width - WINDOW.right);
    }
    if (win && typeof win.top === 'number') b.top = win.top + WINDOW.top;
    return b;
  }

  function createPanel(deps) {
    var chrome = deps.chrome;
    var session = chrome.storage.session;

    function windowsFor() {
      return Promise.resolve()
        .then(function () { return session.get(WINDOWS_KEY); })
        .then(function (got) { return (got && got[WINDOWS_KEY]) || {}; }, function () { return {}; });
    }

    function saveWindows(map) {
      var o = {};
      o[WINDOWS_KEY] = map;
      return Promise.resolve().then(function () { return session.set(o); }).catch(function () {});
    }

    /** The fallback: a small window, toggled like the panel. */
    function toggleWindow(tab) {
      return windowsFor().then(function (map) {
        var open = map[tab.id];
        var gone = open == null ? Promise.reject(new Error('none')) : chrome.windows.get(open);
        return gone.then(
          function () {
            delete map[tab.id];
            return saveWindows(map)
              .then(function () { return chrome.windows.remove(open); })
              .catch(function () {})
              .then(function () { return { ok: true, where: 'window', open: false }; });
          },
          function () {
            return (tab.windowId != null ? chrome.windows.get(tab.windowId) : chrome.windows.getLastFocused())
              .catch(function () { return null; })
              .then(function (win) {
                return chrome.windows.create(Object.assign({ url: pageUrl(chrome.runtime.getURL, tab.id, 'window'), type: 'popup', focused: true }, windowBounds(win)));
              })
              .then(function (created) {
                if (created && created.id != null) map[tab.id] = created.id;
                return saveWindows(map).then(function () { return { ok: true, where: 'window', open: true }; });
              }, function () { return { ok: false }; });
          }
        );
      });
    }

    /** chrome.action.onClicked: the panel in the page, opened or closed; on a
     *  page Chrome will not let Heddy draw on, the window instead. The click
     *  is the gesture that grants activeTab, so the injection is allowed. */
    function clicked(tab) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      return Promise.resolve()
        .then(function () { return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: PANEL_FILES }); })
        .then(function () { return chrome.tabs.sendMessage(tab.id, { type: 'heddy-panel:toggle', tabId: tab.id }); })
        .then(
          function (r) {
            if (!r || typeof r.open !== 'boolean') throw new Error('no panel');
            return { ok: true, where: 'page', open: r.open };
          }
        )
        .catch(function () { return toggleWindow(tab); });
    }

    /** Take the panel off a page (before Snap a picture), and resolve once
     *  it is gone from the screen. Nothing to do resolves too. */
    function hide(tabId) {
      return Promise.resolve()
        .then(function () { return chrome.tabs.sendMessage(tabId, { type: 'heddy-panel:close' }); })
        .catch(function () {});
    }

    /** chrome.windows.onRemoved: forget a fallback window the child closed. */
    function windowRemoved(windowId) {
      return windowsFor().then(function (map) {
        var changed = false;
        Object.keys(map).forEach(function (k) {
          if (map[k] === windowId) { delete map[k]; changed = true; }
        });
        return changed ? saveWindows(map) : undefined;
      });
    }

    return { clicked: clicked, hide: hide, windowRemoved: windowRemoved };
  }

  var api = { PANEL_FILES: PANEL_FILES, PAGE: PAGE, WINDOWS_KEY: WINDOWS_KEY, WINDOW: WINDOW, pageUrl: pageUrl, windowBounds: windowBounds, createPanel: createPanel };
  root.HeddyPanel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
