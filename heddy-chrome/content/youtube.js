// content/youtube.js — Heddy on a YouTube watch page (PRD-v0.96.0 § 1h,
// D68, D69, D73, D74, D76; artifact round-8-youtube-desk.html #desk).
//
// ONE button straight after YouTube's Share, Watch with Heddy (filled cream,
// the eyes mark), inside a closed shadow root so neither page can restyle
// the other (D68; Add to My Clips left YouTube's bar for the toolbar popup).
// It opens the Professor's desk in YouTube's suggestions column
// (content/desk.js) and is pressed, ringed, while the desk is open; pressing
// it again closes the desk. 📌 on the desk opens it on every video.
//
// H jots the line being spoken into the desk's Jot tab, and only while the
// desk is open (D74): with the desk closed H does nothing, and YouTube's own
// keys are always left alone (Heddy only listens). It also shows Heddy's
// toasts (lib/toast.js) and pauses the video when Full desk hands it to
// Classroom. It reads the video id from the address, the player's time and
// length, and the video's title and channel. Selectors:
// content/youtube-selectors.js, nowhere else.
//
// D76: a copy of this script left in the tab when Heddy is reloaded finds
// chrome.runtime.id gone on its next tick, removes everything it drew and
// stops (lib/desk-model.js createLifeline). A copy from before 0.5.0 has no
// lifeline: reloading the YouTube tab clears it (artifact, "Why three buttons?").
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
  var D = globalThis.HeddyDeskModel;
  var SEL = globalThis.HeddyYouTube.SELECTORS;
  var CHECK_MS = 1500;

  var lang = 'en';
  var tr = I.translator(lang);
  var bar = null; // { host, watch }
  var lastId = null;

  /** chrome.runtime.sendMessage, quiet when Heddy was reloaded under the page. */
  function send(message) {
    try {
      return chrome.runtime.sendMessage(message).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
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

  function videoTitle() {
    var h = document.querySelector(SEL.title);
    var text = h ? h.textContent.trim() : '';
    return (text || document.title.replace(/\s*-\s*YouTube\s*$/, '')).slice(0, 200) || null;
  }

  function channelName() {
    var a = document.querySelector(SEL.channel);
    return a ? a.textContent.trim().slice(0, 100) : null;
  }

  // ─── the desk ──────────────────────────────────────────────────────────────

  var desk = globalThis.HeddyDesk.create({
    chrome: chrome,
    sel: SEL,
    send: send,
    youtubeId: currentId,
    title: videoTitle,
    channel: channelName,
    isDark: isDark,
    onOpenChange: function () { labelBar(); },
  });

  // ─── the button ────────────────────────────────────────────────────────────

  var BAR_CSS =
    ':host{all:initial;display:inline-flex;align-items:center;margin-left:8px;flex:none;vertical-align:middle}' +
    'button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;height:36px;border-radius:999px;padding:0 14px 0 6px;' +
    'font:800 13.5px/1 "Heddy Manrope",Manrope,Roboto,Arial,sans-serif;white-space:nowrap;cursor:pointer;-webkit-font-smoothing:antialiased;background:#f2ead8;color:#002147}' +
    'svg{display:block;flex:none;border-radius:7px}' +
    'button:hover{background:#ebe1cb}' +
    // Pressed while the desk is open (D68): the artifact's .hb.on ring.
    'button[aria-pressed="true"]{box-shadow:0 0 0 2px #0f0f0f,0 0 0 4px #f2ead8}' +
    ':host(.light) button[aria-pressed="true"]{box-shadow:0 0 0 2px #fff,0 0 0 4px #002147}' +
    'button:focus-visible{outline:2px solid #3ea6ff;outline-offset:4px}';

  function buildBar() {
    var host = document.createElement('heddy-actions');
    var shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML =
      '<style>' + BAR_CSS + '</style>' +
      M.sprite(['h-eyes']) +
      '<button type="button" class="watch" aria-pressed="false">' + M.use('h-eyes', 24) + '<span></span></button>';
    var watch = shadow.querySelector('.watch');
    watch.addEventListener('click', function () { desk.toggle(); });
    return { host: host, watch: watch };
  }

  function labelBar() {
    if (!bar) return;
    bar.watch.querySelector('span').textContent = tr('watchWithHeddy');
    bar.watch.setAttribute('aria-pressed', String(desk.isOpen()));
    bar.host.classList.toggle('light', !isDark());
  }

  function removeBar() {
    if (bar && bar.host.isConnected) bar.host.remove();
  }

  /** Put the button after Share, once YouTube has drawn its action bar. */
  function ensureBar() {
    if (!currentId() || isLive()) return removeBar();
    var row = document.querySelector(SEL.actionBar);
    if (!row) return;
    if (!bar) bar = buildBar();
    labelBar();
    if (row.nextElementSibling !== bar.host) row.insertAdjacentElement('afterend', bar.host);
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

  // ─── H: the line being spoken, into the desk (D74) ─────────────────────────
  // Only while the desk is open, on a watch page that is not live, never while
  // the child types (lib/jot-key.js, and the desk's own fields). Closed, H
  // does nothing. The 2.5 s join is the desk's (lib/desk-model.js press).

  function onKeyDown(e) {
    if (!desk.isOpen()) return;
    if (!currentId() || isLive() || !K.isJotKey(e, document.activeElement) || desk.isTyping()) return;
    desk.pressJot();
  }

  // ─── wiring ────────────────────────────────────────────────────────────────

  function refresh() {
    if (!life.check()) return;
    var id = currentId();
    if (id !== lastId) {
      lastId = id;
      send({ type: 'heddy-ui:watch-page', on: !!id });
      // 📌 (D69): the next video opens straight into the desk.
      if (id && !isLive() && desk.pinned() && !desk.isOpen()) desk.open();
    }
    if (!id || isLive()) {
      if (desk.isOpen()) desk.close();
    } else {
      desk.refresh();
    }
    ensureBar();
  }

  function setLang(next) {
    lang = next;
    tr = I.translator(lang);
    desk.setLang(next);
    labelBar();
  }

  function onMessage(msg) {
    if (!life.check() || !msg || typeof msg !== 'object') return;
    if (msg.type === 'heddy-ui:toast') onToast(msg);
    else if (msg.type === 'heddy-ui:pause') {
      var video = document.querySelector(SEL.video);
      if (video && !video.paused) video.pause();
    } else if (msg.type === 'heddy-ui:open-desk') {
      // The popup's faint eyes icon (D75).
      if (currentId() && !isLive() && !desk.isOpen()) desk.open();
    }
  }

  function onStorage(changes, area) {
    if (!life.check()) return;
    if (area === 'sync' && changes[I.STORAGE_KEY]) I.currentLang().then(setLang);
    if (area === 'local') desk.storageChanged(changes);
  }

  function onResize() {
    if (life.check()) desk.resize();
  }

  /** D76: everything this copy drew comes off the page, and it listens no more. */
  function teardown() {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('yt-navigate-finish', refresh);
    document.removeEventListener('yt-page-data-updated', refresh);
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch (e) { /* gone with Heddy */ }
    try { chrome.storage.onChanged.removeListener(onStorage); } catch (e) { /* gone with Heddy */ }
    desk.destroy();
    removeBar();
    bar = null;
    globalThis.__heddyYouTube = null;
  }

  var life = D.createLifeline({
    isAlive: function () { return D.alive(globalThis.chrome); },
    teardown: teardown,
    setInterval: function (fn, ms) { return setInterval(fn, ms); },
    clearInterval: function (h) { clearInterval(h); },
    everyMs: CHECK_MS,
    tick: refresh,
  });

  chrome.runtime.onMessage.addListener(onMessage);
  chrome.storage.onChanged.addListener(onStorage);

  // YouTube is a single-page app: a new video is a yt-navigate-finish, not a
  // new page. The lifeline's interval puts the button back if YouTube redraws
  // its bar, and keeps the desk in its column.
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onResize);
  document.addEventListener('yt-navigate-finish', refresh);
  document.addEventListener('yt-page-data-updated', refresh);
  life.start();

  globalThis.__heddyYouTube = { refresh: refresh };
  Promise.all([I.currentLang(), desk.loadPrefs()]).then(function (got) { setLang(got[0]); }).then(refresh, refresh);
})();
