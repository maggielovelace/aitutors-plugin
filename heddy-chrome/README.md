# Heddy for Chrome

**English** · [简体中文](README.zh-CN.md)

*Keep what you find.* Works with [aitutors.me](https://aitutors.me).

Heddy puts two buttons on every YouTube video page, straight after Share:

- **Watch with Heddy** keeps the video in *My Clips* and opens it in
  Classroom on aitutors.me, with the professor for that subject.
- **Add to My Clips** keeps it for later.

The same two buttons are in Heddy's panel, with a choice of *Whole video* or
*From m:ss*, so they work even if YouTube changes its page. Click Heddy's
toolbar icon and the panel opens at the top right of the page. It stays there
while you scroll, select or click the page, and closes on its ✕, on Esc, or
on a second click of the icon. On pages Chrome keeps extensions out of
(`chrome://` pages, the Web Store) it opens as a small window instead.

Heddy is a courier. It keeps no account, key or token: every tap opens a
page on aitutors.me, and that page checks the video and saves it under the
child's own account, with one tap there. Its one request of its own asks
aitutors.me who is signed in, for the study pass in its settings and the
account row in its panel, and keeps nothing it hears.
Watch with Heddy and Add to My Clips open it in a new tab beside the video,
which Heddy closes once the video is kept, bringing you back to it; the
other captures open a small window. **Reads a page only when you ask it to** — see [PRIVACY.md](PRIVACY.md).

And on any page:

- **H on a YouTube video** jots the line being spoken into the video's
  Jotter. Press H twice quickly to take the line before as well. YouTube's
  own keys, J included, keep doing what they always did.
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

```
YouTube page ──tap──▶ Heddy ──opens──▶ aitutors.me/capture/clip?cid=…
                       ▲                         │
                       └─ heddy:ready ───────────┤  (Chrome extension messaging)
                       ── heddy:add (once) ─────▶│
                                                 │  check · topic · Keep, as the child
                       ◀── heddy:result ─────────┘
   Heddy closes the tab · toast "In My Clips", tick on the icon
```

- `background.js` + `lib/courier.js` — opens the tab or window, answers each `cid`
  once, drops an unclaimed one after 10 minutes, shows the result.
- `content/youtube.js` — the two buttons and the toast, in a closed shadow
  root. **Every YouTube selector is in `content/youtube-selectors.js`**: when
  YouTube changes its page, that is the one file to fix.
- `lib/panel.js` + `content/panel.js` — the panel: a click on the icon draws
  `popup/popup.html` in a frame at the top right of the page (a closed shadow
  root), or opens it in a small window where Chrome forbids that.
- `popup/`, `options/` — the panel's content and the settings page.
- `lib/protocol.js` — the messages; they mirror `lib/capture/protocol.ts` on
  aitutors.me.
- `_locales/` — English and 简体中文. After editing them, run
  `node scripts/build-messages.mjs` (the settings switch reads a bundled copy).

- `fonts/` — Manrope (SIL OFL 1.1), bundled; see Licence below.
- `store/` — the Web Store listing (English and 简体中文), the privacy-practices
  answers and the screenshots. Not part of the package.

No build step: the folder is the extension.

## Tests

```bash
cd heddy-chrome
npm test
```

Node 20 or later, no dependencies. The tests pin the permissions, forbid any
network call in the shipped files but the one who-is-signed-in request
(`lib/who.js`), check that each `cid` is answered once and
expires at 10 minutes, and check every message against the site's validator.

`scripts/build-fonts.mjs` rewrites `lib/font-data.js` from `fonts/*.woff2`
(the page surfaces load Manrope from those bytes, so no font URL is exposed to
the page). `scripts/render-icons.sh` redraws the PNG icons from `icons/src/*.svg` (needs
`rsvg-convert`).

## Licence

MIT for the code — see [LICENSE](LICENSE). The Heddy name, character and
icons are not covered.

The Manrope typeface in `fonts/` (and its bytes in `lib/font-data.js`) is
© The Manrope Project Authors and is licensed under the SIL Open Font
License 1.1 — see [fonts/OFL.txt](fonts/OFL.txt). It is bundled, not
downloaded: the extension makes no request for it.
