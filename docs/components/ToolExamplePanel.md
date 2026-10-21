# Component: ToolExamplePanel

**Kind:** Component (presentation-only Server Component)

## Representative File

`src/component/tool/ToolExamplePanel.tsx` (tests: `ToolExamplePanel.test.tsx`; browser: `test/e2e/tool-value-examples.spec.ts`)

## Purpose

Shows one verified, source-grounded demonstration (v0.4.3 Batch 2) beneath the real tool on the tool page of five existing utilities: `compress-pdf`, `pdf-to-image`, `images-to-pdf`, `image-resizer` and `image-converter`. It is supporting evidence. It never replaces, wraps or re-implements the working tool.

## Source data ownership

- The only data source is a `ValueExample` record from `src/module/tool/valueExamples.ts` (Batch 1 owner). That module reads measured facts from `public/examples/v0.4.3/manifest.json` and its own tests re-verify the committed bytes.
- The tool route calls `getValueExample(tool.id)` and passes the result to `ToolPageTemplate`. Neither the route nor the component lists the five tool ids, duplicates manifest records, or holds a second lookup registry.
- Every sentence, byte count, dimension, page size, rotation, format and URL shown is read from the record. The component contains only labels (headings, role words, media-type display names) and layout. No measurement, percentage or guarantee is computed or written in JSX.
- `ToolDefinition`, the registry and the example data owner are unchanged.

## Composition and insertion point

`ToolPageTemplate` accepts one optional prop, `example?: ValueExample`. When present it renders `<ToolExamplePanel example={example} />`:

```
header (breadcrumb, the page's only H1, description)
working tool UI            <div>{toolUi}</div>
ToolExamplePanel           only when `example` is supplied
tool guide                 existing `section[aria-label="Tool guide"]`
```

The panel is a sibling of the guide, never inside it. It sits inside the existing `ToolErrorBoundary` and `AdSenseEligiblePage`, so error handling and advertising eligibility are inherited. It adds no boundary, no advertising slot and no telemetry call. A tool without an example renders exactly the previous structure, with no empty placeholder.

## Server/client boundary

Server Component. No `"use client"`, no React state, no effects, no event handlers. It imports only React types and the `ValueExample` types; it imports no worker, PDF.js, QPDF, pdf-lib, Canvas or other browser-processing module, and it performs no processing, fetching or file reading at render time. Its output is static HTML.

## Content contract

One `<section>` named by its own heading, `<h2>Worked example</h2>`, placed beneath the page's H1 and before the guide's H2s. The record's `task` follows as the lead paragraph. Sub-headings are `<h3>`/`<h4>`:

1. Why this tool: `whyThisTool`.
2. Files: each source and output asset as a list item with its actual format, dimensions or page facts (including page rotation), and byte size, a caption for those facts, an optional small preview for images, and an explicit download link.
3. How to reproduce: for each operation, its summary and the ordered control-label steps from the record.
4. Result: `outcome`, then what changed and what stayed the same.
5. Limitations: every `limitation`.
6. Provenance: the record's permission statement.

The panel never claims an operation the tool does not offer, never presents one example as a guarantee for arbitrary files, and states no site-wide privacy or data-collection claim beyond what the record says.

## Same-origin asset links

- Link and image URLs are `asset.url` from the record, which begin with `/examples/v0.4.3/` and resolve to committed files in `public/`. No third-party or remote sample host is referenced.
- Downloads are visitor-initiated links (`download` attribute with the file's name and its `type`, plus a `data-example-asset` marker so tests of a tool's own result downloads can tell the two apart). Nothing downloads, opens or fetches on load.
- Image assets (PNG, JPEG, WebP) show a native `<img loading="lazy" decoding="async">` preview with `width`/`height` from the record and CSS that preserves the aspect ratio and prevents horizontal overflow. These files are small and each is shown once. PDFs get a labelled link only, with no inline viewer and no PDF rendering dependency.
- The panel remains complete and usable when a preview image fails to load, because every fact and link is text.

## Accessibility and responsive contract

- Exactly one page H1 (the template's). The panel adds no H1, dialog, modal, nested scroll region or live region.
- The section is a labelled region (`aria-labelledby` to its H2). Lists are real lists; each image sits in a `<figure>` with a `<figcaption>` of its measured facts.
- Preview `alt` text and the visible caption use `ValueExampleAsset.description`, written from inspecting each committed image (what it shows or how the output differs from the source), not from its file name, format or size; those facts stay in the caption's fact list. PDF download links carry unique descriptive names (role, format, file name and a short description of the file's contents). `valueExamples.test.ts` ties the transparency, background and scale claims to the committed bytes (v0.4.3 Batch 3 correction of the Batch 2 accessibility note).
- Links use the existing secondary-action link treatment and the global visible `:focus-visible` ring; every link is keyboard reachable.
- Only existing semantic tokens (`panel-bg`, `panel-border`, `preview-bg`, `preview-border`, `secondary-action-*`, `text`, `text-muted`); all six palettes and the colour modes inherit. No new token, animation or transition.
- The grid collapses to one column on narrow screens, long file names wrap, and the panel adds no horizontal page scroll at 390px or desktop widths. The document-end spacer owned by the footer still keeps the final content clear of the fixed footer; the panel does not interact with the header or footer.

## Preservation of the real tool

The working tool remains first, unchanged and prominent. The panel adds no processing path, no interactive sample runner, and does not alter any tool's download rules (for example Compress PDF still offers a download only when the result is smaller).

## Tests

- `ToolExamplePanel.test.tsx`: all five records render; every fact on screen matches the record; same-origin links only; unique link names; no H1, no client markers, no script or ad elements; preview dimensions.
- `ToolPageTemplate.test.tsx`: panel appears after the tool UI and before the guide only when `example` is supplied; unchanged structure otherwise; the five featured tools are exactly those with a record.
- `test/e2e/tool-value-examples.spec.ts`: the five real pages, an unrelated tool, link and media-type resolution, visitor-triggered downloads, no unsolicited download, no overflow at desktop and mobile, tool reachability, footer clearance, no runtime errors, no external sample host.
