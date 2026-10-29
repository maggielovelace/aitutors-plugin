// background.js — Heddy's service worker. The logic is lib/courier.js; this
// file only loads the bundled scripts and connects Chrome's events to it.
importScripts('lib/protocol.js', 'lib/config.js', 'lib/cid-store.js', 'lib/courier.js');

var courier = HeddyCourier.createCourier({
  chrome: chrome,
  store: HeddyCidStore.createCidStore(),
  randomUUID: function () { return crypto.randomUUID(); },
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

// Heddy's own popup and YouTube content script.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  courier.internal(message, sender).then(
    function (reply) { sendResponse(reply); },
    function () { sendResponse(null); }
  );
  return true;
});

chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
  courier.tabUpdated(tabId, change, tab);
});
