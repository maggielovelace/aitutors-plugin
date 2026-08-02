# AI Tutors — ChatGPT & Codex plugin

**English** · [简体中文](README.zh-CN.md)

Install the [aitutors.me](https://aitutors.me) tutors into **ChatGPT** or **Codex**.

This repository contains only the plugin manifest — the tutors themselves run at
`https://aitutors.me/mcp`. Nothing here needs building, and there is no code to run.

---

## What this is

[![aitutors.me KS3 Parent Intro Video](https://img.youtube.com/vi/w3I3YWmSArM/maxresdefault.jpg)](https://www.youtube.com/watch?v=w3I3YWmSArM)

*Two minutes on what the tutors do and how a KS3 family uses them.*

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

Step-by-step guides: [Claude](https://aitutors.me/install) ·
[ChatGPT](https://aitutors.me/chatgpt) ·
[Claude Code & Codex](https://aitutors.me/agent-setup)

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

[hello@aitutors.me](mailto:hello@aitutors.me) · [aitutors.me/chatgpt](https://aitutors.me/chatgpt) ·
[YouTube](https://www.youtube.com/@aitutorsme)

---

Claude is our primary platform — new features land there first. Everything the
tutors do works the same on both.
