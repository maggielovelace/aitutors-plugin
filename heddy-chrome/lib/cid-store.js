// lib/cid-store.js — the payloads Heddy is holding for capture windows (D19).
//
// A capture mints a cid and puts its payload here; the window's heddy:ready
// claims it ONCE and the payload is forgotten. A payload nobody claims within
// 10 minutes is dropped (the site's "Heddy is holding this · N more minutes").
// After the claim Heddy keeps only what it needs to answer the window's
// heddy:result on the right YouTube tab, once, for 30 minutes.
//
// Pure: the clock is injected and the state is plain JSON, so the background
// can mirror it to chrome.storage.session and a restarted service worker
// carries on where it stopped.
(function (root) {
  var HOLD_MS = 10 * 60 * 1000;
  var RESULT_MS = 30 * 60 * 1000;

  function createCidStore(options) {
    var opts = options || {};
    var now = opts.now || Date.now;
    var holdMs = opts.holdMs || HOLD_MS;
    var resultMs = opts.resultMs || RESULT_MS;
    // cid → { payload, createdAt, origin, windowId, captureTabId, tabId, then, youtubeId, startSec, kind, title, cut }
    var held = {};
    // cid → { claimedAt, origin, windowId, captureTabId, tabId, then, youtubeId, startSec, kind, title, cut }
    var claimed = {};
    // cid → { doneAt, origin, windowId, captureTabId, tabId } after its result:
    // only so a later Cancel or Close on the same page can still close it.
    var done = {};

    function sweep() {
      var t = now();
      Object.keys(held).forEach(function (cid) {
        if (t - held[cid].createdAt >= holdMs) delete held[cid];
      });
      Object.keys(claimed).forEach(function (cid) {
        if (t - claimed[cid].claimedAt >= resultMs) delete claimed[cid];
      });
      Object.keys(done).forEach(function (cid) {
        if (t - done[cid].doneAt >= resultMs) delete done[cid];
      });
    }

    function key(cid) {
      return typeof cid === 'string' ? cid.toLowerCase() : '';
    }

    /** The window must be the one Heddy opened for this cid, when both are
     *  known; a capture opened as a tab (Watch with Heddy, Add to My Clips)
     *  must also be that tab. */
    function sameWindow(entry, sender) {
      if (entry.windowId != null && sender.windowId != null && entry.windowId !== sender.windowId) return false;
      return entry.captureTabId == null || sender.tabId == null || entry.captureTabId === sender.tabId;
    }

    return {
      /** Hold a payload for a capture window. */
      put: function (cid, entry) {
        sweep();
        held[key(cid)] = {
          payload: entry.payload,
          createdAt: now(),
          origin: entry.origin,
          windowId: entry.windowId == null ? null : entry.windowId,
          captureTabId: null,
          tabId: entry.tabId == null ? null : entry.tabId,
          then: entry.then,
          youtubeId: entry.youtubeId,
          startSec: entry.startSec == null ? null : entry.startSec,
          // Phase 2: what the window was for ('clip', 'moment', 'undo', 'jot',
          // 'page') and what its result needs (the video's title for the toast).
          kind: entry.kind || 'clip',
          title: typeof entry.title === 'string' ? entry.title : null,
          cut: entry.cut === true,
        };
      },

      /** Record the window Chrome opened for a cid. */
      setWindow: function (cid, windowId) {
        var e = held[key(cid)];
        if (e) e.windowId = windowId;
      },

      /** Record the tab Chrome opened for a cid, and the window it is in. */
      setTab: function (cid, tabId, windowId) {
        var e = held[key(cid)];
        if (!e) return;
        e.captureTabId = tabId;
        if (windowId != null) e.windowId = windowId;
      },

      /** The child closed a capture tab: forget its cid, held or claimed.
       *  Returns how many were dropped. */
      dropTab: function (tabId) {
        var n = 0;
        [held, claimed, done].forEach(function (m) {
          Object.keys(m).forEach(function (cid) {
            if (m[cid].captureTabId != null && m[cid].captureTabId === tabId) { delete m[cid]; n++; }
          });
        });
        return n;
      },

      /** Forget a payload whose window never opened. */
      drop: function (cid) {
        delete held[key(cid)];
      },

      /** The payload for heddy:ready, once. Null for an unknown, expired or
       *  already-claimed cid, or a sender other than the window Heddy opened. */
      claim: function (cid, sender) {
        sweep();
        var k = key(cid);
        var e = held[k];
        if (!e || e.origin !== sender.origin || !sameWindow(e, sender)) return null;
        delete held[k];
        claimed[k] = { claimedAt: now(), origin: e.origin, windowId: e.windowId, captureTabId: e.captureTabId == null ? null : e.captureTabId, tabId: e.tabId, then: e.then, youtubeId: e.youtubeId, startSec: e.startSec, kind: e.kind || 'clip', title: e.title == null ? null : e.title, cut: e.cut === true };
        return e.payload;
      },

      /** What heddy:result needs (the YouTube tab, then, the video), once,
       *  and only after the window claimed its payload. */
      takeResult: function (cid, sender) {
        sweep();
        var k = key(cid);
        var e = claimed[k];
        if (!e || e.origin !== sender.origin || !sameWindow(e, sender)) return null;
        delete claimed[k];
        done[k] = { doneAt: now(), origin: e.origin, windowId: e.windowId, captureTabId: e.captureTabId == null ? null : e.captureTabId, tabId: e.tabId };
        return e;
      },

      /** Cancel or Close after the page already reported (the site sends
       *  'cancelled' then): where its tab or window is, once, from the same
       *  page only. Null otherwise. Carries nothing a toast could use. */
      takeDone: function (cid, sender) {
        sweep();
        var k = key(cid);
        var e = done[k];
        if (!e || e.origin !== sender.origin || !sameWindow(e, sender)) return null;
        delete done[k];
        return e;
      },

      /** Minutes left before an unclaimed payload is dropped, or 0. */
      minutesLeft: function (cid) {
        sweep();
        var e = held[key(cid)];
        return e ? Math.ceil((holdMs - (now() - e.createdAt)) / 60000) : 0;
      },

      size: function () {
        sweep();
        return Object.keys(held).length + Object.keys(claimed).length;
      },

      toJSON: function () {
        sweep();
        return { held: held, claimed: claimed, done: done };
      },

      /** Replace the state with one saved by toJSON (a worker restart). */
      load: function (data) {
        held = (data && data.held && typeof data.held === 'object') ? data.held : {};
        claimed = (data && data.claimed && typeof data.claimed === 'object') ? data.claimed : {};
        done = (data && data.done && typeof data.done === 'object') ? data.done : {};
        sweep();
      },
    };
  }

  var api = { HOLD_MS: HOLD_MS, RESULT_MS: RESULT_MS, createCidStore: createCidStore };
  root.HeddyCidStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
