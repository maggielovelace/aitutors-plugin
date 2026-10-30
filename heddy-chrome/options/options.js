// options/options.js — Heddy's settings (PRD-v0.96.0 D36, D60; artifact R6 · C
// and R6 · owner's pick).
//
// From the top: the study pass (who Heddy saves for, from aitutors.me's /me,
// lib/who.js), Language, About Heddy (version, the full Extension ID with
// Copy, the privacy link), and For developers, folded. The pass is drawn
// signed out until /me answers; any error leaves it signed out, saying
// nothing. Nothing /me says is stored.
(function () {
  var C = HeddyConfig, I = HeddyI18n, M = HeddyMarks, W = HeddyWho;
  var $ = function (id) { return document.getElementById(id); };
  var savedTimer = null;
  var tr = I.translator('en');
  var me = W.SIGNED_OUT;
  var origin = C.PROD_ORIGIN;

  function open(url) {
    chrome.tabs.create({ url: url }).catch(function () {});
  }

  function action(cls, label, url) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', function () { open(url); });
    return b;
  }

  /** The pass, from what /me said. Signed in: name, year and subjects, Open
   *  my Study, Not you? Switch. A grown-up: Open my dashboard. Signed out
   *  (grey): Sign in, I'm new: make my account, I'm a parent. */
  function paintPass() {
    var L = W.links(origin);
    var acts = $('passActions');
    acts.textContent = '';
    $('passEyebrow').textContent = tr('passEyebrow');
    var child = me.signedIn && me.role === 'child';
    var parent = me.signedIn && me.role === 'parent';
    $('pass').classList.toggle('blank', !child && !parent);
    if (child) {
      $('passName').textContent = me.firstName;
      $('passLine').textContent = W.passLine(me, tr);
      acts.appendChild(action('btn gold', tr('whoOpenStudy'), L.study));
      acts.appendChild(action('lk lt', tr('passSwitch'), L.signIn));
    } else if (parent) {
      $('passName').textContent = tr('whoGrownUp');
      $('passLine').textContent = tr('passGrownUpLine');
      acts.appendChild(action('btn gold', tr('whoOpenDashboard'), L.dashboard));
      acts.appendChild(action('lk lt', tr('passSwitch'), L.signIn));
    } else {
      $('passName').textContent = tr('passNotSignedIn');
      $('passLine').textContent = tr('passSavesTo');
      acts.appendChild(action('btn gold', tr('whoSignIn'), L.signIn));
      acts.appendChild(action('btn ghost', tr('passMakeAccount'), L.signUp));
      acts.appendChild(action('lk lt', tr('passParent'), L.parent));
    }
  }

  function paint(lang) {
    tr = I.translator(lang);
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    document.title = tr('optionsTitle');
    $('title').textContent = tr('optionsTitle');
    $('langLabel').textContent = tr('optionsLanguage');
    $('langHint').textContent = tr('optionsLanguageHint');
    $('aboutHeading').textContent = tr('aboutHeading');
    $('aboutVersion').textContent = tr('aboutVersion');
    $('aboutId').textContent = tr('aboutId');
    $('copyId').textContent = tr('aboutCopy');
    $('aboutPrivacy').textContent = tr('aboutPrivacy');
    $('privacy').textContent = tr('aboutPrivacyLink');
    $('devHeading').textContent = tr('optionsDevHeading');
    $('devToggle').textContent = tr('optionsDevToggle');
    $('devHint').textContent = tr('optionsDevHint');
    Array.prototype.forEach.call(document.querySelectorAll('input[name="lang"]'), function (r) { r.checked = r.value === lang; });
    paintPass();
  }

  function saved() {
    $('saved').textContent = tr('optionsSaved');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { $('saved').textContent = ''; }, 2000);
  }

  function ask() {
    W.loadMe(window.fetch.bind(window), origin).then(function (answer) {
      me = answer;
      paintPass();
    });
  }

  $('mark').innerHTML = M.sprite(['h-eyes', 'h-face']) + M.use('h-eyes', 40);
  $('passFace').innerHTML = M.use('h-face', 110);
  var id = chrome.runtime.id;
  $('extId').textContent = id;
  $('passId').textContent = 'Heddy ' + W.shortId(id);
  $('version').textContent = chrome.runtime.getManifest().version;

  $('copyId').addEventListener('click', function () {
    var b = $('copyId');
    Promise.resolve()
      .then(function () { return navigator.clipboard.writeText(id); })
      .then(function () {
        b.textContent = tr('aboutCopied');
        setTimeout(function () { b.textContent = tr('aboutCopy'); }, 1500);
      }, function () {
        // No clipboard: select the id so it can be copied by hand.
        var r = document.createRange();
        r.selectNodeContents($('extId'));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      });
  });
  $('privacy').addEventListener('click', function () { open(C.PRIVACY_URL); });

  Promise.all([I.currentLang(), chrome.storage.local.get(C.DEV_KEY).catch(function () { return {}; })]).then(function (got) {
    var dev = !!got[1] && got[1][C.DEV_KEY] === true;
    origin = C.captureOrigin(dev);
    paint(got[0]);
    $('dev').checked = dev;
    ask();

    Array.prototype.forEach.call(document.querySelectorAll('input[name="lang"]'), function (r) {
      r.addEventListener('change', function () {
        var lang = I.normalise(r.value) || 'en';
        var o = {};
        o[I.STORAGE_KEY] = lang;
        chrome.storage.sync.set(o).then(function () { paint(lang); saved(); });
      });
    });

    $('dev').addEventListener('change', function () {
      var o = {};
      o[C.DEV_KEY] = $('dev').checked;
      chrome.storage.local.set(o).then(function () {
        // The pass asks the site the captures now go to.
        origin = C.captureOrigin($('dev').checked);
        me = W.SIGNED_OUT;
        paintPass();
        ask();
        saved();
      });
    });
  });
})();
