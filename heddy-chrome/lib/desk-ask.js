// lib/desk-ask.js — Ask {professor}, the desk's crest (the Round 8 contract's
// § 6). The ONE place the desk asks: content/desk.js calls openAsk and knows
// nothing of where the asking happens.
//
// Phase 8a: Heddy's existing room window (/capture/room, the Ask Heddy flow),
// through the internal heddy-ui:tool; the background turns `t` into the
// video's address at that second (lib/snap.js). The owner wants Ask, Explain
// and Make a card in a pop-up tutor room INSIDE the desk instead (Classroom's
// 380 × 520 mini room, 2026-10-31); that needs a server chat endpoint, so the
// next round replaces this function's body and nothing else.
//
//   ctx: { line, title, youtubeId, t }  line: the line being spoken, or null
//   send(message) → Promise             chrome.runtime.sendMessage, quietly
(function (root) {
  /** The words the room opens on: the line being spoken, else the title. */
  function quoteFor(ctx) {
    return (ctx && (ctx.line || ctx.title || ctx.youtubeId)) || '';
  }

  function openAsk(ctx, send) {
    return send({ type: 'heddy-ui:tool', tool: 'ask', quote: quoteFor(ctx), context: '', t: ctx.t });
  }

  var api = { openAsk: openAsk, quoteFor: quoteFor };
  root.HeddyDeskAsk = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
