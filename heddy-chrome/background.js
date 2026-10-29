// background.js — Heddy's service worker. The logic is lib/courier.js; this
// file only loads the bundled scripts and connects Chrome's events to it.
importScripts('lib/messages.js', 'lib/i18n.js', 'lib/protocol.js', 'lib/config.js', 'lib/cid-store.js', 'lib/courier.js', 'lib/crop.js', 'lib/tools.js', 'lib/snap.js');

var courier = HeddyCourier.createCourier({
  chrome: chrome,
  store: HeddyCidStore.createCidStore(),
  randomUUID: function () { return crypto.randomUUID(); },
});

// Snap a picture and the three tools (lib/snap.js, lib/tools.js). They open
// their windows through the courier, which answers heddy:ready and
// heddy:result for them like any other kind.
var snap = HeddySnap.createSnap({
  chrome: chrome,
  crop: HeddyCrop,
  tools: HeddyTools,
  makers: { createImageBitmap: createImageBitmap.bind(self), OffscreenCanvas: OffscreenCanvas, Blob: Blob },
  droppedText: function () {
    return HeddyI18n.currentLang(chrome).then(function (lang) { return HeddyI18n.t(lang, 'boxDropped'); });
  },
  sender: HeddyTools.createSender({ openCapture: courier.openCapture }),
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

// Heddy's own popup, the YouTube content script and the page tray.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var pictures = snap.internal(message, sender);
  if (pictures) {
    pictures.then(function (reply) { sendResponse(reply); }, function () { sendResponse(null); });
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
  snap.tabUpdated(tabId, change);
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  snap.tabGone(tabId);
});

// Right-click an image → "Jot this picture with Heddy" (D30). The menu's
// title follows Heddy's language when it is installed or the language changes.
function installPictureMenu() {
  HeddyI18n.currentLang(chrome).then(function (lang) {
    snap.installMenu(HeddyI18n.t(lang, 'menuJotPicture'));
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

// "Jot it with Heddy" on a selection, and the jot-selection command: both are
// gestures, so activeTab lets Heddy inject the tray into that tab (D3, D7).
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
