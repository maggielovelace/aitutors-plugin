// Round 6 (PRD-v0.96.0 D60, D61): who Heddy saves for (/me, lib/who.js), the
// settings page's study pass, and the panel on a page Heddy can't add to
// Jotters (lib/page-kind.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

const W = load('./lib/who.js');
const K = load('./lib/page-kind.js');
globalThis.HeddyMessages = load('./lib/messages.js');
const I = load('./lib/i18n.js');
const en = I.translator('en');
const zh = I.translator('zh_CN');
const OWN = 'dfodgnhipffpkldflfjcelbafjogjheo';

// ─── D61: the kinds of page ─────────────────────────────────────────────────

const KINDS = [
  ['chrome://extensions/', 'chrome', 'Extensions'],
  ['chrome://newtab/', 'chrome', 'New tab'],
  ['chrome-search://local-ntp/local-ntp.html', 'chrome', 'New tab'],
  ['chrome://settings/privacy', 'chrome', 'Chrome settings'],
  ['chrome://history/', 'chrome', 'Chrome page'],
  ['about:blank', 'chrome', 'Chrome page'],
  ['devtools://devtools/bundled/inspector.html', 'chrome', 'Chrome page'],
  ['chrome-extension://aaaabbbbccccddddeeeeffffgggghhhh/options.html', 'chrome', 'Another extension'],
  ['https://chromewebstore.google.com/detail/heddy/' + OWN, 'store', 'Chrome Web Store'],
  ['https://chrome.google.com/webstore/detail/x', 'store', 'Chrome Web Store'],
  [`chrome-extension://${OWN}/options/options.html`, 'heddy', 'Heddy settings'],
  [`chrome-extension://${OWN}/popup/popup.html?tab=3&host=window`, 'heddy', 'Heddy page'],
  ['view-source:https://www.bbc.co.uk/bitesize', 'source', 'Page source'],
  ['https://www.aqa.org.uk/papers/8300-1H-QP.PDF', 'file', 'PDF file'],
  ['file:///Users/shan/Downloads/homework.pdf', 'file', 'PDF file'],
  ['file:///Users/shan/notes.txt', 'file', 'File on this computer'],
  ['', 'other', 'This page'],
  ['ftp://old.example/x', 'other', 'This page'],
];

for (const [url, kind, chip] of KINDS) {
  test(`kind: ${url || '(Chrome hid the address)'} → ${kind}, chip "${chip}"`, () => {
    assert.equal(K.kindOf(url, OWN), kind);
    const d = K.describe(url, OWN);
    assert.equal(d.kind, kind);
    assert.equal(en(d.chip), chip);
    assert.notEqual(zh(d.chip), d.chip, 'a Chinese chip');
    for (const key of [d.line, d.sub]) {
      assert.notEqual(en(key), key, `${key} in English`);
      assert.notEqual(zh(key), key, `${key} in Chinese`);
    }
  });
}

test('a page Heddy can add to Jotters is no kind: web pages, YouTube, and aitutors.me itself', () => {
  for (const url of ['https://www.bbc.co.uk/bitesize/guides/zc', 'http://example.com/', 'https://www.youtube.com/watch?v=Fq2aPn3x_-A', 'https://aitutors.me/study', 'https://example.com/pdf-guide']) {
    assert.equal(K.kindOf(url, OWN), null, url);
    assert.equal(K.describe(url, OWN), null, url);
  }
});

test('the PDF line is the PRD’s: "Heddy can’t save this PDF yet. Upload it to Jotters instead."', () => {
  const d = K.describe('https://x.example/a.pdf', OWN);
  assert.equal(en(d.line), "Heddy can't save this PDF yet.");
  assert.match(en(d.sub), /^Upload it to Jotters instead/);
  assert.equal(en(K.describe('https://chromewebstore.google.com/', OWN).line), 'Chrome keeps Heddy out of the Web Store.');
  assert.equal(en(K.describe('chrome://newtab/', OWN).line), 'Nothing to read here.');
});

test('without its own id, Heddy’s pages read as another extension’s, never as a page it can save', () => {
  assert.equal(K.kindOf(`chrome-extension://${OWN}/options/options.html`, undefined), 'chrome');
});

// ─── the header never prints the extension id ───────────────────────────────

const popup = read('popup/popup.js');

test('the panel’s header shows a site’s name only for a web page; on any other page the kind’s chip, never the extension id', () => {
  assert.match(popup, /\$\('ctx'\)\.textContent = url && \/\^https\?:\/\.test\(url\) \? hostLabel\(url\) : '';/);
  assert.match(popup, /ctx\.textContent = tr\(d\.chip\);/);
  assert.doesNotMatch(popup, /chrome\.runtime\.id\)?\s*;?\s*\$\('ctx'\)|ctx'\)\.textContent = [^;]*runtime\.id/);
  // every chip is words, never an id-shaped string
  for (const [url] of KINDS) {
    const d = K.describe(url, OWN);
    for (const t of [en(d.chip), zh(d.chip)]) {
      assert.doesNotMatch(t, /[a-p]{32}/, t);
      assert.ok(!t.includes(OWN));
    }
  }
});

test('the fallback window is told the kind, for a page whose address Chrome hides from it', () => {
  const { pageUrl } = load('./lib/panel.js');
  assert.equal(pageUrl((p) => `chrome-extension://${OWN}/${p}`, 3, 'window', 'store'), `chrome-extension://${OWN}/popup/popup.html?tab=3&host=window&kind=store`);
  assert.match(popup, /var cant = url \? HeddyPageKind\.describe\(url, chrome\.runtime\.id\) : HINT_KIND;/);
});

test('the D61 body: face and why, the account row, then My Jotters · My Clips · My Study; Snap a picture only where box mode can run', () => {
  assert.match(popup, /M\.use\('h-face', 60\)/);
  assert.match(popup, /tile\('h-pen', tr\('tileJotters'\), L\.jotters\)[^]*tile\('h-film', tr\('tileClips'\), L\.clips\)[^]*tile\('h-school', tr\('tileStudy'\), L\.study\)/);
  assert.match(popup, /if \(url && !cant && \/\^https\?:\/\.test\(url\)/);
  assert.match(popup, /if \(cant\) return renderCantSave\(body, cant\);/);
  assert.doesNotMatch(popup, /renderCantRead/);
});

// ─── D60: /me ───────────────────────────────────────────────────────────────

test('/me, a child: first name, year and subjects, cleaned', () => {
  assert.deepEqual(W.parseMe({ signedIn: true, role: 'child', firstName: ' Shan\n', yearGroup: 8, subjects: ['Science', 'Maths', ' English '] }),
    { signedIn: true, role: 'child', firstName: 'Shan', yearGroup: 8, subjects: ['Science', 'Maths', 'English'] });
  for (const y of [8, '8', 'Y8', 'y8', 'Year 8']) assert.equal(W.parseMe({ signedIn: true, role: 'child', firstName: 'Shan', yearGroup: y }).yearGroup, 8, String(y));
  for (const y of [0, 14, 'eight', null, undefined, 'Y8x']) assert.equal(W.parseMe({ signedIn: true, role: 'child', firstName: 'Shan', yearGroup: y }).yearGroup, null, String(y));
  assert.deepEqual(W.parseMe({ signedIn: true, role: 'child', firstName: 'Shan', subjects: 'Maths' }).subjects, []);
  assert.equal(W.parseMe({ signedIn: true, role: 'child', firstName: 'x'.repeat(200) }).firstName.length, 40);
});

test('/me, a parent: no names, whatever else is sent', () => {
  assert.deepEqual(W.parseMe({ signedIn: true, role: 'parent', firstName: 'Mum', email: 'm@example.com' }), { signedIn: true, role: 'parent' });
});

test('/me, signed out, or any shape it does not know: signed out', () => {
  for (const x of [{ signedIn: false }, null, undefined, 'yes', [], {}, { signedIn: 'true', role: 'child', firstName: 'S' }, { signedIn: true }, { signedIn: true, role: 'admin', firstName: 'S' }, { signedIn: true, role: 'child' }, { signedIn: true, role: 'child', firstName: '   ' }]) {
    assert.deepEqual(W.parseMe(x), { signedIn: false }, JSON.stringify(x));
  }
});

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'function' ? body() : body) });

test('loadMe asks GET {origin}/api/learn/heddy/me with the browser’s cookie, no redirect followed', async () => {
  const calls = [];
  const me = await W.loadMe(async (url, init) => { calls.push({ url, init }); return res(200, { signedIn: true, role: 'child', firstName: 'Shan', yearGroup: 'Y8', subjects: [] }); }, 'https://aitutors.me');
  assert.equal(me.firstName, 'Shan');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://aitutors.me/api/learn/heddy/me');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.redirect, 'error', 'a sign-in redirect reads as signed out, not as a page');
  assert.equal(calls[0].init.body, undefined, 'nothing is sent');
  const dev = [];
  await W.loadMe(async (url) => { dev.push(url); return res(200, { signedIn: false }); }, 'http://localhost:3000');
  assert.deepEqual(dev, ['http://localhost:3000/api/learn/heddy/me']);
});

test('loadMe: a network error, a 401 or 500, bad JSON, a redirect or a timeout all read as signed out, and it never throws', async () => {
  const cases = [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => res(401, { signedIn: true, role: 'child', firstName: 'Shan' }),
    async () => res(500, {}),
    async () => res(200, () => { throw new SyntaxError('Unexpected token <'); }),
    async () => { throw new TypeError('redirect mode is set to error'); },
    async () => null,
  ];
  for (const f of cases) assert.deepEqual(await W.loadMe(f, 'https://aitutors.me'), { signedIn: false });
  // a request that never answers is abandoned
  let aborted = false;
  // like fetch: rejects on abort, at once if the signal is already aborted
  const never = (url, init) => new Promise((_, reject) => {
    const stop = () => { aborted = true; reject(new Error('aborted')); };
    if (init.signal.aborted) stop(); else init.signal.addEventListener('abort', stop);
  });
  const timers = [];
  const p = W.loadMe(never, 'https://aitutors.me', { setTimeout: (fn, ms) => { timers.push({ fn, ms }); return 1; }, clearTimeout: () => {} });
  assert.equal(timers[0].ms, 5000);
  timers[0].fn();
  assert.deepEqual(await p, { signedIn: false });
  assert.ok(aborted);
});

test('the pass line, the avatar initial and the short id', () => {
  assert.equal(W.passLine({ yearGroup: 8, subjects: ['Science', 'Maths', 'English'] }, en), 'Year 8 · Science, Maths, English');
  assert.equal(W.passLine({ yearGroup: null, subjects: ['Maths'] }, en), 'Maths');
  assert.equal(W.passLine({ yearGroup: 8, subjects: [] }, zh), 'Year 8', 'UK year groups stay in English in Chinese copy');
  assert.equal(W.initial('shan'), 'S');
  assert.equal(W.initial('李明'), '李');
  assert.equal(W.shortId(OWN), 'dfodgnhi…');
});

test('the doors: Sign in is the kid door, I’m new adds new=1, I’m a parent the parent door', () => {
  assert.deepEqual(W.links('https://aitutors.me'), {
    signIn: 'https://aitutors.me/auth/login?door=kid',
    signUp: 'https://aitutors.me/auth/login?door=kid&new=1',
    parent: 'https://aitutors.me/auth/login?door=parent',
    study: 'https://aitutors.me/study',
    jotters: 'https://aitutors.me/study/jotters',
    clips: 'https://aitutors.me/study/clips',
    dashboard: 'https://aitutors.me/dashboard',
  });
});

// ─── D60: the settings page ─────────────────────────────────────────────────

const opts = read('options/options.js');
const html = read('options/options.html');

test('settings, in order: the study pass, Language, About Heddy, For developers folded', () => {
  const order = ['id="pass"', 'id="langLabel"', 'id="aboutHeading"', '<details class="dev">'].map((s) => html.indexOf(s));
  assert.ok(order.every((i) => i > 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(html, /<details class="dev">\s*<summary id="devHeading"><\/summary>/, 'folded');
});

test('signed out is the drawing until /me answers: grey, Not signed in, Sign in, I’m new: make my account, I’m a parent', () => {
  assert.match(html, /<section class="pass blank" id="pass"/);
  assert.match(opts, /var me = W\.SIGNED_OUT;/);
  assert.match(opts, /\$\('passName'\)\.textContent = tr\('passNotSignedIn'\);[^]*action\('btn gold', tr\('whoSignIn'\), L\.signIn\)[^]*action\('btn ghost', tr\('passMakeAccount'\), L\.signUp\)[^]*action\('lk lt', tr\('passParent'\), L\.parent\)/);
  assert.deepEqual(['passNotSignedIn', 'passMakeAccount', 'passParent'].map((k) => en(k)), ['Not signed in', "I'm new: make my account", "I'm a parent"]);
});

test('signed in: name, year and subjects, Heddy’s face, Open my Study, Not you? Switch; a grown-up gets Open my dashboard', () => {
  assert.match(opts, /\$\('passName'\)\.textContent = me\.firstName;\s*\$\('passLine'\)\.textContent = W\.passLine\(me, tr\);\s*acts\.appendChild\(action\('btn gold', tr\('whoOpenStudy'\), L\.study\)\);\s*acts\.appendChild\(action\('lk lt', tr\('passSwitch'\), L\.signIn\)\);/);
  assert.match(opts, /\$\('passName'\)\.textContent = tr\('whoGrownUp'\);[^]*action\('btn gold', tr\('whoOpenDashboard'\), L\.dashboard\)/);
  assert.equal(en('whoGrownUp'), 'Signed in as a grown-up');
  assert.match(opts, /\$\('passFace'\)\.innerHTML = M\.use\('h-face', 110\);/);
});

test('About Heddy: the version, the full extension id with Copy, the privacy link', () => {
  assert.match(opts, /var id = chrome\.runtime\.id;\s*\$\('extId'\)\.textContent = id;/);
  assert.match(opts, /navigator\.clipboard\.writeText\(id\)/);
  assert.match(opts, /\$\('version'\)\.textContent = chrome\.runtime\.getManifest\(\)\.version;/);
  assert.match(opts, /open\(C\.PRIVACY_URL\)/);
  assert.equal(load('./lib/config.js').PRIVACY_URL, 'https://github.com/maggielovelace/aitutors-plugin/blob/main/heddy-chrome/PRIVACY.md');
});

test('the dev switch asks the site captures go to; /me’s answer is never stored', () => {
  assert.match(opts, /origin = C\.captureOrigin\(\$\('dev'\)\.checked\);\s*me = W\.SIGNED_OUT;/);
  assert.doesNotMatch(opts.replace(/chrome\.storage\.(sync|local)\.set\(o\)/g, ''), /storage\.\w+\.set|localStorage/);
});
