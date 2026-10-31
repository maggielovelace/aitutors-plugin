// content/youtube-selectors.js — EVERY YouTube selector Heddy depends on, in
// one place (PRD-v0.96.0 Risks: "one selector in one file").
//
// When YouTube changes its markup and the button or the desk vanishes, this is
// the only file to fix. Nothing breaks meanwhile: the toolbar popup offers Add
// to My Clips on every watch page, and opens the desk, and it reads the player
// through `video` alone.
(function (root) {
  var SELECTORS = Object.freeze({
    // The row holding Like and Share. Watch with Heddy goes straight after it,
    // which puts it after Share and before YouTube's own Save / Download.
    actionBar: 'ytd-watch-metadata #top-level-buttons-computed',
    // The main player's <video>: its time for the desk and the popup, a tap on
    // a time seeks it, and pause() when Full desk hands it to Classroom.
    video: '#movie_player video',
    // The player itself: the once-per-device J hint sits inside it (Phase 2).
    player: '#movie_player',
    // The player while it plays a live stream: no buttons there (PRD Must 3).
    livePlayer: '#movie_player.ytp-live',
    // The popup's video row. If these miss, it falls back to the tab title.
    title: 'ytd-watch-metadata #title h1',
    channel: 'ytd-watch-metadata ytd-channel-name a',
    // The desk (Round 8, D69). The right-hand column it opens in, and, in
    // theatre mode or a window too narrow for two columns, the column under
    // the player; the page element whose attributes say which (is-two-columns_,
    // theater); YouTube's suggestions, folded away while the desk is open; and
    // the masthead the desk sticks under.
    secondaryColumn: 'ytd-watch-flexy #secondary-inner',
    belowPlayer: 'ytd-watch-flexy #below',
    watchFlexy: 'ytd-watch-flexy',
    suggestions: 'ytd-watch-flexy #related',
    masthead: '#masthead-container',
    // The video's own chapters (Round 11b, D93): the chapters panel's items
    // (each a time and a title), else the description, whose "0:00 Intro"
    // lines are where YouTube's chapters come from. Read as text only.
    chapterItem: 'ytd-macro-markers-list-item-renderer',
    chapterTime: '#time',
    chapterTitle: 'h4',
    description: 'ytd-watch-metadata #description-inline-expander, ytd-watch-metadata #description',
  });

  var api = { SELECTORS: SELECTORS };
  root.HeddyYouTube = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
