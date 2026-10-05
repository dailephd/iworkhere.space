# MergePdf

Batch 2 public browser-local tool. `MergePdfTool.tsx` owns selection, generation,
focus and result URLs; `mergePdf.ts` owns collection limits and filenames.

Accept 2–10 PDFs, each non-empty and at most 10 MiB/100 pages. Before inspection,
reject a proposed addition over 10 files or 25 MiB aggregate. Inspect each new
source through `inspectPdfFile`; accept the whole batch only when every source
passes and the resulting collection has at most 100 pages. A rejected batch
keeps the accepted list. Repeated filenames/files are distinct opaque IDs.
Array order and Batch 1 ordered-file transitions determine merge order.

The existing pdf-lib worker receives operation `merge`, request ID and ordered
transferred copies of source bytes. It defends count, per-source and aggregate
byte/page bounds, loads each source and copies its pages in order into one PDF.
Only this worker imports pdf-lib. The client owns one short-lived worker and
the inherited 30-second timeout; every terminal path or cancel terminates it.

Before exposing output, independently reopen it through the existing PDF.js
owner and compare every page's count, dimensions and rotation with concatenated
source geometry. Generated-output inspection allows the existing 25 MiB worker
response bound, without weakening the 10 MiB input cap. Fixture acceptance also
compares extracted text/order and representative rendered content; production
verification does not render every page. Static-page fidelity is the boundary:
metadata, bookmarks, attachments, forms, signatures and accessibility structure
are not promised. No compression or repair is offered.

Add/remove/reorder, Reset and unmount abort inspection, cancel processing and
invalidate generations/results. Stale completions cannot create URLs or emit
success. Result is one application/pdf Blob with an operation-owned URL and
`<safe-first-basename>-merged.pdf` filename. Revoke on every invalidation and
unmount. Download is an explicit anchor; never automatic.

Expected validation errors use the bounded PdfFile message. Operation/timeout/
verification failures use local role=alert with a realistic retry action, never
raw diagnostics. Cancellation is silent. Status uses role=status. Inputs and
buttons have labels; edge moves are disabled; remove returns focus to the file
input, Reset likewise, validation focuses the alert, success focuses the result
heading. Controls wrap at mobile widths using existing semantic tokens.

PDF bytes/names/sizes/pages never enter network, storage, URL state or telemetry.
Only `tool_executed` with toolId/slug is emitted after verified success. Ordinary
application asset traffic and separately enabled observability remain possible.

Adjacent unit/component tests and real fixture browser tests own acceptance.
