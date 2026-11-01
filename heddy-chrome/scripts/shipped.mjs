// The files a store build ships: the extension folder minus what only the
// repository needs. scripts/package.mjs zips exactly this list, and the tests
// scan exactly this list (tests/helpers.mjs), so what the tests check is what
// the Web Store receives.
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Folders: tests, these scripts, the store listing and its renders, the icons'
// SVG sources (the PNGs are rendered from them), the built zip (dist/),
// dependencies and git.
const SKIP_DIRS = new Set(['tests', 'scripts', 'store', 'icons/src', 'dist', 'node_modules', '.git']);
// Files: the READMEs and package.json are the repository's, not Chrome's.
// PRIVACY.md and LICENSE ship; the fonts' OFL texts ship with the fonts.
const SKIP_FILES = new Set(['README.md', 'README.zh-CN.md', 'package.json', 'package-lock.json']);
const SKIP_NAMES = /^(\.DS_Store|\._.*|Thumbs\.db|.*~|\.gitignore)$/;

/** Every shipped file, relative to the extension root, sorted. */
export function shippedFiles(root = ROOT) {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full);
      if (SKIP_NAMES.test(name)) continue;
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(rel)) walk(full);
      } else if (!SKIP_FILES.has(rel)) out.push(rel);
    }
  })(root);
  return out.sort();
}
