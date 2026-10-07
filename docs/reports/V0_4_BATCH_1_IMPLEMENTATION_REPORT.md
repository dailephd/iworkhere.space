# v0.4.0 Batch 1 Implementation Report — Developer Category and JSON Formatter

Date: 2026-10-07

Repository: `dailephd/iworkhere.space`

Starting master SHA: `116af39bff9ab270d2932081913fd91cce56cde8`

Branch: `feature/v0.4.0-batch-1-category-json` (started at the same SHA)

Implementation candidate SHA: `49a327c3e55aaf01f32d8ab2a15d5df8485a05d4`

Package version: `0.3.1` (unchanged). No dependency added or changed; no
`package.json` / `package-lock.json` change. Execution mode:
`DIRECT_IMPLEMENTATION`. Plan: [v0.4.0 implementation plan](../plans/v0.4.0-implementation-plan.md).

## Retrieval

- my-dev-kit `@dailephd/my-dev-kit` 1.12.5 (current published version; installed
  under the project-contained `.my-dev-kit-workflow/tools/`).
- Fresh index over `src` and `test` (TypeScript, call graph) at the starting
  tree: `.my-dev-kit-context/indexes/iworkhere-space-v0.4-batch1-20261007T063929`
  (214 files, 716 symbols; `manifest.json` in that directory). Untracked.
- Searches on the fresh index: `ToolCategory`, `ToolDefinition`,
  `tool_definition_list`, `getAvailableCategory`, `getToolByCategory`,
  `VALID_CATEGORY`, `formatCategoryTitle`, `categoryDescription`,
  `buildCategoryMetadata`, `getToolBreadcrumb`, `getToolGuide`, `guideById`,
  `HtmlTextExtractorTool`, `trackEvent`, `tool_result_copied` (no symbol hit;
  the event name is a string used in tool code), `tool_executed`,
  `ToolPageTemplate`, `ToolClientFrame`, `data-category`, `category-image`,
  `category-text`, `category-document`, `sitemap`, `ToolSearch`.
- Lookups, slices and exact-source retrieval of the category owners
  (`ToolCategory`, `getAvailableCategory`, `VALID_CATEGORY`, category route
  continuation) were performed on the planning index of the same source; the
  starting source tree is identical to it (only documentation commits
  intervened). No lookup/slice was re-run on the Batch 1 index; bounded ranges
  were used for the rest.
- Catalog-count assertions were searched afresh over `test/` and `src/**/*.test.*`.
  The result was a superset of the inherited list: `image-compressor.spec.ts`
  and `image-converter.spec.ts` (home/Discover tool count 15) were also
  affected.
- Whole-file reads: `src/module/tool/guide.test.tsx` (73 lines) because it had
  to be edited in several places; no source file was read whole otherwise.
- Retrieval gate: category ownership, registry derivation, guide ownership,
  `VALID_CATEGORY` / title / description route-local ownership and the six
  legacy outputs matched the plan; no `category.ts` existed.

## Category owner

`src/module/tool/category.ts` owns the static `as const` definition list (ids,
canonical order, page title, page description), `ToolCategory` (derived),
`isToolCategory`, and `getToolCategoryDefinition`. `type.ts` imports the type
and re-exports it, so existing `ToolCategory` imports are unchanged.

Canonical order: `document, text, math, everyday, time, image, developer`
(the pre-change registry-first-appearance order, developer appended).
`getAvailableCategory()` derives populated categories from the registry and
returns them in canonical order. The category route no longer holds
`VALID_CATEGORY`, `formatCategoryTitle` or `categoryDescription`; the six
legacy titles/descriptions are asserted verbatim (they were moved unchanged).
`registry.test.ts` imports the canonical list instead of hardcoding one. A
repository-scan test fails if the removed identifiers return under `src`.

Developer: title `Developer Tool`, description `Format, validate, transform,
and inspect developer data.`

Developer theme tokens (`src/style/theme.css`, plus
`[data-category="developer"]`): Light `#c2410c` / soft `#fff0e8`; system-dark
and explicit Dark `#fb923c` / `#3b2418`; One Dark `#d19a66` / `#3a3027`.
Existing category colors, geometry and markup unchanged.

## JSON module

`src/module/tool/developer/jsonFormat.ts`: strict RFC 8259 scanner/state machine
with an explicit stack, emitting verbatim token lexemes (no value
materialization, no `JSON.parse` → `JSON.stringify`). Format uses 2-space
indentation, `": "`, compact `{}` / `[]`, no trailing newline; Minify removes
insignificant whitespace.

Evidence (73 module tests): valid roots; whitespace; layout; 33 invalid-grammar
cases (each in both modes); lexical preservation of
`12345678901234567890123`, `1E+2`, `-0`, `1.0`, escape spellings (`é`,
`\/`, escaped emoji, lone surrogate), duplicate keys and order; idempotence and
`minify(format(x)) == minify(x)`; token-sequence equality via an independent
regex oracle; error `code`/`message`/`offset`/`line`/`column` for LF, CRLF, CR
and UTF-16 columns; 1,048,576 bytes accepted, +1 rejected before scanning
(string length is not the measure); near-limit nesting (524,288 `[` + 524,288
`]`) minifies without a stack error.

Implementation note (not in the plan): pretty output of deeply nested input
grows quadratically, so Format stops with the stable code `output-too-large`
past 16,777,216 output characters and returns a normal error; Minify is
unaffected. Documented in `docs/modules/JsonFormat.md`. The grammar and
contract are otherwise as frozen.

## Tool, registry, guide

`JsonFormatterTool.tsx` (client): labeled input, read-only output,
`Format JSON`, `Minify JSON`, `Copy result`, `Reset`, `role="alert"` region.
Editing input clears output, copied state and error; failures leave no output;
Reset clears all and refocuses the input. Telemetry is the existing facade only
(`tool_executed`, `tool_result_copied`, each `{ toolId, slug }`); no JSON,
size, error excerpt or output reaches `trackEvent`, `logEvent` or
`captureError`. 11 component tests cover this including no network, storage or
query use.

Registry entry (`json-formatter`, `developer`, client-only/offline, no
persistence, no shareable query, no popularity) and `guideById` entry
(strict JSON, token-preserving formatting, 1 MiB limit, local processing;
related `html-text-extractor`, `slugify`) match the plan exactly.

Known note: the shared `ToolPageTemplate` derives the related-tools heading from
the tool's own category, so this page shows "Related developer tools" over two
text tools. The template was not changed (out of scope); it can be revisited
when the template is next touched.

## Catalog

16 tools, 7 populated categories, 25 sitemap URLs; new URLs
`/tool/json-formatter` and `/category/developer`, appearing through the existing
registry-derived contracts (no edit to `sitemap.ts`, Home, Discover or nav).
`/category/text` still lists exactly Slugify and HTML Text Extractor.

## Validation (local)

- `npm run typecheck`: pass. `npm run lint`: 0 errors (5 pre-existing warnings
  in unrelated files).
- `npm run test`: 77 files, 1000 tests, all passed.
  RUN_ID `2026-10-07T11-48-30-437Z-3732d4a2`,
  `test-report/2026-10-07T11-48-30-437Z-3732d4a2/`.
- `npm run build`: pass.
- `npm run test:e2e` (existing desktop 1280×720 and mobile 390×844 projects):
  322 passed. RUN_ID `2026-10-07T11-48-39-486Z-2b3d584c`,
  `test-report/e2e/2026-10-07T11-48-39-486Z-2b3d584c/`. The new
  `test/e2e/json-formatter.spec.ts` ran separately as RUN_ID
  `2026-10-07T11-48-11-690Z-791951f9` (8 passed).
- No local container gate (no runtime dependency added); CI runs it.

Changes to existing specs: affected count assertions 15→16 (app-navigation
including the route list and loop, image-compressor, image-converter) and
sitemap 23→25 (compress-pdf, document-family, images-to-pdf, pdf-to-image,
pdf-page-copy, ui-discovery). `text category preserves its two known text
tools` is unchanged.

## Exclusions preserved

No Batch 2/3 work, no dependency, no version bump, no ROADMAP batch log, no
discovery/home/nav redesign, no category reordering, no tool moved, no release
action.
