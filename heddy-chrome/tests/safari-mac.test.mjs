// Heddy in the Mac menu bar (aitutors.me PRD-v0.145.0, S2): the packaging that puts safari-mac/AppDelegate.swift
// into the Safari Xcode project, the Mac app's version and network entitlement, and the pieces of the Swift the
// owner's rulings (M1–M12) and the server contract (/api/heddy/mac/*) depend on. The Swift itself is compiled by
// `sh scripts/package-safari-app.sh` + xcodebuild; these tests pin what must not quietly drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, read, shippedFiles } from './helpers.mjs';

const script = () => readFileSync(join(ROOT, 'scripts/package-safari-app.sh'), 'utf8');
const swift = () => read('safari-mac/AppDelegate.swift');

// A converter-shaped project: Debug + Release for each of the four targets.
const config = (cfg, id, sdk, version = '1.0') =>
  `\t\tX /* ${cfg} configuration for PBXNativeTarget "T" */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n` +
  `\t\t\t\tCODE_SIGN_STYLE = Automatic;\n` +
  (sdk === 'macosx' ? '\t\t\t\tENABLE_APP_SANDBOX = YES;\n' : '') +
  `\t\t\t\tMARKETING_VERSION = ${version};\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ${id};\n\t\t\t\tSDKROOT = ${sdk};\n\t\t\t};\n\t\t\tname = ${cfg};\n\t\t};\n`;
const TARGETS = [
  ['me.aitutors.heddy.safari', 'iphoneos'],
  ['me.aitutors.heddy.safari.Extension', 'iphoneos'],
  ['me.aitutors.heddy.safari', 'macosx'],
  ['me.aitutors.heddy.safari.Extension', 'macosx'],
];
const project = (targets = TARGETS) => targets.map(([id, sdk]) => config('Debug', id, sdk) + config('Release', id, sdk)).join('');
const blocks = (text) => text.match(/\/\* (?:Debug|Release) configuration[\s\S]*?name = (?:Debug|Release);/g);

test('packaging copies safari-mac/AppDelegate.swift over the converter\'s Mac AppDelegate, and fails loudly without it', () => {
  const s = script();
  assert.match(s, /mac_delegate="\$project_dir\/Heddy\/macOS \(App\)\/AppDelegate\.swift"/);
  assert.match(s, /if \[ ! -f "\$mac_delegate" \]; then[\s\S]*?exit 1\s*\n\s*fi/, 'a missing template file stops the script');
  assert.match(s, /cp safari-mac\/AppDelegate\.swift "\$mac_delegate"/);
  // The copy and the project changes come after the converter ran, and before signing.
  const at = (re) => s.search(re);
  assert.ok(at(/safari-web-extension-packager/) < at(/cp safari-mac\/AppDelegate\.swift/));
  assert.ok(at(/cp safari-mac\/AppDelegate\.swift/) < at(/node scripts\/safari-mac-app\.mjs/));
  assert.ok(at(/node scripts\/safari-mac-app\.mjs/) < at(/node scripts\/safari-signing\.mjs/));
});

test('the Mac app and its extension become 1.1; iOS keeps its own version', async () => {
  const { macAppProject, MAC_APP_VERSION } = await import('../scripts/safari-mac-app.mjs');
  assert.equal(MAC_APP_VERSION, '1.1');
  const out = blocks(macAppProject(project()));
  for (const b of out) {
    const sdk = b.match(/SDKROOT = (\w+);/)[1];
    assert.match(b, new RegExp(`MARKETING_VERSION = ${sdk === 'macosx' ? '1\\.1' : '1\\.0'};`), `${sdk} version`);
  }
});

test('only the Mac APP gets com.apple.security.network.client (ENABLE_OUTGOING_NETWORK_CONNECTIONS), Debug and Release', async () => {
  const { macAppProject, NETWORK_CLIENT, MAC_APP_ID } = await import('../scripts/safari-mac-app.mjs');
  assert.equal(NETWORK_CLIENT, 'ENABLE_OUTGOING_NETWORK_CONNECTIONS = YES;');
  const once = macAppProject(project());
  assert.equal(once.split(NETWORK_CLIENT).length - 1, 2);
  for (const b of blocks(once)) {
    const isApp = b.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${MAC_APP_ID};`) && b.includes('SDKROOT = macosx;');
    assert.equal(b.includes(NETWORK_CLIENT), isApp);
  }
  assert.equal(macAppProject(once).split(NETWORK_CLIENT).length - 1, 2, 'running it twice adds nothing');
});

test('a changed converter template fails the Mac step instead of shipping an app with no network', async () => {
  const { macAppProject } = await import('../scripts/safari-mac-app.mjs');
  assert.throws(() => macAppProject(project(TARGETS.slice(0, 3))), /expected 4/);
  assert.throws(() => macAppProject(project().replace(/ENABLE_APP_SANDBOX = YES;\n/g, '')), /ENABLE_APP_SANDBOX/);
});

test('signing still finds its four Release targets after the Mac step (no new target)', async () => {
  const { macAppProject } = await import('../scripts/safari-mac-app.mjs');
  const { signProject, PROFILES } = await import('../scripts/safari-signing.mjs');
  assert.equal(Object.keys(PROFILES).length, 4);
  const signed = signProject(macAppProject(project()));
  assert.equal(signed.match(/CODE_SIGN_STYLE = Manual;/g).length, 4);
});

test('the Swift never ships inside the extension zip', () => {
  assert.ok(!shippedFiles().some((f) => f.startsWith('safari-mac/')));
});

test('menu bar app: owl status item + popover, open-at-login pre-ticked, Dock goes when the window closes (M1, M11, M12)', () => {
  const s = swift();
  assert.match(s, /NSStatusBar\.system\.statusItem/);
  assert.match(s, /private let popover = NSPopover\(\)/);
  assert.match(s, /\.sink \{ \[weak self\] _, _ in self\?\.updateBadge\(\) \}/);
  assert.match(s, /var openTodos: Int \{ connected \? \(panel\?\.openTodos \?\? 0\) : 0 \}/, 'the owl counts open to-dos');
  assert.match(s, /@State var openAtLogin = true/, 'the welcome sheet starts ticked');
  assert.match(s, /SMAppService\.mainApp\.register\(\)/);
  assert.match(s, /SMAppService\.mainApp\.unregister\(\)/);
  assert.match(s, /func applicationShouldTerminateAfterLastWindowClosed\(_ sender: NSApplication\) -> Bool \{\s*return false\s*\}/);
  assert.match(s, /if !others \{ NSApp\.setActivationPolicy\(\.accessory\) \}/, 'closing the last window drops the Dock icon');
  assert.match(s, /private func showMainWindow\(\) \{\s*NSApp\.setActivationPolicy\(\.regular\)/, 'the gear brings it back');
  assert.match(s, /func applicationShouldTerminate[\s\S]*?return \.terminateCancel/, 'the converter\'s quit-after-settings keeps the menu bar');
});

test('connect: ASWebAuthenticationSession on heddy-mac://, PKCE S256, the token only in the Keychain', () => {
  const s = swift();
  assert.match(s, /static let callbackScheme = "heddy-mac"/);
  assert.match(s, /ASWebAuthenticationSession\(url: url, callback: \.customScheme\(HeddyMac\.callbackScheme\)\)/);
  assert.match(s, /prefersEphemeralWebBrowserSession = false/);
  assert.match(s, /store\.link\("\/heddy-chrome\/mac-connect"\)/);
  assert.match(s, /URLQueryItem\(name: "state", value: state\), URLQueryItem\(name: "challenge", value: PKCE\.challenge\(verifier\)\)/);
  assert.match(s, /SHA256\.hash\(data: Data\(verifier\.utf8\)\)/);
  assert.match(s, /items\.first\(where: \{ \$0\.name == "state" \}\)\?\.value == state/, 'the answer must match our own state');
  assert.match(s, /"\/api\/heddy\/mac\/token"\), method: "POST", body: \["code": code, "verifier": verifier\]/);
  assert.match(s, /kSecClass as String: kSecClassGenericPassword/);
  assert.doesNotMatch(s, /UserDefaults[^\n]*token/i, 'the token is never in UserDefaults');
});

test('the panel speaks the S1 contract: bearer GET panel every 5 minutes, to-do ops, Tonight\'s line with no lens', () => {
  const s = swift();
  assert.match(s, /static let origin = URL\(string: "https:\/\/aitutors\.me"\)!/);
  assert.doesNotMatch(s, /localhost|127\.0\.0\.1/);
  assert.match(s, /static let refreshEvery: TimeInterval = 5 \* 60/);
  assert.match(s, /"Bearer \\\(token\)", forHTTPHeaderField: "Authorization"/);
  assert.match(s, /url\("\/api\/heddy\/mac\/panel", q\)/);
  assert.match(s, /\["op": "status", "id": todo\.id, "status": status\]/);
  assert.match(s, /func toggle\(_ todo: MacPanel\.Todo\) -> Task<Void, Never>\? \{ setStatus\(todo, todo\.state == "done" \? "todo" : "done"\) \}/, 'the box: done | todo');
  assert.match(s, /func cycle\(_ todo: MacPanel\.Todo\) -> Task<Void, Never>\? \{ setStatus\(todo, TodoList\.next\(todo\.state\)\) \}/, 'the pill: todo | doing | done (M15)');
  assert.match(s, /\["op": "add", "title": title\]/);
  assert.match(s, /api\.write\("\/api\/heddy\/mac\/line"/);
  assert.doesNotMatch(s, /"lens"/, 'M9: no lens in the menu bar');
  assert.match(s, /let order = \["calm", "bright", "sleepy", "wobbly"\]/, 'the four moods the server accepts');
  assert.match(s, /case "safeguarding" where ok2xx: return \.safeguarding/, 'a tripped line shows the Childline message');
});

test('shortcuts in the ruled order, each to its aitutors.me page (M10)', () => {
  const s = swift();
  const bar = s.slice(s.indexOf('var shortcuts: some View'), s.indexOf('// MARK: - The welcome sheet'));
  const order = bar.split('Shortcut(title: ').slice(1).map((chunk) => `${chunk.match(/^w\.(\w+)/)[1]} ${chunk.match(/store\.link\("([^"]+)"\)/)[1]}`);
  assert.deepEqual(order, ['home /study', 'jotters /study/jotters', 'cards /study/cards', 'clips /study/clips', 'exams /study/exam', 'tutors /study/tutor']);
  assert.ok(bar.indexOf('Shortcut(title: w.tutors') < bar.indexOf('actions.gear'), 'the gear is last, on the right');
  assert.match(s, /RoundButton\(label: w\.openCalendar, action: \{ actions\.open\(store\.link\("\/study\/calendar"\)\) \}\)/);
  assert.match(s, /func link\(_ path: String\) -> URL \{ api\.url\(\(lang == \.zh \? "\/zh" : ""\) \+ path\) \}/);
});

test('public repo: client code only, no secrets or server code in the Swift', () => {
  const s = swift();
  assert.doesNotMatch(s, /sk_live|sk_test|whsec_|service_role|SUPABASE|MCP_JWT|mcpJwtSecret|createHmac/i);
});

test('"Check in today · +5 pts": derived from today\'s stamp (S1 sends no such to-do), and it leads to Tonight\'s line', () => {
  const s = swift();
  assert.match(s, /guard let p = panel, p\.day == p\.today, p\.week\.checkIns != nil,\s*let today = p\.week\.days\.first\(where: \{ \$0\.isToday \}\) else \{ return nil \}\s*return today\.checkedIn/);
  assert.match(s, /static let checkInPoints = 5/, 'lib/calendar/points.ts DAILY_CHECK_IN_POINTS');
  assert.match(s, /Button\(action: \{ if !done \{ lineFocused = true \} \}\)/);
  assert.match(s, /focus: \$lineFocused/);
  assert.match(s, /return Array\(\(doing \+ \(checkIn == false \? \[\.checkIn\(done: false\)\] : \[\]\) \+ todo\)\.prefix\(rows\)\)/, 'heads the To do rows while unticked, leaves once checked in (M15)');
  assert.match(s, /var todoRows: \[TodoRow\] \{ TodoList\.rows\(checkIn: checkInRow, todos: panel\?\.todos \?\? \[\]\) \}/);
});

// Owner 2026-11-15: "when the pointer hovers on it, please give reactions — currently looks like freezing."
const panelSource = () => {
  const s = swift();
  return s.slice(s.indexOf('struct RoundButton'), s.indexOf('// MARK: - The welcome sheet'));
};

test('hover: one style lifts on hover, darkens on press, eases in 120 ms, shows the pointing hand, and stays still when disabled', () => {
  const s = swift();
  assert.match(s, /static let hover = 0\.09/);
  assert.match(s, /static let press = 0\.14/);
  assert.match(s, /static let ease = Animation\.easeOut\(duration: 0\.12\)/);
  assert.equal(s.split('private var lit: Bool { enabled && (hovering || (hoverID != nil && preview == hoverID)) }').length - 1, 2, 'buttons AND text boxes stay still when disabled');
  assert.match(s, /\.overlay\(shape\.fill\(Color\.white\.opacity\(lit && !pressed \? amount : 0\)\)/);
  assert.match(s, /\.overlay\(shape\.fill\(Color\.black\.opacity\(enabled && pressed \? Lift\.press : 0\)\)/);
  assert.match(s, /\.onHover \{ hovering = \$0 \}\s*\.hoverCursor\(\.pointingHand, when: enabled\)/);
  assert.match(s, /NSCursor\.pop\(\)/, 'every pushed cursor is popped');
  assert.match(s, /\.onDisappear \{\s*if pushed \{ NSCursor\.pop\(\); pushed = false \}/);
  assert.doesNotMatch(s, /focusEffectDisabled/, 'keyboard focus rings still work');
});

test('hover: every control in the panel uses it (no plain buttons left)', () => {
  const p = panelSource();
  assert.doesNotMatch(p, /\.buttonStyle\(\.plain\)/);
  const ids = {
    'round buttons ‹ › ⤢': /\.buttonStyle\(NightButton\(shape: Circle\(\), edge: Night\.gold, hoverID: label\)\)/,
    'Today pill': /hoverID: "pill"/,
    'day stamps': /hoverID: "stamp:\\\(d\.day\)"/,
    'to-do rows': /hoverID: "todo:\\\(t\.id\)"/,
    'check-in row': /hoverID: "checkin"/,
    '+ Add a to-do': /textButton\(w\.addTodo, id: "add"\)/,
    'All N in My calendar': /id: "all", colour: Night\.gold\)/,
    'status pill': /hoverID: "pill:\\\(t\.id\)"/,
    'cancel ✕': /hoverID: "cancel-add"/,
    'Heddy\'s eyes': /hoverID: "eyes"/,
    'shortcuts incl. Cards badge': /hoverID: "shortcut:\\\(title\)"/,
    'gear': /hoverID: "gear"/,
    'Connect': /hoverID: "connect"/,
    'Tonight\'s line field': /\.modifier\(FieldHover\(enabled: forToday, focused: lineFocused, hoverID: "line"\)\)/,
  };
  for (const [name, re] of Object.entries(ids)) assert.match(p, re, name);
  assert.match(swift(), /struct FieldHover: ViewModifier \{[^]*?\.hoverCursor\(\.iBeam, when: enabled\)/, 'I-beam over the line, none when disabled');
  assert.match(p, /\.hoverCursor\(\.iBeam\)/, 'I-beam over the new to-do box');
  assert.match(p, /\.strokeBorder\(on \? Color\.accentColor : hover \? Night\.gold : Night\.faint/, 'the tick box answers its row');
  assert.match(p, /Button\(action: \{ store\.show\(d\.day\) \}\) \{ DayStamp\(day: d\) \}/, 'a stamp is a real control');
});

test('the day pill never says the weekday twice: "Tue · 17 Nov", "Today · Sat 14"', () => {
  const s = swift();
  assert.match(s, /if day == today \{ return \(w\.today, short\(day, w\.lang\)\) \}/);
  assert.match(s, /if day == add\(today, -1\) \{ return \(w\.yesterday, short\(day, w\.lang\)\) \}/);
  assert.match(s, /if day == add\(today, 1\) \{ return \(w\.tomorrow, short\(day, w\.lang\)\) \}/);
  assert.match(s, /return \(weekdayName\(day, w\.lang\), dayMonth\(day, w\.lang\)\)/);
  assert.match(s, /formatter\("M月d日", \.zh\)\.string\(from: d\) : formatter\("d MMM"\)\.string\(from: d\)/);
  assert.match(s, /Text\(pill\.word\)[^]*?Text\("· " \+ pill\.rest\)/);
  assert.doesNotMatch(s, /pillWord/);
});

test('ring: both lines inside the inner circle at any count, the artifact\'s sizes as the most (owner: "7/5" overflowed)', () => {
  const s = swift();
  assert.match(s, /static let textWidth: CGFloat = 30/);
  assert.match(s, /static let textHeight: CGFloat = 26/);
  assert.match(s, /static let countSize: CGFloat = 15/);
  assert.match(s, /static let captionSize: CGFloat = 8/);
  assert.match(s, /\.font\(\.system\(size: Self\.countSize, weight: \.semibold\)\)\s*\.lineLimit\(1\)\.minimumScaleFactor\(Self\.minScale\)/);
  assert.match(s, /\.font\(\.system\(size: Self\.captionSize, weight: \.medium\)\)\.foregroundColor\(Night\.soft\)\s*\.lineLimit\(1\)\.minimumScaleFactor\(Self\.minScale\)/);
  assert.match(s, /\.frame\(width: Self\.textWidth, height: Self\.textHeight\)/);
  assert.match(s, /min\(1, Double\(done \?\? 0\) \/ Double\(goal\)\)/, 'over the goal the ring stays full');
});

test('pill: always one line; the word never wraps or truncates, the date shrinks first', () => {
  const s = swift();
  assert.match(s, /Text\(pill\.word\)\.font\(\.system\(size: 14, weight: \.semibold\)\)\s*\.lineLimit\(1\)\.fixedSize\(horizontal: true, vertical: false\)\.layoutPriority\(2\)/);
  assert.match(s, /Text\("· " \+ pill\.rest\)\.font\(\.system\(size: 14\)\)\.foregroundColor\(Night\.soft\)\s*\.lineLimit\(1\)\.minimumScaleFactor\(0\.7\)\.layoutPriority\(1\)/);
});

test('to-dos (M15, design B): five rows, Doing first, a pill on each, counts in the heading, All N in My calendar', () => {
  const s = swift();
  assert.match(s, /static let rows = 5/, 'the box never grows past five');
  assert.doesNotMatch(s, /TodoFold|todosExpanded|showMore|showLess|listCeiling|ScrollView\(\.vertical\) \{ todoRows/, 'no fold, no expand, no inner scroll');
  assert.match(s, /let open = todos\.filter \{ \$0\.state != "done" \}/, 'done rows leave the list');
  assert.match(s, /case "todo": return "doing"\s*case "doing": return "done"\s*default: return "todo"/, 'To do → Doing → Done → To do');
  assert.match(s, /case "doing": return lang == \.zh \? "进行中" : "Doing"\s*case "done": return lang == \.zh \? "已完成" : "Done"\s*default: return lang == \.zh \? "待做" : "To do"/, 'the catalog\'s statuses');
  assert.match(s, /Text\(w\.todoCounts\(p\.openTodos, p\.doneToday \?\? 0\)\)/, '"N open · M done" in the heading');
  assert.match(s, /textButton\(w\.addTodo, id: "add"\)[^]*?Spacer\(minLength: 0\)[^]*?textButton\(w\.allInCalendar\(p\.openTodos\), id: "all", colour: Night\.gold\) \{ actions\.open\(store\.link\("\/study\/calendar"\)\) \}/, 'Add left, All N right, one line');
  assert.match(s, /Button\(action: \{ store\.cycle\(t\) \}\)/, 'the pill cycles');
  assert.match(s, /Tickbox\(on: t\.state == "done", doing: t\.state == "doing"\)/, 'Doing: the blue ring');
  assert.match(s, /static let doing = Color\(hex: 0x7AA7FF\)/);
  assert.match(s, /handleWrite\(r, revert: before\)/, 'a refused write rolls back');
  assert.match(s, /case \.ok\(_, let itemId\):[^]*?if let itemId \{ showAdded\(id: itemId, title: title\) \}/, 'an added to-do shows at once, with the id the server gave it (owner ruling)');
  assert.match(s, /static let slide: Double = 0\.15/);
  assert.match(s, /withAnimation\(\.easeInOut\(duration: TodoList\.slide\)\) \{ panel = p \}/, 'a row leaving slides');
});

test('eyes: the site\'s blink + gaze, only while the popover shows, never with Reduce Motion', () => {
  const s = swift();
  assert.match(s, /static let blinkPeriod: TimeInterval = 6\.5/);
  assert.match(s, /static let gazePeriod: TimeInterval = 11/);
  assert.match(s, /\(0\.34, 0\.1\)/);
  assert.match(s, /\(0\.22, CGPoint\(x: 3\.2, y: -1\)\)/);
  assert.match(s, /TimelineView\(\.animation\(minimumInterval: 1\.0 \/ 30, paused: !animating\)\)/, 'no timeline while not animating');
  assert.match(s, /var eyesAnimating: Bool \{ panelVisible && !reduceMotion \}/);
  assert.match(s, /HeddyEyes\(mood: store\.mood, animating: store\.eyesAnimating,/);
  assert.match(s, /func popoverWillShow[^]*?store\.reduceMotion = NSWorkspace\.shared\.accessibilityDisplayShouldReduceMotion[^]*?store\.panelVisible = true/);
  assert.match(s, /func popoverDidClose\(_ notification: Notification\) \{\s*store\.panelVisible = false/);
  assert.match(s, /popover\.delegate = self/);
  assert.match(s, /lookUp: eyesHover && !store\.reduceMotion/);
});

test('new to-do box: Esc and ✕ cancel, clicking away only closes an empty box, a failure shows in red', () => {
  const s = swift();
  assert.match(s, /\.onExitCommand \{ onExit\?\(\) \}/);
  assert.match(s, /focus: \$addFocused, onExit: store\.cancelAdd\)/);
  assert.match(s, /Button\(action: store\.cancelAdd\) \{\s*Icons\.close/);
  assert.match(s, /\.onChange\(of: addFocused\) \{ _, focused in if !focused \{ store\.blurAdd\(\) \} \}/);
  assert.match(s, /if let e = store\.addError \{\s*Text\(e\)\.font\(\.system\(size: 12\)\)\.foregroundColor\(Night\.test\)/);
});

test('the bottom-right button wears heddy.app\'s mascot (heddy-focus.svg on the SiteChrome tile); its menu is unchanged', () => {
  const s = swift();
  const bar = s.slice(s.indexOf('var shortcuts: some View'), s.indexOf('// MARK: - The welcome sheet'));
  assert.match(bar, /Button\(action: actions\.gear\) \{\s*HeddyMascot\(size: Self\.mascotSize\)/);
  assert.doesNotMatch(bar, /Icons\.gear/);
  assert.match(bar, /\.buttonStyle\(NightButton\(shape: RoundedRectangle\(cornerRadius: 8\), hoverID: "gear"\)\)\s*\.help\(w\.heddyMenu\)\s*\.accessibilityLabel\(w\.heddyMenu\)/);
  assert.match(s, /var heddyMenu: String \{ lang == \.zh \? "Heddy 菜单" : "Heddy menu" \}/);
  // the tile, as SiteChrome.tsx draws it
  assert.match(s, /RoundedRectangle\(cornerRadius: 10 \* k\)/);
  assert.match(s, /Color\(hex: 0x1C3763\), location: 0\), \.init\(color: Color\(hex: 0x0B1120\), location: 0\.78\)/);
  assert.match(s, /center: UnitPoint\(x: 0\.26, y: 0\.14\)/);
  assert.match(s, /\.frame\(width: 31 \* k, height: 31 \* k\)\s*\.offset\(x: 2 \* k, y: \(34 - 31 \+ 2\) \* k\)/, 'owl 31 at left 2, bottom -2');
  assert.match(s, /Circle\(\)\.fill\(Self\.amber\)\s*\.frame\(width: 6 \* k, height: 6 \* k\)/);
  assert.match(s, /\.offset\(x: \(34 - 4 - 6\) \* k, y: 4 \* k\)/, 'the dot at top 4 / right 4');
  assert.match(s, /\.clipShape\(RoundedRectangle\(cornerRadius: 10 \* k\)\)/);
  // the owl, path for path (heddy-focus.svg)
  for (const piece of [
    /body\.move\(to: pt\(60, 18\)\); body\.addCurve\(to: pt\(96, 62\), control1: pt\(82, 18\), control2: pt\(96, 36\)\)/,
    /wl\.move\(to: pt\(33, 54\)\); wl\.addCurve\(to: pt\(33, 99\), control1: pt\(21, 64\), control2: pt\(21, 88\)\)/,
    /tuft\.move\(to: pt\(55\.5, 18\)\); tuft\.addQuadCurve\(to: pt\(64\.5, 18\), control: pt\(60, 8\.5\)\)/,
    /face\.move\(to: pt\(60, 38\)\); face\.addQuadCurve\(to: pt\(37, 62\), control: pt\(39, 41\)\)/,
    /beak\.move\(to: pt\(60, 67\)\); beak\.addLine\(to: pt\(54\.5, 72\)\)/,
    /\(46\.0, 13\.5, 6\.7, 49\.5, 53\.2, 2\.4\), \(74, 11, 5\.6, 76\.8, 53\.8, 2\)/,
    /static let star = Color\(hex: 0x238744\)/,
    /static let wing = Color\(hex: 0xECEBE5\)/,
  ]) assert.match(s, piece);
  assert.doesNotMatch(s, /heddy-wing|heddy-pupil|heddy-body/, 'the SVG\'s animation classes are not carried over');
});

test('Mentor\'s composer: today before 21:00 in place of Tonight\'s line, flipping at 21:00 while open; Enter opens the room', () => {
  const s = swift();
  assert.match(s, /static let lineOpensHour = 21/);
  assert.equal(s.match(/lineOpensHour = /g).length, 1, 'the hour is written in one place');
  assert.match(s, /!isToday \|\| calendar\.component\(\.hour, from: now\) >= lineOpensHour/);
  assert.match(s, /let opens = calendar\.date\(byAdding: \.hour, value: lineOpensHour, to: start\)!/);
  assert.doesNotMatch(s, /18:00/, 'no stale 18:00 left in the comments');
  assert.match(s, /TimelineView\(\.explicit\(MentorComposer\.flips\(after: Date\(\)\)\)\) \{ _ in\s*if MentorComposer\.showsLine\(isToday: p\.day == p\.today, now: previewNow \?\? Date\(\)\) \{\s*lineRow\(p\)\s*\} else \{\s*mentorRow\(p\)/);
  assert.match(s, /eveningRow\(p\)\.padding\(\.top, 10\)/);
  assert.doesNotMatch(s, /\n\s+lineRow\(p\)\.padding/, 'the line row is only reached through the switch');
  assert.match(s, /var askMentorPlaceholder: String \{ lang == \.zh \? "问 Mentor，或加到日历" : "Ask Mentor, or add to your calendar" \}/);
  // Enter: the link, then clear; empty does nothing
  assert.match(s, /guard let url = MentorComposer\.askURL\(store\.askText, day: p\.today, base: store\.link\("\/study\/calendar"\)\) else \{ return \}\s*store\.askText = ""\s*actions\.open\(url\)/);
  assert.match(s, /URLQueryItem\(name: "day", value: day\), URLQueryItem\(name: "ask", value: String\(t\.prefix\(askMax\)\)\)/);
  assert.match(s, /replacingOccurrences\(of: "\+", with: "%2B"\)/);
  // the row matches the line row: 44×40 crest box + 40-high box, the same fills and borders
  assert.match(s, /MentorCrest\(\)\s*\.frame\(width: 26, height: 26\)\s*\.frame\(width: 44, height: 40\)\s*\.background\(RoundedRectangle\(cornerRadius: 10\)\.fill\(Night\.field\)\)/);
  assert.match(s, /\.modifier\(FieldHover\(enabled: true, focused: askFocused, hoverID: "ask"\)\)/);
  // the crest is the calendar's MentorMark
  assert.match(s, /static let ring = Color\(hex: 0x2F8A53\)/);
  assert.match(s, /for \(x, o\) in \[\(33\.0, 1\.0\), \(50, 0\.5\), \(67, 0\.25\)\]/);
  assert.match(s, /ctx\.stroke\(disc, with: \.color\(Self\.ring\), lineWidth: 3\)/);
});
