# Card format

## The output shape

Produce **one** fenced JSON block. Either shape is accepted:

```json
{
  "topic": "Cell structure",
  "cards": [
    { "front": "What does the mitochondrion do?", "back": "Releases energy from glucose (respiration)", "hint": null, "card_type": "basic" }
  ]
}
```

or a bare array, if you have no topic to suggest (the person importing it
will be asked to type one):

```json
[
  { "front": "Mitochondrion", "back": "Releases energy from glucose", "hint": null, "card_type": "basic_reversed" }
]
```

### Per-card fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `front` | string | yes | The prompt. One fact (see `qa-checklist.md`). |
| `back` | string | yes | The answer. Say it the way you'd actually say it out loud — not a paragraph. |
| `hint` | string \| null | yes (use `null` if none) | Optional scaffold. Must not repeat a ≥4-char word from `back` — see `qa-checklist.md`. |
| `card_type` | string | yes | One of: `basic`, `basic_reversed`, `type_in`, `cloze`, `cloze_multi`. Never `image_occlusion` — see below. |
| `extra` | string \| null | no | The "why" — context never needed to answer the card. ≤700 characters. |
| `source_url` | string \| null | no | Only kept if it is `https://bbc.co.uk/bitesize/...` or `https://thenational.academy/...` (any subdomain of either). Anything else is silently dropped — don't bother inventing other links. |

Field names are **snake_case** on the wire (`card_type`, `source_url`), even
though this is a JavaScript/TypeScript product internally — that internal
detail doesn't matter to you, just match the table above exactly.

## The six kinds, one note at a time

**`basic`** — one question, one answer. The default. Most cards should be this.

```json
{ "front": "Which particle decides what element an atom is?", "back": "The proton", "hint": null, "card_type": "basic" }
```

**`basic_reversed`** — write it ONCE; the platform makes two cards from it,
each scheduled independently (recognising the word and producing it are
different skills). Use for vocabulary, names, terms — anything where both
directions matter.

```json
{ "front": "Mitochondrion", "back": "Releases energy from glucose", "hint": null, "card_type": "basic_reversed" }
```

**`type_in`** — same as `basic`, but the person types their answer before
seeing it. Pick this for short, exact answers (a term, a formula, a number) —
not for anything where the wording could reasonably vary, since the check is
literal.

```json
{ "front": "What does HCF stand for?", "back": "highest common factor", "hint": null, "card_type": "type_in" }
```

**`cloze`** — a sentence with exactly ONE blank, marked with double braces.
Put the same text the braces mark into `back` too, so the card is
self-describing without depending on anyone parsing the braces downstream.

```json
{ "front": "A force is measured in {{newtons}}.", "back": "newtons", "hint": null, "card_type": "cloze" }
```

**`cloze_multi`** — a sentence with TWO OR MORE blanks. Write it once; the
platform makes one card per blank automatically (each with its own
schedule). You never split this yourself — sending `cloze_multi` with two
braces is correct and complete.

```json
{ "front": "The {{Battle of Hastings}} was fought in {{1066}}.", "back": "Battle of Hastings; 1066", "hint": null, "card_type": "cloze_multi" }
```

Blank-count decides `cloze` vs `cloze_multi` automatically downstream — if
you write zero blanks by mistake, the platform keeps the card but silently
turns it into `basic` with the braces stripped, which is very likely not
what you intended. Always double-check the brace count matches the kind you
meant.

**`image_occlusion`** — registered by the platform but reserved for its own
canonical, product-owned diagrams. **Never emit this card type.** A card of
this type with no diagram attached is a broken card, and this skill has no
mechanism to attach one. Anything you send with this `card_type` is coerced
to `basic` on arrival anyway (fail-open, not an error) — so just don't use
it, and use `basic` with a described diagram in the `front` text instead if
a visual concept needs a card.

## The eight-card ceiling

A single import lands as one deck, and one deck accepts at most **8** cards
per batch — a card beyond the eighth is silently not saved (the person gets
a gentle notice, not an error naming the number). If the material genuinely
needs more than 8 cards, say so and offer two or more separate JSON blocks
(one topic/deck each) rather than one long array.
