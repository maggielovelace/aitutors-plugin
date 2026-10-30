# Chrome Web Store — privacy practices answers

The answers for the developer dashboard's **Privacy practices** tab. They say
the same as [PRIVACY.md](../PRIVACY.md); if one changes, change both.
`tests/store.test.mjs` checks that every permission in `manifest.json` has a
justification here.

## Single purpose

> Heddy for Chrome helps a student keep what they find while studying (a
> YouTube video, a line from a video, words or a picture from a web page, or
> a whole page) and hands it to their own account on aitutors.me, where they
> choose to keep it.

## Permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | Heddy reads the current tab only after the student asks: by opening the popup, choosing a right-click menu item, or pressing a shortcut. activeTab also lets Snap a picture take a screenshot of the visible tab (chrome.tabs.captureVisibleTab) at that moment, so the student can box a diagram. No tab is read without that gesture. |
| `scripting` | Injects Heddy's own files into the tab the student asked about: to read the selected words (and up to 300 characters either side) or the page's readable text, to show the tray of tools beside a selection, to draw the box for Snap a picture, and to redraw the two buttons when YouTube moves to a new video without reloading the page. No remote code is injected. |
| `storage` | Keeps a few preferences on the device: the language (English or 简体中文), the last Whole video / From m:ss choice, whether the first-time popup and the H hint have been seen, and a developer switch. chrome.storage.session holds a hand-over for the aitutors.me window (forgotten once taken, or after 10 minutes) and pictures boxed for one jot until they are sent. |
| `contextMenus` | Adds "Save to Jotters" when the student right-clicks selected words, and "Add picture to Heddy" when they right-click a picture; each adds a card to Heddy's panel. |
| `commands` | Ctrl Shift K starts Snap a picture (press it twice for the whole screen). Heddy's buttons under a selection have a command with no default key, so the student can set their own at chrome://extensions/shortcuts. |
| Host `https://www.youtube.com/watch*` | Draws Watch with Heddy and Add to My Clips on YouTube video pages, and takes H for the line being spoken. It reads the video id from the address, and the player's time and the video's title only when the student taps or presses H. Nothing else on YouTube. |
| Host `https://aitutors.me/*`, `https://*.aitutors.me/*` | The windows Heddy opens on aitutors.me, where the student keeps what they found under their own account. Only these pages may ask Heddy for a hand-over (externally_connectable). The subdomains are aitutors.me's own preview sites. |

Not requested: `tabs`, `history`, `cookies`, `webRequest`,
`declarativeNetRequest`, `sidePanel`, `<all_urls>`. No
`web_accessible_resources`: page surfaces use Heddy's bundled Manrope font
from bytes in the content script, so no extension file is exposed to pages.

## Remote code

> **No, I am not using remote code.** All JavaScript is in the package. Heddy
> loads no script, stylesheet, font or wasm from the network, and uses no
> eval or dynamic import. The Manrope font is bundled in `fonts/`.

## Data usage

What the dashboard asks, and the answer to each.

| Data type | Collected? |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | **Yes** |

Website content (owner ruling, 2026-10-30): **Yes**, and only on the
student's own action: Save to Jotters, + Text or + Add, Save page to Jotters, Snap a picture, or Explain /
Make a card / Ask Heddy. Heddy then reads the words, page or picture they
chose and hands it, inside Chrome, to the aitutors.me window in front of
them; it goes only to aitutors.me, under the student's own account. It is
never sold, never used for advertising or to decide creditworthiness, and not
shared with third parties beyond aitutors.me's own processing. Heddy itself
sends nothing to any server, keeps no copy after the hand-over, and has no
analytics or error reporting.

Who is signed in (D60): the settings page and the panel on a page Heddy
can't save from send one `GET https://aitutors.me/api/learn/heddy/me`, with
the browser's own aitutors.me cookie and no body. The answer (a child's first
name, year group and subjects, or only "a grown-up is signed in") is shown
and never stored or sent on. ⚠️ Owner to decide before the next submission
whether this counts as "Personally identifiable information" in the table
above; it is left at its current answer until then. What is kept on aitutors.me is covered by
https://aitutors.me/privacy.

### Certifications (all three ticked)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

https://github.com/maggielovelace/aitutors-plugin/blob/main/heddy-chrome/PRIVACY.md
