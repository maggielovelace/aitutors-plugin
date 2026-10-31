// lib/toast.js — Heddy's one toast (PRD-v0.96.0 D18, D25; artifact R2 · F1 step 3
// and Round 3 · "After J · one toast spec on both hosts").
//
// One module for every toast Heddy shows on a page: "In My Clips" after Add to
// My Clips (Phase 1); after H on YouTube "Note saved · 2:48 — Map scales", the
// quote, Undo and Open in Jotter (Phase 2, the same layout as the desk's
// JotToast); after Jot it "Jotted", the quote, Undo and Open in Jotter; after
// Save page to Jotters "Saved to Jotters · {title}" and Open in Jotter, with the cut line.
// It lives in a closed shadow root at the top right, so neither page can
// restyle the other. Every string from a page or a result is set as text.
//
//   model(msg, lang, tr)  pure: what a heddy-ui:toast message shows
//   createToaster(deps)   the DOM: show(model), hide()
(function (root) {
  var P = root.HeddyProtocol || (typeof require === 'function' && require('./protocol.js'));

  var CLIP_MS = 4000;
  var NOTE_MS = 5000;
  var DONE_MS = 1800;

  /** What a toast message from the background shows, or null. Pure. */
  function model(msg, lang, tr) {
    if (!msg || typeof msg !== 'object') return null;
    switch (msg.kind) {
      case 'desk_jot':
        // H with the desk out of sight (Round 11: another tab, fullscreen):
        // "Jotted · 2:48" and the line, on the video.
        return {
          wide: true,
          title: tr('deskJotToast', P.clockOf(typeof msg.t === 'number' ? msg.t : 0)),
          quote: typeof msg.quote === 'string' && msg.quote ? tr('toastQuote', msg.quote) : null,
          ms: CLIP_MS,
        };
      case 'desk_say':
        // The desk's line for an H it could not jot (nothing being said, no
        // transcript yet), where the desk is out of sight.
        return typeof msg.text === 'string' && msg.text ? { title: msg.text, ms: NOTE_MS } : null;
      case 'cant_keep':
        return { title: tr('toastCantKeep'), ms: CLIP_MS };
      case 'clip': {
        var parts = [];
        var topic = P.topicForToast(msg.topic, msg.topicLang, lang);
        if (topic) parts.push(topic);
        if (typeof msg.startSec === 'number') parts.push(tr('toastFrom', P.clockOf(msg.startSec)));
        return {
          title: tr('toastInMyClips'),
          line: parts.join(' · ') || null,
          open: typeof msg.href === 'string' ? { label: tr('toastOpen'), href: msg.href } : null,
          ms: CLIP_MS,
        };
      }
      case 'clip_added': {
        // Add to My Clips from the popup (owner: C1 + C3's toast): "Added to
        // My Clips · 1:09 – 2:04", a line for a new channel, Open · Undo.
        // The Undo is the popup's too (lib/web-routes.js undoClip).
        var s = typeof msg.startSec === 'number' ? msg.startSec : null;
        var e = typeof msg.endSec === 'number' ? msg.endSec : null;
        var head = msg.duplicate === true ? tr('toastAlreadyInClips') : tr('toastAddedToClips');
        var range = s !== null && e !== null ? P.clockOf(s) + ' – ' + P.clockOf(e) : s ? tr('toastFrom', P.clockOf(s)) : null;
        return {
          title: range ? head + ' · ' + range : head,
          line: (Array.isArray(msg.notices) && msg.notices.indexOf('new_channel') >= 0) ? tr('toastNoticeNewChannel') : null,
          warn: Array.isArray(msg.notices) && msg.notices.indexOf('new_channel') >= 0,
          open: typeof msg.href === 'string' ? { label: tr('toastOpen'), href: msg.href } : null,
          undo: typeof msg.momentId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(msg.momentId) && msg.duplicate !== true ? { label: tr('toastUndo'), momentId: msg.momentId } : null,
          ms: NOTE_MS,
        };
      }
      case 'clip_undone':
        return { title: tr('toastClipUndone'), ms: DONE_MS };
      case 'clip_undo_failed':
        return { title: tr('toastClipUndoFailed'), ms: NOTE_MS };
      case 'signed_out':
        return {
          title: tr('toastSignInClips'),
          open: typeof msg.href === 'string' ? { label: tr('toastSignIn'), href: msg.href } : null,
          ms: NOTE_MS,
        };
      case 'note': {
        // The topic when the site sent one in Heddy's language, else the
        // video's own title (a toast never mixes two languages).
        var name = P.topicForToast(msg.topic, msg.topicLang, lang) || (typeof msg.title === 'string' && msg.title.trim() ? msg.title.trim() : null);
        var time = P.clockOf(typeof msg.t === 'number' ? msg.t : 0);
        return {
          wide: true,
          title: name ? tr('toastNoteSaved', time, name) : tr('toastNoteSavedAt', time),
          quote: typeof msg.quote === 'string' && msg.quote ? tr('toastQuote', msg.quote) : null,
          undo: typeof msg.jotId === 'string' && P.isCaptureId(msg.jotId) ? { label: tr('toastUndo'), jotId: msg.jotId } : null,
          open: typeof msg.href === 'string' ? { label: tr('toastOpenInJotter'), href: msg.href, quiet: true } : null,
          ms: NOTE_MS,
        };
      }
      case 'jotted':
        // A web jot's Undo needs its Jotter too (heddy:undo jotterId); without
        // one the site could not find it, so there is no Undo to offer.
        return {
          wide: true,
          title: tr('toastJotted'),
          quote: typeof msg.quote === 'string' && msg.quote ? tr('toastQuote', msg.quote) : null,
          undo: P.isCaptureId(msg.jotId) && P.isCaptureId(msg.jotterId) ? { label: tr('toastUndo'), jotId: msg.jotId, jotterId: msg.jotterId } : null,
          open: typeof msg.href === 'string' ? { label: tr('toastOpenInJotter'), href: msg.href, quiet: true } : null,
          ms: NOTE_MS,
        };
      case 'clipped': {
        var page = typeof msg.title === 'string' && msg.title.trim() ? msg.title.trim() : null;
        return {
          wide: true,
          title: page ? tr('toastClipped', page) : tr('toastClippedNoTitle'),
          line: msg.cut === true ? tr('toastPageCut') : null,
          open: typeof msg.href === 'string' ? { label: tr('toastOpenInJotter'), href: msg.href, quiet: true } : null,
          ms: NOTE_MS,
        };
      }
      case 'saved': {
        // Save to Jotters (Round 5, D54): no Undo, as the result names saves,
        // not a jot; no Open in Jotter after Save and jot now (its tab is
        // already the notebook).
        var jotter = typeof msg.title === 'string' && msg.title.trim() ? msg.title.trim() : null;
        return {
          wide: true,
          title: jotter ? tr('toastClipped', jotter) : tr('toastClippedNoTitle'),
          open: typeof msg.href === 'string' ? { label: tr('toastOpenInJotter'), href: msg.href, quiet: true } : null,
          ms: NOTE_MS,
        };
      }
      case 'no_captions':
        // D59: /capture/clip refused a video whose captions are none.
        return { title: tr('toastNoCaptions'), ms: NOTE_MS };
      case 'card':
        // Make a card (owner, 2026-10-29): Undo deletes the cards it made.
        return {
          wide: true,
          title: tr('toastCardMade'),
          undo: P.cardIdsOf(msg.cardIds) ? { label: tr('toastUndo'), cardIds: P.cardIdsOf(msg.cardIds) } : null,
          open: typeof msg.href === 'string' ? { label: tr('toastOpenInJotter'), href: msg.href, quiet: true } : null,
          ms: NOTE_MS,
        };
      case 'card_undone':
        return { title: tr('toastCardDeleted'), ms: DONE_MS };
      case 'card_undo_failed':
        return { title: tr('toastCardUndoFailed'), ms: NOTE_MS };
      case 'undone':
        return { title: tr('toastJotDeleted'), ms: DONE_MS };
      case 'undo_failed':
        return { title: tr('toastUndoFailed'), ms: NOTE_MS };
      default:
        return null;
    }
  }

  var CSS =
    ':host{all:initial;position:fixed;top:16px;right:24px;z-index:2147483647}' +
    '.t span.w{color:#9a6b12;font-weight:600}' +
    '.toast{box-sizing:border-box;width:380px;display:flex;align-items:flex-start;gap:11px;padding:11px 13px;' +
    'background:#fdfcf8;border:1px solid #d9d2c3;border-radius:12px;color:#002147;box-shadow:0 12px 30px rgba(0,0,0,.28);' +
    'font-family:"Heddy Manrope",Manrope,Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.toast.wide{width:400px}' +
    'svg{display:block;flex:none}' +
    '.t{display:grid;gap:1px;min-width:0;flex:1}' +
    '.t b{font:700 14px/1.35 "Heddy Manrope",Manrope,Roboto,Arial,sans-serif}' +
    '.t span{font:500 12px/1.35 "Heddy Manrope",Manrope,Roboto,Arial,sans-serif;color:#5d6878}' +
    '.t q{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;quotes:none;margin-top:4px;' +
    'font:500 13px/1.45 "Source Serif 4",Georgia,serif;color:#14253f;overflow-wrap:anywhere}' +
    '.o{display:flex;flex-direction:column;align-items:flex-end;gap:8px;align-self:center}' +
    '.toast.wide .o{align-self:flex-start}' +
    '.o button{all:unset;cursor:pointer;font:700 13px/1.35 "Heddy Manrope",Manrope,Roboto,Arial,sans-serif;color:#1f6a40;white-space:nowrap}' +
    '.o button.q{font:600 12px/1.35 "Heddy Manrope",Manrope,Roboto,Arial,sans-serif;color:#5d6878;text-decoration:underline;text-underline-offset:3px}' +
    '.o button:hover{text-decoration:underline;text-underline-offset:3px}' +
    '.o button:focus-visible{outline:2px solid #1f6a40;outline-offset:2px;border-radius:4px}';

  /**
   * deps: { document, marks (HeddyMarks), onOpen(href), onUndo(jotId, jotterId|null),
   *         onUndoCards(cardIds) (Make a card's Undo),
   *         mount() → where the toast goes (the fullscreen element while
   *         there is one; the page's root otherwise),
   *         setTimeout, clearTimeout }
   */
  function createToaster(deps) {
    var doc = deps.document;
    var later = deps.setTimeout || setTimeout;
    var cancel = deps.clearTimeout || clearTimeout;
    var M = deps.marks;
    var current = null; // { host, timer }

    function hide() {
      if (!current) return;
      cancel(current.timer);
      current.host.remove();
      current = null;
    }

    function action(cls, label, onClick) {
      var b = doc.createElement('button');
      b.type = 'button';
      if (cls) b.className = cls;
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    }

    /** Show a model (from model()); replaces any toast already showing. */
    function show(m) {
      hide();
      if (!m) return null;
      var host = doc.createElement('heddy-toast');
      var shadow = host.attachShadow({ mode: 'closed' });
      // Constant markup only; every string below goes in as text.
      shadow.innerHTML =
        '<style>' + CSS + '</style>' + M.sprite(['h-eyes']) +
        '<div class="toast" role="status" aria-live="polite">' + M.use('h-eyes', 26) +
        '<span class="t"><b></b></span></div>';
      var box = shadow.querySelector('.toast');
      if (m.wide) box.classList.add('wide');
      var t = shadow.querySelector('.t');
      t.querySelector('b').textContent = m.title;
      if (m.line) {
        var line = doc.createElement('span');
        // A check that needs a grown-up's eye (a new channel): the artifact's amber.
        if (m.warn) line.className = 'w';
        line.textContent = m.line;
        t.appendChild(line);
      }
      if (m.quote) {
        var q = doc.createElement('q');
        q.textContent = m.quote;
        t.appendChild(q);
      }
      if (m.undo || m.open) {
        var o = doc.createElement('span');
        o.className = 'o';
        if (m.undo && m.undo.momentId) {
          var momentId = m.undo.momentId;
          o.appendChild(action('', m.undo.label, function () { hide(); if (deps.onUndoClip) deps.onUndoClip(momentId); }));
        } else if (m.undo && m.undo.cardIds) {
          var cardIds = m.undo.cardIds;
          o.appendChild(action('', m.undo.label, function () { hide(); if (deps.onUndoCards) deps.onUndoCards(cardIds); }));
        } else if (m.undo) {
          var jotId = m.undo.jotId;
          var jotterId = m.undo.jotterId || null;
          o.appendChild(action('', m.undo.label, function () { hide(); deps.onUndo(jotId, jotterId); }));
        }
        if (m.open) {
          var href = m.open.href;
          o.appendChild(action(m.open.quiet ? 'q' : '', m.open.label, function () { hide(); deps.onOpen(href); }));
        }
        box.appendChild(o);
      }
      (deps.mount && deps.mount() || doc.documentElement).appendChild(host);
      current = { host: host, timer: later(hide, m.ms) };
      return host;
    }

    return { show: show, hide: hide };
  }

  var api = { CLIP_MS: CLIP_MS, NOTE_MS: NOTE_MS, DONE_MS: DONE_MS, model: model, createToaster: createToaster };
  root.HeddyToast = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
