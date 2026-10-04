# PdfFile

Batch 1 foundation; no public document tool is registered.

`src/module/tool/document/pdfFile.ts` owns explicit frozen PDF/document limits,
bounded header/source validation, page-count and geometry validation, safe
basename/byte presentation and bounded parser error categories. It does not
import image-domain behavior. `pdfFile.client.ts` owns bounded File reads and
inspection through the separate PDF.js runtime owner.

Reject empty/non-finite sources and sources above 10 MiB before reading them.
Check the first 1024 bytes for a PDF version header, without trusting extension
or MIME; a header alone is never parsing acceptance. PDF.js must inspect all
pages, reject password/encrypted state, enforce 100 pages and return finite,
positive page geometry and normalized rotation. Large valid page boxes are
inspectable; render allocation is separately limited to 4096 per side and
16,000,000 pixels. Oversize rendering is a render-limit failure with lower-scale
guidance, not an assertion that the PDF is corrupt. File-read and engine errors
become only bounded domain categories.

Encrypted documents are unsupported, including documents with an empty user
password. No password entry, decryption or `ignoreEncryption` support exists.
Malformed/truncated bodies fail locally. A recoverable PDF.js input inspection
is not independent output fidelity acceptance and does not advertise repair.

`pageSelection.ts` is a pure one-based inclusive range parser. It preserves
segment order, expands ascending ranges, deduplicates by first occurrence,
accepts ASCII separator whitespace, rejects empty/malformed/descending/zero/
negative/unsafe integers, validates an optional page count and bounds expansion
by the caller's positive output cap. Normal mistakes return structured errors.

`orderedFile.ts` owns pure document-family add/remove/up/down transitions over
stable opaque local IDs, File references and validated metadata. Array order is
authoritative. IDs are supplied by the caller and contain no document identity.
Duplicate IDs and invalid moves do not mutate state; no UI, storage or routing.

No file bytes, names, sizes, geometry, document text or error diagnostics enter
telemetry, storage, URL state or network requests. Source/result object URLs and
generation state remain future operation owners' responsibility.

Adjacent Vitest tests cover all pure contracts and lifecycle instrumentation.
`test/fixtures/pdf/README.md` owns deterministic corpus provenance. Real parser,
worker and rendering acceptance is browser-owned under PdfProcessing.
