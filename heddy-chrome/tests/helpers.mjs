// Shared by the tests: the extension root, a CommonJS loader for the
// extension's classic scripts, and the list of files that ship.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const load = createRequire(join(ROOT, 'package.json'));
export const read = (p) => readFileSync(join(ROOT, p), 'utf8');
export const manifest = () => JSON.parse(read('manifest.json'));

/** Every file a store build zips: the folder minus tests, scripts, docs and dev files. */
export function shippedFiles() {
  const skip = new Set(['tests', 'scripts', 'node_modules', '.git']);
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(ROOT, full);
      if (skip.has(rel.split('/')[0])) continue;
      if (statSync(full).isDirectory()) walk(full);
      else out.push(rel);
    }
  })(ROOT);
  return out;
}
