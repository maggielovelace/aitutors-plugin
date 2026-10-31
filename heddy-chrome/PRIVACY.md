# Heddy for Chrome — privacy

**English** · [简体中文](README.zh-CN.md#隐私)

**Reads a page only when you ask it to.** Heddy for Chrome holds no account,
key or token, and keeps only a few preferences, and the desk's unsaved jots, on
your device. Its own requests go only to aitutors.me, with your aitutors.me
sign-in: one to ask who is signed in there, and the desk's four on a YouTube
video (see *Who Heddy saves for* and *The desk on YouTube*, below).

## What Heddy reads

- **On a YouTube video page** (`https://www.youtube.com/watch…` only), Heddy
  draws one button, *Watch with Heddy*. To do that it reads the video's id
  from the page address.
- **While the desk is open** (you pressed *Watch with Heddy*, or turned on 📌),
  Heddy reads the video's title and channel and the player's time and length,
  to show the time, to follow the player in the transcript and to jot the line
  being spoken. It folds YouTube's suggestions away while the desk is open and
  gives them back when it closes. **H** jots only while the desk is open; with
  the desk closed Heddy listens to no key. The transcript is not read from the
  page: aitutors.me sends it (below).
- **When you open Heddy's toolbar popup** on a YouTube video, it reads the
  video's title, channel, length and current time, and YouTube's storyboard
  (the small preview frames YouTube already loads for its own progress bar),
  to show them to you. The thumbnail and the frames come from YouTube's own
  `i.ytimg.com`, as on YouTube itself. Dragging the strip moves the video.
- **On any other page, only when you ask**: when you open Heddy's panel, tap
  *+ Text* or *+ Add*, choose *Save to Jotters* from the right-click menu, or
  press a shortcut you set yourself, Heddy reads the words you selected, at most 300 characters either
  side of them, the page's title and its address (without the part after `#`).
  When you choose *Save page to Jotters*, it reads the page's readable text, with
  its pictures as links (it downloads no picture). When you choose *Explain*,
  *Make a card* or *Ask Heddy* on selected words, it reads the same words and
  the same 300 characters either side.
- **When you snap a picture** (the popup's *Snap a picture*, right-click a
  picture → *Add picture to Heddy*, or Ctrl Shift K), Heddy takes a
  screenshot of the part of the tab you can see, cuts out the box you draw,
  and keeps only that piece (a PNG, at most 1600 pixels on its longest side
  and 1 MB). It reads the sentence nearest the picture (at most 300
  characters), the page's title and its address. It sees only what is on your
  screen and downloads no picture. *Copy picture* puts the piece on your
  clipboard and nowhere else.
- **Nothing else.** Heddy reads no captions from the page, no comments, no
  history, no cookies, and no page you have not opened Heddy on.

## Where it goes

Nowhere, by Heddy. When you tap a button or press H, Heddy opens a small
window on `https://aitutors.me` and hands that page what it read: the video's
id and the time, or the words and where they came from, or the page, or the
pictures you boxed. Heddy hands it over through Chrome
itself: only pages on aitutors.me can ask for it, each hand-over works once,
and an unclaimed one is forgotten after 10 minutes. The aitutors.me page then
checks the video and asks you to keep it, under your own aitutors.me account.
What happens there is covered by the aitutors.me privacy policy
(<https://aitutors.me/privacy>).

On the Chrome Web Store this is declared as **website content**: collected
only when you ask (Save to Jotters, + Text or + Add, Save page to Jotters, Snap a picture, Explain, Make a
card or Ask Heddy), sent only to aitutors.me under your own account, never
sold, never used for advertising or credit decisions, and not shared with
anyone else beyond aitutors.me's own processing.

Heddy itself sends nothing to aitutors.me, to us, or to anyone else. It has
no analytics and no error reporting.

## Who Heddy saves for

When you open Heddy's settings, or its panel on a page it can't save from,
Heddy asks aitutors.me one question: `GET https://aitutors.me/api/learn/heddy/me`.
Chrome sends it with your own aitutors.me sign-in cookie, as it would for any
aitutors.me page; Heddy never reads or keeps that cookie, and sends nothing
else with the request. aitutors.me answers with no more than a child's first
name, year group and subjects (or, for a parent, only that a grown-up is
signed in, with no name). Heddy shows that answer on the study pass or the
account row, and forgets it when the page closes: it is never stored and
never sent anywhere else. If the question fails, Heddy shows "Not signed in".
## The desk on YouTube

The desk gets what it shows from aitutors.me through Heddy's own background,
in the same way, with your aitutors.me sign-in cookie sent by Chrome and never
read or kept by Heddy:

- `GET /api/learn/heddy/desk/video` — the video's id and title, to learn whose
  desk it is (the professor) and where its Jotter is;
- `GET /api/learn/heddy/desk/transcript` — the video's id, for its transcript
  (from the channel's own captions, fetched by aitutors.me) and, if you choose
  Bilingual or Chinese, ten minutes of Chinese lines at a time;
- `GET /api/learn/heddy/desk/insights` — the video's id, for the Insights tab
  where aitutors.me has them;
- `POST /api/learn/heddy/desk/jots` — only when you press *Save to My Jotters*:
  the video's id, title, channel and length, and the jots you made.

*Full desk* hands the video and your jots to an aitutors.me tab the same way
*Add to My Clips* does (above). Until one of the two, your jots stay in Heddy's
storage on this computer. These, and the who-is-signed-in question, are the
only requests Heddy makes of its own.

## What Heddy stores on your device

| What | Where | Why |
|---|---|---|
| Your language (English or 简体中文), if you chose one, on the settings page or the desk's EN \| 中 | `chrome.storage.sync` | So the buttons speak your language. If you use Chrome Sync, Chrome copies it to your other computers. |
| The desk's jots on a video, until you press *Save to My Jotters* or *Full desk* (the time, whether it is a spoken line or your note, and its words) | `chrome.storage.local`, one list per video | So nothing you jot is lost before you save it |
| The desk's 📌, whether it is taller, and the Digest's view (English, Bilingual or Chinese) | `chrome.storage.local` | So the desk opens the way you left it |
| Whether you have seen the first-time popup | `chrome.storage.local` | So it shows once |
| The developer switch (off unless you turned it on) | `chrome.storage.local` | For people building aitutors.me itself |
| The hand-over waiting for an aitutors.me window: a random id and what it carries (the video id and time, the words you chose, the page, or the pictures) | `chrome.storage.session`, cleared when Chrome closes | Forgotten once the window takes it, or after 10 minutes |
| Pictures you have boxed for one jot but not sent yet (up to four, from one page) | `chrome.storage.session`, cleared when Chrome closes | Dropped when you send them, press Esc, close the tab or go to another page |

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab` | Read a page, or take a picture of what is on screen, only after you ask: the popup, the right-click menu or a shortcut |
| `scripting` | Read the video's time and storyboard for the popup, and move the video when you drag its strip; draw the button and the desk when YouTube moves to a new video without reloading the page, read the selection or the page you asked about, and draw the box for Snap a picture |
| `contextMenus` | *Save to Jotters* when you right-click a selection, and *Add picture to Heddy* when you right-click a picture |
| `commands` | Ctrl Shift K for Snap a picture, and a shortcut for Heddy's buttons under a selection if you set one (Heddy sets none for it) |
| `storage` | The preferences above |
| `https://www.youtube.com/watch*` | YouTube video pages, and nothing else on YouTube |
| `https://aitutors.me/*`, `https://*.aitutors.me/*` | The windows Heddy opens, and the requests above |

Heddy does not ask for `tabs`, `history`, `cookies`, `webRequest`, or access
to all sites.

## Contact

hello@aitutors.me
