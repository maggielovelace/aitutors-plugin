# Chrome Web Store listing — English

Built from PRD-v0.96.0 Appendix B, rewritten for what Phases 1–3 shipped.
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
Works with aitutors.me. Keep YouTube videos, lines, pages and pictures in your Jotter. Reads a page only when you ask.
<!-- summary:end -->

## Description

<!-- description:start -->
Works with aitutors.me.

Heddy keeps what you find while you study and takes it to your professors on aitutors.me, with where it came from.

ON A YOUTUBE VIDEO
• Watch with Heddy: keeps the video in My Clips and opens it in the Classroom on aitutors.me.
• Add to My Clips: keeps it for later, from the start or from the moment you are at.
• H: jots the line being spoken into the video's Jotter. Press it twice quickly to take the line before as well. YouTube's own keys keep working.

ON ANY PAGE
• Select some words, then Jot it, Explain, Make a card or Ask Heddy. Or right-click the words and choose "Jot it with Heddy".
• Clip this page: keeps the readable part of a page as a source in your Jotter.
• Snap a picture: draw a box round a diagram, chart or photo and jot it. Keep up to four pictures from the same page in one jot, or Copy picture to paste it somewhere else. Right-click a picture and choose "Jot this picture with Heddy", or press Ctrl Shift K (twice for the whole screen).

AFTER YOU SAVE
A small note on the page says what was kept and shows the words. Undo takes it back; Open in Jotter goes straight to it.

YOU ARE IN CHARGE
• Nothing is kept until you tap Keep on aitutors.me, under your own account.
• Heddy reads a page only when you ask it to: its icon, the right-click menu or your shortcut.
• Heddy holds no account, password, key or token.
• Heddy makes no network call of its own. It has no analytics and no error reporting.
• It keeps only a few preferences on your device, such as your language.

English and 简体中文: choose in Heddy's options.

FOR SCHOOLS
Managed Chromebooks may block extensions. To allow Heddy, add its extension ID to the allow-list in the Google Admin console. Nothing on aitutors.me depends on Heddy: without it, children add videos from Quick add as before.

You need an aitutors.me account, signed in as the child in the same Chrome.
<!-- description:end -->

## Graphics

| Asset | File |
|---|---|
| Store icon (128 × 128) | `icons/store-128.png` |
| Screenshot 1: YouTube buttons and the popup | `store/screenshots/01-youtube.png` |
| Screenshot 2: the selection tray | `store/screenshots/02-selection-tray.png` |
| Screenshot 3: Snap a picture, box mode | `store/screenshots/03-snap-picture.png` |
| Screenshot 4: the Jotted toast with Undo | `store/screenshots/04-jotted-toast.png` |
| Screenshot 5: installing | `store/screenshots/05-install.png` |
| Small promo tile (440 × 280) | `store/screenshots/promo-440x280.png` |

The screenshots are English only. The same pictures can serve the zh-CN
listing; the Web Store shows them for every language unless a language gets
its own set. Re-render them with `store/render/render.mjs` (see its header).
