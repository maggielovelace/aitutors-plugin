// background.js — Heddy's service worker. The logic is lib/courier.js; this
// file only loads the bundled scripts and connects Chrome's events to it.
importScripts('lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/config.js', 'lib/cid-store.js', 'lib/courier.js', 'lib/crop.js', 'lib/tools.js', 'lib/snap.js', 'lib/page-kind.js', 'lib/panel.js', 'lib/pos.js', 'lib/cards.js', 'lib/desk-api.js', 'lib/desk-ask.js', 'lib/heddy-api.js', 'lib/web-routes.js');

var cards = null;
var courier = HeddyCourier.createCourier({
  chrome: chrome,
  // "Save to Jotters" on a selection: the words become a card (lib/cards.js).
  collect: function (tab) { return cards.collect(tab); },
  store: HeddyCidStore.createCidStore(),
  randomUUID: function () { return crypto.randomUUID(); },
});

// The toolbar icon opens Heddy's panel in the page (lib/panel.js): the desk,
// docked on the right. Where Chrome keeps extensions out, the toolbar popup
// shows it instead (D79); no window opens (D78).
var panel = HeddyPanel.createPanel({ chrome: chrome });

chrome.action.onClicked.addListener(function (tab) {
  panel.clicked(tab);
});

// Snap a picture (lib/snap.js): box mode beside the desk.
var snap = HeddySnap.createSnap({
  chrome: chrome,
  crop: HeddyCrop,
  tools: HeddyTools,
  makers: { createImageBitmap: createImageBitmap.bind(self), OffscreenCanvas: OffscreenCanvas, Blob: Blob },
  // A picture added from the page's own menu or the whole-tab press lands
  // as a card, so the panel opens beside box mode to show it.
  showPanel: panel.show,
});

// The desk on a YouTube watch page (Round 8, D69–D72): its four requests to
// aitutors.me go from here, with the browser's own aitutors.me cookie, as
// lib/who.js's /me does (lib/desk-api.js).
var desk = HeddyDeskApi.createDeskApi({ chrome: chrome, fetchImpl: fetch.bind(self) });

// Round 9 (D78–D86): every save, Undo, card, jot, clip and the Ask view's
// conversation, as requests from here on the same cookie (lib/heddy-api.js,
// lib/web-routes.js). Nothing opens a window.
var heddyApi = HeddyApi.createHeddyApi({ call: desk.call, origin: desk.origin, fetchImpl: fetch.bind(self) });
var routes = HeddyWebRoutes.createWebRoutes({
  chrome: chrome,
  api: heddyApi,
  cards: {
    saveWeb: function (tab, article) { return cards.saveWeb(tab, article); },
    undoSave: function (tab, saveId) { return cards.undoSave(tab, saveId); },
  },
  showPanel: panel.show,
});

// The desk's Sources: the numbered cards and the save (lib/cards.js).
cards = HeddyCards.createCards({
  chrome: chrome,
  crop: HeddyCrop,
  api: heddyApi,
  ask: routes.ask,
  randomUUID: function () { return crypto.randomUUID(); },
  pageFiles: HeddyCourier.PAGE_FILES,
  capture: snap.cropOne,
  showLine: snap.showLine,
  showPanel: panel.show,
  droppedText: function () {
    return HeddyI18n.currentLang(chrome).then(function (lang) { return HeddyI18n.t(lang, 'boxDropped'); });
  },
});

// Full desk's /capture tab asks for its payload (heddy:ready) and reports
// (heddy:result). Only origins in the manifest's externally_connectable can
// reach this, and the courier checks the sender again.
chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  courier.external(message, sender).then(
    function (reply) { sendResponse(reply === undefined ? null : reply); },
    function () { sendResponse(null); }
  );
  return true;
});

// A fresh install opens the first-run page on aitutors.me (PRD D8); an update
// of Heddy or of Chrome does not.
chrome.runtime.onInstalled.addListener(function (details) {
  courier.installed(details);
});

// Heddy's own popup, the YouTube content script and the page tray.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var mine = routes.internal(message, sender) || desk.internal(message, sender) || snap.internal(message, sender) || cards.internal(message, sender);
  if (mine) {
    mine.then(function (reply) { sendResponse(reply); }, function () { sendResponse(null); });
    return true;
  }
  courier.internal(message, sender).then(
    function (reply) { sendResponse(reply); },
    function () { sendResponse(null); }
  );
  return true;
});

// The desk's Ask view: one Port per conversation, the site's lines streamed
// back to it (lib/web-routes.js).
chrome.runtime.onConnect.addListener(function (port) {
  routes.connected(port);
});

chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
  courier.tabUpdated(tabId, change, tab);
  cards.tabUpdated(tabId, change);
  panel.tabUpdated(tabId, change);
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  cards.tabGone(tabId);
  courier.tabRemoved(tabId);
  routes.tabGone(tabId);
  panel.tabGone(tabId);
});

// Right-click an image → "Add picture to Heddy" (D30, D55). The menu's
// title follows Heddy's language when it is installed or the language changes.
function installPictureMenu() {
  HeddyI18n.currentLang(chrome).then(function (lang) {
    snap.installMenu(HeddyI18n.t(lang, 'menuAddPicture'));
  });
}
chrome.runtime.onInstalled.addListener(installPictureMenu);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'sync' && changes[HeddyI18n.STORAGE_KEY]) installPictureMenu();
});
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  snap.menuClicked(info, tab);
});

// Ctrl Shift K (⌘ Shift K on a Mac): box mode; twice within 0.4 s, the whole tab.
chrome.commands.onCommand.addListener(function (command, tab) {
  snap.command(command, tab);
});

// "Save to Jotters" on a selection (the words become a card, D55), and the
// jot-selection command (the tray): both are gestures, so activeTab lets
// Heddy into that tab (D3, D7).
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  courier.menuClicked(info, tab);
});

chrome.commands.onCommand.addListener(function (name, tab) {
  courier.command(name, tab);
});

// The menu item speaks Heddy's language (the options page's switch, D36).
function menusInLang() {
  HeddyI18n.currentLang().then(function (lang) { courier.installMenus(lang); });
}
chrome.runtime.onInstalled.addListener(menusInLang);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'sync' && changes[HeddyI18n.STORAGE_KEY]) menusInLang();
});
