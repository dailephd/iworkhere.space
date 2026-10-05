# PDF to JPG / PNG

`PdfToImageTool` owns one source, settings, generations, feedback and download
URLs. `pdfToImage.client.ts` composes the accepted PDF.js runtime; it creates no
renderer or worker architecture. No pdf-lib or QPDF operation is involved.

## Source and selection

`inspectPdfFile` validates a non-empty, unencrypted PDF with supported header,
at most 10 MiB and 100 pages and valid geometry. After inspection, page selection
starts at `1`. `parsePageSelection` receives actual pageCount and the existing
20-output cap. Singles, ascending ranges and comma combinations retain requested
sequence and remove later duplicates. There is no all-pages shortcut.

## Settings and rendering

PNG is default. JPEG alone exposes quality 0.50–1.00, default 0.85, step 0.05.
Resolution is exactly 72, 150 or 300 DPI, default 150; scale is DPI / 72.
The runtime measures PDF.js `getViewport({scale})`, honoring inherent rotation,
and uses ceil(width/height). Every selected page is preflighted before any export
canvas exists. The inherited 4096-side and 16,000,000-pixel caps are checked
again by `renderPdfPage` before assigning canvas dimensions. No silent downscale.
A limit failure requests lower DPI; no partial result is exposed.

Each conversion opens the PDF once, preflights all pages, renders sequentially
and releases each canvas before the next. JPEG passes the native PDF.js white
background option; PNG retains the accepted renderer's default page appearance
without an additional flattening step. PNG output is lossless; JPEG is lossy.
This does not promise transparent PNG backgrounds for PDF pages.

Canvas encoding uses toBlob with exact image/png or image/jpeg MIME, quality
only for JPEG. Null/empty output fails. Native createImageBitmap independently
decodes every Blob, checks exact dimensions/MIME and closes immediately. Real
fixtures additionally compare visible pixels and requested page identity/order.
No data URL, base64, OCR, previews/gallery, ZIP or download-all control exists.

## Ownership and accessibility

One AbortController/generation owns loading, preflight, rendering, encoding and
verification. Source replacement, active setting changes, new conversion, Reset
and unmount abort work and revoke all prior result URLs. PDF.js loading/render
tasks cancel through the existing runtime. Canvas encoding/native image decode
finish asynchronously where native APIs cannot cancel; abort checks prevent
continuation/adoption and bitmaps/canvases/documents are always released.
Cancellation/stale work creates no application error, URL or success telemetry.
Quality changes are relevant only while JPEG is active.

Explicit labels identify source, page selection, output format, resolution and
JPEG quality. Invalid selections/settings disable Convert pages. Inline errors
announce bounded selection guidance; runtime errors are focused local alerts.
Processing uses role=status; success focuses the result heading. Reset restores
PNG, 150 DPI, quality 0.85, empty source/selection and focuses the source input.
Existing semantic panels and wrapping controls/results support mobile keyboard
and touch use without a global focus or UI framework.

## Results, failures and privacy

Downloads appear only after all outputs verify. Each result displays source page
number, PNG/JPG, pixel dimensions, bytes and an individual anchor. Filenames use
the existing safe PDF basename plus source identity: document-page-003.png or
document-page-001.jpg, in requested result order. No automatic download occurs.
Failures include inherited source errors, invalid expressions/over-20 selection,
render bounds, bounded runtime, encoding and image-verification failures; raw
PDF.js/parser/decoder diagnostics never reach the UI or telemetry.

PDF processing and generated images remain local. Ordinary application assets
and separately enabled site observability may use network requests. Keep the
page open until processing/download finishes. Only safe tool_executed toolId/slug
identity is emitted. No filenames, bytes, page data, selections, settings, text,
pixels, Blobs or URLs enter telemetry, persistence, query state or uploads.
