// content/youtube-selectors.js — EVERY YouTube selector Heddy depends on, in
// one place (PRD-v0.96.0 Risks: "one selector in one file").
//
// When YouTube changes its markup and the buttons vanish, this is the only
// file to fix. Nothing breaks meanwhile: the toolbar popup offers Watch with
// Heddy and Add to My Clips on every watch page without these buttons, and it
// reads the player through `video` alone.
(function (root) {
  var SELECTORS = Object.freeze({
    // The row holding Like and Share. Heddy's two buttons go straight after it,
    // which puts them after Share and before YouTube's own Save / Download.
    actionBar: 'ytd-watch-metadata #top-level-buttons-computed',
    // The main player's <video>: its currentTime for "From m:ss", and pause()
    // when Watch with Heddy hands the video to Classroom.
    video: '#movie_player video',
    // The player while it plays a live stream: no buttons there (PRD Must 3).
    livePlayer: '#movie_player.ytp-live',
    // The popup's video row. If these miss, it falls back to the tab title.
    title: 'ytd-watch-metadata #title h1',
    channel: 'ytd-watch-metadata ytd-channel-name a',
  });

  var api = { SELECTORS: SELECTORS };
  root.HeddyYouTube = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
