# Content guide

Everything the app teaches lives in this `content/` folder. You can edit any of
these files with a plain text editor. When you run `npm run build` (or
`npm run check-content`), a checker reads every file and tells you, in plain
English, if something is broken (for example a quiz answer that points to an
option that does not exist).

## Files

| File | What it holds |
|------|---------------|
| `tracks.json` | The four learning tracks, their descriptions, and lesson order |
| `lessons/<track>/<NN>-<slug>.md` | One lesson per file |
| `glossary.json` | Glossary terms and definitions |
| `timeline.json` | Timeline events |
| `book-intros.json` | Intro cards for all 66 books |
| `resources.json` | Further Resources page |

## Lesson file format

```markdown
---
id: big-story-01            # <track>-<two digit number>; must be unique
track: big-story            # big-story | bible-origins | church-history | reading-bible
order: 1
title: "In the Beginning"
minutes: 6                  # estimated reading time
keyPassage: "Genesis 1:1-2:3"
summary: >
  Two or three sentences, written for a beginner.
quiz:
  - q: "Question text?"
    options:
      - "First option"
      - "Second option"
      - "Third option"
    answer: 1               # counts from 0, so 1 = "Second option"
    explain: "One or two sentences explaining the right answer."
---

Lesson text in Markdown.

## Use second-level headings for sections

Link to a glossary word like this: [[covenant]], or with different display
text like this: [[covenant|covenants]].
```

### Bible references

- `keyPassage` uses full English book names, e.g. `"John 3:1-21"`,
  `"Psalm 23"`, `"Genesis 1:1-2:3"`, `"1 Corinthians 15:1-8"`.
- In lesson text, write references normally, e.g. (Romans 5:8) or
  Genesis 12:1-3. The app turns them into tappable links automatically.

### Writing rules

- Plain, warm language for someone with no background. Short paragraphs.
- 5–7 minute read: roughly 800–1,100 words.
- Stick to mainstream historical scholarship. Give approximate dates ("about",
  "around", "c."), and say so plainly when scholars disagree.
- Where Protestant, Catholic, and Orthodox Christians differ, explain each view
  fairly and in the way its own members would recognise.
- Never copy text from books or websites. Write in your own words.
- Do not quote long stretches of any copyrighted Bible translation. Short
  phrases are fine; the key passage is shown from the reader's own Bible.

### Glossary term ids

These are the ids you can use inside `[[...]]`:

`abrahamic-covenant`, `allegory`, `anabaptist`, `anglican`, `apocalyptic`, `apocrypha`, `apostle`, `aramaic`, `arianism`, `ascension`, `atonement`, `baptism`, `bishop`, `canon`, `catholic`, `church`, `church-fathers`, `codex`, `context`, `council`, `covenant`, `creed`, `davidic-covenant`, `dead-sea-scrolls`, `denomination`, `deuterocanonical`, `disciple`, `dynamic-equivalence`, `ecumenical-council`, `ecumenism`, `eisegesis`, `epistle`, `eucharist`, `evangelical`, `excommunication`, `exegesis`, `exile`, `exodus`, `faith`, `filioque`, `formal-equivalence`, `genre`, `gentile`, `gospel`, `grace`, `hebrew`, `heresy`, `hermeneutics`, `holy-spirit`, `image-of-god`, `incarnation`, `indulgence`, `inspiration`, `intertestamental-period`, `israel`, `justification`, `kingdom-of-god`, `koine-greek`, `lament`, `law`, `liturgy`, `manuscript`, `martyr`, `masoretic-text`, `messiah`, `missions`, `monasticism`, `new-covenant`, `new-creation`, `oriental-orthodox`, `orthodox`, `papyrus`, `parable`, `parallelism`, `paraphrase`, `parchment`, `passover`, `patriarch`, `pentateuch`, `pentecost`, `pentecostal`, `pope`, `proof-texting`, `prophet`, `protestant`, `purgatory`, `reformation`, `repentance`, `resurrection`, `revival`, `sabbath`, `sacrament`, `sacrifice`, `salvation`, `schism`, `scribe`, `second-coming`, `septuagint`, `sin`, `sola-scriptura`, `synoptic-gospels`, `tabernacle`, `tanakh`, `temple`, `testament`, `textual-criticism`, `textual-variant`, `torah`, `translation`, `trinity`, `vulgate`, `wisdom-literature`

To add a new term, add an entry to `glossary.json` with an `id`, `term` and
`definition`.
