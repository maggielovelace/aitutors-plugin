# Flashcards for aitutors.me

> Turn notes, a textbook page, or a topic into flashcards that pass
> aitutors.me's own QA gate on the first try — atomic fronts, no hint-leak,
> the right card kind for the material — output as one JSON block ready to
> import.

This is a **format and QA teaching skill**, not a tutor and not an
integration. It calls no API and holds no account state. It knows nothing
about hint ladders, Socratic questioning, or curriculum content — that is
the private aitutors.me connector's job, not this skill's.

## The six card kinds

| Kind | What it tests | Cards per note |
|---|---|---|
| `basic` | One question, one answer | 1 |
| `basic_reversed` | Recognise AND produce (vocab, names) | 2, independently scheduled |
| `type_in` | Typed recall of a short exact answer | 1 |
| `cloze` | Fill one blank in a sentence | 1 |
| `cloze_multi` | Fill several blanks in one sentence | 1 per blank |
| `image_occlusion` | Reserved for the platform's own diagrams | never authored here |

Full schema and worked examples: `references/card-format.md`.

## Quick invocations

```text
Use the flashcards skill on this page of notes about the water cycle —
make me a set for a Year 8 aitutors.me account.
```

```text
flashcards: I have a list of 15 French vocab words with translations —
turn them into basic_reversed cards. Split into two batches since that's
more than the 8-card ceiling.
```

## Install

**Claude Code:** the skill lives in this repo at `skills/flashcards/` and is
picked up from the project skills directory.

**Hermes Agent** (NousResearch `hermes-agent`): skills live in
`~/.hermes/skills/<category>/<name>/` — drop the directory in and it's live,
no registration:

```bash
cp -R skills/flashcards ~/.hermes/skills/education/flashcards
hermes skills list | grep flashcards   # verify
```

No environment variables or API keys are required — this skill only
produces JSON.

## What happens next

The output is a JSON block, not a saved deck. See `references/import-flow.md`
for exactly how someone turns that block into real, private practice cards
in their own aitutors.me account.

## Status

| Piece | Status |
|---|---|
| Card format + all six kinds documented | Written |
| QA checklist (mirrors `lintCard` exactly) | Written |
| Import-flow guidance | Written |

Source of truth for the rules this skill restates: `lib/learner/flashcards.ts`
and `lib/learner/card-lint-copy.ts` in the private aitutors.me repo; product
spec `docs/prd/PRD-v0.62.0-flashcards-public-skill-and-import.md`.

**License:** MIT — this is a format/QA spec, not brand IP. Redistribute and
adapt freely.
