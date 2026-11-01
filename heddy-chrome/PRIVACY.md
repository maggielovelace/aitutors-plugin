# Heddy for Chrome — privacy

**English** · [简体中文](README.zh-CN.md#隐私)

This page describes version 0.8.1.

**Reads a page only when you ask it to.** Heddy for Chrome holds no account,
password, key or token, and keeps only a few preferences, and the desk's
unsaved jots, on your device. Its requests go only to aitutors.me, with your
aitutors.me sign-in: one to ask who is signed in, the desk's five on a YouTube
video, and the saves, Undos, cards, jots, clips and Ask conversations that you
start yourself (all listed under *Every request Heddy makes*, below). Heddy
opens no window or tab unless you tap a link that says it leaves.

## What Heddy reads

- **On a YouTube video page** (`https://www.youtube.com/watch…` only), Heddy
  draws one button, *Watch with Heddy*. To do that it reads the video's id
  from the page address.
- **While the desk is open** (you pressed *Watch with Heddy*, or turned on 📌),
  Heddy reads the video's title and channel, the player's time and length, and
  the video's chapters (from YouTube's chapters panel, or the timestamps in
  the description), to show the time, follow the player in the Digest, write
  Insights per chapter and jot the line being spoken. It folds YouTube's
  suggestions away while the desk is open and gives them back when it closes.
  **H** jots only while the desk is open; with the desk closed Heddy listens
  to no key. The transcript is not read from the page: aitutors.me sends it
  (below).
- **When you open Heddy's toolbar popup** on a YouTube video, it reads the
  video's title, channel, length and current time, and YouTube's storyboard
  (the small preview frames YouTube already loads for its own progress bar),
  to show them to you. The thumbnail and the frames come from YouTube's own
  `i.ytimg.com`, as on YouTube itself. Dragging the strip moves the video.
- **On any other page, only when you ask**: when you open Heddy's panel, tap
  *+ Text* or *+ Add*, choose *Save to Jotters* from the right-click menu, or
  press a shortcut you set yourself, Heddy reads the words you selected, at
  most 300 characters either side of them, the page's title and its address
  (without the part after `#`). When you choose *Save page to Jotters*, it
  reads the page's readable text, with its pictures as links (it downloads no
  picture). When you choose *Explain*, *Make a card* or *Ask Heddy* on
  selected words, it reads the same words and the same 300 characters either
  side.
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

Only to aitutors.me. Heddy's background sends each request below with your
own aitutors.me sign-in cookie, which Chrome attaches as it would for any
aitutors.me page; Heddy never reads or keeps that cookie. What you keep is
kept on aitutors.me under your own account. *Full desk ↗* is the one action
that hands the video and your jots to an aitutors.me tab through Chrome
itself: only pages on aitutors.me can ask for it, each hand-over works once,
and an unclaimed one is forgotten after 10 minutes. What happens on
aitutors.me is covered by the aitutors.me privacy policy
(<https://aitutors.me/privacy>).

On the Chrome Web Store this is declared as **website content**: collected
only when you ask (Save to my Jotters, + Text, Add to Sources, Snap a picture,
Ask {professor} or Make a card), sent only to aitutors.me under your own
account, never sold, never used for advertising or credit decisions, and not
shared with anyone else beyond aitutors.me's own processing. The Ask view's
conversation is also a chat with your professor, and the desk tells
aitutors.me which video it is open on (with 📌 on, every video you watch);
the store's answers for those, and the reasoning, are in
[store/privacy-answers.md](store/privacy-answers.md).

Heddy sends nothing to us or to anyone else, and nothing to aitutors.me that
is not listed below. It has no analytics and no error reporting.

## Every request Heddy makes

**Who is signed in.** When you open Heddy's settings, or its panel on a page
it can't save from, Heddy asks `GET /api/learn/heddy/me`, with nothing but the
cookie. aitutors.me answers with no more than a child's first name, year
group and subjects (or, for a parent, only that a grown-up is signed in, with
no name). Heddy shows that answer on the study pass or the account row, and
forgets it when the page closes: it is never stored and never sent anywhere
else. If the question fails, Heddy shows "Not signed in".

**The desk on YouTube.** While the desk is open:

- `GET /api/learn/heddy/desk/video` — the video's id and title, when the desk
  opens and again once the transcript has loaded, to learn whose desk it is
  (the professor), where its Jotter is and whether it has a Quiz;
- `GET /api/learn/heddy/desk/transcript` — the video's id and title, for its
  transcript (from the channel's own captions, fetched by aitutors.me) and, if
  you choose Bilingual or Chinese, ten minutes of Chinese lines at a time;
- `POST /api/learn/heddy/desk/keypoints` — the video's id and title, the
  language, and its chapters (each title and start time), for the Insights on
  the chapter the player is in, or one you ask for;
- `POST /api/learn/heddy/desk/quiz` — only when you use the Quiz tab: the
  video's id and title, the quiz's id, and, when you answer, the question's
  number and the option you chose; *Add cards* asks for flashcards from the
  questions you missed;
- `POST /api/learn/heddy/desk/jots` — only when you press *Save to My
  Jotters*: the video's id, title, channel and length, and the jots you made.

*Save to My Jotters* opens nothing: the desk says the jots are saved, and only
*Open my Jotter ↗* opens a tab. Until you save, or use *Full desk*, your jots
stay in Heddy's storage on this computer.

**Saving and asking.** Each of these is sent only when you tap the button
that names it:

- `POST /api/learn/heddy/save` — *Save n to my Jotters* (or *Save this page to
  my Jotters*): the page's address and title, your snippets and pictures in
  your order, the words either side of each, and, if you ticked *Also keep the
  article's text* or picked nothing, the page's main text (headings and
  paragraphs, without menus or ads, at most 200 KB);
- `POST /api/learn/heddy/undo` — *Undo*: the id of the save, card, jot or clip;
- `POST /api/learn/heddy/clip` — *Add to My Clips*: the video's id, title and
  the start and end you chose;
- `POST /api/learn/heddy/ask` — a question in Ask (on the desk or in Heddy's
  panel), *Explain* or *Make a card*: the page's (or video's) address and
  title, the picture or words you asked about, and the conversation so far.
  The professor's answer comes back to Heddy; nothing is kept on your
  computer;
- `POST /api/learn/heddy/card` and `POST /api/learn/heddy/jot` — *Keep card*
  and *Keep as a jot*: the card or answer you chose to keep, with the page's
  address and title.

These twelve are the only requests Heddy makes.

## What Heddy stores on your device

| What | Key | Where |
|---|---|---|
| Your language (English or 简体中文), if you chose one, on the settings page or the desk's EN \| 中. If you use Chrome Sync, Chrome copies it to your other computers | `lang` | `chrome.storage.sync` |
| The desk's jots on a video, until you press *Save to My Jotters* or *Full desk* (each jot's time, whether it is a spoken line or your note, and its words), so nothing you jot is lost before you save it | `deskJots:` + the video's id | `chrome.storage.local` |
| The desk's 📌, whether it is taller, and the width you dragged it to | `deskPin`, `deskTall`, `deskWidth` | `chrome.storage.local` |
| The Digest's view (English, Bilingual or Chinese), whether its Insights note is open, and whether you closed its line about channels' own captions | `digestView`, `digestNoteOpen`, `digestFineHidden` | `chrome.storage.local` |
| Whether you have seen the first-time popup, so it shows once | `seenFirstRun` | `chrome.storage.local` |
| The developer switch (off unless you turned it on), for people building aitutors.me itself | `devOrigin` | `chrome.storage.local` |
| The hand-over waiting for Full desk's aitutors.me tab: a random id, the video id and your jots. Forgotten once the tab takes it, or after 10 minutes | `heddyCids` | `chrome.storage.session`, cleared when Chrome closes |
| The snippets and pictures you picked on a page (up to four pictures), and, after a save, the ones that save carried (for Undo). Gone when the tab goes to another page or closes | `heddyCards:` + the tab's number | `chrome.storage.session`, cleared when Chrome closes |

Versions before 0.5 also kept `startChoice` (the popup's old start choice) in
`chrome.storage.local`; 0.8.1 neither reads nor writes it.

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab` | Read a page, or take a picture of what is on screen, only after you ask: the popup, Heddy's panel, the right-click menu or a shortcut |
| `scripting` | Read the video's time and storyboard for the popup, and move the video when you drag its strip; draw the button and the desk when YouTube moves to a new video without reloading the page, show Heddy's panel, read the selection or the page you asked about, and draw the box for Snap a picture |
| `contextMenus` | *Save to Jotters* when you right-click a selection, and *Add picture to Heddy* when you right-click a picture |
| `commands` | Ctrl Shift K for Snap a picture, and a shortcut for Heddy's buttons under a selection if you set one (Heddy sets none for it) |
| `storage` | The preferences above |
| `https://www.youtube.com/watch*` | YouTube video pages, and nothing else on YouTube |
| `https://aitutors.me/*`, `https://*.aitutors.me/*` | The requests above, and the aitutors.me tabs you open |

Heddy does not ask for `tabs`, `history`, `cookies`, `webRequest`, or access
to all sites. Heddy's panel on a web page is its own page, shown in a frame
Heddy draws when you open it; its files are marked web-accessible with an
address that changes every session, so no website can tell Heddy is there.

## Contact

hello@aitutors.me
