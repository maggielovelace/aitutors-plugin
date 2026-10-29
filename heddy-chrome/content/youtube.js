// content/youtube.js — Heddy on a YouTube watch page (PRD-v0.96.0 D16, D17;
// artifact R2 · F1 and F2).
//
// Draws Watch with Heddy (filled cream, the eyes mark) and Add to My Clips
// (outlined) straight after YouTube's Share button, inside a closed shadow
// root so neither page can restyle the other; shows Heddy's toasts
// (lib/toast.js); pauses the video when Watch with Heddy hands it to
// Classroom; and takes H for the line being spoken (Phase 2, D18; "H for
// Heddy", owner 2026-10-29). It reads only the video id from the address, the
// player's current time and the video's title, and only when the child taps
// or presses H. Selectors:
// content/youtube-selectors.js, nowhere else.
//
// "From m:ss" on the bar buttons: they use the choice the child last made in
// the popup's Whole video / From m:ss control, Whole video until they make
// one. The window on aitutors.me shows the same choice again before Keep.
(function () {
  if (globalThis.__heddyYouTube) {
    globalThis.__heddyYouTube.refresh();
    return;
  }

  var P = globalThis.HeddyProtocol;
  var I = globalThis.HeddyI18n;
  var M = globalThis.HeddyMarks;
  var T = globalThis.HeddyToast;
  var K = globalThis.HeddyJotKey;
  var SEL = globalThis.HeddyYouTube.SELECTORS;
  var START_KEY = 'startChoice';
  var CHECK_MS = 1500;

  var lang = 'en';
  var tr = I.translator(lang);
  var bar = null; // { host, watch, add }
  var lastId = null;

  /** chrome.runtime.sendMessage, quiet when Heddy was reloaded under the page. */
  function send(message) {
    try {
      return chrome.runtime.sendMessage(message).catch(function () {});
    } catch (e) {
      return Promise.resolve();
    }
  }

  function currentId() {
    return P.youtubeIdFromUrl(location.href);
  }

  function isLive() {
    return !!document.querySelector(SEL.livePlayer);
  }

  function isDark() {
    return document.documentElement.hasAttribute('dark');
  }

  // ─── the two buttons ───────────────────────────────────────────────────────

  var BAR_CSS =
    ':host{all:initial;display:inline-flex;align-items:center;gap:8px;margin-left:8px;flex:none;vertical-align:middle}' +
    'button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;height:36px;border-radius:999px;padding:0 14px;' +
    'font:600 14px/1 Manrope,Roboto,Arial,sans-serif;white-space:nowrap;cursor:pointer;-webkit-font-smoothing:antialiased}' +
    'svg{display:block;flex:none}' +
    '.watch{background:#f2ead8;color:#002147;font-weight:800}' +
    '.add{background:transparent;color:#f1f1f1;font-weight:700;box-shadow:inset 0 0 0 1px #5a5a5a}' +
    ':host(.light) .add{color:#0f0f0f;box-shadow:inset 0 0 0 1px #c6c6c6}' +
    '.watch:hover{background:#ebe1cb}.add:hover{background:rgba(255,255,255,.1)}:host(.light) .add:hover{background:rgba(0,0,0,.05)}' +
    'button:focus-visible{outline:2px solid #3ea6ff;outline-offset:2px}';

  function buildBar() {
    var host = document.createElement('heddy-actions');
    var shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML =
      '<style>' + BAR_CSS + '</style>' +
      M.sprite(['h-eyes', 'h-film']) +
      '<button type="button" class="watch">' + M.use('h-eyes', 20) + '<span></span></button>' +
      '<button type="button" class="add">' + M.use('h-film', 18) + '<span></span></button>';
    var watch = shadow.querySelector('.watch');
    var add = shadow.querySelector('.add');
    watch.addEventListener('click', function () { capture('classroom'); });
    add.addEventListener('click', function () { capture('keep'); });
    return { host: host, watch: watch, add: add };
  }

  function labelBar() {
    if (!bar) return;
    bar.watch.querySelector('span').textContent = tr('watchWithHeddy');
    bar.add.querySelector('span').textContent = tr('addToMyClips');
    bar.host.classList.toggle('light', !isDark());
  }

  function removeBar() {
    if (bar && bar.host.isConnected) bar.host.remove();
  }

  /** Put the buttons after Share, once YouTube has drawn its action bar. */
  function ensureBar() {
    if (!currentId() || isLive()) return removeBar();
    var row = document.querySelector(SEL.actionBar);
    if (!row) return;
    if (!bar) bar = buildBar();
    labelBar();
    if (row.nextElementSibling !== bar.host) row.insertAdjacentElement('afterend', bar.host);
  }

  function capture(then) {
    var id = currentId();
    if (!id) return;
    chrome.storage.local.get(START_KEY).then(
      function (got) { return got && got[START_KEY]; },
      function () { return null; }
    ).then(function (choice) {
      var video = document.querySelector(SEL.video);
      var startSec = P.startSecFor(choice, video ? video.currentTime : NaN);
      return send({ type: 'heddy-ui:capture', youtubeId: id, startSec: startSec, then: then });
    }).catch(function () {});
  }

  // ─── the toast (lib/toast.js: one spec for every Heddy toast, D25) ─────────

  var toaster = T.createToaster({
    document: document,
    marks: M,
    onOpen: function (href) { send({ type: 'heddy-ui:open', href: href }); },
    onUndo: function (jotId, jotterId) { send({ type: 'heddy-ui:undo', jotId: jotId, jotterId: jotterId }); },
    onUndoCards: function (cardIds) { send({ type: 'heddy-ui:undo-card', cardIds: cardIds }); },
  });

  function onToast(msg) {
    toaster.show(T.model(msg, lang, tr));
  }

  // ─── H: the line being spoken (D18; artifact R2 · F3) ──────────────────────
  // H on a watch page that is not live, never while the child types
  // (lib/jot-key.js). YouTube's own keys, J among them, are left alone: Heddy
  // only listens. The press is held 2.5 s so a second H joins the line
  // before, then ONE heddy:moment goes to a window on aitutors.me that does
  // not take focus.

  var hold = K.createJHold({
    now: function () { return Date.now(); },
    setTimer: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimer: function (h) { clearTimeout(h); },
    send: function (j) {
      send({ type: 'heddy-ui:moment', youtubeId: j.video.youtubeId, title: j.video.title, t: j.t, tEnd: j.tEnd });
    },
  });

  function videoTitle() {
    var h = document.querySelector(SEL.title);
    var text = h ? h.textContent.trim() : '';
    return (text || document.title.replace(/\s*-\s*YouTube\s*$/, '')).slice(0, 200) || null;
  }

  function onKeyDown(e) {
    var id = currentId();
    if (!id || isLive() || !K.isJotKey(e, document.activeElement)) return;
    var video = document.querySelector(SEL.video);
    var t = video ? video.currentTime : NaN;
    if (!(typeof t === 'number' && isFinite(t) && t >= 0)) return;
    hideHint();
    hold.press(t, { youtubeId: id, title: videoTitle() });
  }

  // The H hint: once per device, for 6 s, the first time Heddy loads on a
  // watch page (artifact R2 · F1). Bottom left of the player, above its bar.
  var HINT_KEY = 'seenHHint';
  var HINT_MS = 6000;
  var hint = null;
  var hintAsked = false;
  var HINT_CSS =
    ':host{all:initial;position:absolute;left:14px;bottom:56px;z-index:70;pointer-events:none}' +
    '.h{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:#f2ead8;color:#002147;' +
    'font:700 13px Manrope,Roboto,Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.4);white-space:nowrap;-webkit-font-smoothing:antialiased}' +
    'b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;background:#002147;color:#f2ead8;font:700 12px "JetBrains Mono",ui-monospace,Menlo,monospace}';

  function hideHint() {
    if (!hint) return;
    clearTimeout(hint.timer);
    hint.host.remove();
    hint = null;
  }

  function maybeHint() {
    if (hintAsked || !currentId() || isLive()) return;
    var player = document.querySelector(SEL.player);
    if (!player) return;
    hintAsked = true;
    chrome.storage.local.get(HINT_KEY).then(function (got) {
      if (got && got[HINT_KEY]) return;
      var o = {};
      o[HINT_KEY] = true;
      chrome.storage.local.set(o).catch(function () {});
      var host = document.createElement('heddy-hint');
      var shadow = host.attachShadow({ mode: 'closed' });
      shadow.innerHTML = '<style>' + HINT_CSS + '</style><span class="h"><b>H</b><span></span></span>';
      shadow.querySelector('.h > span').textContent = tr('jHint');
      player.appendChild(host);
      hint = { host: host, timer: setTimeout(hideHint, HINT_MS) };
    }).catch(function () {});
  }

  // ─── wiring ────────────────────────────────────────────────────────────────

  function refresh() {
    var id = currentId();
    if (id !== lastId) {
      // An H still waiting goes under the video it was pressed on.
      hold.flush();
      lastId = id;
      send({ type: 'heddy-ui:watch-page', on: !!id });
    }
    ensureBar();
    maybeHint();
  }

  function setLang(next) {
    lang = next;
    tr = I.translator(lang);
    labelBar();
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'heddy-ui:toast') onToast(msg);
    else if (msg.type === 'heddy-ui:pause') {
      var video = document.querySelector(SEL.video);
      if (video && !video.paused) video.pause();
    }
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync' && changes[I.STORAGE_KEY]) I.currentLang().then(setLang);
  });

  // YouTube is a single-page app: a new video is a yt-navigate-finish, not a
  // new page. The interval puts the buttons back if YouTube redraws its bar.
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pagehide', function () { hold.flush(); });
  document.addEventListener('yt-navigate-finish', refresh);
  document.addEventListener('yt-page-data-updated', refresh);
  setInterval(refresh, CHECK_MS);

  globalThis.__heddyYouTube = { refresh: refresh };
  I.currentLang().then(setLang).then(refresh, refresh);
})();
