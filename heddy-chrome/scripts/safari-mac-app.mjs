// The Mac app's own settings for the Xcode project that package-safari-app.sh generates (aitutors.me
// PRD-v0.145.0, Heddy in the Mac menu bar, S2). Run after safari-mac/AppDelegate.swift is copied in.
//
//   * The macOS app and its extension become version MAC_APP_VERSION (1.1.3). iOS is left at the converter's
//     version: the menu bar is Mac only, and an iOS build carries its own number.
//   * The macOS APP (not the extension) gets ENABLE_OUTGOING_NETWORK_CONNECTIONS = YES, which Xcode signs in as the
//     com.apple.security.network.client entitlement: the menu bar fetches its panel from aitutors.me under the
//     App Sandbox. Debug and Release both, so a local run behaves like the store build.
//
// Throws when the project does not have exactly the two macOS targets with two configurations each, so a changed
// converter template fails the packaging loudly instead of shipping an app that cannot reach the network.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MAC_APP_VERSION = '1.1.3';
export const MAC_APP_ID = 'me.aitutors.heddy.safari';
export const NETWORK_CLIENT = 'ENABLE_OUTGOING_NETWORK_CONNECTIONS = YES;';

/** The project text with the macOS targets at `version` and the macOS app allowed outgoing connections. */
export function macAppProject(text, version = MAC_APP_VERSION) {
  let macConfigs = 0;
  let appConfigs = 0;
  const out = text.replace(/\/\* (?:Debug|Release) configuration for PBXNativeTarget[^\n]*\n[\s\S]*?name = (?:Debug|Release);/g, (block) => {
    const id = block.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/)?.[1];
    const sdk = block.match(/SDKROOT = (\w+);/)?.[1];
    if (sdk !== 'macosx') return block;
    if (!/MARKETING_VERSION = [^;]+;/.test(block)) throw new Error(`${id} on macosx: no MARKETING_VERSION to set`);
    let next = block.replace(/MARKETING_VERSION = [^;]+;/, `MARKETING_VERSION = ${version};`);
    macConfigs++;
    if (id === MAC_APP_ID) {
      if (!next.includes('ENABLE_APP_SANDBOX = YES;')) throw new Error(`${id} on macosx: expected ENABLE_APP_SANDBOX = YES`);
      if (!next.includes(NETWORK_CLIENT)) next = next.replace('ENABLE_APP_SANDBOX = YES;', `ENABLE_APP_SANDBOX = YES;\n\t\t\t\t${NETWORK_CLIENT}`);
      appConfigs++;
    }
    return next;
  });
  if (macConfigs !== 4) throw new Error(`found ${macConfigs} macOS target configurations, expected 4`);
  if (appConfigs !== 2) throw new Error(`found ${appConfigs} macOS app configurations, expected 2`);
  return out;
}

/** heddy-mac:// as the macOS app's own URL type (2026-11-22): the connect page answers heddy-mac://connected in the
 *  DEFAULT browser, and macOS hands it to Heddy's application(_:open:). Before, a sign-in window had to catch it, and
 *  on macOS 26 Safari and with Chrome as the default browser it did not. Added once; throws on a plist it cannot read. */
export const MAC_URL_SCHEME = 'heddy-mac';
export function macAppInfoPlist(text) {
  if (!/<plist[^>]*>\s*<dict>/.test(text) || !/<\/dict>\s*<\/plist>\s*$/.test(text)) throw new Error('macOS (App)/Info.plist: expected one top-level <dict>');
  if (text.includes('<key>CFBundleURLTypes</key>')) {
    if (!text.includes(`<string>${MAC_URL_SCHEME}</string>`)) throw new Error('macOS (App)/Info.plist: CFBundleURLTypes without heddy-mac');
    return text;
  }
  const types = `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${MAC_APP_ID}.connect</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${MAC_URL_SCHEME}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`;
  return text.replace(/<\/dict>\s*<\/plist>\s*$/, `${types}</dict>\n</plist>\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [flag, file] = process.argv[2] === '--plist' ? ['plist', process.argv[3]] : ['project', process.argv[2]];
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, flag === 'plist' ? macAppInfoPlist(text) : macAppProject(text));
}
