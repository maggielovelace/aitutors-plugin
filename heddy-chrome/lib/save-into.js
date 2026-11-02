// lib/save-into.js — "Save into" on the web desk (site PRD-v0.122.0 R30,
// R14 and Appendix A; artifact 8wyNVxSwnQGYBikHswnaxe, Round 8, Proposal 1,
// "A quiet Into line that opens a list" — the spec, matched literally).
//
// One line above the Save button: INTO [JOT-27] Photosynthesis homework ▾.
// Tapping it opens a list over the cards: "This page" (this page's Jotter,
// or "A new Jotter for this page"), "Recent" (the child's Jotters from
// GET /api/learn/heddy/jotters, each a key chip, its title and a short
// time), a key box that filters the list here, a rule, and "Keep saving into
// JOT-n today". The button then names where the save goes.
//
// The default never changes for a child who never opens the list: "This
// page" sends no jotterId and the site picks this page's Jotter (R8).
//
// Keep saving (R14): {jotterId, key, title, day} in chrome.storage.local,
// `day` the local YYYY-MM-DD. It is applied on every page until local
// midnight, or until the child picks another option.
//
// Every Jotter title is the child's own text, from the site: it is set as
// text (textContent), never as HTML. Nothing here makes a request; the list
// comes from Heddy's background (lib/heddy-api.js).
(function (root) {
  var INTO_KEY = 'heddySaveInto';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var JOT_KEY = /^JOT-\d{1,9}$/;

  function isUuid(x) {
    return typeof x === 'string' && UUID.test(x);
  }

  function text(x, max) {
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** The local calendar day, YYYY-MM-DD (not UTC: R14 is the child's midnight). */
  function localDay(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Milliseconds until the next local midnight. */
  function msToMidnight(d) {
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return Math.max(1000, next.getTime() - d.getTime());
  }

  // ─── keep saving (R14) ──────────────────────────────────────────────────

  /** The stored keep-saving choice, if it is still today's; else null. */
  function keepOf(stored, now) {
    if (!stored || typeof stored !== 'object') return null;
    if (!isUuid(stored.jotterId) || typeof stored.day !== 'string' || !DAY.test(stored.day)) return null;
    if (stored.day !== localDay(now)) return null;
    return {
      jotterId: stored.jotterId,
      key: typeof stored.key === 'string' && JOT_KEY.test(stored.key) ? stored.key : null,
      title: text(stored.title, 120),
      day: stored.day,
    };
  }

  /** What is stored when the child ticks "Keep saving": the Jotter's id,
   *  key and title, and today. Nothing else. Null for a target with no id. */
  function keepFor(target, now) {
    if (!target || !isUuid(target.id)) return null;
    return { jotterId: target.id, key: target.key || null, title: target.title || '', day: localDay(now) };
  }

  // ─── the target ─────────────────────────────────────────────────────────
  //
  // { kind: 'new' }                         "A new Jotter for this page": no jotterId
  // { kind: 'page', id, key, title }        this page's Jotter, once known: no jotterId
  // { kind: 'page', id: null }              this page's Jotter, not known (a site
  //                                         without the page hint): no jotterId
  //
  // `page` (the site's hint): an object, this page's Jotter; null, said
  // plainly by the site, none yet; undefined, not known.
  // { kind: 'jotter', id, key, title }      a Jotter the child picked: its jotterId

  var NEW = { kind: 'new' };
  var UNKNOWN = { kind: 'page', id: null, key: null, title: '' };

  /** "This page" for a page hint: its Jotter, a new one (null), or not known. */
  function pageTarget(page) {
    if (page === undefined) return UNKNOWN;
    if (page && isUuid(page.id)) return { kind: 'page', id: page.id, key: page.key || null, title: page.title || '' };
    return NEW;
  }

  function jotterTarget(j) {
    return { kind: 'jotter', id: j.id, key: j.key || null, title: j.title || '' };
  }

  /** The default, in order: keep saving (today's), this page's Jotter, a new one. */
  function defaultTarget(keep, page) {
    if (keep) return { kind: 'jotter', id: keep.jotterId, key: keep.key, title: keep.title };
    return pageTarget(page);
  }

  /** "This page" is one option, whether its Jotter is known or not. */
  function sameTarget(a, b) {
    if (!a || !b) return false;
    var pa = a.kind !== 'jotter';
    var pb = b.kind !== 'jotter';
    if (pa || pb) return pa && pb;
    return a.id === b.id;
  }

  /** Picking an option: the new target, and keep saving kept only if the
   *  child picked the Jotter it names (R14: "until the child picks another"). */
  function pick(target, keep) {
    return { target: target, keep: keep && target && target.id === keep.jotterId ? keep : null };
  }

  /** The chosen Jotter has gone (App. A 6; the site's 404 jotter_gone):
   *  nothing was saved. Keep saving ends, "This page" is selected (this
   *  page's Jotter if it is known and is not the one that went, else "A new
   *  Jotter for this page"), the list is closed, and the child is told. The
   *  caller clears the stored keep saving and fetches the list again. */
  function afterGone(page, gone) {
    // The Jotter that went was this page's: there is none now. Otherwise
    // what is known (or not) about this page stays.
    var still = page && gone && page.id === gone.id ? null : page;
    return {
      keep: null,
      page: still,
      target: defaultTarget(null, still),
      picked: false,
      open: false,
      query: '',
      error: { key: 'intoGone', name: nameOf(gone) },
    };
  }

  // ─── the desk's state for the line ──────────────────────────────────────
  //
  // mode: 'off'  no line, and no jotterId (signed out, a grown-up, or the
  //              list failed with no keep saving);
  //       'wait' today's keep saving is shown at once, and Save is held
  //              until the list answers;
  //       'list' a child: the line and the list;
  //       'keep' the list failed, but today's keep saving (stored in this
  //              browser by a child's own tick) still applies: the site
  //              checks the id, and jotter_gone recovers.
  // page: the site's hint (pageTarget). url: the page the line is about.
  // Each function changes `into` in place and returns it.

  function freshInto(url) {
    return { mode: 'off', show: false, jotters: [], keep: null, page: undefined, learned: false, target: UNKNOWN, picked: false, open: false, query: '', url: url || null };
  }

  function setMode(into, m) {
    into.mode = m;
    into.show = m !== 'off';
    if (m === 'off') into.open = false;
    return into;
  }

  /** Today's keep saving as a row of the list. */
  function keepRow(k) {
    return { id: k.jotterId, key: k.key, title: k.title, at: null };
  }

  /** The panel opens with today's keep saving: show it now, hold Save. */
  function withKeep(into, keep) {
    into.keep = keep;
    if (!keep || into.mode !== 'off') return into;
    setMode(into, 'wait');
    into.jotters = [keepRow(keep)];
    if (!into.picked) into.target = defaultTarget(keep, into.page);
    return into;
  }

  /** The list's answer (lib/heddy-api.js parseJotters, through a message:
   *  an undefined `page` arrives missing). */
  function withList(into, r) {
    if (r && r.show === true && Array.isArray(r.jotters)) {
      setMode(into, 'list');
      into.jotters = r.jotters;
      if (r.page !== undefined) {
        // The site's hint: this page's Jotter, or null for a new one.
        into.page = r.page && isUuid(r.page.id) ? { id: r.page.id, key: r.page.key || null, title: r.page.title || '' } : null;
        into.learned = false;
      } else if (!into.learned) {
        // An older site: not known (unless this desk just saved this page).
        into.page = undefined;
      }
    } else if (r && r.known === true) {
      setMode(into, 'off');
      into.jotters = [];
    } else if (into.keep) {
      setMode(into, 'keep');
      into.jotters = [keepRow(into.keep)];
    } else {
      setMode(into, 'off');
      into.jotters = [];
    }
    if (into.page && !into.page.key) {
      var hit = into.jotters.filter(function (j) { return j.id === into.page.id; })[0];
      if (hit) into.page = { id: hit.id, key: hit.key, title: hit.title || into.page.title };
    }
    if (!into.picked) into.target = defaultTarget(into.keep, into.page);
    else if (into.target.kind === 'page') into.target = pageTarget(into.page);
    return into;
  }

  /** The tab is on another page now (a single-page site changed its
   *  address): what was known about the old page's Jotter goes, an unpicked
   *  or "This page" target is about the new page. A Jotter the child picked
   *  stays. The caller asks for the list again. */
  function withNavigation(into, url) {
    into.url = url;
    into.page = undefined;
    into.learned = false;
    if (!into.picked || into.target.kind !== 'jotter') {
      into.picked = false;
      into.target = defaultTarget(into.keep, undefined);
    }
    return into;
  }

  /** Save waits while today's keep saving waits for the list. */
  function saveHeld(into) {
    return into.mode === 'wait';
  }

  /** Where a save goes: the line's target, or (no line) this page's. */
  function targetOf(into) {
    return into.show ? into.target : NEW;
  }

  /** The save's extra field: jotterId only for a Jotter the child chose. */
  function bodyOf(target) {
    return target && target.kind === 'jotter' && isUuid(target.id) ? { jotterId: target.id } : {};
  }

  /** "JOT-27", or the title when there is no key, or null. */
  function nameOf(target) {
    if (!target || target.kind === 'new') return null;
    return target.key || target.title || null;
  }

  /** The button's words: it always names where the save goes. A new Jotter
   *  keeps the existing wording ("Save 2 to my Jotters"). */
  function buttonLabel(tr, n, target) {
    var name = nameOf(target);
    if (!name) return n ? (n === 1 ? tr('saveOne') : tr('saveN', String(n))) : tr('savePage');
    if (!n) return tr('intoSavePage', name);
    return n === 1 ? tr('intoSaveOne', name) : tr('intoSaveN', String(n), name);
  }

  // ─── the list ───────────────────────────────────────────────────────────

  /** The key box filters locally: "31", "jot31", "JOT-31" find JOT-31 (and
   *  JOT-310…); any other words find a title that contains them. */
  function filterJotters(list, q) {
    var s = String(q || '').trim();
    if (!s) return list.slice();
    var digits = /^(?:jot)?\s*-?\s*(\d+)$/i.exec(s);
    var low = s.toLowerCase();
    return list.filter(function (j) {
      if (digits) {
        var m = j.key && /^JOT-(\d+)$/.exec(j.key);
        return !!m && m[1].indexOf(digits[1]) === 0;
      }
      return (j.key && j.key.toLowerCase().indexOf(low) >= 0) || String(j.title || '').toLowerCase().indexOf(low) >= 0;
    });
  }

  /** The options in order: "This page" first, then Recent (this page's
   *  Jotter is not repeated there), filtered by the key box. */
  function optionsOf(jotters, page, q) {
    var first = pageTarget(page);
    var rest = filterJotters(jotters.filter(function (j) { return !(page && j.id === page.id); }), q);
    return [first].concat(rest.map(function (j) { return Object.assign(jotterTarget(j), { at: j.at }); }));
  }

  /** ↑ ↓ through the options, wrapping. */
  function step(i, dir, count) {
    if (!count) return -1;
    if (i < 0) return dir > 0 ? 0 : count - 1;
    return (i + dir + count) % count;
  }

  /** "now", "10 min", "3 h", "Tue", then "12 Oct" (zh: 刚刚, 10 分钟, 3 小时, 周二, 10月12日). */
  function relTime(tr, lang, at, now) {
    if (typeof at !== 'number' || !isFinite(at)) return '';
    var ms = now.getTime() - at;
    if (ms < 60000) return tr('intoNow');
    if (ms < 3600000) return tr('intoMins', String(Math.floor(ms / 60000)));
    var then = new Date(at);
    var loc = lang === 'zh_CN' ? 'zh-CN' : 'en-GB';
    if (localDay(then) === localDay(now)) return tr('intoHours', String(Math.floor(ms / 3600000)));
    try {
      if (ms < 6 * 86400000) return new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(then);
      return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(then);
    } catch (e) {
      return localDay(then);
    }
  }

  // ─── the view ───────────────────────────────────────────────────────────

  function css(SANS, MONO) {
    return [
      // the line (.r8into, .r8key, .r8key.new, the "today" tag)
      '.cd .ito{position:relative;flex:none}',
      '.cd .ito .il{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;font:500 12px ' + SANS + ';color:#4a5263;background:#fff;border:1px solid #e0dacd;border-radius:9px;padding:6px 8px;min-width:0;text-align:left;cursor:pointer}',
      '.cd .ito .il:focus-visible{outline:2px solid var(--sc);outline-offset:2px}',
      '.cd .ito .il .l{color:#8a8f9c;flex:none;font:600 10.5px ' + MONO + ';text-transform:uppercase;letter-spacing:.04em}',
      '.cd .ito .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:#1b2140}',
      '.cd .ito .il .cv{margin-left:auto;color:#8a8f9c;flex:none}',
      '.cd .ito .ky{flex:none;font:600 11px ' + MONO + ';color:#23306b;background:#e8ebf7;border:1px solid #cfd6f1;border-radius:6px;padding:1px 6px}',
      '.cd .ito .ky.new{color:#8a5a00;background:#fff8e6;border-color:#f0d49a}',
      '.cd .ito .td{flex:none;font:600 10.5px ' + SANS + ';color:#23306b;background:#eef0f8;border-radius:999px;padding:1px 7px}',
      // the list (.r8pop), over the cards
      '.cd .ito .ip{position:absolute;text-align:left;left:0;right:0;bottom:calc(100% + 6px);z-index:4;background:#fff;border:1px solid #e0dacd;border-radius:11px;box-shadow:0 12px 30px rgba(0,0,0,.12);padding:6px;font:500 12.5px ' + SANS + ';color:#1f2433;display:flex;flex-direction:column;gap:2px;max-height:min(420px,calc(100vh - 220px));box-sizing:border-box}',
      '.cd .ito .ip[hidden]{display:none}',
      '.cd .ito .lb{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;align-items:stretch;gap:2px;overflow:auto;min-height:0}',
      '.cd .ito .sec{font:600 10px ' + MONO + ';color:#8a8f9c;text-transform:uppercase;letter-spacing:.05em;padding:6px 7px 2px}',
      '.cd .ito .it{display:flex;justify-content:flex-start;width:100%;box-sizing:border-box;align-items:center;gap:7px;padding:6px 7px;border-radius:7px;min-width:0;cursor:pointer}',
      '.cd .ito .it .t{font-weight:500;color:#1f2433}',
      '.cd .ito .it.ac{background:#f7f5ef}',
      '.cd .ito .it[aria-selected="true"]{background:#f4f5fc;box-shadow:inset 0 0 0 1px #c9cdf0}',
      '.cd .ito .it small{margin-left:auto;flex:none;color:#8a8f9c;font:500 10.5px ' + MONO + '}',
      '.cd .ito .none{padding:6px 7px;color:#8a8f9c;font-size:12px}',
      '.cd .ito .sr{border:1px solid #d9d2c3;border-radius:7px;padding:5px 8px;font:500 11.5px ' + MONO + ';color:#1f2433;margin:2px 2px 4px;background:#fff;outline:0;min-width:0}',
      '.cd .ito .sr::placeholder{color:#9aa0ad}',
      '.cd .ito .sr:focus-visible{border-color:#4338ca}',
      '.cd .ito hr{border:0;border-top:1px solid #ece7dc;margin:3px 2px;width:auto}',
      '.cd .ito .kp{display:flex;gap:7px;align-items:center;font:500 12px ' + SANS + ';color:#4a5263;padding:4px 7px;cursor:pointer;position:relative}',
      '.cd .ito .kp input{position:absolute;opacity:0;width:14px;height:14px;margin:0;left:7px}',
      '.cd .ito .kp i{width:14px;height:14px;border-radius:4px;border:1.5px solid #a7abb5;background:#fff;flex:none;box-sizing:border-box;display:grid;place-items:center;color:#fff;font:800 10px/1 ' + SANS + ';font-style:normal}',
      '.cd .ito .kp input:checked + i{background:#4338ca;border-color:#4338ca}',
      '.cd .ito .kp input:focus-visible + i{outline:2px solid #4338ca;outline-offset:2px}',
    ].join('\n');
  }

  var seq = 0;

  /**
   * The Into line and its list. Every title goes in as text.
   *
   * o: { doc, tr, lang, now() → Date, target, keep (today's or null),
   *      jotters, page, open, query, busy,
   *      onPick(target), onKeep(on), onOpen(open, refocus), onQuery(q) }
   * The caller draws it again on every change (except typing in the key
   * box), and puts the focus back with focusLine / focusBox / focusKeep.
   * Returns { el, line, box, focusLine(), focusBox(), focusKeep(), cleanup() }.
   */
  function draw(o) {
    var doc = o.doc;
    var tr = o.tr;
    var id = 'heddy-into-' + (++seq);

    function el(tag, cls, words) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (words !== undefined && words !== null) e.textContent = words;
      return e;
    }

    function chip(target) {
      if (target.kind === 'new') return el('span', 'ky new', tr('intoNewChip'));
      return target.key ? el('span', 'ky', target.key) : null;
    }

    function titleOf(target) {
      if (target.kind === 'new') return tr('intoNewPage');
      if (target.kind === 'page' && !target.id) return tr('intoThisPageJotter');
      return target.title || target.key || tr('intoUntitled');
    }

    var wrap = el('div', 'ito');
    var line = el('button', 'il');
    line.type = 'button';
    line.setAttribute('aria-haspopup', 'listbox');
    line.setAttribute('aria-expanded', String(!!o.open));
    line.setAttribute('aria-controls', id + '-list');
    if (o.busy) line.disabled = true;
    line.appendChild(el('span', 'l', tr('intoLabel')));
    var c = chip(o.target);
    if (c) line.appendChild(c);
    line.appendChild(el('span', 't', titleOf(o.target)));
    var today = !!(o.keep && o.target && o.target.id === o.keep.jotterId);
    if (today) line.appendChild(el('span', 'td', tr('intoToday')));
    line.appendChild(el('span', 'cv', '▾'));
    var name = o.target.kind === 'new' || !o.target.id ? titleOf(o.target) : (o.target.key ? o.target.key + ' · ' : '') + titleOf(o.target);
    line.setAttribute('aria-label', tr('intoLineLabel', name) + (today ? ' · ' + tr('intoToday') : ''));
    wrap.appendChild(line);

    var pop = el('div', 'ip');
    pop.hidden = !o.open;
    var list = el('ul', 'lb');
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', tr('intoListLabel'));
    var box = el('input', 'sr');
    box.type = 'text';
    box.setAttribute('placeholder', tr('intoKeyBox'));
    box.setAttribute('aria-label', tr('intoKeyBox'));
    box.setAttribute('aria-controls', list.id);
    box.setAttribute('autocomplete', 'off');
    box.setAttribute('spellcheck', 'false');
    box.value = o.query || '';

    var opts = [];
    var rows = [];
    var active = -1;

    function setActive(i) {
      active = i;
      rows.forEach(function (r, k) { r.className = 'it' + (k === i ? ' ac' : ''); });
      if (i >= 0 && rows[i]) {
        box.setAttribute('aria-activedescendant', rows[i].id);
        if (rows[i].scrollIntoView) rows[i].scrollIntoView({ block: 'nearest' });
      } else {
        box.removeAttribute('aria-activedescendant');
      }
    }

    function fill() {
      list.textContent = '';
      opts = optionsOf(o.jotters || [], o.page, box.value);
      rows = [];
      var now = o.now();
      opts.forEach(function (t, i) {
        if (i === 0) list.appendChild(sectionHead(tr('intoThisPage')));
        if (i === 1) list.appendChild(sectionHead(tr('intoRecent')));
        var li = el('li', 'it');
        li.id = id + '-o' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(sameTarget(t, o.target)));
        var ch = chip(t);
        if (ch) li.appendChild(ch);
        li.appendChild(el('span', 't', titleOf(t)));
        if (t.kind === 'jotter') {
          var when = relTime(tr, o.lang, t.at, now);
          if (when) li.appendChild(el('small', null, when));
        }
        li.addEventListener('mousedown', function (e) { e.preventDefault(); });
        li.addEventListener('click', function () { choose(i); });
        rows.push(li);
        list.appendChild(li);
      });
      if (opts.length === 1 && String(box.value).trim()) {
        list.appendChild(sectionHead(tr('intoRecent')));
        var none = el('li', 'none', tr('intoNoMatch'));
        none.setAttribute('role', 'presentation');
        list.appendChild(none);
      }
      var sel = -1;
      opts.forEach(function (t, i) { if (sel < 0 && sameTarget(t, o.target)) sel = i; });
      setActive(String(box.value).trim() && opts.length > 1 ? 1 : sel);
    }

    function sectionHead(words) {
      var h = el('li', 'sec', words);
      h.setAttribute('role', 'presentation');
      return h;
    }

    function choose(i) {
      var t = opts[i];
      if (!t) return;
      var clean = t.kind === 'jotter' ? { kind: 'jotter', id: t.id, key: t.key, title: t.title } : t;
      o.onPick(clean);
    }

    line.addEventListener('click', function () {
      if (o.busy) return;
      o.onOpen(!o.open, true);
    });
    line.addEventListener('keydown', function (e) {
      if (!o.open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        o.onOpen(true, true);
      }
    });
    box.addEventListener('input', function () {
      o.onQuery(box.value);
      fill();
    });
    pop.addEventListener('keydown', function (e) {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        o.onOpen(false, true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(step(active, e.key === 'ArrowDown' ? 1 : -1, opts.length));
      } else if (e.key === 'Enter' && e.target === box) {
        e.preventDefault();
        if (active >= 0) choose(active);
      }
    });

    pop.appendChild(list);
    pop.appendChild(box);
    // "Keep saving into JOT-27 today": only for a Jotter with an id.
    var canKeep = !!keepFor(o.target, o.now());
    var cb = null;
    if (canKeep) {
      pop.appendChild(el('hr'));
      var kp = el('label', 'kp');
      cb = el('input');
      cb.type = 'checkbox';
      cb.checked = today;
      cb.addEventListener('change', function () { o.onKeep(cb.checked); });
      kp.appendChild(cb);
      kp.appendChild(el('i', null, today ? '✓' : ''));
      kp.appendChild(el('span', null, tr('intoKeep', nameOf(o.target))));
      pop.appendChild(kp);
    }
    wrap.appendChild(pop);
    fill();

    // A tap outside closes it (the line toggles it itself).
    if (o.open) {
      var outside = function (e) {
        if (wrap.contains(e.target)) return;
        doc.removeEventListener('pointerdown', outside, true);
        o.onOpen(false, false);
      };
      setTimeout(function () { doc.addEventListener('pointerdown', outside, true); }, 0);
      wrap.cleanup = function () { doc.removeEventListener('pointerdown', outside, true); };
    }

    return {
      el: wrap,
      box: box,
      line: line,
      focusBox: function () { box.focus(); },
      focusLine: function () { line.focus(); },
      focusKeep: function () { if (cb) cb.focus(); else box.focus(); },
      cleanup: function () { if (wrap.cleanup) wrap.cleanup(); },
    };
  }

  var api = {
    INTO_KEY: INTO_KEY,
    NEW: NEW,
    UNKNOWN: UNKNOWN,
    pageTarget: pageTarget,
    isUuid: isUuid,
    localDay: localDay,
    msToMidnight: msToMidnight,
    keepOf: keepOf,
    keepFor: keepFor,
    defaultTarget: defaultTarget,
    sameTarget: sameTarget,
    pick: pick,
    afterGone: afterGone,
    freshInto: freshInto,
    keepRow: keepRow,
    withKeep: withKeep,
    withList: withList,
    withNavigation: withNavigation,
    saveHeld: saveHeld,
    targetOf: targetOf,
    bodyOf: bodyOf,
    nameOf: nameOf,
    buttonLabel: buttonLabel,
    filterJotters: filterJotters,
    optionsOf: optionsOf,
    step: step,
    relTime: relTime,
    css: css,
    draw: draw,
  };
  root.HeddySaveInto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
