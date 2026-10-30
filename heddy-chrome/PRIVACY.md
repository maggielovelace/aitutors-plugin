# Heddy for Chrome — privacy

**English** · [简体中文](README.zh-CN.md#隐私)

**Reads a page only when you ask it to.** Heddy for Chrome holds no account,
key or token, makes no network call of its own, and keeps only a few
preferences on your device.

## What Heddy reads

- **On a YouTube video page** (`https://www.youtube.com/watch…` only), Heddy
  draws two buttons, *Watch with Heddy* and *Add to My Clips*. To do that it
  reads the video's id from the page address. When you tap a button, it also
  reads the player's current time, if you chose *From m:ss*.
- **When you press H** on a YouTube video page, it reads the player's current
  time and the video's title (for the "Note saved" message).
- **When you open Heddy's toolbar popup** on a YouTube video, it reads the
  video's title, channel, length and current time to show them to you.
- **On any other page, only when you ask**: when you open the popup, choose
  *Jot it with Heddy* from the right-click menu, or press a shortcut you set
  yourself, Heddy reads the words you selected, at most 300 characters either
  side of them, the page's title and its address (without the part after `#`).
  When you choose *Save page to Jotters*, it reads the page's readable text, with
  its pictures as links (it downloads no picture). When you choose *Explain*,
  *Make a card* or *Ask Heddy* on selected words, it reads the same words and
  the same 300 characters either side.
- **When you snap a picture** (the popup's *Snap a picture*, right-click a
  picture → *Jot this picture with Heddy*, or Ctrl Shift K), Heddy takes a
  screenshot of the part of the tab you can see, cuts out the box you draw,
  and keeps only that piece (a PNG, at most 1600 pixels on its longest side
  and 1 MB). It reads the sentence nearest the picture (at most 300
  characters), the page's title and its address. It sees only what is on your
  screen and downloads no picture. *Copy picture* puts the piece on your
  clipboard and nowhere else.
- **Nothing else.** Heddy reads no captions or transcripts, no comments, no
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
only when you ask (Jot it, Save page to Jotters, Snap a picture, Explain, Make a
card or Ask Heddy), sent only to aitutors.me under your own account, never
sold, never used for advertising or credit decisions, and not shared with
anyone else beyond aitutors.me's own processing.

Heddy itself sends nothing to aitutors.me, to us, or to anyone else. It has
no analytics and no error reporting.

## What Heddy stores on your device

| What | Where | Why |
|---|---|---|
| Your language (English or 简体中文), if you chose one | `chrome.storage.sync` | So the buttons speak your language. If you use Chrome Sync, Chrome copies it to your other computers. |
| *Whole video* or *From m:ss*, whichever you chose last | `chrome.storage.local` | So the buttons on YouTube use the same choice |
| Whether you have seen the first-time popup | `chrome.storage.local` | So it shows once |
| Whether you have seen the "H jots the line being spoken" hint | `chrome.storage.local` | So it shows once |
| The developer switch (off unless you turned it on) | `chrome.storage.local` | For people building aitutors.me itself |
| The hand-over waiting for an aitutors.me window: a random id and what it carries (the video id and time, the words you chose, the page, or the pictures) | `chrome.storage.session`, cleared when Chrome closes | Forgotten once the window takes it, or after 10 minutes |
| Pictures you have boxed for one jot but not sent yet (up to four, from one page) | `chrome.storage.session`, cleared when Chrome closes | Dropped when you send them, press Esc, close the tab or go to another page |

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab` | Read a page, or take a picture of what is on screen, only after you ask: the popup, the right-click menu or a shortcut |
| `scripting` | Draw the buttons when YouTube moves to a new video without reloading the page, read the selection or the page you asked about, and draw the box for Snap a picture |
| `contextMenus` | *Jot it with Heddy* when you right-click a selection, and *Jot this picture with Heddy* when you right-click a picture |
| `commands` | Ctrl Shift K for Snap a picture, and a shortcut for Jot it if you set one (Heddy sets none for it) |
| `storage` | The preferences above |
| `https://www.youtube.com/watch*` | YouTube video pages, and nothing else on YouTube |
| `https://aitutors.me/*`, `https://*.aitutors.me/*` | The windows Heddy opens |

Heddy does not ask for `tabs`, `history`, `cookies`, `webRequest`, or access
to all sites.

## Contact

hello@aitutors.me
