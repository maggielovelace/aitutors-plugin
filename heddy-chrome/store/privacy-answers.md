# Chrome Web Store — privacy practices answers

The answers for the developer dashboard's **Privacy practices** tab, for
version 0.8.1. They say the same as [PRIVACY.md](../PRIVACY.md); if one
changes, change both. `tests/store.test.mjs` checks that every permission in
`manifest.json` has a justification here, and that every request path and
every `chrome.storage` key in the shipped code is named here and in
PRIVACY.md.

## Single purpose

> Heddy for Chrome helps a student keep what they find while studying (a
> YouTube video, a line from a video, words or a picture from a web page, or
> a whole page), study a YouTube video beside it with their own aitutors.me
> professor, and hands what they choose to keep to their own account on
> aitutors.me.

## Permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | Heddy reads the current tab only after the student asks: by opening the popup or Heddy's panel, choosing a right-click menu item, or pressing a shortcut. activeTab also lets Snap a picture take a screenshot of the visible tab (chrome.tabs.captureVisibleTab) at that moment, so the student can box a diagram. No tab is read without that gesture. |
| `scripting` | Injects Heddy's own files into the tab the student asked about: to read the selected words (and up to 300 characters either side) or the page's readable text, to show Heddy's panel and the tray of tools beside a selection, to draw the box for Snap a picture, to redraw the Watch with Heddy button and the desk when YouTube moves to a new video without reloading the page, and, in the toolbar popup on a YouTube video, to read the player's time and YouTube's storyboard (preview frames) and move the video when the strip is dragged (MAIN world, a read of the player's own response only). No remote code is injected. |
| `storage` | Keeps a few preferences on the device (`chrome.storage.local` and `.sync`, listed under *What is stored* below): the language, the desk's 📌, height, width and Digest view, whether the Insights note is open and the only-channel line is hidden, the desk's unsaved jots per video (until Save to My Jotters or Full desk), whether the first-time popup has been seen, and a developer switch. `chrome.storage.session` holds Full desk's hand-over (forgotten once taken, or after 10 minutes) and each tab's picked snippets and pictures until they are saved (and, after a save, for its Undo). |
| `contextMenus` | Adds "Save to Jotters" when the student right-clicks selected words, and "Add picture to Heddy" when they right-click a picture; each adds a card to Heddy's panel. |
| `commands` | Ctrl Shift K starts Snap a picture (press it twice for the whole screen). Heddy's buttons under a selection have a command with no default key, so the student can set their own at chrome://extensions/shortcuts. |
| Host `https://www.youtube.com/watch*` | Draws Watch with Heddy on YouTube video pages and, when the student opens it (or turns on 📌), the desk beside the video: Jot, Digest, Insights and Quiz. It reads the video id from the address, and, while the desk is open, the video's title, channel, chapter list (from the chapters panel or the description's timestamps) and the player's time. H jots the line being spoken only while the desk is open. Nothing else on YouTube. |
| Host `https://aitutors.me/*`, `https://*.aitutors.me/*` | The requests listed below, which Heddy's background makes to aitutors.me with the browser's own sign-in, so what the student keeps lands under their own account; and the aitutors.me tabs the student opens with a link that says it leaves. Only aitutors.me pages may ask Heddy for a hand-over (externally_connectable). The subdomains are aitutors.me's own preview sites. |

Not requested: `tabs`, `history`, `cookies`, `webRequest`,
`declarativeNetRequest`, `sidePanel`, `<all_urls>` host access.

`web_accessible_resources`: Heddy's panel on a web page is its own popup page
(`popup/popup.html` with its scripts and the Manrope font) shown in a frame
Heddy draws when the student opens it, so those files are listed with
`use_dynamic_url: true` (the address changes every session, so a page cannot
probe for Heddy). They are Heddy's own static files; no page can make them do
anything. The desk's fonts on YouTube (JetBrains Mono, Source Serif 4) are
bundled as bytes in the content script and are not exposed.

## Remote code

> **No, I am not using remote code.** All JavaScript is in the package. Heddy
> loads no script, stylesheet, font or wasm from the network, and uses no
> eval or dynamic import. The fonts are bundled in `fonts/` and as bytes in
> `lib/font-data.js` and `lib/font-desk-data.js`.

## Every request Heddy makes

All of them go from Heddy's background to aitutors.me, with the browser's own
aitutors.me sign-in cookie, which Heddy never reads or keeps. Heddy holds no
account, password, key or token, and sends nothing to anyone else: no
analytics, no error reporting.

| Request | When | What is sent |
|---|---|---|
| `GET /api/learn/heddy/me` | The settings page opens, or Heddy's panel opens on a page it can't save from | Nothing but the cookie. The answer (a child's first name, year group and subjects, or only "a grown-up is signed in") is shown and never stored |
| `GET /api/learn/heddy/desk/video` | The desk opens on a video (Watch with Heddy, or 📌 on), and again once its transcript has loaded | The video's id and title |
| `GET /api/learn/heddy/desk/transcript` | The desk opens; the Digest's Bilingual or Chinese view asks for the next ten minutes | The video's id and title, and where the Chinese should start |
| `POST /api/learn/heddy/desk/keypoints` | While the desk is open on a video with chapters, for the chapter the player is in (and when the student asks for notes on a later one) | The video's id and title, the language, and its chapters (each title and start time, read from the page) |
| `POST /api/learn/heddy/desk/quiz` | The student starts the Quiz tab, answers a question, finishes, or taps Add cards | The video's id and title, the quiz's id, and for an answer the question's number and the option the student chose |
| `POST /api/learn/heddy/desk/jots` | Save to My Jotters on the desk | The video's id, title, channel and length, and the jots (each one's time, whether it is a spoken line or the student's note, and its words) |
| `POST /api/learn/heddy/save` | Save to my Jotters on a page (or Save this page to my Jotters) | The page's address and title, the snippets and pictures in the student's order with the words either side of each, and, if asked, the page's main text (at most 200 KB) |
| `POST /api/learn/heddy/undo` | Undo | The id of the save, card, jot or clip |
| `POST /api/learn/heddy/clip` | Add to My Clips | The video's id and title, and the start and end chosen |
| `POST /api/learn/heddy/ask` | A question typed in Ask (on the desk or in the panel), Explain, or Make a card | The page's or video's address and title, the words or picture asked about, and the conversation so far; the professor's reply streams back and is not kept on the device |
| `POST /api/learn/heddy/card` | Keep card | The card chosen, with the page's address and title |
| `POST /api/learn/heddy/jot` | Keep as a jot | The answer chosen, with the page's address and title |

## What is stored on the device

| Key | Area | What |
|---|---|---|
| `lang` | `chrome.storage.sync` | English or 简体中文, from the settings page or the desk's EN \| 中 |
| `deskJots:` + video id | `chrome.storage.local` | The desk's unsaved jots on that video, until Save to My Jotters or Full desk |
| `deskPin` | `chrome.storage.local` | The desk's 📌 (open on every video) |
| `deskTall` | `chrome.storage.local` | Whether the desk is taller |
| `deskWidth` | `chrome.storage.local` | The width the desk was dragged to |
| `digestView` | `chrome.storage.local` | The Digest's view: English, Bilingual or Chinese |
| `digestNoteOpen` | `chrome.storage.local` | Whether the Digest's Insights note is open |
| `digestFineHidden` | `chrome.storage.local` | Whether the "from the channel's own captions" line was closed |
| `seenFirstRun` | `chrome.storage.local` | Whether the first-time popup has been seen |
| `devOrigin` | `chrome.storage.local` | The developer switch (off unless turned on) |
| `heddyCids` | `chrome.storage.session` | Full desk's hand-over: a random id, the video id and the jots; forgotten once taken, or after 10 minutes |
| `heddyCards:` + tab id | `chrome.storage.session` | That tab's picked snippets and pictures (up to four pictures) and, after a save, what it carried, for Undo; gone when the tab moves to another page or closes |

`chrome.storage.session` is cleared when Chrome closes. Nothing is stored
anywhere else, and no cookie, history or account data is stored at all.
(Versions before 0.5 also kept `startChoice`, the popup's old start
choice; 0.8.1 neither reads nor writes it.)

## Data usage

What the dashboard asks, and the answer to each. Google's definitions are
quoted from the dashboard's *Data usage* form.

| Data type | Collected? |
|---|---|
| Personally identifiable information | **Yes** |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | **Yes** |
| Location | No |
| Web history | **Yes** |
| User activity | No |
| Website content | **Yes** |

⚠️ **Two answers change from the 2026-10-30 submission and wait for the
owner:** *Personal communications* (No → Yes) and *Web history* (No → Yes).
The reasoning for every row follows.

**Personally identifiable information** ("name, address, email address,
age, or identification number") — **Yes**, unchanged (owner ruling
2026-10-30). `GET /api/learn/heddy/me` answers with the child's first name
and year group, shown in Heddy's settings and panel and never stored or sent
on.

**Website content** ("text, images, sounds, videos, or hyperlinks") —
**Yes**, unchanged (owner ruling 2026-10-30), and only on the student's own
action: Save to my Jotters, + Text, Add to Sources, Snap a picture,
Ask {professor} or Make a card. Heddy's background sends the words, page text or
picture they chose to aitutors.me (`/api/learn/heddy/save`, `/ask`, `/card`,
`/jot`, `/clip`, `/undo`), with the browser's own aitutors.me sign-in, under
the student's own account; Heddy holds no credential and never reads the
cookie. On YouTube the desk also sends the video's chapter titles
(`/desk/keypoints`) and, on Save to My Jotters, the jotted lines
(`/desk/jots`): website content too. A Quiz answer is the number of the
option the student tapped on a quiz aitutors.me wrote; it is the student's
reply to aitutors.me's own content, so it is counted here and not as *User
activity*. It is never sold, never used for advertising or to decide
creditworthiness, and not shared with third parties beyond aitutors.me's own
processing. Heddy sends nothing anywhere else, keeps no copy after a save,
and has no analytics or error reporting.

**Personal communications** ("emails, texts, or chat messages") —
**Yes (changed; owner to confirm).** The Ask view, on the desk and in the
panel, is a chat: the student types a message, Heddy's background sends it
and the conversation so far to aitutors.me (`/api/learn/heddy/ask`), and the
professor's reply comes back. Google's examples name chat messages without
asking who is at the other end, so a typed conversation with a tutor fits
the definition as written. The 2026-10-30 answer counted Ask under *Website
content* only. Answering No would be defensible only if "personal" meant
person-to-person; nothing in the form says so, and a reviewer who opens Ask
sees a chat.

**Web history** ("list of web pages a user has visited, page titles, and
time of visit") — **Yes (changed; owner to confirm).** On a web page Heddy
sends an address and title only for the page the student saves from, which
is website content, not a history. But on YouTube the desk asks
`/desk/video` and `/desk/transcript` with the video's id and title as soon as
it opens, and with 📌 on it opens by itself on every video: aitutors.me then
learns each video the student watches with the desk, and when. That is a
list of pages visited with their titles. With 📌 off it happens only on
Watch with Heddy, but the form has one answer for the extension, so the
honest answer is Yes.

**User activity** ("network monitoring, clicks, mouse position, scroll, or
keystroke logging") — No, unchanged. Heddy listens to one key (H) only while
the desk is open, to jot the line being spoken, and logs no key, click,
scroll or pointer anywhere. Which Quiz option the student tapped is sent as
their answer (above), not as a record of what they did.

**Authentication information** ("passwords, credentials, security question,
or personal identification number (PIN)") — No, unchanged. Chrome attaches
the aitutors.me sign-in cookie to Heddy's requests as it would for any
aitutors.me page; Heddy never reads, stores or sends it itself.

**Location** — No. Heddy reads no location, and aitutors.me's view of the IP
address is the site's own, not collected by Heddy. **Health** and
**Financial and payment information** — No: Heddy shows no price and handles
no payment (*Upgrade* opens aitutors.me's own pricing page in a tab).

What is kept on aitutors.me is covered by https://aitutors.me/privacy.

### Certifications (all three ticked)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

https://github.com/maggielovelace/aitutors-plugin/blob/main/heddy-chrome/PRIVACY.md
