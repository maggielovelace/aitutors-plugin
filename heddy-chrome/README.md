# Heddy for Chrome

**English** · [简体中文](README.zh-CN.md)

*Keep what you find.* Works with [aitutors.me](https://aitutors.me).

Heddy puts two buttons on every YouTube video page, straight after Share:

- **Watch with Heddy** keeps the video in *My Clips* and opens it in
  Classroom on aitutors.me, with the professor for that subject.
- **Add to My Clips** keeps it for later.

The same two buttons are in Heddy's toolbar popup, with a choice of
*Whole video* or *From m:ss*, so they work even if YouTube changes its page.

Heddy is a courier. It keeps no account, key or token and makes no network
call of its own: every tap opens a small window on aitutors.me, and that page
checks the video and saves it under the child's own account, with one tap
there. **Reads a page only when you ask it to** — see [PRIVACY.md](PRIVACY.md).

And on any page:

- **H on a YouTube video** jots the line being spoken into the video's
  Jotter. Press H twice quickly to take the line before as well. YouTube's
  own keys, J included, keep doing what they always did.
- **Jot it** keeps words you select on any page, with where they came from.
  Right-click a selection → *Jot it with Heddy*, or open Heddy's popup. You
  can also give it a shortcut of your own at `chrome://extensions/shortcuts`
  (Heddy sets none, so it never takes one of Chrome's).
- **Clip this page** keeps the readable part of a page as a source for your
  Jotter. A very long page keeps its first part, and Heddy tells you so.

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
in, the window asks you to first and then carries on.

## Settings

Right-click Heddy's icon → **Options**, or the cog in the popup:

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
            toast "In My Clips", tick on the icon
```

- `background.js` + `lib/courier.js` — opens the window, answers each `cid`
  once, drops an unclaimed one after 10 minutes, shows the result.
- `content/youtube.js` — the two buttons and the toast, in a closed shadow
  root. **Every YouTube selector is in `content/youtube-selectors.js`**: when
  YouTube changes its page, that is the one file to fix.
- `popup/`, `options/` — the toolbar popup and the settings page.
- `lib/protocol.js` — the messages; they mirror `lib/capture/protocol.ts` on
  aitutors.me.
- `_locales/` — English and 简体中文. After editing them, run
  `node scripts/build-messages.mjs` (the settings switch reads a bundled copy).

No build step: the folder is the extension.

## Tests

```bash
cd heddy-chrome
npm test
```

Node 20 or later, no dependencies. The tests pin the permissions, forbid any
network call in the shipped files, check that each `cid` is answered once and
expires at 10 minutes, and check every message against the site's validator.

`scripts/render-icons.sh` redraws the PNG icons from `icons/src/*.svg` (needs
`rsvg-convert`).

## Licence

MIT for the code — see [LICENSE](LICENSE). The Heddy name, character and
icons are not covered.
