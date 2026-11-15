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
  assert.match(s, /let status = p\.todos\[i\]\.done \? "done" : "todo"/, 'the route takes done | todo');
  assert.match(s, /\["op": "add", "title": title\]/);
  assert.match(s, /api\.write\("\/api\/heddy\/mac\/line"/);
  assert.doesNotMatch(s, /"lens"/, 'M9: no lens in the menu bar');
  assert.match(s, /let order = \["calm", "bright", "sleepy", "wobbly"\]/, 'the four moods the server accepts');
  assert.match(s, /case "safeguarding": return \.safeguarding/, 'a tripped line shows the Childline message');
});

test('shortcuts in the ruled order, each to its aitutors.me page (M10)', () => {
  const s = swift();
  const bar = s.slice(s.indexOf('private var shortcuts: some View'), s.indexOf('// MARK: - The welcome sheet'));
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
  const box = s.slice(s.indexOf('BoxHeading(text: w.todoBox)'));
  assert.ok(box.indexOf('store.checkInRow') < box.indexOf('ForEach(p.todos)'), 'first row of the to-do box');
});
