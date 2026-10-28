# Module: Guide

## Contract

`src/module/tool/guide.ts` owns typed operation-specific explanatory sections,
short instructions and related canonical ToolId lists. Guides currently cover
four image tools, five document tools, the v0.4 JSON Formatter / Validator,
Word / Character Counter and QR Code Generator, and the post-release Slugify,
Length Converter, Weight Converter and HTML Text Extractor. In total, 16 of the
16 of the 18 registered tools have guides; Calculator and Time Arithmetic
have none.
`getToolGuide(toolId)` returns optional guide content. It defines no slug, category, component, status, or route identity. It is imported only by server composition/tests, never by a client catalog or generic lib helper. Related identities resolve through metadata.ts. Privacy prose distinguishes local processing from ordinary site asset/optional telemetry traffic. Image-family limits remain 25 MiB and 30 MP; no bulk, target-size, metadata-preservation or unsupported-format claims are introduced for that family.

Document guides describe each operation's supported formats, explicit downloads,
fidelity boundaries and local processing. Single PDF sources are 10 MiB/100
pages; Merge accepts 2–10 with 25 MiB/100 aggregate pages; Split has 20 groups.
Images to PDF accepts 1–20 JPEG/PNG images, 25 MiB together and 30 MP each.
PDF image export has 20 outputs, 72/150/300 DPI (150 default), 4096 per side /
16 MP and JPEG quality 0.50–1.00 (0.85 default). Compress PDF has one lossless
structural mode and explicitly describes normal NO REDUCTION ACHIEVED outcomes.
No ZIP, OCR, signing, repair, password entry or lossy PDF compression is claimed.
Related IDs resolve through metadata, and each guide may select any relevant
registered tools; the document and image guides happen to relate only siblings
of their own family. The shared template labels the related set by the related
tools' own category when they all share one (`Related image tools`), and uses the
neutral `Related tools` when they span categories or the set is empty. The
source tool's category never determines the heading.

v0.4.0 Batch 1 adds the `json-formatter` guide (the first `developer` tool):
strict RFC 8259 JSON with any root value, rejected non-JSON syntax, token-
preserving formatting (insignificant whitespace only; no number coercion,
escape normalization, duplicate-member collapse or reordering), the 1 MiB UTF-8
limit, and local processing. Related IDs: `html-text-extractor`, `slugify`, which are `text` tools, so the page shows `Related text tools`.

The `word-character-counter` guide documents the word, grapheme-cluster
character, whitespace and line rules, the `Intl.Segmenter` requirement, the 1 MiB
limit and local processing (related IDs `slugify`, `html-text-extractor`). The
`qr-code-generator` guide documents exact-as-typed payloads (no URL fetching),
the fixed ECC M / black-on-white / 512 × 512 PNG / four-module quiet-zone
settings, the 2048 UTF-8 byte limit and local generation (related IDs
`length-converter`, `weight-converter`, so the page shows `Related converter
tools`).

v0.4.4 Batch 4 adds one concise example section to each of the three
guides whose behavior is easiest to misjudge (headed `Check it with this input`, `Counting examples` and `Example and what to do if it will not scan`, never `Worked example`, which names the tool-page panel). `json-formatter` shows a document
with a 20-digit integer, `1.50E+2`, a `\u00e9` escape and a repeated member name
that Minify JSON returns unchanged and Format JSON only re-indents, next to the
`{"a":1,}` error at line 1, column 8. `word-character-counter` states the actual
counts for `Don’t`, a combining-accent `é`, an emoji family (one character, zero
words) and `Hello world` followed by a line break (2 words, 12 characters, 10
without whitespace, 2 lines). `qr-code-generator` encodes a known URL and gives
a recovery action when a code will not scan. The inputs are the exported
`JSON_GUIDE_EXAMPLE`, `COUNTER_GUIDE_DECOMPOSED`, `COUNTER_GUIDE_FAMILY` and
`QR_GUIDE_EXAMPLE` constants, so `guideExample.test.tsx` runs the exact text the
page shows through the real components or logic: the JSON and counter tools in
jsdom, and the QR output decoded by the test-only `jsqr` reader back to the same
payload. The other guides are unchanged.
