# Compress PDF

One unencrypted, parseable PDF with a supported header, non-empty bytes, at most
10 MiB, 100 pages and valid geometry. `inspectPdfFile` owns source validation;
password entry and repair are unsupported.

## Operation and ownership

The existing `qpdf.client.ts`, `qpdf.workerType.ts` and `qpdf.worker.ts` own the
explicit `compress` operation. Foundation rewrite remains supported. Each
operation uses one short-lived worker and the unchanged project-owned QPDF
12.4.2 runtime. Only PDF bytes and request identity cross the boundary, never a
filename. Input is copied before transfer. The worker validates bytes, rejects
encryption, stages `/input.pdf`, and runs exactly:

`--object-streams=generate --recompress-flate --compression-level=9 --deterministic-id /input.pdf /output.pdf`

This is LOSSLESS_STRUCTURAL: no image optimization, downsampling, quality
setting or rasterization. Exit zero alone produces a candidate. Any nonzero
status, including recovery/warnings, discards output and maps to bounded local
failure. Raw diagnostics remain bounded internally and never enter UI or
telemetry. MEMFS files are removed before transfer or failure; the client
terminates on completion, failure, timeout or cancellation.

## Comparison and independent verification

`compressPdf.client.ts` compares actual byte lengths before verification.
Equal/larger output is discarded without creating a Blob or object URL and
without deep verification. The local outcome is **NO REDUCTION ACHIEVED**, a
normal result, not an error. The original remains available as the source and
no replacement download or success event is offered.

Only smaller output reaches `compressPdfVerification.client.ts`, using the
existing PDF.js runtime independently of QPDF. It checks parsing, count, every
page's width/height (existing 0.001-point tolerance) and exact rotation. Every
page's extracted text is compared as an ordered string sequence with end-of-line
markers; only empty PDF.js items are ignored. No whitespace/content folding.
Empty text is valid. First, last and middle (when more than two pages) are
rendered against white at scale at most 0.5, reduced further to a maximum
512-pixel side. Source and output RGBA bytes must match exactly. Canvases are
released, documents closed and abort listeners removed on every terminal path.
Rendering is verification only, never the downloadable output. Verification
failure discards candidate, preserves source and produces a bounded alert.

This evidence covers supported static-page semantics. Signatures, metadata,
bookmarks, complex forms, accessibility structure and arbitrary PDF extensions
are outside the fidelity guarantee.

## UI, lifecycle, privacy

The tool owns selection, generation, abort controller, result and URL. Choose
PDF, Compress PDF and Reset are the only controls. Inspection/processing disables
the primary action. Replacement, new action, Reset and unmount invalidate prior
outcomes, abort work and revoke successful result URLs. Stale generations cannot
adopt outcomes or emit telemetry. Cancellation is not an error. Reset focuses
the picker; result/no-reduction headings receive focus; local errors use alerts.

After smaller output passes verification, create `application/pdf` Blob and
`<pdfFileBasename>-compressed.pdf` URL. Show original/compressed size, bytes saved
and `(input-output)/input*100` percent. No URL exists for no reduction. Do not
revoke a live result before its download can begin.

Document bytes stay browser-local. Ordinary application, PDF.js and QPDF assets
may use network. No bytes, filename, size, savings, count, text or diagnostics
enter API, URL, storage or observability. Only a verified smaller result emits
`tool_executed` with tool identity. No new dependencies or analytics events.
