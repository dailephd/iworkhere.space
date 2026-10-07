# v0.4.0 Batch 2 Implementation Report — Word / Character Counter

Date: 2026-10-07

Repository: `dailephd/iworkhere.space`

Starting master SHA: `59318b5f7b142a8154fead3153674a6c35eca4f2`

Branch: `feature/v0.4.0-batch-2-word-character-counter` (started at the same SHA)

Implementation candidate SHA: `3b357d7bd10612512e640f7e0b0777e624380cc0`

Package version: `0.3.1` (unchanged). No dependency added; no `package.json` /
`package-lock.json` change. Execution mode: `DIRECT_IMPLEMENTATION`. Plan:
[v0.4.0 implementation plan](../plans/v0.4.0-implementation-plan.md). Batch 3 not
started.

## Retrieval

- my-dev-kit `@dailephd/my-dev-kit` 1.12.5 (current published version).
- Fresh index from current master over roots `src`, `test` and `script`
  (TypeScript, call graph): `.my-dev-kit-context/indexes/iworkhere-space-v0.4-batch2-20261007T080209`
  (`manifest.json` in that directory). Untracked.
- Searches (fresh index): `WordCharacterCounter`, `textMetric`, `Intl.Segmenter`
  (no hits for all three: no existing owner), `TextEncoder`,
  `HtmlTextExtractorTool`, `SlugifyTool`, `JsonFormatterTool`,
  `ToolComponentProp`, `tool_definition_list`, `getToolByCategory`,
  `getAvailableCategory`, `guideById`, `relatedToolId` (no symbol hit; read via
  `guide.ts`), `tool_executed`, `tool_result_copied`, `sitemap`,
  `containerSmoke`, `publicRoutes` (no symbol; a local variable in
  `containerSmoke.ts`, found by bounded source).
- Lookup: `isToolCategory`, `getAvailableCategory`. Slice: `getAvailableCategory`
  (5 nodes / 5 edges). Source: `script/containerSmoke.ts` lines 148–160. Batch 1
  category/guide ownership was reconfirmed by these results and by the existing
  Batch 1 tests passing unchanged.
- Whole-file fallbacks: none. (Registry/guide/test edits used bounded ranges and
  anchored replacements.)
- Gate: category owner intact; `text` canonical; registry still the tool
  population owner; no text-metric owner exists; no browserslist or
  browser-support policy contradicts `Intl.Segmenter`.

## Full-repository count audit

Searched `src`, `test`, `script`, `.github`, `scripts`, `database`,
`dashboard/src` for 16/25/"sixteen"/`publicRoutes.length`/"two known". Each
changed literal describes the catalog being extended; unrelated literals
(e.g. result-link counts, theme island counts) were left alone.

| Location | Change |
|---|---|
| `src/module/tool/registry.test.ts` | tool total 16 → 17; counter contract + text order added |
| `src/app/sitemap.test.ts` | 16 → 17 tools, 25 → 26 URLs; counter URL exactly once |
| `script/containerSmoke.ts` | `publicRoutes.length !== 25` → `!== 26` (routes still derived from the sitemap) |
| `test/e2e/app-navigation.spec.ts` | home/Discover tool counts 16 → 17, loop bound, name "seventeen", route list + `/tool/word-character-counter`; text category test now lists exactly 3 tools |
| `test/e2e/image-compressor.spec.ts`, `image-converter.spec.ts` | Discover tool count 16 → 17 |
| sitemap `<loc>` count 25 → 26 | `compress-pdf`, `document-family`, `images-to-pdf`, `pdf-to-image`, `pdf-page-copy` (also test title), `ui-discovery`, `json-formatter` specs |

## TextMetric module

`src/module/tool/text/textMetric.ts` (pure; no React, telemetry, storage or
network). `measureText(text)` returns `{ ok: true, metric }` with exactly
`wordCount`, `characterCount`, `characterWithoutWhitespaceCount`, `lineCount`
(labels Words, Characters, Characters excluding whitespace, Lines) or
`{ ok: false, error: { code, message } }` for `input-too-large` /
`segmenter-unavailable`.

- Words: the frozen regex `/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu`,
  iterated with `matchAll` (no array of matches). Hyphen/underscore/slash split;
  `你好世界` = 1; `Intl.Segmenter` word granularity is not used.
- Characters: `Intl.Segmenter("en", { granularity: "grapheme" })`, iterated
  without materializing segments.
- Excluding whitespace: a grapheme is excluded only if every code point is
  `\p{White_Space}` (so CRLF is one excluded grapheme; U+200B is counted).
- Lines: 0 for empty; CRLF/CR/LF separators + 1; trailing newline adds a line;
  NEL/LS/PS are not separators.
- Capability: `Intl.Segmenter` is feature-detected per call; if absent for
  non-empty input the result is `segmenter-unavailable` with no counts. Empty
  input and over-limit input are decided before capability.
- Limit: 1,048,576 UTF-8 bytes via `TextEncoder` (a string longer than the limit
  in UTF-16 units is rejected without encoding). Exactly the limit is accepted;
  +1 is rejected; nothing is truncated.

Evidence (62 module tests): empty/simple/spaces-only; apostrophes (straight,
curly, `rock'n'roll`), hyphen, underscore, slash, punctuation, numbers, Latin,
decomposed Latin, Greek, Cyrillic, CJK; one-character graphemes (combining
accent, skin tone, ZWJ, family ZWJ, flag; two flags = 2); six whitespace kinds
plus CRLF excluded; U+200B counted; 11 line cases; NEL/LS/PS; byte boundary
for ASCII, 2-byte and 4-byte characters; a near-boundary realistic mixed-content
input with exact counts; adversarial apostrophe runs at 1 MiB complete
(no catastrophic backtracking); `Intl.Segmenter` removed and restored cleanly.
Boundary-size tests completed in well under a second, so no debounce/worker
was needed.

## Component

`src/module/tool/text/WordCharacterCounterTool.tsx` (client; no props used).
Labeled `Text` textarea; a `<dl>` with exactly `Words`, `Characters`,
`Characters excluding whitespace`, `Lines`; `role="alert"` area; `Reset`
(clears text and errors, metrics back to 0, refocuses input). Live via
`useMemo`; no Calculate or copy button. For over-limit or unsupported states the
input stays as typed, the bounded message is announced and each metric shows
`—` (never stale or misleading numbers). 7 component tests (jsdom, real
`textMetric`).

Telemetry decision: no `tool_executed` per keystroke, no count or length events,
nothing derived from the text reaches `trackEvent`, `logEvent` or
`captureError`; expected errors are not captured. Tests assert no observability
calls at all across edits, errors and Reset, plus no `fetch`, `sendBeacon`,
storage or query use.

## Registry and guide

Registry: `word-character-counter`, name `Word / Character Counter`, category
`text`, description and SEO description "Count words, Unicode characters,
characters excluding whitespace, and lines locally in your browser.",
canonical `/tool/word-character-counter`, capability `client-only`/`offline`,
tags `text, word, character, counter, utility`, `persist: "none"`,
`shareableQuery: false`, no popularity. Appended after the JSON entry; the text
category order is `slugify, html-text-extractor, word-character-counter`.

Guide: four-step instructions and sections Word counting, Character counting,
Whitespace and lines, Limits and local processing. Related IDs `slugify`,
`html-text-extractor` (heading "Related text tools"). `Registry.md` and
`Guide.md` were not changed (their generic contracts remain accurate).

## Catalog

17 tools, 7 populated categories, 26 sitemap URLs; new URL
`/tool/word-character-counter` through the existing registry-derived contracts
(no edit to `sitemap.ts`, Home, Discover, nav or the category owner).
`/category/text` lists exactly 3 tools; `/category/developer` still 1.

## Validation (local)

- `npm run typecheck`: pass. `npm run lint`: 0 errors (5 pre-existing warnings).
- `npm run test`: 79 files, 1071 tests passed.
  RUN_ID `2026-10-07T13-07-20-394Z-8256ea62`,
  `test-report/2026-10-07T13-07-20-394Z-8256ea62/`.
- `npm run build`: pass.
- Focused E2E (counter + navigation, 24 tests): pass; the counter spec ran first
  as RUN_ID `2026-10-07T13-06-23-807Z-4caa4e2a` (a test-arithmetic mistake in my
  own word-count expectation was corrected before the final run).
- `npm run test:e2e` (existing 1280×720 and 390×844 projects): 330 passed.
  RUN_ID `2026-10-07T13-07-31-117Z-1c2ef4b4`,
  `test-report/e2e/2026-10-07T13-07-31-117Z-1c2ef4b4/`.
- Local container (`npm run docker:ready` started Docker silently, then
  `npm run test:container`): first run `2026-10-07T13-14-26-317Z-5bf66bad` —
  the 26-route inventory and route checks passed, and the in-container E2E
  finished 329 passed / 1 failed. The single failure was `theme-pilot` "direct
  Resizer hydration system-dark" (mobile) with
  `console error: Failed to load resource: net::ERR_NO_BUFFER_SPACE`, a local
  Windows socket-buffer exhaustion unrelated to Batch 2 (the same test passes in
  the host E2E). One exact rerun, `2026-10-07T13-22-46-326Z-8ba7d295`, passed.
  Reports under `test-report/container/`. Both results are preserved here.

## Exclusions preserved

No Batch 3 / QR work, no dependency, no package change or version bump, no
category-owner, token or JSON change (JSON spec edited only for the generic
sitemap count), no ROADMAP log, no README/CHANGELOG reconciliation, no release
action.
