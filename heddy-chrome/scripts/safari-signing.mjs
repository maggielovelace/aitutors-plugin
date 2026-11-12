// App Store signing for the Xcode project that package-safari-app.sh generates.
// The converter writes Automatic signing, which from the command line asks for
// a Development profile; uploads use manual signing with the App Store profiles
// named below (created in the developer account, valid until 2027-09-16).
// Release configurations only; Debug stays Automatic for running on a device.
// Also adds two Info.plist keys App Store Connect checks at upload: the Mac
// app's category, and the export-compliance answer (no non-exempt encryption).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TEAM = 'SK67LXX843';
export const PROFILES = {
  'me.aitutors.heddy.safari|iphoneos': 'Heddy Safari iOS App Store',
  'me.aitutors.heddy.safari|macosx': 'Heddy Safari Mac App Store',
  'me.aitutors.heddy.safari.Extension|iphoneos': 'Heddy Safari Ext iOS App Store',
  'me.aitutors.heddy.safari.Extension|macosx': 'Heddy Safari Ext Mac App Store',
};

/** The project text with every Release target configuration signed for the App Store. */
export function signProject(text) {
  let count = 0;
  const out = text.replace(/\/\* Release configuration for PBXNativeTarget[^\n]*\n[\s\S]*?name = Release;/g, (block) => {
    const id = block.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/)?.[1];
    const sdk = block.match(/SDKROOT = (\w+);/)?.[1];
    const profile = PROFILES[`${id}|${sdk}`];
    if (!profile) throw new Error(`no App Store profile for ${id} on ${sdk}`);
    if (!block.includes('CODE_SIGN_STYLE = Automatic;')) throw new Error(`${id} on ${sdk}: expected Automatic signing`);
    const lines = [
      'CODE_SIGN_STYLE = Manual;',
      `DEVELOPMENT_TEAM = ${TEAM};`,
      '"CODE_SIGN_IDENTITY" = "Apple Distribution";',
      `PROVISIONING_PROFILE_SPECIFIER = "${profile}";`,
    ];
    if (!id.endsWith('.Extension')) {
      lines.push('INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;');
      if (sdk === 'macosx') lines.push('INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.education";');
    }
    count++;
    return block.replace('CODE_SIGN_STYLE = Automatic;', lines.join('\n\t\t\t\t'));
  });
  if (count !== Object.keys(PROFILES).length) throw new Error(`signed ${count} Release configurations, expected ${Object.keys(PROFILES).length}`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  writeFileSync(file, signProject(readFileSync(file, 'utf8')));
}
