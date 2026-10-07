# v0.4.0 Related-Tool Label Correction Report

## Identity

- Trigger verdict: `NEEDS_CORRECTION_RELATED_TOOL_LABEL` (v0.4 implementation-completeness audit)
- Date: 2026-10-07
- Starting master SHA: `519bedf072be17593c371bfd7242713bdae93b95`
- Branch: `fix/v0.4.0-related-tool-label`
- my-dev-kit `@dailephd/my-dev-kit` 1.12.5; fresh index
  `.my-dev-kit-context/indexes/iworkhere-space-v0.4-correction-20261007T101601` (not committed)
- Package version: `0.3.1` (unchanged). Catalog: 18 tools / 7 categories / 27 sitemap URLs (unchanged).

## Retrieval

Searches: `ToolPageTemplate`, `relatedTool`, `ToolGuide`, `getToolByIdList`,
`guide.test`. Bounded reads: `ToolPageTemplate.tsx`, `Guide.md`,
`ToolPageTemplate.md`, `guide.test.tsx` structure, `.gitattributes`. No whole-file
fallback beyond the 50-line template. Gate proven before editing: the heading
used `tool.category`; JSON related IDs resolved to `text`, `text`; Word Counter
related were `text`; QR related were `everyday`; image guides related only image
tools and document guides only document tools; `.gitattributes` had no `uqr`
entry; `THIRD_PARTY_NOTICES.md` still claimed the retained license path.

## Defect and root cause

`ToolPageTemplate` rendered `` `Related ${tool.category} tools` ``, assuming every
related tool belongs to the source tool's category. The JSON Formatter (category
`developer`) relates to HTML Text Extractor and Slugify (`text`), so the page said
"Related developer tools" above two text tools.

## Correction

The heading is derived from the actual related set, locally in the template:
non-empty and all related tools share one category gives `Related <category>
tools`; otherwise `Related tools`. No helper module, metadata query, category-label
registry or per-guide heading was added. No guide IDs, registry data or category
data changed.

| Page | Before | After |
|---|---|---|
| JSON Formatter / Validator | Related developer tools | Related text tools |
| Word / Character Counter | Related text tools | Related text tools |
| QR Code Generator | Related everyday tools | Related everyday tools |
| Image guides (4) | Related image tools | Related image tools |
| Document guides (5) | Related document tools | Related document tools |
| Mixed set / empty set (synthetic) | n/a | Related tools |

## Specifications

- `docs/components/ToolPageTemplate.md`: new "Related-tools heading" section; the
  outdated "four image tools only" statement now says guides render for every tool
  with guide data.
- `docs/modules/Guide.md`: related IDs are no longer described as staying inside the
  source family; the heading rule and the JSON case are documented.

## uqr license byte identity

`.gitattributes` gains `public/licenses/uqr-0.1.3-LICENSE.txt -text`, next to the
other retained license entries. The license content was not touched. SHA-256 of the
committed Git blob and of installed `node_modules/uqr/LICENSE` are both
`b39d50e24727f341a0ebdb2ab040c57efaf4076a8ad5b1d0c8c45beb975b4571` (identical).
The pre-existing Windows working-copy file is CRLF-converted
(`bf9fbcb0…`), which is the conversion the new rule prevents on future checkouts;
it was not edited or restored. Byte preservation after the rule is verified by a
fresh checkout of the committed branch (see PR).

## Tests

`src/module/tool/guide.test.tsx` gains a "related-tools heading truthfulness"
group: every guided tool's heading equals the category of its related set (or the
neutral heading when mixed), a JSON regression (developer tool, text/text related,
`Related text tools`, no `Related developer tools`, links intact), inherited
headings (text, everyday, four image, five document), a synthetic mixed-category
set and an empty set rendered through `ToolPageTemplate` without registering
anything. With the old `tool.category` logic four of these fail; with the
correction all 25 pass. `test/e2e/json-formatter.spec.ts` asserts the server HTML
and the visible `h2` say `Related text tools`.

## Validation

- Typecheck pass; lint 0 errors (5 pre-existing warnings); unit tests 81 files,
  1145 tests passed (`test-report/2026-10-07T15-17-37-379Z-cf8f2e05`); build pass.
- Focused E2E (JSON, counter, QR): 34 passed, RUN_ID
  `2026-10-07T15-18-22-774Z-de2a4976`.
- Full E2E, local Windows, two runs, neither fully clean:
  - `2026-10-07T15-19-09-893Z-03ce9e8b`: 347 passed, 1 failed. The QR URL download
    test timed out at 5 s waiting for the preview, although the failure screenshot
    shows the QR and Download link present.
  - Rerun `2026-10-07T15-29-00-290Z-fad52924`: 347 passed, 1 failed, a different
    unrelated test (`image-feedback`, 26 MiB size-feedback alert not shown within 5 s).
  - Neither reproduced: the QR spec passed 108/108 (`--repeat-each=6`, RUN_ID
    `2026-10-07T15-26-46-857Z-a2384508`) and the QR plus image-feedback specs passed
    120/120 (`--repeat-each=3`, RUN_ID `2026-10-07T15-36-28-565Z-149e0541`). The
    template change affects only a server-rendered heading, and the earlier Batch 3
    full run on the same machine passed 348. The cause of the two single timeouts
    was not identified; the PR's Linux E2E and Container jobs are the authoritative
    full-suite gate.
- Container: not rerun locally; no runtime or packaging file other than
  `.gitattributes` changed. PR CI Container is required.

## Scope

Changed: `ToolPageTemplate.tsx`, `guide.test.tsx`, `json-formatter.spec.ts`,
`ToolPageTemplate.md`, `Guide.md`, `.gitattributes`, this report, `doc_index.md`.
No dependency, version, catalog, QR, JSON or counter behavior change. No
reconciliation, pre-release or release work.
