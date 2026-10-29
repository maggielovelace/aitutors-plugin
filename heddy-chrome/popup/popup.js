// popup/popup.js — the toolbar popup (artifact R2 · 03, round 2c, R3b · 05).
//
// Four states, Phase 1 only shows what already works (D25, Direction A):
//   first time    the one line, the YouTube line, Open aitutors.me (primary)
//   YouTube watch the video row, Whole video / From m:ss, Watch with Heddy
//                 (primary), Add to My Clips (outlined)
//   aitutors.me   one line of help, no primary, no footer
//   any other     "Heddy works on YouTube videos for now", Open aitutors.me
// Every string from a page (the video's title and channel) is set as text.
(function () {
  var P = HeddyProtocol, C = HeddyConfig, I = HeddyI18n, M = HeddyMarks, SEL = HeddyYouTube.SELECTORS;
  var tr = I.translator('en');

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  /** A button with a constant mark before its label. */
  function button(cls, mark, markSize, label) {
    var b = el('button', cls);
    b.type = 'button';
    if (mark) b.insertAdjacentHTML('beforeend', M.use(mark, markSize));
    b.appendChild(el('span', null, label));
    return b;
  }

  function hostLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function isSite(url, dev) {
    var u;
    try { u = new URL(url); } catch (e) { return false; }
    if (u.protocol === 'https:' && (u.hostname === 'aitutors.me' || /\.aitutors\.me$/.test(u.hostname))) return true;
    return dev && u.origin === C.DEV_ORIGIN;
  }

  function openSite(origin) {
    chrome.tabs.create({ url: origin + '/' }).then(function () { window.close(); }, function () {});
  }

  function drawChrome() {
    $('mark').innerHTML = M.sprite(['h-eyes', 'h-film', 'h-clock', 'h-lock', 'h-open', 'h-cog']) + M.use('h-eyes', 22);
    $('lock').innerHTML = M.use('h-lock', 14);
    $('lockLine').textContent = tr('footerLock');
    var cog = $('settings');
    cog.innerHTML = M.use('h-cog', 21);
    cog.title = tr('settings');
    cog.setAttribute('aria-label', tr('settings'));
    cog.addEventListener('click', function () { chrome.runtime.openOptionsPage(); window.close(); });
  }

  // ─── states ────────────────────────────────────────────────────────────────

  function renderFirstTime(body, origin) {
    $('ctx').textContent = tr('ctxFirstTime');
    body.appendChild(el('p', 'lead big', tr('firstTimeLead')));
    var three = el('div', 'three');
    var line = el('span');
    line.insertAdjacentHTML('beforeend', M.use('h-film', 16));
    line.appendChild(document.createTextNode(tr('firstTimeYouTube')));
    three.appendChild(line);
    body.appendChild(three);
    var open = button('btn wide', 'h-open', 16, tr('openSite'));
    open.addEventListener('click', function () { openSite(origin); });
    body.appendChild(open);
    $('foot').hidden = false;
  }

  function renderOther(body, origin) {
    body.appendChild(el('p', 'lead big', tr('otherPageLine')));
    var open = button('btn wide', 'h-open', 16, tr('openSite'));
    open.addEventListener('click', function () { openSite(origin); });
    body.appendChild(open);
    $('foot').hidden = false;
  }

  function renderSite(body) {
    body.appendChild(el('p', 'here', tr('sitePageLine')));
  }

  /** Runs in the YouTube tab (activeTab, granted by opening this popup). */
  function readVideo(sel) {
    var v = document.querySelector(sel.video);
    var title = document.querySelector(sel.title);
    var channel = document.querySelector(sel.channel);
    return {
      t: v ? v.currentTime : null,
      duration: v && isFinite(v.duration) ? v.duration : null,
      title: title ? title.textContent.trim().slice(0, 200) : null,
      channel: channel ? channel.textContent.trim().slice(0, 100) : null,
    };
  }

  function videoInfo(tab) {
    var fallback = { t: null, duration: null, title: (tab.title || '').replace(/\s*-\s*YouTube\s*$/, '').slice(0, 200) || null, channel: null };
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readVideo, args: [SEL] }).then(
      function (res) {
        var got = res && res[0] && res[0].result;
        if (!got) return fallback;
        return { t: got.t, duration: got.duration, title: got.title || fallback.title, channel: got.channel };
      },
      function () { return fallback; }
    );
  }

  function renderYouTube(body, tab, youtubeId, info, stored) {
    $('ctx').textContent = 'youtube.com';
    var canFrom = P.startSecFor('from', info.t) !== null;
    var choice = stored === 'from' && canFrom ? 'from' : 'whole';

    var vid = el('div', 'vid');
    var th = el('span', 'th');
    th.insertAdjacentHTML('beforeend', M.use('h-film', 24));
    vid.appendChild(th);
    var meta = el('div');
    meta.appendChild(el('b', null, info.title || tr('thisVideo')));
    var sub = [info.channel, info.duration ? P.clockOf(info.duration) : null].filter(Boolean).join(' · ');
    if (sub) meta.appendChild(el('span', 'sub', sub));
    vid.appendChild(meta);
    body.appendChild(vid);

    var seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    var whole = button('', null, 0, tr('wholeVideo'));
    var from = button('', 'h-clock', 14, tr('fromTime', P.clockOf(canFrom ? info.t : 0)));
    from.disabled = !canFrom;
    function paint() {
      whole.setAttribute('aria-pressed', String(choice === 'whole'));
      from.setAttribute('aria-pressed', String(choice === 'from'));
    }
    function pick(c) {
      choice = c;
      paint();
      var o = {};
      o[C.START_KEY] = c;
      chrome.storage.local.set(o).catch(function () {});
    }
    whole.addEventListener('click', function () { pick('whole'); });
    from.addEventListener('click', function () { if (canFrom) pick('from'); });
    seg.appendChild(whole);
    seg.appendChild(from);
    paint();
    body.appendChild(seg);

    var err = el('p', 'err');
    err.hidden = true;
    function go(then, btn) {
      btn.setAttribute('aria-busy', 'true');
      chrome.runtime.sendMessage({
        type: 'heddy-ui:capture',
        youtubeId: youtubeId,
        startSec: choice === 'from' ? P.startSecFor('from', info.t) : null,
        then: then,
        tabId: tab.id,
        windowId: tab.windowId,
      }).then(function (reply) {
        if (reply && reply.ok) return window.close();
        throw new Error('no window');
      }).catch(function () {
        btn.removeAttribute('aria-busy');
        err.textContent = tr('captureFailed');
        err.hidden = false;
      });
    }
    var watch = button('btn wide', 'h-eyes', 18, tr('watchWithHeddy'));
    var add = button('btn ghost wide', 'h-film', 16, tr('addToMyClips'));
    watch.addEventListener('click', function () { go('classroom', watch); });
    add.addEventListener('click', function () { go('keep', add); });
    body.appendChild(watch);
    body.appendChild(add);
    body.appendChild(err);
    $('foot').hidden = false;
  }

  // ─── start ─────────────────────────────────────────────────────────────────

  Promise.all([
    I.currentLang(),
    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0] || null; }, function () { return null; }),
    chrome.storage.local.get([C.DEV_KEY, C.START_KEY, C.FIRST_RUN_KEY]).catch(function () { return {}; }),
  ]).then(function (got) {
    var lang = got[0], tab = got[1], local = got[2] || {};
    tr = I.translator(lang);
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    drawChrome();
    var dev = local[C.DEV_KEY] === true;
    var origin = C.captureOrigin(dev);
    var body = $('body');
    var url = tab && tab.url;
    $('ctx').textContent = url ? hostLabel(url) : '';

    if (!local[C.FIRST_RUN_KEY]) {
      var o = {};
      o[C.FIRST_RUN_KEY] = true;
      chrome.storage.local.set(o).catch(function () {});
      return renderFirstTime(body, origin);
    }
    var youtubeId = url ? P.youtubeIdFromUrl(url) : null;
    if (youtubeId) {
      return videoInfo(tab).then(function (info) { renderYouTube(body, tab, youtubeId, info, local[C.START_KEY]); });
    }
    if (url && isSite(url, dev)) return renderSite(body);
    return renderOther(body, origin);
  });
})();
