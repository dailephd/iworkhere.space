# Image file processing contracts

This planner-directed specification freezes the v0.2 image-family boundaries.
Batch 1 implements no image utility, shared presentation component or processing
runtime. The first production file workflow is Batch 2 — Image Resizer.

## Processing and formats

Processing takes place in the browser/client. Normal formats are JPEG, PNG and
WebP. HEIC/HEIF belongs to the dedicated future converter. No server image
endpoint, external processing API or cloud upload is authorized.

Initial resource-safety targets are a **25 MiB source file ceiling** (26,214,400
bytes) and a **30 megapixel decoded area ceiling** (30,000,000 pixels). These are
implementation starting limits; later tool batches must validate them with real
decoder behavior, including dimensions before allocating avoidable large output.

Future tools explicitly validate accepted MIME/format, file size, decodability,
and decoded dimensions/area where applicable. A file extension alone does not
establish a valid encoding. Unsupported, corrupt, empty and oversized inputs must
produce explicit validation or processing feedback inside the tool.

## Local state and privacy

The state family is: `idle`, `selected`, `processing`, `success`, `validation
failure`, `processing failure`. These names do not authorize a global state engine.
Each tool owns its state and transitions. Replacement/reset must invalidate stale
asynchronous results so an earlier file cannot overwrite a newer selection.

Binary data stays in local browser/component state only. Selected file information
includes file contents, name, path, MIME, size, dimensions and generated binary
output. Never pass it through URL query state, analytics, logging or external APIs.
Do not persist File/Blob data through the storage abstraction. Existing analytics,
logging and storage semantics remain unchanged.

## Output, object URLs and downloads

Generated output uses Blob/File-compatible browser data and local downloads.
Each `URL.createObjectURL()` call has a named owner and a matching lifecycle that
eventually calls `URL.revokeObjectURL()`. Track both preview and download URLs.
Release superseded selections/results, reset state, failed processing allocations,
completed download resources and component-unmount resources. Repeated processing
and downloads must not accumulate live URLs. Do not revoke a URL before its
preview consumer or download has had a chance to use it.

Later tools must test URL ownership on replacement, reset, failure, unmount and
repeated downloads. Object URLs remain local and must never enter shared state,
logs, telemetry or external requests. Releasing a URL does not authorize retaining
unneeded File/Blob references afterward.

## Error ownership

Expected validation and processing failures stay in the tool UI, with a useful
message and a recoverable next action. Unexpected React failures may reach
`ToolErrorBoundary`. Expected corrupt-file/unsupported-format/resource-limit
failures must not be converted into unexpected boundary exceptions.

## Shared code and measurement

No shared image-family components are authorized yet. Repeated implementation
evidence is required before introducing shared presentation. Do not implement a
universal engine, generic processor, plugin architecture or processing runtime.

Batch 3's independently passing Resizer/Compressor comparison authorizes only
common source-file primitives, specified in [ImageFile](ImageFile.md). Operation
encoding, React UI/state, object URLs and generation tokens remain local.

Fixture provenance follows [the fixture convention](../../test/fixtures/images/README.md).
Heavy decoder work must measure production build chunks and fresh-context browser
JavaScript resources on unrelated routes and before/after explicit decoder loading.
The ignored Batch 1 HEIC harness proves decoder-level feasibility only. Because
the current registry statically imports components, final application isolation
must be measured again in Batch 5 after wiring the actual tool.

`heic-to@1.5.2` is technical-proof-only in Batch 1. Its LGPL-3.0 license requires
separate production license approval. Module loading does not prove functional
HEIC conversion; a provenance-known real HEIC conversion fixture is required in
Batch 5 before accepting production functionality.
