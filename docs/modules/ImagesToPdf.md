# Images to PDF

`ImagesToPdfTool` owns ordered selection, inspection, generation, feedback and
one download. It reuses image source primitives, document ordered-file
transitions, the existing pdf-lib worker/client and PDF.js output verifier.

## Sources and ordering

Accept 1–20 non-empty JPEG/PNG images, at most 25 MiB together. Each image also
obeys the image family's 25 MiB and 30 megapixel limits. Picker hints do not
validate content. `validateImageFileSize`, `readImageFileFormat`,
`inspectImageFile` and `validateImageFileDimension` are authoritative. WebP is
explicitly unsupported; filenames and MIME cannot override encoded content.
Count/aggregate byte prechecks precede decoding. Addition is atomic: any failure
keeps the previously accepted collection. Additional selections and intentional
duplicate files receive distinct opaque IDs. Existing ordered-file primitives
implement Move up, Move down and Remove; there is no drag/drop.

## Generation and verification

Create PDF invokes `images-to-pdf` in the existing short-lived worker. Requests
contain ordered encoded bytes, JPEG/PNG format and expected decoded dimensions,
never filenames or UI IDs. The protocol validates count, bytes, actual signature
and dimensions. The worker embeds JPEG/PNG directly, checks intrinsic dimensions
against inspected dimensions and draws each image at (0,0) on its own page.
Intrinsic pixel width/height numerically equal PDF points; rotation is zero.
There are no margins, paper presets, DPI interpretation, cropping or EXIF parser.
An unexpected browser/embedding dimension mismatch fails closed.

PNG alpha is embedded without an intentional white flattening step. Independent
small-fixture renders verify alpha and opaque content. Viewer/page backgrounds
affect presentation; this does not promise a portable transparent PDF page.
Metadata preservation is not promised.

Inputs are copied before transfer, leaving UI buffers intact. Existing 30-second
timeout, protocol/error termination and cancellation apply. PDF.js independently
reopens output and verifies page count and ordered width/height (0.001 tolerance)
and zero rotation before download. Fixture acceptance additionally renders real
JPEG/PNG pages and compares visible content against native source decoding.

## Lifecycle, errors and accessibility

Tool-local generations abort inspection pipelines, terminate mutation workers
and ignore stale completions on addition, removal, reorder, Reset and unmount.
Native bitmap decoding cannot itself be interrupted; the inherited inspection
owner closes its eventual bitmap, while abort checks stop subsequent pipeline
work and state adoption. Cancellation is not an error. Result URLs are revoked
on every mutation, new operation, Reset and unmount. No stale success telemetry
or URLs are created.

File input has an explicit label and accepts multiple files. List controls name
their ordinal and target; edge moves are disabled. Validation/processing failures
use a focused local alert with bounded messages, never raw parser diagnostics.
Processing uses role=status. Reset and removal focus the source input; success
focuses the result heading. Controls wrap on mobile using existing semantic
panels. Create PDF is disabled during inspection/generation or without sources.

## Output and privacy

One application/pdf Blob, page count, byte size and explicit download link are
offered after verification, named `images-to-pdf.pdf`. No auto-download or ZIP.
Images are read locally and the PDF is created in the browser; source images are
not uploaded. Ordinary application assets and separately enabled observability
may use network requests. Keep the page open until processing/download finishes.
Only `tool_executed` with safe toolId/slug identity is emitted. No file names,
formats, counts, dimensions, bytes, pixels, raw errors or URLs enter telemetry,
storage, query state or network payloads. State persists nowhere.
