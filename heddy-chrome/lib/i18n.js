// lib/i18n.js — Heddy's own message lookup (D36).
//
// chrome.i18n follows Chrome's UI language and cannot be switched at runtime,
// so the options page stores a choice ('en' or 'zh_CN') in chrome.storage.sync
// and every surface reads strings through t() from the bundled catalogs
// (lib/messages.js, generated from _locales). With no choice stored, the
// language follows Chrome's. The manifest's own name and description still
// come from chrome.i18n, which is what the Web Store and chrome://extensions read.
(function (root) {
  var LANGS = ['en', 'zh_CN'];
  var STORAGE_KEY = 'lang';

  function messages() {
    return root.HeddyMessages || (typeof require === 'function' ? require('./messages.js') : {});
  }

  /** The catalog for a browser language tag: any Chinese → zh_CN, else en. */
  function langForUi(tag) {
    return /^zh\b/i.test(String(tag || '')) ? 'zh_CN' : 'en';
  }

  function normalise(lang) {
    return LANGS.indexOf(lang) >= 0 ? lang : null;
  }

  /** One string. `$NAME$` placeholders take the arguments in order of their
   *  `$1`, `$2`… content, as chrome.i18n does. Unknown keys fall back to
   *  English, then to the key itself, so a missing string is visible. */
  function t(lang, key) {
    var args = Array.prototype.slice.call(arguments, 2);
    var all = messages();
    var entry = (all[lang] && all[lang][key]) || (all.en && all.en[key]);
    if (!entry) return key;
    var text = entry.message;
    var ph = entry.placeholders || {};
    Object.keys(ph).forEach(function (name) {
      var m = /^\$(\d+)$/.exec(ph[name].content || '');
      var value = m ? args[Number(m[1]) - 1] : '';
      text = text.split(new RegExp('\\$' + name + '\\$', 'gi')).join(value === undefined ? '' : String(value));
    });
    return text;
  }

  /** The language the child chose on the options page, or Chrome's. */
  function currentLang(chromeApi) {
    var c = chromeApi || root.chrome;
    var fallback = langForUi(c && c.i18n && c.i18n.getUILanguage ? c.i18n.getUILanguage() : 'en');
    if (!c || !c.storage || !c.storage.sync) return Promise.resolve(fallback);
    return c.storage.sync.get(STORAGE_KEY).then(
      function (got) { return normalise(got && got[STORAGE_KEY]) || fallback; },
      function () { return fallback; }
    );
  }

  /** t() bound to a language. */
  function translator(lang) {
    return function (key) {
      return t.apply(null, [lang].concat(Array.prototype.slice.call(arguments)));
    };
  }

  var api = { LANGS: LANGS, STORAGE_KEY: STORAGE_KEY, langForUi: langForUi, normalise: normalise, t: t, currentLang: currentLang, translator: translator };
  root.HeddyI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
