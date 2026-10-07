# Module: TextMetric

## Contract

`src/module/tool/text/textMetric.ts` is a pure, React-independent module that
computes exactly four metrics for the Word / Character Counter. It contains no
telemetry, storage, network or DOM access and is not a general text-analysis
engine.

### Metrics (exactly four)

| Public label | Meaning |
|---|---|
| Words | word-regex matches (below) |
| Characters | Unicode extended grapheme clusters |
| Characters excluding whitespace | the same graphemes minus whitespace graphemes |
| Lines | CRLF / CR / LF separators + 1; empty input is 0 |

### Words (locale-independent)

Matches of `/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu`.
A word starts with a Unicode letter or number; later letters, combining marks
and numbers stay in the run; one straight (`'`) or curly (`’`) apostrophe
between two runs joins them. Hyphen, underscore, slash, punctuation and emoji
are not word characters (`well-known` = 2, `foo_bar` = 2). A contiguous CJK run
is one word (`你好世界` = 1) by this frozen contract. `Intl.Segmenter` word
granularity is deliberately not used.

### Characters

`Intl.Segmenter` with locale `"en"` and granularity `"grapheme"`, iterated
without materializing all segments. UTF-16 length, code-point counts and
custom emoji regexes are never used. `e` + U+0301, skin-tone emoji, ZWJ
sequences and regional-indicator flags each count once.

### Characters excluding whitespace

Same grapheme iteration. A grapheme is excluded only when every one of its code
points is `\p{White_Space}` (space, tab, LF, CR, NBSP, ideographic space, …).
Other invisible characters are counted: U+200B ZERO WIDTH SPACE is not
`White_Space`.

### Lines

Empty string → 0. Otherwise separators + 1 where `\r\n` is one separator and a
lone `\r` or `\n` is one. A trailing newline starts a final empty line
(`"a\n"` = 2). U+0085, U+2028 and U+2029 are not separators.

### Capability and errors

`Intl.Segmenter` is feature-detected at call time. If it is absent and the
input is non-empty, the result is the stable error `segmenter-unavailable` with a
bounded project-owned message; there is no code-unit/code-point fallback and no
approximate count. Empty input never needs the segmenter and yields all zeros.

### Size limit

1,048,576 UTF-8 bytes measured with `TextEncoder` (never `.length` as the
contract; a string longer than the limit in UTF-16 units is rejected without
encoding because bytes ≥ code units). Exactly the limit is accepted; one more
byte yields `input-too-large`. Input is never truncated and no metrics are
returned for an over-limit input.

### Result

A discriminated result: `{ ok: true, metrics }` with the four counts, or
`{ ok: false, error: { code, message } }` with code `input-too-large` or
`segmenter-unavailable`. Expected outcomes are not exceptions.

### Safety

Single-pass iteration; the word regex has no nested ambiguous quantifiers over
overlapping classes that can backtrack catastrophically (an apostrophe is a
mandatory anchor between runs). Behavior at the 1 MiB boundary is covered by
tests.
