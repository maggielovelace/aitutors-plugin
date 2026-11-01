// Shared by the tests: the extension root, a CommonJS loader for the
// extension's classic scripts, and the list of files that ship.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const load = createRequire(join(ROOT, 'package.json'));
export const read = (p) => readFileSync(join(ROOT, p), 'utf8');
export const manifest = () => JSON.parse(read('manifest.json'));

/** Every file a store build zips (scripts/shipped.mjs: the folder minus tests, scripts, store/, the icons' SVG sources, the READMEs and dev files). */
export { shippedFiles } from '../scripts/shipped.mjs';
