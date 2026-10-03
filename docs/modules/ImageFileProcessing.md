# Image file processing contracts

This planner-directed specification freezes the v0.2 image-family boundaries.
The four implemented tools are Resizer, Compressor, JPG/PNG/WebP Converter and
HEIC/HEIF to JPEG/PNG Converter. This document is the current family authority.

## Processing and formats

Processing takes place in the browser/client. Normal formats are JPEG, PNG and
WebP. HEIC/HEIF belongs to the dedicated worker converter specified in
[HeicConverter](HeicConverter.md). Batch 5 keeps decoder imports solely
inside that worker, with lazy construction after source-size prechecks and
termination per operation. Its synthetic 480 x 320 positive fixture stays within
the frozen 30 MP limit. No server image
endpoint, external processing API or cloud upload is authorized.

Frozen resource-safety limits are a **25 MiB source file ceiling** (26,214,400
bytes) and a **30 megapixel decoded area ceiling** (30,000,000 pixels). Validate actual decoder dimensions before allocating avoidable large output.

Tools validate actual encoded content, file size, decodability,
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

Tests protect URL ownership on replacement, reset, failure, unmount and
repeated downloads. Object URLs remain local and must never enter shared state,
logs, telemetry or external requests. Releasing a URL does not authorize retaining
unneeded File/Blob references afterward.

## Error ownership

Expected validation and processing failures stay in the tool UI, with a useful
message and a recoverable next action. Unexpected React failures may reach
`ToolErrorBoundary`. Expected corrupt-file/unsupported-format/resource-limit
failures must not be converted into unexpected boundary exceptions.

Batch 6 feedback identifies the failed stage, includes known local size,
dimensions/pixel area or requested output format, and gives a realistic recovery
action. Do not invent corruption or expose raw exceptions, stacks, internal
codes or Blob URLs. Decode uncertainty is explicit. Empty/oversized sources,
unsupported content and invalid/oversized decoded dimensions share ImageFile
feedback; canvas/encoding and unknown operation failures remain operation-local.
Cancellation and stale work produce no alert. Local details never enter logging,
analytics, URL state, persistence or network requests. Recoverable errors use
role="alert"; reading/processing announcements remain statuses.

## Shared code and measurement

Only identical source presentation is shared through the presentation-only
[ImageSourcePanel](ImageSourcePanel.md). It owns no validation, state, URL or encoding. Do not implement a
universal engine, generic processor, plugin architecture or processing runtime.

Batch 3's independently passing Resizer/Compressor comparison authorizes only
common source-file primitives, specified in [ImageFile](ImageFile.md). Operation
encoding, tool state, results, object URLs and generation tokens remain local.

Fixture provenance follows [the fixture convention](../../test/fixtures/images/README.md).
Heavy decoder work must measure production build chunks and fresh-context browser
JavaScript resources on unrelated routes and before/after explicit decoder loading.
Real HEIC conversion and application-level decoder isolation pass against the
registered production tool. The sole decoder import is `heic-to/next` inside the
dedicated worker. Workers are lazy after the source-size check, short-lived per
inspection/conversion, and terminated on stale work, replacement, Reset and
unmount. The main app receives bounded messages and browser-compatible Blobs.

`heic-to@1.5.2`, bundled libheif 1.22.2 and libde265 1.0.16 were reviewed for
the v0.2 production distribution. The owner approved the HEIC production-license
gate: `HEIC_RELEASE_LICENSE_APPROVAL=APPROVED_BY_OWNER` and
`HEIC_RELEASE_READY=YES`. See the evidence review under
`test-report/v0.2-heic-license-review/` for artifact, license, and notice-route
findings.
