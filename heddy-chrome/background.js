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
  makers: { createImageBitmap: function (blob) { return self.createImageBitmap(blob); }, OffscreenCanvas: self.OffscreenCanvas, Blob: Blob },
  // A picture added from the page's own menu or the whole-tab press lands
  // as a card, so the panel opens beside box mode to show it.
  showPanel: panel.show,
});

// The desk on a YouTube watch page (Round 8, D69–D72): its four requests to
// aitutors.me go from here, with the browser's own aitutors.me cookie, as
// lib/who.js's /me does (lib/desk-api.js).
var safari = chrome.runtime.getURL('/').startsWith('safari-web-extension:');
if (safari) importScripts('lib/safari-site.js', 'lib/who.js');
var requestSite = safari ? HeddySafariFetch.createSafariFetch(chrome) : fetch.bind(self);
var desk = HeddyDeskApi.createDeskApi({ chrome: chrome, fetchImpl: requestSite });

// Round 9 (D78–D86): every save, Undo, card, jot, clip and the Ask view's
// conversation, as requests from here on the same cookie (lib/heddy-api.js,
// lib/web-routes.js). Nothing opens a window.
var heddyApi = HeddyApi.createHeddyApi({ call: desk.call, origin: desk.origin, fetchImpl: requestSite, extensionId: chrome.runtime.id });
var routes = HeddyWebRoutes.createWebRoutes({
  chrome: chrome,
  api: heddyApi,
  cards: {
    saveWeb: function (tab, article, jotterId) { return cards.saveWeb(tab, article, jotterId); },
    undoSave: function (tab, saveId) { return cards.undoSave(tab, saveId); },
  },
  showPanel: panel.show,
  saveJots: desk.saveJots,
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
  if (safari && message && message.type === 'heddy-safari:me' &&
      sender && sender.id === chrome.runtime.id && String(sender.url || '').startsWith(chrome.runtime.getURL('/'))) {
    desk.call('GET', HeddyWho.PATH).then(function (reply) { sendResponse(reply.data); });
    return true;
  }
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

// Safari on iPhone and iPad exposes these actions in Heddy's panel.
var menus = chrome.contextMenus || chrome.menus;
if (menus && menus.onClicked) {
  function installMenus() {
    HeddyI18n.currentLang(chrome).then(function (lang) {
      snap.installMenu(HeddyI18n.t(lang, 'menuAddPicture'));
      courier.installMenus(lang);
    });
  }

  chrome.runtime.onInstalled.addListener(installMenus);
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync' && changes[HeddyI18n.STORAGE_KEY]) installMenus();
  });
  menus.onClicked.addListener(function (info, tab) {
    snap.menuClicked(info, tab);
    courier.menuClicked(info, tab);
  });
}

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function (name, tab) {
    var active = tab ? Promise.resolve(tab) : chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0]; });
    active.then(function (current) {
      snap.command(name, current);
      courier.command(name, current);
    }).catch(function () {});
  });
}
