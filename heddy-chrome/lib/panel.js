// lib/panel.js — Heddy's panel: what a click on the toolbar icon opens
// (owner, 2026-10-30; Round 9, D79).
//
// On a web page the panel is the desk, docked on the right with the page
// narrowed, never covered (content/panel.js draws the frame; the frame IS
// popup/popup.html, so every chrome.* call it makes still works, and on an
// ordinary page it draws the desk, popup/web-desk.js). It stays until the
// child closes it: its ✕, Esc, or the icon again.
//
// On a page Chrome keeps from extensions (chrome://, PDFs, the Web Store,
// another extension's page) nothing can be drawn in the page. Round 9 (D78,
// D79) opens no window there: the toolbar popup shows the same panel
// itself. The click that found the page closed to Heddy sets that tab's
// popup and opens it (chrome.action.openPopup); where Chrome does not let an
// extension open its popup, the child's next click on the icon shows it.
// The tab's popup is cleared when it goes to another page.
//
// Chrome passed in, so the tests drive it with a fake (background.js wires it).
(function (root) {
  var K = root.HeddyPageKind || (typeof require === 'function' && require('./page-kind.js'));
  // lib/auto-add.js: the rules content/panel.js applies to a selection (D65).
  var PANEL_FILES = ['lib/auto-add.js', 'content/panel.js'];
  var PAGE = 'popup/popup.html';

  /** popup.html?tab=<id>&host=panel|popup: the tab it acts on, and where it
   *  is drawn. `kind` (lib/page-kind.js) names the page for the popup, which
   *  may not be told the address of a page Chrome keeps to itself. */
  function pageUrl(getURL, tabId, host, kind) {
    return getURL(PAGE) + '?tab=' + encodeURIComponent(String(tabId)) + '&host=' + host + (kind ? '&kind=' + encodeURIComponent(kind) : '');
  }

  /** The same, relative, as chrome.action.setPopup takes it. */
  function popupPath(tabId, kind) {
    return pageUrl(function (p) { return p; }, tabId, 'popup', kind);
  }

  function createPanel(deps) {
    var chrome = deps.chrome;
    // Tabs whose popup Heddy set, until they go to another page.
    var popups = {};

    /** The page is closed to Heddy: the toolbar popup shows the panel there
     *  (D79), never a window. */
    function popupInstead(tab) {
      var kind = tab.url ? K.kindOf(tab.url, chrome.runtime.id) : 'other';
      return Promise.resolve()
        .then(function () { return chrome.action.setPopup({ tabId: tab.id, popup: popupPath(tab.id, kind) }); })
        .then(function () {
          popups[tab.id] = true;
          if (typeof chrome.action.openPopup !== 'function') return { ok: true, where: 'popup', open: false };
          return Promise.resolve()
            .then(function () { return chrome.action.openPopup(tab.windowId != null ? { windowId: tab.windowId } : undefined); })
            .then(function () { return { ok: true, where: 'popup', open: true }; }, function () { return { ok: true, where: 'popup', open: false }; });
        })
        .catch(function () { return { ok: false }; });
    }

    /** chrome.action.onClicked: the panel in the page, opened or closed; on a
     *  page Chrome will not let Heddy draw on, the toolbar popup instead.
     *  The click is the gesture that grants activeTab, so the injection is
     *  allowed. */
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
        .catch(function () { return popupInstead(tab); });
    }

    /** Open the panel on a page if it is not open already (never closes it):
     *  after something was added to the cards from the page's own menu or
     *  bar, or Heddy ▾ asked the desk, so the child sees it. A page Chrome
     *  keeps from extensions has nothing to add. */
    function show(tab) {
      if (!tab || tab.id == null) return Promise.resolve({ ok: false });
      return Promise.resolve()
        .then(function () { return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: PANEL_FILES }); })
        .then(function () { return chrome.tabs.sendMessage(tab.id, { type: 'heddy-panel:open', tabId: tab.id }); })
        .then(function (r) { return { ok: !!(r && r.open) }; }, function () { return { ok: false }; });
    }

    /** Take the panel off a page (before Snap a picture), and resolve once
     *  it is gone from the screen. Nothing to do resolves too. */
    function hide(tabId) {
      return Promise.resolve()
        .then(function () { return chrome.tabs.sendMessage(tabId, { type: 'heddy-panel:close' }); })
        .catch(function () {});
    }

    /** chrome.tabs.onUpdated: a tab whose popup Heddy set goes back to the
     *  icon's click when it goes to another page. */
    function tabUpdated(tabId, change) {
      if (!popups[tabId] || !change || !change.url) return Promise.resolve();
      delete popups[tabId];
      return Promise.resolve()
        .then(function () { return chrome.action.setPopup({ tabId: tabId, popup: '' }); })
        .catch(function () {});
    }

    function tabGone(tabId) {
      delete popups[tabId];
    }

    return { clicked: clicked, show: show, hide: hide, tabUpdated: tabUpdated, tabGone: tabGone };
  }

  var api = { PANEL_FILES: PANEL_FILES, PAGE: PAGE, pageUrl: pageUrl, popupPath: popupPath, createPanel: createPanel };
  root.HeddyPanel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
