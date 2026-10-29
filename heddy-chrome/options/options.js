// options/options.js — the language switch (D36) and, clearly apart, the
// developer switch that sends captures to http://localhost:3000.
(function () {
  var C = HeddyConfig, I = HeddyI18n, M = HeddyMarks;
  var $ = function (id) { return document.getElementById(id); };
  var savedTimer = null;

  function paint(lang) {
    var tr = I.translator(lang);
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    document.title = tr('optionsTitle');
    $('title').textContent = tr('optionsTitle');
    $('langLabel').textContent = tr('optionsLanguage');
    $('langHint').textContent = tr('optionsLanguageHint');
    $('devHeading').textContent = tr('optionsDevHeading');
    $('devToggle').textContent = tr('optionsDevToggle');
    $('devHint').textContent = tr('optionsDevHint');
    $('lockLine').textContent = tr('footerLock');
    Array.prototype.forEach.call(document.querySelectorAll('input[name="lang"]'), function (r) { r.checked = r.value === lang; });
    return tr;
  }

  function saved(tr) {
    $('saved').textContent = tr('optionsSaved');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { $('saved').textContent = ''; }, 2000);
  }

  $('mark').innerHTML = M.sprite(['h-eyes', 'h-lock']) + M.use('h-eyes', 32);
  $('lock').innerHTML = M.use('h-lock', 14);

  Promise.all([I.currentLang(), chrome.storage.local.get(C.DEV_KEY).catch(function () { return {}; })]).then(function (got) {
    var tr = paint(got[0]);
    $('dev').checked = !!got[1] && got[1][C.DEV_KEY] === true;

    Array.prototype.forEach.call(document.querySelectorAll('input[name="lang"]'), function (r) {
      r.addEventListener('change', function () {
        var lang = I.normalise(r.value) || 'en';
        var o = {};
        o[I.STORAGE_KEY] = lang;
        chrome.storage.sync.set(o).then(function () { tr = paint(lang); saved(tr); });
      });
    });

    $('dev').addEventListener('change', function () {
      var o = {};
      o[C.DEV_KEY] = $('dev').checked;
      chrome.storage.local.set(o).then(function () { saved(tr); });
    });
  });
})();
