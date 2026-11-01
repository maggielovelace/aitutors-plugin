# Heddy for Chrome

**English** · [简体中文](README.zh-CN.md)

*Keep what you find.* Works with [aitutors.me](https://aitutors.me).

Heddy puts one button on every YouTube video page, straight after Share:
**Watch with Heddy**. It opens the **Professor's desk** in YouTube's
suggestions column (under the player in theatre mode or a narrow window):
Classroom's desk, with **Jot** (press **H** for the line being spoken, twice
quickly for the line before, or type a note), the **Digest** (the transcript
in English, Bilingual or Chinese, following the player; tap a time to play from there,
and select words or click a line for Classroom's tray: Jot it · Explain ·
Make a card · Ask the professor · › Play from here · Copy),
Insights where aitutors.me has them, a **Quiz** when the video is in *My Clips*
and has a quiz ready (Classroom's quiz, inside the desk), and the crest to ask
the professor.
**Save to My Jotters** saves the jots to the video's Jotter; **Full desk**
keeps the video in *My Clips* and opens it in Classroom with them. The desk
speaks English or Chinese (its EN | 中 is Heddy's Language setting), and 📌
opens it on every video.

**Add to My Clips** is Heddy's panel on a YouTube video: the video's
thumbnail and exact link, a film strip of its frames with a gold window to
drag from both ends, and *Whole · The last 30 s · From now*. Click Heddy's
toolbar icon and the panel opens at the top right of the page; *Add to My
Clips* keeps it and says so on the video ("Added to My Clips · Open").

**On any other page the panel is the desk** (Round 9), docked on the right
with the page narrowed beside it: one **Sources** tab with the numbered cards
(drag ⠿ or use ↑ ↓, ✕, + Text / + Picture), **Also keep the article's text ⓘ**,
**Save n to my Jotters** (Read it · Jot it · Get it), and the Heddy crest,
which is the **Ask** tab: a conversation with the page's professor, with
*Explain* and *Make a card* chips, *Keep card* and *Keep as a jot*. Under a
picture and under selected words the same bar, *[Text view | Picture view] ·
Heddy ▾*, offers *Ask Mentor about it/this* and *Make a card* in the desk.
On pages Chrome keeps extensions out of (`chrome://` pages, the Web Store)
the toolbar popup shows the panel.

Heddy keeps no account, key or token. Every save, Undo, card, jot, clip and
question goes from Heddy's background to aitutors.me with the browser's own
aitutors.me sign-in (`lib/heddy-api.js`, `lib/desk-api.js`), and the site keeps
it under the child's own account. **No window or tab opens unless the child
taps a link that says it leaves** (Open my Jotter ↗, Open on a toast, Sign in,
Full desk ↗, the popup's tiles). **Reads a page only when you ask it to** — see [PRIVACY.md](PRIVACY.md).

And on any page:

- **H on a YouTube video**, while the desk is open, jots the line being
  spoken into the desk's Jot tab. Press H twice quickly to take the line
  before as well. It works on any of the desk's tabs, while the video plays
  and in fullscreen (a small "Jotted" note shows on the video), never while
  you type. With the desk closed H does nothing, and YouTube's own keys,
  J included, always keep doing what they did.
- **Collect, then Save to Jotters.** Click Heddy's icon and its panel stays
  on the page while you read. While it is open, **select words and each
  selection is added by itself** as the next card (stretch or shrink it
  within 5 seconds and the card follows; ✕ removes one you did not want).
  **+ Text** and **+ Picture** are a switch: tap **+ Picture** and draw a
  box for a picture. Each one is a numbered card, and the same number shows
  on the page beside its highlight or box. Drag a card by ⠿, or use ↑ / ↓
  (Alt+↑ / Alt+↓ on a focused card), to put them in your order. Up to 10
  snippets and 4 pictures, all from one page; going to another page clears
  them. **Save to Jotters** puts them on the left page of that page's
  Jotter, in your order, where you jot from them. **Save and jot now** opens
  the notebook at them. Explain, Make a card and Ask Heddy act on card 1.
- **Snap a picture** (the panel's + Picture, or Ctrl Shift K, which opens
  the panel too): under a box, the **Text | Picture** switch · **+ Picture**
  to keep it · **Heddy ▾** with Explain this picture, Make a card, Ask Heddy
  about it, Copy picture and Whole visible page. Saving is in the panel.
  Esc, or Text on the switch, goes back to words.
- **Right-click** words → *Save to Jotters*, or a picture → *Add picture to
  Heddy*: either becomes the next card, and the panel opens on it. Heddy's
  buttons under a selection (+ Add, Explain, Make a card, Ask Heddy) come up
  with a shortcut of your own at `chrome://extensions/shortcuts` (Heddy sets
  none, so it never takes one of Chrome's). Ctrl Shift K pressed twice keeps
  the whole visible tab as a card. Nothing Heddy does writes a jot: you jot
  in the notebook, from the left page.
- **Save page to Jotters** keeps the readable part of a page as a source in
  your Jotters. A very long page keeps its first part, and Heddy tells you so.

## Install

**From the Chrome Web Store:** the listing link goes here when it is
published.

**From source** (for testing, or before the listing is live):

1. Download this repository (Code → Download ZIP) and unzip it, or
   `git clone https://github.com/maggielovelace/aitutors-plugin`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `heddy-chrome` folder.
4. Pin Heddy from the puzzle-piece menu, then open any YouTube video.

Sign in to aitutors.me as the child in the same Chrome. If you aren't signed
in, the aitutors.me tab or window asks you to first and then carries on.

## Settings

Right-click Heddy's icon → **Options**, or the cog in Heddy's panel:

- **Language** — English or 简体中文. It starts as Chrome's language. The
  windows on aitutors.me follow the language chosen on the site.
- **For developers** — send captures to `http://localhost:3000` instead of
  aitutors.me. Leave it off.

## For schools

Managed Chromebooks may block extensions. To allow Heddy, add its id to your
allow-list in the Google Admin console:

```
Extension id: (filled in when the Web Store listing is published)
```

Nothing on aitutors.me depends on Heddy: without it, children add videos from
the Quick add page as before.

## How it works

Every save and question (Round 9):

```
desk / Heddy ▾ ──message──▶ Heddy's background ──POST, the browser's cookie──▶ aitutors.me/api/learn/heddy/*
      ▲                                │
      └──── the answer (Ask: NDJSON lines over a Port) ◀──┘
```

Full desk ↗, the one hand-over left:

```
YouTube page ──tap──▶ Heddy ──opens──▶ aitutors.me/capture/clip?cid=…
                       ▲                         │
                       └─ heddy:ready ───────────┤  (Chrome extension messaging)
                       ── heddy:add (once) ─────▶│
                                                 │  check · topic · Keep, as the child
                       ◀── heddy:result ─────────┘
   Heddy closes the tab · toast "In My Clips", tick on the icon
```

- `background.js` + `lib/courier.js` — Full desk's tab: answers each `cid`
  once, drops an unclaimed one after 10 minutes, shows the result.
- `lib/heddy-api.js` + `lib/web-routes.js` — Round 9's six requests and who may
  ask for them; `lib/cards.js` — the Sources list and the save.
- `popup/web-desk.js`, `lib/desk-shell.js`, `lib/ask-view.js`, `lib/desk-ask.js` —
  the web desk, the desk's look, and the Ask view (shared with YouTube's desk).
- `lib/tray-tools.js`, `content/page-tray.js`, `content/box-mode.js` — the bar
  and Heddy ▾ under words and pictures.
- `content/youtube.js` — the two buttons and the toast, in a closed shadow
  root. **Every YouTube selector is in `content/youtube-selectors.js`**: when
  YouTube changes its page, that is the one file to fix.
- `lib/panel.js` + `content/panel.js` — the panel: a click on the icon draws
  `popup/popup.html` in a frame (a closed shadow root), docked on the right as
  the desk on an ordinary page; where Chrome forbids that, the toolbar popup.
- `popup/`, `options/` — the panel's content and the settings page.
- `lib/protocol.js` — the messages; they mirror `lib/capture/protocol.ts` on
  aitutors.me.
- `_locales/` — English and 简体中文. After editing them, run
  `node scripts/build-messages.mjs` (the settings switch reads a bundled copy).

- `fonts/` — Manrope, JetBrains Mono and Source Serif 4 (SIL OFL 1.1), bundled; see Licence below.
- `store/` — the Web Store listing (English and 简体中文), the privacy-practices
  answers and the screenshots. Not part of the package.

No build step: the folder is the extension.

## Tests

```bash
cd heddy-chrome
npm test
```

Node 20 or later, no dependencies. The tests pin the permissions, forbid any
network call in the shipped files but the who-is-signed-in request
(`lib/who.js`), the desk's five (`lib/desk-api.js`) and the six saves and
asks (`lib/heddy-api.js`), check that every one of those requests and every
`chrome.storage` key is named in [PRIVACY.md](PRIVACY.md) and
`store/privacy-answers.md`, pin the desk's words
to Classroom's catalog (`tests/classroom-words.test.mjs`, which reads a
checkout of aitutors.me at `$HEDDY_SITE_REPO` and skips without one), check that each `cid` is answered once and
expires at 10 minutes, and check every message against the site's validator.

`scripts/build-fonts.mjs` rewrites `lib/font-data.js` from `fonts/*.woff2`
(the page surfaces load Manrope from those bytes, so no font URL is exposed to
the page). `scripts/render-icons.sh` redraws the PNG icons from `icons/src/*.svg` (needs
`rsvg-convert`).

## Packaging for the Chrome Web Store

```bash
cd heddy-chrome
node scripts/package.mjs        # → dist/heddy-chrome-<version>.zip, with its contents and size
PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/verify-zip.mjs
```

The zip holds exactly what `scripts/shipped.mjs` lists (the files the tests
scan), with `manifest.json` at its root: no tests, scripts, `store/`, SVG
sources or READMEs. Its manifest drops `http://localhost:3000/*` from
`externally_connectable` (`--dev` keeps it). `verify-zip.mjs` loads the zip
unpacked in headless Chromium and fails on any install warning, manifest
error, runtime error or page error. The listing, the privacy answers and the
screenshots are in `store/`; `store/render/render.mjs` redraws the
screenshots from the real UI.

## Licence

MIT for the code — see [LICENSE](LICENSE). The Heddy name, character and
icons are not covered.

The Manrope typeface in `fonts/` (and its bytes in `lib/font-data.js`) is
© The Manrope Project Authors and is licensed under the SIL Open Font
License 1.1 — see [fonts/OFL.txt](fonts/OFL.txt). It is bundled, not
downloaded: the extension makes no request for it. The desk's JetBrains Mono
(© The JetBrains Mono Project Authors, [fonts/OFL-JetBrainsMono.txt](fonts/OFL-JetBrainsMono.txt))
and Source Serif 4 (© The Source Serif 4 Project Authors,
[fonts/OFL-SourceSerif4.txt](fonts/OFL-SourceSerif4.txt)), latin subsets in
`fonts/` and as bytes in `lib/font-desk-data.js`, are under the same licence
and bundled the same way.
