# QA checklist

aitutors.me runs every card — model-authored or child-authored — through the
same deterministic gate before it is saved. This document restates that
gate's rules exactly, so what you produce passes on the first try instead of
coming back rejected.

## 1. Multi-fact fronts — the only HARD rejection

A front that clearly asks for more than one fact is refused outright: the
whole card is rejected, nothing is saved, nothing is silently trimmed. The
gate is deliberately conservative — it would rather let a borderline
multi-fact card through than reject a good single-fact one — but these
patterns reliably trip it:

- An enumeration verb plus an explicit small count: *"Name three organelles"*,
  *"Give the four chambers of the heart"*, *"State 3 properties of metals"*.
  (A count written as a big number — "the 1066 battle" — is fine; that's a
  date, not an enumeration.)
- A leading "list" imperative: *"List the noble gases"*.
- Two enumerated things joined by "and the"/"and their": *"Name the reactants
  and the products"*.

**Fix:** split into one card per fact. "Name three organelles" becomes three
separate `basic` cards, one organelle each — or, if it's really the same
question three times, consider whether it's better as one `cloze_multi` card
with three blanks in one sentence.

## 2. Hint-leak — silently stripped, card kept

If a `hint` contains a word four characters or longer that also appears in
`back` (case-insensitive), the hint is dropped and the card is saved without
it. This isn't an error, but it means your hint effectively vanishes — so
write hints that would still make sense with this rule in mind:

- **Bad:** back = "hinge", hint = "sounds like a door hinge" → the word
  "hinge" appears in both, hint is stripped.
- **Good:** back = "hinge", hint = "what does a door need to swing open?" →
  no shared long word, hint survives and actually scaffolds recall.

A hint should narrow the search, never spell out or paraphrase the answer.

## 3. Source links — allowlist only

`source_url` is kept only if it resolves to `https://bbc.co.uk/bitesize/...`
or `https://thenational.academy/...` (any subdomain of either, `https` only).
Anything else — a different domain, `http://`, a malformed URL — is silently
dropped; the card is kept without a link. Don't invent or guess at other
"official-looking" education URLs; they will not survive.

## 4. Unknown taxonomy nodes — silently cleared

If you ever pass `taxonomy_node` (not part of the standard shape this skill
produces, but accepted if present) and it doesn't match a real KS3 topic id,
it is cleared and the card is kept, unfiled. This skill does not have access
to the platform's topic-id list, so it's simplest to omit this field
entirely rather than guess at an id.

## 5. What "atomic front" actually means in practice

The multi-fact check above is a heuristic, not the whole spirit of the rule.
Beyond what the pattern-matcher catches, aim for: **could someone answer this
correctly by recalling ONE thing?** A front like "Explain photosynthesis"
technically has one grammatical subject but invites a paragraph — better as
several fronts, each testing one component ("What gas does photosynthesis
release?", "What pigment absorbs light for photosynthesis?", "In which
organelle does photosynthesis happen?").
