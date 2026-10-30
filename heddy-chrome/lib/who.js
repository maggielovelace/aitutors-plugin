// lib/who.js — who Heddy saves for (PRD-v0.96.0 D60, D61).
//
// The settings page's study pass and the panel's account row ask aitutors.me
// one question, GET /api/learn/heddy/me, with the browser's own aitutors.me
// cookie (the existing host permission). Heddy still holds no credential:
// the cookie is the browser's, sent by the browser, and Heddy never reads it.
// The answer is one of
//
//   {signedIn:false}
//   {signedIn:true, role:'child', firstName, yearGroup, subjects:string[]}
//   {signedIn:true, role:'parent'}                      (no names)
//
// It is shown and forgotten: never stored, never sent anywhere else. This is
// the only request Heddy makes of its own; tests/no-network.test.mjs allows
// exactly this one, to exactly this path. Any error, or any other shape,
// reads as signed out, with no error shown.
(function (root) {
  var PATH = '/api/learn/heddy/me';
  var MAX_NAME = 40;
  var MAX_SUBJECTS = 12;
  var MAX_SUBJECT = 40;
  var TIMEOUT_MS = 5000;
  var SIGNED_OUT = Object.freeze({ signedIn: false });

  function text(x, max) {
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /** The year as the site gives it (8, '8', 'Y8', 'Year 8'), as a number
   *  from 1 to 13, or null. */
  function yearOf(x) {
    var m = /^(?:y(?:ear)?\s*)?(\d{1,2})$/i.exec(String(x == null ? '' : x).trim());
    var n = m ? Number(m[1]) : NaN;
    return n >= 1 && n <= 13 ? n : null;
  }

  /** One /me answer, checked. Anything unknown is signed out. */
  function parseMe(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.signedIn !== true) return SIGNED_OUT;
    if (data.role === 'parent') return { signedIn: true, role: 'parent' };
    if (data.role !== 'child') return SIGNED_OUT;
    var firstName = text(data.firstName, MAX_NAME);
    if (!firstName) return SIGNED_OUT;
    var subjects = Array.isArray(data.subjects)
      ? data.subjects.map(function (s) { return text(s, MAX_SUBJECT); }).filter(Boolean).slice(0, MAX_SUBJECTS)
      : [];
    return { signedIn: true, role: 'child', firstName: firstName, yearGroup: yearOf(data.yearGroup), subjects: subjects };
  }

  /** Where the site's pages are: sign in at the kid door, a new account,
   *  the parent door, Study, Jotters, Clips and the parent dashboard. */
  function links(origin) {
    return {
      signIn: origin + '/auth/login?door=kid',
      signUp: origin + '/auth/login?door=kid&new=1',
      parent: origin + '/auth/login?door=parent',
      study: origin + '/study',
      jotters: origin + '/study/jotters',
      clips: origin + '/study/clips',
      dashboard: origin + '/dashboard',
    };
  }

  /** Ask /me. `fetchImpl` is the page's fetch; resolves to a parsed answer,
   *  never rejects. The browser sends its own aitutors.me cookie. */
  function loadMe(fetchImpl, origin, opts) {
    var o = opts || {};
    var later = o.setTimeout || setTimeout;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? later(function () { ctrl.abort(); }, o.timeoutMs || TIMEOUT_MS) : null;
    return Promise.resolve()
      .then(function () {
        return fetchImpl(origin + PATH, { method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined });
      })
      .then(function (res) {
        if (!res || !res.ok) return SIGNED_OUT;
        return res.json().then(parseMe, function () { return SIGNED_OUT; });
      })
      .catch(function () { return SIGNED_OUT; })
      .then(function (me) {
        if (timer !== null && o.clearTimeout) o.clearTimeout(timer);
        else if (timer !== null) clearTimeout(timer);
        return me;
      });
  }

  /** "Year 8 · Science, Maths, English", leaving out what is not known. */
  function passLine(me, tr) {
    var parts = [];
    if (me.yearGroup) parts.push(tr('whoYear', String(me.yearGroup)));
    if (me.subjects && me.subjects.length) parts.push(me.subjects.join(', '));
    return parts.join(' · ');
  }

  /** The first character of a name, for the avatar. */
  function initial(name) {
    var c = Array.from(String(name || '').trim())[0];
    return c ? c.toUpperCase() : '';
  }

  /** The id cut short for the pass: "Heddy dfodgnhi…". */
  function shortId(id) {
    var s = String(id || '');
    return s.length > 8 ? s.slice(0, 8) + '…' : s;
  }

  var api = { PATH: PATH, SIGNED_OUT: SIGNED_OUT, parseMe: parseMe, yearOf: yearOf, links: links, loadMe: loadMe, passLine: passLine, initial: initial, shortId: shortId };
  root.HeddyWho = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
