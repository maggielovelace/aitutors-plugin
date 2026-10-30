// background.js — Heddy's service worker. The logic is lib/courier.js; this
// file only loads the bundled scripts and connects Chrome's events to it.
importScripts('lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/config.js', 'lib/cid-store.js', 'lib/courier.js', 'lib/crop.js', 'lib/tools.js', 'lib/snap.js', 'lib/page-kind.js', 'lib/panel.js', 'lib/pos.js', 'lib/cards.js');

var cards = null;
var courier = HeddyCourier.createCourier({
  chrome: chrome,
  // "Save to Jotters" on a selection: the words become a card (lib/cards.js).
  collect: function (tab) { return cards.collect(tab); },
  store: HeddyCidStore.createCidStore(),
  randomUUID: function () { return crypto.randomUUID(); },
  // Save to Jotters saved: those cards leave the panel's list (lib/cards.js).
  saved: function (meta) { return cards && cards.saved(meta); },
});

// The toolbar icon opens Heddy's panel in the page (lib/panel.js), or a small
// window where Chrome keeps extensions out; it stays until it is closed.
var panel = HeddyPanel.createPanel({ chrome: chrome });

chrome.action.onClicked.addListener(function (tab) {
  panel.clicked(tab);
});

chrome.windows.onRemoved.addListener(function (windowId) {
  panel.windowRemoved(windowId);
});

// Snap a picture and the three tools (lib/snap.js, lib/tools.js). They open
// their windows through the courier, which answers heddy:ready and
// heddy:result for them like any other kind.
var sender = HeddyTools.createSender({ openCapture: courier.openCapture });
var snap = HeddySnap.createSnap({
  chrome: chrome,
  crop: HeddyCrop,
  tools: HeddyTools,
  makers: { createImageBitmap: createImageBitmap.bind(self), OffscreenCanvas: OffscreenCanvas, Blob: Blob },
  sender: sender,
  // A picture added from the page's own menu or the whole-tab press lands
  // as a card, so the panel opens beside box mode to show it.
  showPanel: panel.show,
});

// The panel's numbered cards and Save to Jotters (lib/cards.js, Round 5).
cards = HeddyCards.createCards({
  chrome: chrome,
  crop: HeddyCrop,
  openCapture: courier.openCapture,
  sender: sender,
  randomUUID: function () { return crypto.randomUUID(); },
  pageFiles: HeddyCourier.PAGE_FILES,
  capture: snap.cropOne,
  showLine: snap.showLine,
  showPanel: panel.show,
  droppedText: function () {
    return HeddyI18n.currentLang(chrome).then(function (lang) { return HeddyI18n.t(lang, 'boxDropped'); });
  },
});

// The /capture window asks for its payload (heddy:ready) and reports
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
  var mine = snap.internal(message, sender) || cards.internal(message, sender);
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

chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
  courier.tabUpdated(tabId, change, tab);
  cards.tabUpdated(tabId, change);
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  cards.tabGone(tabId);
  courier.tabRemoved(tabId);
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
