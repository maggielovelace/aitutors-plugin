# AI Tutors — ChatGPT & Codex plugin

Install the [aitutors.me](https://aitutors.me) tutors into **ChatGPT** or **Codex**.

This repository contains only the plugin manifest — the tutors themselves run at
`https://aitutors.me/mcp`. Nothing here needs building, and there is no code to run.

---

## Install

### ChatGPT (Work) or the ChatGPT desktop app

1. Open **Plugins** → **Add plugin marketplace**
2. Paste this repository's URL as the **Source**:
   ```
   https://github.com/maggielovelace/aitutors-plugin
   ```
3. Add the marketplace, then **Install** the *AI Tutors* plugin
4. Sign in with your aitutors.me account when prompted

Plugins are available in **ChatGPT Work** on the web and in the desktop app.
They are not available in the Chat tab, the IDE extension, or on mobile.

### Codex CLI

```bash
codex plugin marketplace add https://github.com/maggielovelace/aitutors-plugin
codex plugin add aitutors@aitutors-me
codex mcp login aitutors
```

The last command opens the aitutors.me sign-in page in your browser.

### Without the marketplace

Any MCP client that speaks OAuth can connect directly to:

```
https://aitutors.me/mcp
```

---

## What you get

Mentor runs the daily check-in and hands over to the right subject tutor —
Professors **Pi** (maths), **Quill** (English), **Darwin** (biology),
**Curie** (chemistry), **Newton** (physics), **Harari** (history) and
**Mercator** (geography).

Sessions, flashcards and progress save to the same account as the aitutors.me
parent dashboard, so work done in ChatGPT shows up there.

## Requirements

An active [aitutors.me](https://aitutors.me) subscription. The plugin signs you
in to your existing account; it does not create one.

## Support

[hello@aitutors.me](mailto:hello@aitutors.me) · [aitutors.me/chatgpt](https://aitutors.me/chatgpt)

---

Claude is our primary platform — new features land there first. Everything the
tutors do works the same on both.
