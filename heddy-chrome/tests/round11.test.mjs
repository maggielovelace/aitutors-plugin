// Round 11 (0.7.0): the desk's Digest gets Classroom's selection tray
// (lib/desk-tray.js), H jots on any desk tab and in YouTube's fullscreen with
// a confirmation drawn where the child can see it, and the Chinese views fall
// back to English line by line and retry a failed stretch after the site's
// 10-minute window (site PR #1192).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read, manifest } from './helpers.mjs';

globalThis.HeddyMessages = load('./lib/messages.js');
globalThis.HeddyI18n = load('./lib/i18n.js');
globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyMarks = load('./lib/marks.js');
const TR = load('./lib/desk-tray.js');
const D = load('./lib/desk-model.js');
const K = load('./lib/jot-key.js');
const T = load('./lib/toast.js');
const A = load('./lib/desk-ask.js');
const I = globalThis.HeddyI18n;

test('the version is 0.7.0, and Round 11 asks for no new permission', () => {
  const m = manifest();
  assert.equal(m.version, '0.7.0');
  assert.deepEqual(m.permissions, ['activeTab', 'scripting', 'contextMenus', 'commands', 'storage']);
  assert.ok(m.content_scripts[0].js.indexOf('lib/desk-tray.js') < m.content_scripts[0].js.indexOf('content/desk.js'), 'the tray loads before the desk');
});

// ─── Pi's tray: Classroom's rules (digest-helpers.ts) ──────────────────────

test('the tray sits 4 px inside its row and its caret 18 px inside the tray, on the words’ centre (trayPlacement)', () => {
  assert.deepEqual(TR.trayPlacement({ sx: 200, sw: 100, bw: 342, rw: 374 }), { bx: 28, cx: 222 });
  assert.deepEqual(TR.trayPlacement({ sx: 0, sw: 10, bw: 342, rw: 374 }), { bx: 4, cx: 18 });
  assert.deepEqual(TR.trayPlacement({ sx: 360, sw: 10, bw: 342, rw: 374 }), { bx: 28, cx: 324 });
});

test('the bar opens above its line, below one within 58 px of the list’s top (50 px bar + 8 px gap)', () => {
  assert.equal(TR.POP_ROOM_PX, 58);
  assert.equal(TR.popSide(57), 'below');
  assert.equal(TR.popSide(58), 'above');
});

test('a selection is the language it started in; empty there, the whole English line', () => {
  assert.equal(TR.selectionForLine({ anchor: 'zh', en: 'pull', zh: ' 速度 不变 ', line: 'L' }), '速度 不变');
  assert.equal(TR.selectionForLine({ anchor: 'en', en: '  measured   in ', zh: '牛顿', line: 'L' }), 'measured in');
  assert.equal(TR.selectionForLine({ anchor: null, en: 'x', zh: 'y', line: 'The whole line.' }), 'The whole line.');
  assert.equal(TR.pickWords(['a  b', '', ' c ']), 'a b c');
  assert.equal(TR.cleanSelection('x'.repeat(700)).length, 600);
});

test('the chosen words are marked in the line, never when they are the whole of it', () => {
  assert.deepEqual(TR.splitMark('A force is a push', 'a push'), ['A force is ', 'a push', '']);
  assert.equal(TR.splitMark('A force', 'A force'), null);
  assert.equal(TR.splitMark('A force', 'gone'), null);
});

test('the tray’s CSS is Classroom’s, in px: 50 px bar, 64 × 42 tools, 11 px / 700 words, 18 px icons, 12 px caret, 236 px menu', () => {
  const css = TR.CSS;
  assert.doesNotMatch(css, /\drem\b/, 'no rem: the owner’s Chrome has a 24 px root font');
  for (const rule of ['height:50px', 'height:42px;min-width:64px;padding:0 8px', 'font:700 11px/1', 'width:18px;height:18px', 'width:12px;height:12px', 'border-radius:14px', 'width:236px', 'min-height:44px', 'background:var(--sc);color:var(--cp-on-sc)', 'margin-top:58px', 'margin-bottom:58px']) {
    assert.ok(css.includes(rule), rule);
  }
});

test('the tray: Jot it · Explain · Make a card · hairline · Ask {name} · ›, whose menu is Play from here · Copy (no chapters on YouTube)', () => {
  const src = read('lib/desk-tray.js');
  const order = ["tool('t-jot'", "tool('t-explain'", "tool('t-card'", "sep.className = 'sep2'", "tool('t-ask'", "more.className = 'more2'"].map((s) => src.indexOf(s));
  assert.ok(order.every((n, i) => n > 0 && (i === 0 || n > order[i - 1])), 'in Classroom’s order');
  assert.match(src, /item\('mi-play'[\s\S]*item\('mi-copy'/);
  assert.doesNotMatch(src, /mi-chapter|digestMoreChapter/, 'no Select the whole chapter on a YouTube video');
  assert.match(src, /COPIED_MS = 1200/);
});

test('the tray’s words are Classroom’s in both languages (the drift test pins them to videos.json)', () => {
  assert.equal(I.t('en', 'digestActJot'), 'Jot it');
  assert.equal(I.t('en', 'digestActCard'), 'Make a card');
  assert.equal(I.t('en', 'deskAsk', 'Newton'), 'Ask Newton');
  assert.equal(I.t('zh_CN', 'digestActExplain'), '讲一讲');
  assert.equal(I.t('zh_CN', 'digestMorePlay'), '从这里播放');
  const pins = read('tests/classroom-words.test.mjs');
  for (const k of ['digestActionsLabel', 'digestActJot', 'digestActExplain', 'digestActCard', 'digestMoreOpen', 'digestMoreLabel', 'digestMorePlay', 'digestMoreCopy', 'digestMoreCopied', 'digestMoreCopyFailed']) assert.match(pins, new RegExp(`\\['${k}', 'digest\\.`), k);
});

// ─── what each tool does on the desk ───────────────────────────────────────

test('Jot it: the chosen words as a line jot at the line’s start', () => {
  const jots = D.lineJot([], { id: 'a', t: 4.23, text: '  measured in newtons ' });
  assert.deepEqual(jots, [{ id: 'a', t: 4.2, kind: 'line', text: 'measured in newtons' }]);
  assert.equal(D.lineJot([], { id: 'b', t: 1, text: '   ' }), null);
  assert.equal(D.lineJot(new Array(D.MAX_JOTS).fill(jots[0]), { id: 'c', t: 1, text: 'x' }), null);
});

test('Explain, Make a card and Ask go to the desk’s Ask view, about the words, at the line’s start; Ask sends them as the first message', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /root\.HeddyDeskAsk\.openAsk\(\{ about: 'words', attach: attach, at: at \}, api, intent, intent === 'ask' \? sel\.words : undefined\);/);
  assert.match(desk, /extra: function \(\) \{ return \{ t: askAt !== null \? askAt : now\(\) \}; \}/);
  let got = null;
  A.openAsk({ about: 'words' }, { openAsk: (ctx, intent, text) => { got = { ctx, intent, text }; } }, 'ask', '  速度不变 ');
  assert.deepEqual(got, { ctx: { about: 'words' }, intent: 'ask', text: '速度不变' });
  A.openAsk({}, { openAsk: (ctx, intent, text) => { got = { intent, text }; } }, 'explain');
  assert.deepEqual(got, { intent: 'explain', text: undefined });
  assert.match(read('lib/ask-view.js'), /else if \(intent === 'ask' && typeof text === 'string' && text\.trim\(\)\) send\('ask', text\);/);
});

test('Play from here seeks the player; Copy writes the clipboard inside the click; nothing opens a window', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /onPlay: function \(\) \{ closeSel\(\); seek\(l\.t\); \}/);
  assert.match(desk, /copy: function \(text\) \{ return root\.navigator\.clipboard\.writeText\(text\); \}/);
});

test('a Digest line is a stamp that seeks and words that open the tray; Space there never reaches YouTube', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /ts\.addEventListener\('click', function \(\) \{ seek\(l\.t\); \}\);/);
  assert.match(desk, /tx\.addEventListener\('pointerup'/);
  assert.match(desk, /t\.getAttribute\('role'\) === 'button'\)\) && \(e\.key === ' ' \|\| e\.key === 'Enter'\)/);
  assert.match(desk, /shadow\.getSelection/, 'the selection is read inside the closed shadow root');
});

// ─── H on any tab, playing, fullscreen ─────────────────────────────────────

const key = (over) => ({ key: 'h', code: 'KeyH', target: null, composedPath: () => [], ...over });
const field = { nodeType: 1, tagName: 'INPUT' };
const box = { nodeType: 1, tagName: 'DIV', isContentEditable: true };
const plain = { nodeType: 1, tagName: 'DIV', closest: () => null };

test('H never fires while the child types: a field anywhere on the composed path, or focused inside an open shadow root', () => {
  assert.equal(K.isJotKey(key(), plain), true);
  assert.equal(K.isJotKey(key({ composedPath: () => [field, plain] }), plain), false);
  assert.equal(K.isJotKey(key({ composedPath: () => [box, plain] }), plain), false);
  const host = { nodeType: 1, tagName: 'YT-SEARCHBOX', closest: () => null, shadowRoot: { activeElement: field } };
  assert.equal(K.isJotKey(key(), host), false);
  assert.match(read('content/desk.js'), /return !!a && root\.HeddyJotKey\.isTypingTarget\(a\);/, 'nor in the desk’s own closed root');
});

test('H: a capture listener on the window, while the desk is open, on any tab; it stops and prevents nothing', () => {
  const yt = read('content/youtube.js');
  assert.match(yt, /window\.addEventListener\('keydown', onKeyDown, true\);/);
  assert.match(yt, /desk\.pressJot\(true\);/);
  assert.doesNotMatch(yt, /stopPropagation|preventDefault/);
  const desk = read('content/desk.js');
  assert.match(desk, /if \(t\.status === 'ok' && t\.lines\.length\) return jotAt\(at, false, key\);/, 'no tab switch when the line can be jotted');
});

test('the confirmation goes where the child can see it: the toast mounts inside document.fullscreenElement', () => {
  assert.match(read('content/youtube.js'), /mount: function \(\) \{ return document\.fullscreenElement \|\| document\.documentElement; \}/);
  const added = [];
  const make = (tag) => ({ tag, appendChild: (c) => added.push([tag, c]) });
  const fs = make('fs');
  const shadow = { innerHTML: '', querySelector: () => ({ classList: { add() {} }, querySelector: () => ({}), appendChild() {} }) };
  const doc = { documentElement: make('root'), createElement: () => ({ attachShadow: () => shadow, remove() {} }) };
  const toaster = T.createToaster({ document: doc, marks: globalThis.HeddyMarks, mount: () => fs, setTimeout: () => 0, clearTimeout() {} });
  toaster.show({ title: 'x', ms: 1 });
  assert.equal(added[0][0], 'fs');
  const desk = read('content/desk.js');
  assert.match(desk, /if \(!deskInSight\(\)\) \{\n        if \(key\) notify\(\{ kind: 'desk_jot', t: j\.t, quote: j\.text \}\);/);
  assert.match(desk, /function deskInSight\(\) \{\n      if \(doc\.fullscreenElement/);
  assert.match(desk, /if \(doc\.fullscreenElement\) return;\n/, 'no hidden note box takes YouTube’s keys in fullscreen');
});

test('the H toast: “Jotted · 2:48” and the line; an H that could not jot says why', () => {
  const tr = I.translator('en');
  const m = T.model({ kind: 'desk_jot', t: 168, quote: 'Map scales' }, 'en', tr);
  assert.equal(m.title, 'Jotted · 2:48');
  assert.equal(m.quote, '“Map scales”');
  assert.equal(T.model({ kind: 'desk_jot', t: 5 }, 'zh_CN', I.translator('zh_CN')).title, '已记下 · 0:05');
  assert.equal(T.model({ kind: 'desk_say', text: tr('deskNoLine') }, 'en', tr).title, tr('deskNoLine'));
  assert.equal(T.model({ kind: 'desk_say' }, 'en', tr), null);
});

// ─── Chinese fallback and retry ───────────────────────────────────────────

test('a line a stretch leaves out has no Chinese, so every view shows its English', () => {
  const lines = [{ t: 0, text: 'one' }, { t: 4, text: 'two' }, { t: 9, text: 'three' }];
  const stretches = [{ from: 0, to: 600, lines: [{ t: 0, text: '一' }, { t: 9, text: '三' }] }];
  assert.deepEqual(lines.map((l) => D.zhLine(stretches, l)), ['一', null, '三']);
  const desk = read('content/desk.js');
  assert.match(desk, /if \(view === 'zh' && z\) \{/, 'Chinese view: Chinese only when the line has it');
  assert.match(desk, /if \(view === 'bi' && z\) \{/, 'Bilingual: the English always, the Chinese when there is some');
});

test('a failed stretch is asked for again once the site’s 10-minute window has passed, when the child switches view', () => {
  assert.equal(D.ZH_FAIL_RETRY_MS, 10 * 60 * 1000);
  const at = { 0: 1000, 600: 500000 };
  assert.deepEqual(D.zhRetryDue(at, 1000 + D.ZH_FAIL_RETRY_MS - 1), []);
  assert.deepEqual(D.zhRetryDue(at, 1000 + D.ZH_FAIL_RETRY_MS), [0]);
  const desk = read('content/desk.js');
  assert.match(desk, /setLocal\(PREF\.view, v\[0\]\);\n          retryZh\(\);/);
  assert.match(desk, /st\.zh\.failedAt\[from\] = Date\.now\(\);/);
});

test('the failure line says “a few minutes”, not “tomorrow”', () => {
  assert.equal(I.t('en', 'digestZhFailed'), 'The Chinese lines did not come through — try again in a few minutes.');
  assert.equal(I.t('zh_CN', 'digestZhFailed'), '中文这次没出来——过几分钟再试。');
});

// ─── the tab row: Classroom's icons, and ←/→ (WAI-ARIA tabs) ──────────────

test('every tab carries Classroom’s icon at every column width (none is hidden in a narrow column)', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /\[\['quiz', 'quiz'\], \['jot', 'jot'\], \['digest', 'digest'\], \['insights', 'insights'\]\]\.forEach\(function \(t\) \{\n        var b = btn\('tab', ic\(t\[1\]\)\);/);
  const SH = load('./lib/desk-shell.js');
  assert.doesNotMatch(SH.CSS, /\.tab \.vi\{display:none\}/);
  for (const k of ['quiz', 'jot', 'digest', 'insights']) assert.ok(SH.IC[k], k);
});

test('←/→ on a desk tab move to the next or previous shown tab, wrapping, and are claimed; elsewhere YouTube keeps them', () => {
  const desk = read('content/desk.js');
  assert.match(desk, /\(e\.key === 'ArrowRight' \|\| e\.key === 'ArrowLeft'\) && t && t\.getAttribute && t\.getAttribute\('role'\) === 'tab'\)/, 'only when a desk tab is the target');
  assert.match(desk, /if \(type === 'keydown'\) \{ e\.preventDefault\(\); stepTab\(e\.key === 'ArrowRight' \? 1 : -1\); \}\n            e\.stopPropagation\(\);/);
  assert.match(desk, /var next = shown\[\(\(i < 0 \? 0 : i\) \+ dir \+ shown\.length\) % shown\.length\];/, 'wraps');
  assert.match(desk, /return \['quiz', 'jot', 'digest', 'insights'\]\.filter\(tabLive\)\.concat\(\['ask'\]\);/, 'the crest is the Ask tab, last');
  assert.match(desk, /ui\.tabs\[k\]\.tabIndex = st\.tab === k \? 0 : -1;/, 'roving tabindex');
  assert.doesNotMatch(read('content/youtube.js'), /ArrowRight|ArrowLeft/, 'the page’s own listener never touches the arrows');
});

// ─── the parity audit (desk-gaps.md): Classroom's desk, literally ─────────

const SH = load('./lib/desk-shell.js');
const desk = read('content/desk.js');

test('#1 icons are never hidden: Classroom’s phone values at ≤ 350 px, one more step at ≤ 335 px', () => {
  assert.match(SH.CSS, /@container \(max-width:350px\)\{\.tabs\{padding:0 8px;gap:2px\}\.tab\{padding:0 6px;gap:4px;font-size:13px\}\.tab \.vi\{width:15px;height:15px\}/);
  assert.match(SH.CSS, /@container \(max-width:335px\)\{\.tabs\{padding:0 6px;gap:0\}\.tab\{padding:0 4px\}\.tab \.vi\{width:14px;height:14px\}\}/);
  assert.doesNotMatch(SH.CSS, /\.vi\{display:none\}/);
});

test('#2 the desk’s mono and serif are bundled (JetBrains Mono, Source Serif 4, OFL), as bytes, YouTube only', () => {
  const F = load('./lib/fonts.js');
  assert.equal(F.MONO.split(',')[0], '"Heddy Mono"');
  assert.equal(F.SERIF.split(',')[0], '"Heddy Serif"');
  assert.match(read('fonts/OFL-JetBrainsMono.txt'), /SIL Open Font License, Version 1\.1/);
  assert.match(read('fonts/OFL-SourceSerif4.txt'), /SIL Open Font License, Version 1\.1/);
  const faces = load('./lib/font-desk-data.js');
  assert.deepEqual(faces.map((f) => f.family), ['Heddy Mono', 'Heddy Serif']);
  for (const f of faces) assert.equal(Buffer.from(f.base64, 'base64').subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(manifest().content_scripts[0].js.includes('lib/font-desk-data.js'));
  assert.doesNotMatch(JSON.stringify(manifest().web_accessible_resources), /jetbrains|serif/i, 'no font URL a page could probe');
  const added = [];
  const n = F.add({ fonts: { add: (x) => added.push(x) } }, faces, function FF(family, bytes, d) { this.family = family; this.d = d; });
  assert.equal(n, 2);
  assert.equal(F.add({ fonts: { add: (x) => added.push(x) } }, faces, function FF() {}), 0, 'once per page');
});

test('#3 one pill slides 200 ms cubic-bezier(.2,.7,.2,1); the panel comes in 10 px from the side of travel; the icon tilts −14° → 6° → 0 over 220 ms; nothing moves under reduced motion', () => {
  assert.match(SH.CSS, /\.ind\{position:absolute;left:0;width:0;bottom:7px;height:34px;border-radius:10px;/);
  assert.match(desk, /var EASE = 'cubic-bezier\(\.2,\.7,\.2,1\)';/);
  assert.match(desk, /play\(ui\.ind, \[\{ left: before\.l \+ 'px', width: before\.w \+ 'px' \}, \{ left: g\.l \+ 'px', width: g\.w \+ 'px' \}\], 200\);/);
  assert.match(desk, /\? 10 : -10;/);
  assert.match(desk, /var ICON_TILT = \[\{ transform: 'rotate\(-14deg\)' \}, \{ transform: 'rotate\(6deg\)' \}, \{ transform: 'rotate\(0\)' \}\];/);
  assert.match(desk, /play\(icon, ICON_TILT, 220\);/);
  assert.match(desk, /if \(!g \|\| !before \|\| !from \|\| from === st\.tab \|\| reducedMotion\(\)\) return;/);
});

test('#4 a tab with nothing behind it is drawn disabled, says why, and never takes the pill', () => {
  assert.match(SH.CSS, /\.tab\[aria-disabled="true"\]\{cursor:default;color:color-mix\(in srgb,var\(--muted\) 55%,transparent\)\}/);
  assert.match(desk, /b\.addEventListener\('click', function \(\) \{ if \(tabLive\(t\[0\]\)\) pickTab\(t\[0\]\); \}\);/);
  assert.match(desk, /if \(!tabLive\(k\)\) b\.title = tr\(k === 'quiz' \? 'deskQuizSoon' : 'deskInsightsSoon'\);/);
});

test('#5 the jot pop-up after every jot: “● Note saved · 0:31 — title”, the line, Undo · Open in Jotter, 5 s, 56 px under the desk’s top', () => {
  assert.match(SH.CSS, /\.jt\{position:absolute;z-index:6;left:10px;right:10px;top:56px;/);
  assert.match(SH.CSS, /\.jt\[data-anim\]\{animation:hd-toast 5s ease both\}/);
  assert.match(desk, /var TOAST_MS = 5000;/);
  assert.match(desk, /hd\.appendChild\(el\('span', 'ok', tr\('deskNoteSaved'\)\)\);/);
  assert.match(desk, /P\.clockOf\(j\.t\) \+ ' — ' \+ \(deps\.title\(\) \|\| ''\)/);
  assert.match(desk, /open\.addEventListener\('click', function \(\) \{ hideToast\(\); saveToJotters\(true\); \}\);/, 'Open in Jotter saves, then opens the Jotter');
  for (const call of ['jotted(r.last.id, key);', 'jotted(id, false);']) assert.ok(desk.includes(call), call);
  assert.equal(I.t('en', 'deskNoteSaved'), 'Note saved');
  assert.equal(I.t('zh_CN', 'deskOpenInJotter'), '在笔记本里打开');
});

test('#6–#8 every jot row is a button that plays from its time, with the play glyph on hover, the word Delete, and an H on a jot made with H', () => {
  assert.match(desk, /var it = el\('button', 'it'\);[\s\S]*it\.addEventListener\('click', function \(\) \{ seek\(j\.t\); \}\);/);
  assert.match(desk, /if \(j\.by === 'key'\) it\.appendChild\(el\('span', 'byj', 'H'\)\);/);
  assert.match(desk, /var del = el\('button', 'del', tr\('deskJotDelete'\)\);/);
  assert.match(SH.CSS, /\.ls \.it:hover\{background:var\(--sc-soft\)\}/);
  assert.match(SH.CSS, /\.ls \.del\{position:absolute;right:8px;bottom:8px;padding:2px 4px;/);
  const D2 = load('./lib/desk-model.js');
  const r = D2.parseStored([{ id: 'a', t: 1, kind: 'line', text: 'x', by: 'key' }, { id: 'b', t: 2, kind: 'note', text: 'y', by: 'evil' }]);
  assert.deepEqual(r.map((j) => j.by), ['key', undefined]);
  assert.equal(I.t('en', 'deskJotDeleted'), 'Jot deleted.');
});

test('#9 the composer: a time chip that plays, a field that grows to 120 px, Enter jots, Shift+Enter a new line, an empty Jot jots the spoken line', () => {
  assert.match(desk, /var field = el\('textarea'\);/);
  assert.match(desk, /if \(e\.key === 'Enter' && !e\.shiftKey && !e\.isComposing\)/);
  assert.match(desk, /if \(!ui\.field\.value\.trim\(\)\) return api\.pressJot\(false\);/);
  assert.match(desk, /field\.style\.height = Math\.min\(field\.scrollHeight, 120\) \+ 'px';/);
  assert.match(SH.CSS, /\.fld textarea\{[^}]*height:20px;max-height:120px;/);
});

test('#10 one Mentor colour everywhere (#0d7565 / #dcf1ec)', () => {
  assert.equal(SH.SC, A.MENTOR.sc);
  assert.equal(SH.SC_SOFT, A.MENTOR.scSoft);
});

test('#11 the crest: a 3 px --sc 30% ring and a 1 px lift on hover and focus', () => {
  assert.match(SH.CSS, /\.crest:hover \.eyes,\.crest:focus-visible \.eyes\{box-shadow:0 0 0 3px color-mix\(in srgb,var\(--sc\) 30%,transparent\);transform:translateY\(-1px\)\}/);
});

test('#14 search: the magnifier, the count, the matches only, Enter steps with a ring on the hit row', () => {
  const D2 = load('./lib/desk-model.js');
  assert.deepEqual(D2.matchLines([{ t: 0, text: 'Le café' }, { t: 1, text: 'tea' }], 'CAFE'), [0]);
  assert.deepEqual(D2.matchLines([{ t: 0, text: 'x' }], '  '), []);
  assert.match(SH.CSS, /\.srch\{margin-left:auto;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;/);
  assert.match(SH.CSS, /\.srch input:focus,\.srch input:not\(:placeholder-shown\)\{width:128px\}/);
  assert.match(SH.CSS, /\.ln\[data-hit\]\{box-shadow:inset 0 0 0 1px var\(--sc\)\}/);
  assert.match(desk, /st\.hit = \(st\.hit \+ \(e\.shiftKey \? m\.length - 1 : 1\)\) % m\.length;/);
  assert.equal(I.t('en', 'digestMatchesMany', '4'), '4 matches');
});

test('#15 the Digest’s insights card: a 44 px folded row, the brief, the door to Insights (disabled while there are none)', () => {
  const D2 = load('./lib/desk-model.js');
  assert.equal(D2.teaserOf('First thing. Second.'), 'First thing.');
  assert.equal(D2.briefOf('Short.'), 'Short.');
  assert.ok(D2.briefOf('word '.repeat(60)).endsWith('…'));
  assert.match(SH.CSS, /\.dnote\.closed\{padding:8px 10px 8px 12px\}/);
  assert.match(desk, /door\.setAttribute\('aria-disabled', 'true'\);/);
  assert.match(desk, /door\.addEventListener\('click', function \(\) \{ pickTab\('insights'\); \}\);/);
});

test('#16 #18 #19 #20 reading draws the clock and the skeletons; the only-the-channel’s-captions line can be hidden; Jump to now; 4 px between rows', () => {
  assert.match(desk, /rd\.appendChild\(el\('span', 'clock'\)\);/);
  assert.match(desk, /var sks = el\('div', 'sks'\);/);
  assert.match(desk, /setLocal\(PREF\.fine, true\);/);
  assert.match(desk, /var jump = el\('button', 'jump', tr\('digestJumpNow'\)\);/);
  assert.match(SH.CSS, /'?\.lns\{display:grid;gap:4px\}/);
});

test('#22 #23 Insights in the subject ink, serif titles, rules, the playing part’s edge; Add to my Jots makes tinted professor jots', () => {
  assert.match(SH.CSS, /\.ins > li\{display:grid;gap:4px;min-width:0;padding-top:10px;border-top:1px solid var\(--line\)\}/);
  assert.match(SH.CSS, /\.pttl\{min-width:0;font:600 14px\/1\.35 /);
  assert.match(SH.CSS, /\.cd \[data-subj="PHYS"\]\{--ins-ink:#2a5ac1\}/);
  assert.match(desk, /if \(next\) jots = next\.map\(function \(j\) \{ return j\.id === id \? Object\.assign\(\{\}, j, \{ by: 'professor' \}\) : j; \}\);/);
  assert.match(SH.CSS, /\.ls li\.ins2\{background:color-mix\(in srgb,var\(--sc\) 9%,var\(--surface\)\);box-shadow:inset 3px 0 0 var\(--sc\)\}/);
});

test('#27 Ask from the crest: “ASK NEWTON · ABOUT 1:09”, “Ask Newton…”, and the line being spoken on the first bubble', () => {
  const s0 = A.fresh({ about: 'video', atLabel: '1:09', attach: { kind: 'text', quote: 'They land at the same time.' } });
  assert.deepEqual(A.headerFor(s0, 'Newton'), { key: 'askAboutAt', args: ['Newton', '1:09'] });
  assert.equal(I.t('en', 'askAboutAt', 'Newton', '1:09'), 'Ask Newton · about 1:09');
  assert.equal(I.t('en', 'askPhShort', 'Newton'), 'Ask Newton…');
  const s1 = A.start(s0, 'ask', 'Why?');
  assert.equal(s1.items[0].at, '1:09 · “They land at the same time.”');
  assert.equal(A.fresh({ about: 'video', atLabel: 'javascript:' }).atLabel, null);
});

test('#31 the desk grows to what the open tab needs, capped at the window, and never shrinks on its own', () => {
  const D2 = load('./lib/desk-model.js');
  const base = { layout: 'column', playerH: 540, viewportH: 900, top: 68, reserve: 32 };
  assert.equal(D2.deskHeight({ ...base, content: 700 }), 700);
  assert.equal(D2.deskHeight({ ...base, content: 300, keep: 700 }), 700, 'keeps');
  assert.equal(D2.deskHeight({ ...base, content: 5000 }), 900 - 68 - 32 - 12, 'capped');
});
