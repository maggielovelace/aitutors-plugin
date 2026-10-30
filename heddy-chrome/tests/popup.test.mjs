// The popup's shortcut row (owner, 2026-10-29): there is no default key, so it
// shows the child's own binding, else "Set a shortcut", which opens Chrome's
// shortcuts page. The H row is the YouTube state's supplement. Source pins,
// as the popup needs a browser; the rendered states were looked at by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

const src = read('popup/popup.js');

test('the shortcut row shows the live binding, else "Set a shortcut" → chrome://extensions/shortcuts', () => {
  assert.match(src, /chrome\.commands\.getAll\(\)/);
  assert.match(src, /x\.name === HeddyCourier\.COMMAND/);
  assert.match(src, /c && c\.shortcut \? c\.shortcut\.replace\(\/\\\+\/g, ' '\) : null/);
  assert.match(src, /if \(k\) slot\.textContent = k;\s*else slot\.replaceWith\(Object\.assign\(shortcutLink\(\)/);
  assert.match(src, /chrome\.tabs\.create\(\{ url: 'chrome:\/\/extensions\/shortcuts' \}\)/);
  assert.doesNotMatch(src, /Ctrl Shift J|⌘ Shift J/, 'no default key printed');
});

test('the YouTube state’s row is "Jot the line being spoken · H"', () => {
  assert.match(src, /keyRow\('h-quill', tr\('jotLineSpoken'\), tr\('jotLineSpokenSub'\), 'H'\)/);
});

test('Save page to Jotters is never refused for length in the popup (the courier cuts it)', () => {
  assert.doesNotMatch(src, /too_long|pageTooLong|MAX_PAGE_BYTES/);
});
