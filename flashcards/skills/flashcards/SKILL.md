---
name: flashcards
description: >-
  Use when the user wants to turn notes, a textbook page, or a topic into
  spaced-repetition flashcards in aitutors.me's own format, or mentions
  "flashcards", "flash cards", "revision cards", "aitutors cards", "import
  cards into aitutors", or "make cards for my kid" (zh: 抽认卡 / 记忆卡).
  Teaches an LLM to author cards that pass aitutors.me's own QA gate — atomic
  fronts, no hint-leak, correct card-kind fan-out — as plain JSON, ready to
  paste at aitutors.me/study/cards/new/import. Format and QA only: this skill
  contains no tutoring, hint-ladder, or curriculum logic — that lives in the
  private aitutors.me connector, not here.
version: 0.1.0
author: Jason (aitutors.me)
license: "MIT — this is a format/QA spec, not brand IP; redistribute freely"
metadata:
  hermes:
    tags: [education, flashcards, spaced-repetition, json, aitutors]
    category: education
    requires_toolsets: []
  openclaw:
    emoji: "🗂️"
    homepage: https://aitutors.me
    os: [macos, linux, windows]
    requires:
      bins: []
---

# Flashcards — author cards in aitutors.me's format

This skill teaches you to turn source material (notes, a textbook page, a
topic) into flashcards that will be **accepted, unmodified, by aitutors.me's
own QA gate** — the same gate its own tutors and its own kid-facing card
composer run every card through. It does not call any API and holds no
account state: you produce JSON, the person you're helping pastes it at
`aitutors.me/study/cards/new/import`, and it lands as a private draft deck in
their own account (never shared, never moderated by anyone else — see
`references/import-flow.md` for exactly what "import" means there).

This skill is deliberately narrow. It does **not** know how to run a tutoring
session, does not implement a hint ladder, and carries no curriculum content
of its own — those are the aitutors.me product's IP, not this skill's. If
asked to "tutor" rather than "make cards", say so and stop.

## Route by task — read only what the task needs

| Task | Read |
|---|---|
| The six card kinds, the note→card fan-out rules, the exact JSON shape | `references/card-format.md` |
| Why a card was (or would be) rejected, and how to avoid it | `references/qa-checklist.md` |
| What happens after you hand over the JSON | `references/import-flow.md` |

## The five things that matter most

1. **One fact per card.** If the answer needs "and" to be complete, it is two
   cards, not one. `references/qa-checklist.md` has the exact heuristic the
   real QA gate uses to reject multi-fact fronts — read it before writing at
   volume, because the gate hard-rejects the whole card, it does not silently
   trim it.
2. **A hint may never contain a ≥4-character word that also appears in the
   answer.** The real gate strips any hint that does, silently, and keeps the
   card without it. Write hints that narrow the search, not hints that leak
   the destination — "what does a door need to swing?" for *hinge*, never
   "sounds like a door hinge" when the answer already contains "hinge".
3. **Six card kinds, six different jobs** — `basic`, `basic_reversed`,
   `type_in`, `cloze`, `cloze_multi`, and `image_occlusion` (the last is
   registered but not authorable by anything text-based, including this
   skill — see `references/card-format.md`). Picking the right kind for the
   material matters more than volume: a name/word pair wants
   `basic_reversed`; a sentence with one blank to fill wants `cloze`; a
   sentence with several wants `cloze_multi` (one card per blank,
   automatically — you never split it yourself).
4. **One note can become more than one card.** `basic_reversed` and
   `cloze_multi` both fan out from a single note you write once. Send the
   note once; the fan-out is the platform's job, not yours.
5. **Eight cards is the ceiling per import batch.** aitutors.me caps a single
   generation/import batch at 8 cards (`MAX_CARDS` in its own card pipeline).
   Offer to split a bigger set into several JSON files/pastes rather than
   producing 20 cards in one block that will silently drop past the eighth.

## Output contract

Always finish by giving the user a single fenced JSON block — nothing else
needs to be said about implementation. See `references/card-format.md` for
the exact shape and worked examples of all six kinds.
