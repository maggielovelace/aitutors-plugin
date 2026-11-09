# Chrome Web Store listing — English

Built from PRD-v0.96.0 Appendix B, rewritten for what version 0.9.0 does.
Paste each field as it stands. The summary must stay at 132 characters or
fewer (`tests/store.test.mjs` checks it).

| Field | Value |
|---|---|
| Name | Heddy for Chrome: Clip to your Jotter, learn with your professors |
| Category | Education |
| Languages | English (en), Chinese (Simplified) (zh-CN) |
| Price | Free |
| Homepage | https://aitutors.me/heddy-chrome |
| Support | hello@aitutors.me |
| Privacy policy | https://github.com/maggielovelace/aitutors-plugin/blob/main/heddy-chrome/PRIVACY.md |

## Summary

<!-- summary:start -->
Works with aitutors.me. Clip words, pictures and video notes into your Jotter. Professors explain and hint, never give the answer.
<!-- summary:end -->

## Description

<!-- description:start -->
Works with aitutors.me.

Most clippers stop at saving. Heddy keeps going.
Heddy for Chrome sends what you find on the web and on YouTube straight into your Jotters on aitutors.me, where seven subject professors help you understand it: clip it, jot it, ask about it, practise it, and come back to it a few days later.

━━━━━━━━━━━━━━
1 · CLIP: keep it, with where it came from
━━━━━━━━━━━━━━
• Sources: click Heddy's icon and its panel opens beside the page. Select words and each selection becomes a numbered card, or tap + Picture and draw a box round a chart or photo (+ Text switches back to words). Keep up to 10 snippets and up to four pictures from one page, and drag them into your own order.
• Save n to my Jotters puts them in your Jotter in that order, with the page's address. Each snippet shows the whole sentence it came from, so nothing is read out of context.
• Save this page to my Jotters keeps the whole article, with its headings, lists and bold text intact.
• Into: the line above Save says which Jotter the save goes to. Tap it to open a list you can search, or type a key such as JOT-31, or keep saving into one Jotter for the rest of the day.
• After saving: Done to carry on, Open my Jotter ↗ to go straight there, or Undo this save.
• Right-click words and choose Save to Jotters, or right-click a picture and choose Add picture to Heddy.
• Snap a picture: press Ctrl Shift K and draw a box round any part of the screen (twice for the whole screen), then keep it, explain it, make a card, ask about it or Copy picture.
• After a jot or a right-click save, a small note says what was kept, and Open in Jotter goes straight to it.

━━━━━━━━━━━━━━
2 · JOT: Watch with Heddy, in English or Chinese
━━━━━━━━━━━━━━
Tap Watch with Heddy on any YouTube video and the desk opens beside it.
• Switch the desk between EN | 中.
• Digest: the transcript in English, Bilingual or Chinese, following the player. Tap a time to play from there.
• Jot: press H to jot the line being spoken, or type a note. Save to My Jotters puts the jots in the video's Jotter, by their times.
• Full desk opens the video in the Classroom on aitutors.me with your jots.
• Add to My Clips keeps a video, or part of it, for later.

━━━━━━━━━━━━━━
3 · ASK: seven professors beside you
━━━━━━━━━━━━━━
Mentor and seven subject professors sit beside the page. Whatever subject you are studying, its own professor helps you think it through.
• Explain: select a line or a picture and your professor explains it.
• Insights: your professor's short note on each chapter of a video, as you reach it.
• Ask: talk to the page's professor about a line, a moment or a picture.
The professors ask, hint and show a worked example of a similar problem. Your own answer stays yours to find.

━━━━━━━━━━━━━━
4 · PRACTISE: your Jotter asks the questions
━━━━━━━━━━━━━━
• Get it: three questions made from your own jots. Get one wrong and Heddy points you back to the jot to read again, never to the answer.
• Teach it back: explain a topic in your own words and see what the professor heard.
• Quiz: a short quiz on each video, with a hint on every question.
• Make a card: turn a key point or a missed question into a flashcard in one tap.

━━━━━━━━━━━━━━
5 · REVISE: Watch-outs come back to you
━━━━━━━━━━━━━━
• Watch-outs: a common mistake kept with the right idea, back after 1, 3 and 7 days to check it has stuck.
• Storyboard: link your jots into a mind map and see how a topic fits together.
• One Jotter can hold web pages, videos and your own uploads, so everything on a topic is in one place.

━━━━━━━━━━━━━━
YOU ARE IN CHARGE
━━━━━━━━━━━━━━
• Heddy reads a page only when you ask: its icon, the desk, the right-click menu or your shortcut.
• What you save is kept on aitutors.me, under your own account, and nowhere else.
• Heddy holds no account, password, key or token. It sends nothing to anyone but aitutors.me, and has no analytics and no error reporting.
• It keeps only a few settings on your device, such as your language and the desk's size, the desk's jots until you save them, and today's chosen Jotter.
• Some features depend on the subjects on your aitutors.me plan.

FOR SCHOOLS
Managed Chromebooks may block extensions. To allow Heddy, add its extension ID to the allow-list in the Google Admin console. Nothing on aitutors.me depends on Heddy: without it, children add videos from Quick add as before.

You need an aitutors.me account, signed in as the child in the same Chrome. Free.
<!-- description:end -->

## Graphics

| Asset | File |
|---|---|
| Store icon (128 × 128): the navy eyes crest at 96 px, 16 px transparent padding | `icons/store-128.png` |
| Screenshot 1: the desk's Digest on a YouTube video, Bilingual, with the professor's insights | `store/screenshots/01-desk-digest.png` |
| Screenshot 2: the desk's Quiz, with a hint | `store/screenshots/02-desk-quiz.png` |
| Screenshot 3: the desk's Jot tab | `store/screenshots/03-desk-jot.png` |
| Screenshot 4: clipping a web page into a Jotter (Sources) | `store/screenshots/04-web-sources.png` |
| Screenshot 5: Ask, with the page's professor, who hints instead of answering | `store/screenshots/05-web-ask.png` |
| Small promo tile (440 × 280) | `store/screenshots/promo-440x280.png` |

These are the English set, rendered from the real 0.9.1 UI on neutral
stand-in pages (no real site, video or child). The zh-CN listing has its own
set in `store/screenshots/zh-CN/` (`HEDDY_LANG=zh_CN`); see listing.zh-CN.md. Re-render them with `store/render/render.mjs` (see
its header).
