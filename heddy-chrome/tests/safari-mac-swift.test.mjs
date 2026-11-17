// Compiles safari-mac/AppDelegate.swift with tests/swift/selftest.swift and runs it: the to-do add request and its
// answers (200/201/400/401/503/safeguarding), the add/cancel paths, Return and Esc in a real text field, the folded
// to-do box, the pill, the ring and the eyes' motion. macOS with Xcode only; skipped elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const hasSwift = process.platform === 'darwin' && spawnSync('xcrun', ['--find', 'swiftc']).status === 0;

test('the Mac app\'s Swift behaves (selftest)', { skip: !hasSwift && 'needs macOS + Xcode', timeout: 600_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'heddy-mac-selftest-'));
  try {
    // The app's own @main is the AppDelegate; the selftest brings its own.
    const app = readFileSync(join(ROOT, 'safari-mac/AppDelegate.swift'), 'utf8').replace(/^@main$/m, '');
    writeFileSync(join(dir, 'app.swift'), app);
    execFileSync('xcrun', ['swiftc', '-parse-as-library', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14.4`,
      '-o', join(dir, 'selftest'), join(ROOT, 'tests/swift/stub.swift'), join(dir, 'app.swift'), join(ROOT, 'tests/swift/selftest.swift')],
    { stdio: 'pipe' });
    const run = spawnSync(join(dir, 'selftest'), { encoding: 'utf8', timeout: 120_000 });
    const failed = run.stdout.split('\n').filter((l) => l.startsWith('FAIL'));
    assert.deepEqual(failed, [], run.stdout);
    assert.match(run.stdout, /SELFTEST OK/);
    assert.equal(run.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
