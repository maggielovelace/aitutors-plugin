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
- **When you open Heddy's toolbar popup** on a YouTube video, it reads the
  video's title, channel, length and current time to show them to you.
- **Nothing else.** Heddy reads no captions or transcripts, no comments, no
  history, no cookies, and no page you have not opened Heddy on.

## Where it goes

Nowhere, by Heddy. When you tap a button, Heddy opens a small window on
`https://aitutors.me` and hands that page the video's id, the start time you
chose and whether you want to watch it now. Heddy hands it over through Chrome
itself: only pages on aitutors.me can ask for it, each hand-over works once,
and an unclaimed one is forgotten after 10 minutes. The aitutors.me page then
checks the video and asks you to keep it, under your own aitutors.me account.
What happens there is covered by the aitutors.me privacy policy
(<https://aitutors.me/privacy>).

Heddy itself sends nothing to aitutors.me, to us, or to anyone else. It has
no analytics and no error reporting.

## What Heddy stores on your device

| What | Where | Why |
|---|---|---|
| Your language (English or 简体中文), if you chose one | `chrome.storage.sync` | So the buttons speak your language. If you use Chrome Sync, Chrome copies it to your other computers. |
| *Whole video* or *From m:ss*, whichever you chose last | `chrome.storage.local` | So the buttons on YouTube use the same choice |
| Whether you have seen the first-time popup | `chrome.storage.local` | So it shows once |
| The developer switch (off unless you turned it on) | `chrome.storage.local` | For people building aitutors.me itself |
| The hand-over waiting for an aitutors.me window: a random id, the video id, the start time | `chrome.storage.session`, cleared when Chrome closes | Forgotten once the window takes it, or after 10 minutes |

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab` | Read the video's title and time in the popup, only when you open it |
| `scripting` | Draw the buttons when YouTube moves to a new video without reloading the page |
| `storage` | The preferences above |
| `https://www.youtube.com/watch*` | YouTube video pages, and nothing else on YouTube |
| `https://aitutors.me/*`, `https://*.aitutors.me/*` | The windows Heddy opens |

Heddy does not ask for `tabs`, `history`, `cookies`, `webRequest`, or access
to all sites.

## Contact

hello@aitutors.me
