// content/youtube.js — Heddy on a YouTube watch page (PRD-v0.96.0 D16, D17;
// artifact R2 · F1 and F2).
//
// Draws Watch with Heddy (filled cream, the eyes mark) and Add to My Clips
// (outlined) straight after YouTube's Share button, inside a closed shadow
// root so neither page can restyle the other; shows the "In My Clips" toast;
// pauses the video when Watch with Heddy hands it to Classroom. It reads only
// the video id from the address and the player's current time, and only when
// the child taps. Selectors: content/youtube-selectors.js, nowhere else.
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
  var SEL = globalThis.HeddyYouTube.SELECTORS;
  var START_KEY = 'startChoice';
  var TOAST_MS = 4000;
  var CHECK_MS = 1500;

  var lang = 'en';
  var tr = I.translator(lang);
  var bar = null; // { host, watch, add }
  var toast = null; // { host, timer }
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

  // ─── the toast (artifact R2 · F1 step 3) ──────────────────────────────────

  var TOAST_CSS =
    ':host{all:initial;position:fixed;top:16px;right:24px;z-index:2147483647}' +
    '.toast{box-sizing:border-box;width:380px;display:flex;align-items:flex-start;gap:11px;padding:11px 13px;' +
    'background:#fdfcf8;border:1px solid #d9d2c3;border-radius:12px;color:#002147;box-shadow:0 12px 30px rgba(0,0,0,.28);' +
    'font-family:Manrope,Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}' +
    'svg{display:block;flex:none}' +
    '.t{display:grid;gap:1px;min-width:0;flex:1}' +
    '.t b{font:700 14px/1.35 Manrope,Roboto,Arial,sans-serif}' +
    '.t span{font:500 12px/1.35 Manrope,Roboto,Arial,sans-serif;color:#5d6878}' +
    '.o{all:unset;cursor:pointer;font:700 13px/1.35 Manrope,Roboto,Arial,sans-serif;color:#1f6a40;white-space:nowrap;align-self:center}' +
    '.o:hover{text-decoration:underline;text-underline-offset:3px}.o:focus-visible{outline:2px solid #1f6a40;outline-offset:2px;border-radius:4px}';

  function hideToast() {
    if (!toast) return;
    clearTimeout(toast.timer);
    toast.host.remove();
    toast = null;
  }

  /** A toast: a title, an optional line, an optional Open. Text only. */
  function showToast(title, line, href) {
    hideToast();
    var host = document.createElement('heddy-toast');
    var shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML =
      '<style>' + TOAST_CSS + '</style>' + M.sprite(['h-eyes']) +
      '<div class="toast" role="status" aria-live="polite">' + M.use('h-eyes', 26) +
      '<span class="t"><b></b><span></span></span></div>';
    shadow.querySelector('b').textContent = title;
    var sub = shadow.querySelector('.t span');
    if (line) sub.textContent = line;
    else sub.remove();
    if (href) {
      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'o';
      open.textContent = tr('toastOpen');
      open.addEventListener('click', function () {
        send({ type: 'heddy-ui:open', href: href });
        hideToast();
      });
      shadow.querySelector('.toast').appendChild(open);
    }
    document.documentElement.appendChild(host);
    toast = { host: host, timer: setTimeout(hideToast, TOAST_MS) };
  }

  function onToast(msg) {
    if (msg.kind === 'cant_keep') return showToast(tr('toastCantKeep'), null, null);
    var parts = [];
    var topic = P.topicForToast(msg.topic, msg.topicLang, lang);
    if (topic) parts.push(topic);
    if (typeof msg.startSec === 'number') parts.push(tr('toastFrom', P.clockOf(msg.startSec)));
    showToast(tr('toastInMyClips'), parts.join(' · '), typeof msg.href === 'string' ? msg.href : null);
  }

  // ─── wiring ────────────────────────────────────────────────────────────────

  function refresh() {
    var id = currentId();
    if (id !== lastId) {
      lastId = id;
      send({ type: 'heddy-ui:watch-page', on: !!id });
    }
    ensureBar();
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
  document.addEventListener('yt-navigate-finish', refresh);
  document.addEventListener('yt-page-data-updated', refresh);
  setInterval(refresh, CHECK_MS);

  globalThis.__heddyYouTube = { refresh: refresh };
  I.currentLang().then(setLang).then(refresh, refresh);
})();
