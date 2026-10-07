# Module: Guide

## Contract

`src/module/tool/guide.ts` owns typed operation-specific explanatory sections, short instructions, and related canonical ToolId lists for four image tools, five document tools and the v0.4 JSON Formatter, Word / Character Counter and QR Code Generator. `getToolGuide(toolId)` returns optional guide content; Calculator, Length Converter, Weight Converter, Time Arithmetic, Slugify and HTML Text Extractor have none. It defines no slug, category, component, status, or route identity. It is imported only by server composition/tests, never by a client catalog or generic lib helper. Related identities resolve through metadata.ts. Privacy prose distinguishes local processing from ordinary site asset/optional telemetry traffic. Image-family limits remain 25 MiB and 30 MP; no bulk, target-size, metadata-preservation or unsupported-format claims are introduced for that family.

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
`length-converter`, `weight-converter`, so the page shows `Related everyday
tools`).
