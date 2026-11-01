# Chrome Web Store listing — English

Built from PRD-v0.96.0 Appendix B, rewritten for what version 0.8.1 does.
Paste each field as it stands. The summary must stay at 132 characters or
fewer (`tests/store.test.mjs` checks it).

| Field | Value |
|---|---|
| Name | Heddy for Chrome |
| Category | Education |
| Languages | English (en), Chinese (Simplified) (zh-CN) |
| Price | Free |
| Homepage | https://aitutors.me/heddy-chrome |
| Support | hello@aitutors.me |
| Privacy policy | https://github.com/maggielovelace/aitutors-plugin/blob/main/heddy-chrome/PRIVACY.md |

## Summary

<!-- summary:start -->
Works with aitutors.me. Study YouTube videos beside your professor, and keep words and pictures from any page in your Jotters.
<!-- summary:end -->

## Description

<!-- description:start -->
Works with aitutors.me.

Heddy sits beside what you are studying and takes what you find to your professors on aitutors.me, with where it came from. The professors help you work it out for yourself: they ask, hint and show a worked example of a similar problem, and leave your own answer to you.

ON A YOUTUBE VIDEO
Tap Watch with Heddy and the desk opens beside the video, in English or Chinese (EN | 中).
• Jot: press H to jot the line being spoken (twice quickly for the line before too), or type a note. Save to My Jotters puts the jots in the video's Jotter, by their times.
• Digest: the transcript, following the player, in English, Bilingual or Chinese. Tap a time to play from there, or select words to jot them, explain them, make a card or ask about them.
• Insights: your professor's short note on each chapter of the video, as you reach it.
• Quiz: a short quiz on the video, with a hint on each question. Questions you miss can become flashcards.
• Ask: talk to your professor about the video, a line or a moment.
• Full desk opens the video in the Classroom on aitutors.me with your jots. 📌 opens the desk on every video.
• Add to My Clips, from Heddy's toolbar icon, keeps a video or part of it for later.

ON ANY PAGE
• Sources: click Heddy's icon and its panel opens beside the page. Select words and each selection is added as a numbered card, or tap + Picture and draw a box (+ Text switches back to words). Drag the cards into your own order. Keep up to 10 snippets and up to four pictures from one page.
• Save n to my Jotters puts them on the left page of that page's Jotter, in your order, ready to jot from. Save this page to my Jotters keeps the readable part of the page as a source.
• Ask: the panel's Ask tab is a conversation with Mentor or the page's professor about your words or picture. Explain and Make a card are one tap away, and you choose whether to keep the card.
• Right-click words and choose Save to Jotters, or right-click a picture and choose Add picture to Heddy.
• Snap a picture: draw a box round a diagram, chart or photo, then + Picture to keep it, or Explain this picture, Make a card, Ask about it or Copy picture. Press Ctrl Shift K (twice for the whole screen).

AFTER YOU SAVE
A small note says what was kept, and Open in Jotter goes straight to it. Changed your mind? Undo.

YOU ARE IN CHARGE
• Heddy reads a page only when you ask: its icon, the desk, the right-click menu or your shortcut.
• What you save is kept on aitutors.me, under your own account, and nowhere else.
• Heddy holds no account, password, key or token. It sends nothing to anyone but aitutors.me, and has no analytics and no error reporting.
• It keeps only a few settings on your device, such as your language and the desk's size, and the desk's jots until you save them.
• Some features depend on the subjects on your aitutors.me plan.

English and 简体中文: choose in Heddy's options, or with the desk's EN | 中.

FOR SCHOOLS
Managed Chromebooks may block extensions. To allow Heddy, add its extension ID to the allow-list in the Google Admin console. Nothing on aitutors.me depends on Heddy: without it, children add videos from Quick add as before.

You need an aitutors.me account, signed in as the child in the same Chrome.
<!-- description:end -->

## Graphics

| Asset | File |
|---|---|
| Store icon (128 × 128): the navy eyes crest at 96 px, 16 px transparent padding | `icons/store-128.png` |
| Screenshot 1: the desk's Digest on a YouTube video | `store/screenshots/01-desk-digest.png` |
| Screenshot 2: the desk's Quiz, with a hint | `store/screenshots/02-desk-quiz.png` |
| Screenshot 3: the desk's Jot tab | `store/screenshots/03-desk-jot.png` |
| Screenshot 4: Sources on a web page | `store/screenshots/04-web-sources.png` |
| Screenshot 5: Ask, with the page's professor | `store/screenshots/05-web-ask.png` |
| Small promo tile (440 × 280) | `store/screenshots/promo-440x280.png` |

The screenshots are English only, rendered from the real 0.8.1 UI on neutral
stand-in pages (no real site, video or child). The same pictures can serve
the zh-CN listing; the Web Store shows them for every language unless a
language gets its own set. Re-render them with `store/render/render.mjs` (see
its header).
