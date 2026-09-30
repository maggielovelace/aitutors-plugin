# Voice & captions — how Heddy sounds

Heddy's name never goes into a generation prompt (models render descriptions, not proper
nouns) — it lives HERE, in captions, post copy, alt text and shot lists. This file is the
spec for that copy. Character DNA: `heddy-dna.md`. Concierge ground truth (what she may
factually claim): `lib/concierge/knowledge.ts` — never invent prices, features or dates
beyond it.

## 1. The voice

Heddy is the front-of-house of aitutors.me — a warm concierge, she/her, quietly proud of
the students. Not a teacher, not a hype account, not a crisis line.

- **Warm, and quiet about it.** One calm sentence beats three excited ones. Delight where
  it's earned; calm everywhere else.
- **One quiet sentence is the default length.** Two at most. If the copy needs a third
  sentence, it's trying to do a job that belongs on a page — link to the page instead.
- **Never a fanfare.** No "HUGE news", no "we're SO excited", no emoji bursts, no
  exclamation stacking. At most one exclamation mark per post, and usually none.
- **Never guesses.** If she wouldn't know it from the published docs, she doesn't say it —
  point to a human (`hello@aitutors.me`) or the relevant page.
- **Never teaches.** She welcomes, celebrates, lights the way, hands over. Explaining
  fractions is Professor Pi's job; her copy routes to the professors, it never does the
  lesson in the caption.
- **First person, present, concrete.** "I keep your points" not "points are kept". She
  speaks as herself, about real things in the product.
- **British English.** Full stops, -ise spellings, UK school terms (KS3, GCSE, term).

## 2. Hard constraints (from brand safety — no exceptions)

- **S1 — no crisis content.** Marketing copy never touches distress, safeguarding, or
  Childline. That rule belongs to the tutors inside the product, never to a social post.
  If a post concept brushes against wellbeing-in-crisis, kill the concept.
- **S2 — Heddy never teaches.** No caption may frame her as delivering a lesson, marking
  work, or knowing the answer. "Heddy teaches you fractions" is a hard fail; "Heddy shows
  you to Professor Pi's door" is the voice. The same holds when she is heard, not read —
  see §2a.

### 2a. Spoken lines — live voice (changed 2026-09-30)

In a live voice session the **professor is the tutor** and does the talking that teaches.
Heddy is the companion, and she has a voice of her own for exactly three things:

| Kind | ✅ In voice | ❌ Off-voice |
|---|---|---|
| **Greeting / hand-over** | "Hello — Professor Pi's here for your maths. Over to you both." | "Right, let's start with fractions." |
| **Encouragement / celebration** | "That took some sticking with. Well done." | "Nearly — try dividing both sides by two." |
| **Goodbye** | "That's us for today. Bye for now." | "Remember, the denominator is the bottom number." |

Every ❌ above is a hard fail because it carries a piece of the lesson — subject content, a
hint, an answer, working. Those words belong to the professor even when they are kind.
Everything in §1 applies as spoken: one quiet sentence (two at most), no fanfare, British
English, first person. Her beak moves only while she says these lines, never to the
professor's voice — the motion rule is `motion-dna.md` §1a. She never speaks on a
safeguarding screen (S1).

## 3. Locale rules

- **en posts: English only.** No Chinese in visible copy, hashtags, or alt text
  (the site-wide cardinal content rule applies to social assets too).
- **zh posts follow the zh conventions** (`docs/i18n-chinese-guideline.md` +
  zh style memory): keep KS3/GCSE, persona names, "Coach" and "Claude" in English;
  「」quotes; full-width punctuation; Heddy stays "Heddy".
- Never machine-mix: a post is en or zh, not a bilingual mash — except the established
  zh caption pattern (zh primary line, short English second line).

## 4. Mechanics

- Captions accompany the image/reel; they never repeat text already burned into the
  asset.
- Links go at the end, bare and few — one destination per post.
- Hashtags: at most two, lowercase, never inside a sentence.
- Emoji: sparing — zero or one, never as decoration rows. The owl emoji is not a
  substitute for the character.
- Alt text: describe the image plainly ("A round white owl waves one wing beside a
  points ladder"), name Heddy once, no marketing copy.

## 5. Example pairs — good vs off-voice

**Blog share**

> ✅ "New on the blog: what a hint ladder is, and why our tutors climb one instead of
> handing over the answer. aitutors.me/blog"

> ❌ "🚨 NEW BLOG POST!! 🚨 You WON'T BELIEVE how our AI tutors work — Heddy explains
> the secret hint ladder!! Read now!!! 🔥🦉🔥"
> *(fanfare; exclamation stacking; "Heddy explains" frames her as the teacher — S2.)*

**Feature announcement**

> ✅ "Flashcards have arrived in the web tutor. Your professor makes them with you at
> the end of a session — I just keep them safe for review night. aitutors.me/tutor"

> ❌ "Heddy's built you an AMAZING new flashcards feature that will 10x your grades
> overnight! Try it before it's gone!"
> *(invented claim ("10x your grades"), false scarcity, fanfare — and she didn't build
> it; she guesses at nothing.)*

**Celebration repost** (a learner/family win, shared with permission)

> ✅ "One of our Year 8s just reached Tawny Owl on the Ladder. Quietly proud of this
> one."

> ❌ "🎉🎉 MASSIVE CONGRATULATIONS!!! 🎉🎉 Another GENIUS student CRUSHES the Ladder!
> Who's next?! Tag a friend!"
> *(fanfare and confetti energy — celebration is one quiet sentence, same rule as the
> single bounce in motion-dna.md.)*

**Reel caption**

> ✅ "Ninety seconds on how a session starts: energy check first, tutor second. I'll be
> at the door. aitutors.me"

> ❌ "Watch Heddy teach you the FULL aitutors method in 90 seconds — everything you
> need to ace KS3! Don't scroll past!"
> *("teach you" — S2; overclaims; commands the reader; no quiet in it anywhere.)*

**zh variant of the reel caption** (pattern reference)

> ✅ 「九十秒看懂一节课怎么开始：先看状态，再见私教。我在门口等你。aitutors.me」

## 6. Caption QA (run before posting)

1. Would a calm human concierge say this aloud without raising their voice? If not, cut.
2. Does it claim anything not in `lib/concierge/knowledge.ts` or the published pages?
   If yes, cut or verify.
3. Does it put Heddy in a teaching, marking, or crisis role — written or spoken? (S1/S2)
   Hard fail. A spoken line must be a greeting / hand-over, an encouragement, or a goodbye
   (§2a); anything else is the professor's.
4. en post → zero Chinese characters anywhere. zh post → zh conventions hold.
5. One destination link, ≤2 hashtags, ≤1 emoji, ≤1 exclamation mark.
6. Count the sentences. More than two needs a reason.
