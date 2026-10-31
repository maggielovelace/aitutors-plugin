// The card toasts (owner, 2026-10-29): "Card made" + Undo + Open in Jotter,
// and its Undo's answer, "Card deleted." (1.8 s) or "Couldn't undo that
// card.". Round 9 (D78): the Undo is a background request (lib/web-routes.js,
// tests/round9.test.mjs), never a window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './helpers.mjs';

globalThis.HeddyProtocol = load('./lib/protocol.js');
globalThis.HeddyConfig = load('./lib/config.js');
globalThis.HeddyCrop = load('./lib/crop.js');
const P = globalThis.HeddyProtocol;
const Toast = load('./lib/toast.js');

const CID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const CARDS = ['A1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002'];
const cards = CARDS.map((c) => c.toLowerCase());
const ids = (n) => Array.from({ length: n }, (_, i) => `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

// ─── the result's cardIds ────────────────────────────────────────────────────

test('a result’s cardIds: 1–10 UUIDs, lowercased; anything else is none', () => {
  const r = (cardIds) => P.parseExternal({ type: 'heddy:result', v: 1, cid: CID, ok: true, cardIds }).cardIds;
  assert.deepEqual(r(CARDS), cards);
  assert.equal(r(ids(10)).length, 10);
  assert.equal(r(ids(11)), null, 'more than 10');
  assert.equal(r([]), null);
  assert.equal(r([CARDS[0], 'not-a-uuid']), null);
  assert.equal(r('a1000000-0000-4000-8000-000000000001'), null, 'not an array');
});

// ─── Make a card ─────────────────────────────────────────────────────────────

test('the “Card made” model: Undo carries the cards; no valid cards, no Undo', () => {
  const tr = (k) => k;
  const m = Toast.model({ kind: 'card', cardIds: cards, href: 'https://aitutors.me/study/jotters' }, 'en', tr);
  assert.equal(m.title, 'toastCardMade');
  assert.deepEqual(m.undo, { label: 'toastUndo', cardIds: cards });
  assert.deepEqual(m.open, { label: 'toastOpenInJotter', href: 'https://aitutors.me/study/jotters', quiet: true });
  assert.equal(Toast.model({ kind: 'card', cardIds: [] }, 'en', tr).undo, null);
  assert.equal(Toast.model({ kind: 'card', cardIds: ids(11) }, 'en', tr).undo, null);
  assert.equal(Toast.model({ kind: 'card' }, 'en', tr).undo, null);
});

test('“Card deleted.” for 1.8 s; “Couldn’t undo that card.” on failure', () => {
  const tr = (k) => k;
  assert.deepEqual(Toast.model({ kind: 'card_undone' }, 'en', tr), { title: 'toastCardDeleted', ms: 1800 });
  assert.equal(Toast.model({ kind: 'card_undo_failed' }, 'en', tr).title, 'toastCardUndoFailed');
  const en = JSON.parse(read('_locales/en/messages.json'));
  assert.equal(en.toastCardMade.message, 'Card made');
  assert.equal(en.toastCardDeleted.message, 'Card deleted.');
  assert.equal(en.toastCardUndoFailed.message, "Couldn't undo that card.");
});

test('both toasters send the card Undo to the background', () => {
  for (const f of ['content/page-tray.js', 'content/youtube.js']) {
    assert.match(read(f), /onUndoCards: function \(cardIds\) \{ send\(\{ type: 'heddy-ui:undo-card', cardIds: cardIds \}\); \}/, f);
  }
  assert.match(read('lib/toast.js'), /if \(m\.undo && m\.undo\.cardIds\) \{[\s\S]*?deps\.onUndoCards\(cardIds\)/);
});

// ─── Explain and Ask Heddy ───────────────────────────────────────────────────

