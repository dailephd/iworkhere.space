# HEIC → JPG / PNG Converter

Batch 5 uses a verified synthetic MIT positive fixture within the frozen limits. Technical acceptance covers real worker inspection and JPEG/PNG conversion; release approval remains a separate human/legal gate.

For target release v0.2.0, the registry exposes `/tool/heic-converter` as a client-only, offline, local single-image HEIC/HEIF utility. The root package metadata remains 0.1.0 until release preparation. No server processing, persistence, shareable query, metadata migration, sequence extraction, resize, or HEIC output is supported.

## Runtime boundary

`HeicConverterTool.tsx` owns local UI state, asynchronous generation invalidation and at most one source-preview URL and one result URL. `heicConverter.ts` owns pure output, quality, filename and preview-dimension contracts. `heicConverter.workerType.ts` defines narrow request/terminal-response identities and bounded errors. `heicConverter.client.ts` creates one dedicated module Worker per inspect or convert operation using the bundler-supported `new Worker(new URL("./heicConverter.worker.ts", import.meta.url), { type: "module" })` boundary.

Only `heicConverter.worker.ts` imports the exact production dependency `heic-to@1.5.2`, through `heic-to/next`. Neither the root nor CSP entry is used. No worker is constructed at module import, route render or initial page load. A selected file must pass shared non-empty and 25 MiB (26,214,400-byte) validation before worker construction. The normal route graph must never load decoder assets. Runtime resource measurements protect six unrelated routes and the initial HEIC route; unrelated transferred-JS growth must remain at most 25 KiB.

## Inspection and conversion

The worker calls `isHeic(file)` regardless of filename or MIME hints, then `heicTo({ blob: file, type: "bitmap" })` with package orientation behavior. Decoded dimensions must be positive integers with area at most 30,000,000 pixels before allocating a preview/output canvas. Every decoded ImageBitmap is closed in a finally block.

Inspection draws onto a transparent OffscreenCanvas, never upscaling and preserving aspect ratio with maximum edge 512 px. It encodes and verifies a PNG preview and returns source width/height plus preview Blob. Main-thread presentation uses only the generated PNG URL, never the original HEIC URL.

Conversion decodes again, uses an OffscreenCanvas at exact decoded source dimensions and draws the bitmap. JPEG first fills the entire canvas `#ffffff`; PNG does not prefill, retaining alpha where exposed by the decoder. JPEG is the default; Quality is 10–100, step 5, default 90, encoded as quality/100. PNG has no Quality control and receives no quality option. The final output uses canvas `convertToBlob`, not the package's direct JPEG/PNG path. Returned MIME must equal `image/jpeg` or `image/png` exactly and the Blob must be non-empty. Filenames use shared `imageFileBasename` plus `-converted.jpg` or `-converted.png`.

Metadata preservation is not guaranteed, including EXIF, GPS, camera information, color profiles, depth, thumbnails and auxiliary items. Complex HEIF failures are recoverable; only single-image acceptance is in scope. No universal HEIC alpha preservation claim is made. Real-alpha evidence depends on the fixture and is unavailable unless a known alpha region is established.

## Ownership, failure and privacy

Batch 6 distinguishes worker creation/start failure, runtime failure and invalid
response. Error responses remain bounded: only the source-dimension-limit
category may additionally carry positive integer sourceWidth/sourceHeight for
an actual area over 30 MP. Invalid dimensions use the bounded category without
dimension fields. The client validates this exact category-specific shape and
uses its own request target for encoding feedback; no arbitrary diagnostics are
transferred. Alerts describe detection/decode/canvas/encoding stages and useful
recovery. Cancelled or stale operations never show an alert.

Each worker terminates on its first terminal response or browser error, and immediately on cancellation, source replacement, Reset or unmount. Cancellation settles its pending promise; generation checks prevent late responses adopting state or emitting telemetry. The tool states are idle, selected, processing, success, validation failure and processing failure. Safe error categories describe unsupported content, decode failure, source dimension limits, missing canvas, encode failure, worker-start failure, worker-runtime failure or invalid response; no raw Error, stack or metadata is posted.

Source-preview URLs are revoked on replacement, Reset and unmount. Results are revoked on output/Quality changes, conversion replacement, source replacement, Reset and unmount. Downloads reuse the owned result URL. Shared image-file primitives remain narrow and ImageSourcePanel is unchanged; the materially different HEIC source UI is local.

Only current successful conversion emits one `tool_executed` event with `{ toolId, slug: "heic-converter" }`. Inspection emits none; ToolClientFrame owns tool_opened. Files, filenames, dimensions, MIME, Blobs and image contents never enter URL, storage, logging, application APIs or analytics metadata. Worker transfer is local. Decoder assets are served from the application origin without CDN or external processing requests.

## Fixture and assurance

The only primary real fixture is `test/fixtures/images/heic-source.heic`, the synthetic MIT `asym-base.heic` from su-engineering/heic-web at commit `3261b10a31625dcb395b82081b3e9f7d10c9fc2c`. Its Git blob is `c6da5cea205f31fe2eab42c704583ee35f1dd27f`; size 3,554 bytes; local SHA-256 `b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119`. Pinned generation/contribution policy and verbatim MIT license establish provenance; see the fixture README. Actual inspection/output dimensions are 480 x 320 (153,600 pixels). The previous 45,441,024-pixel fixture demonstrated correct 30 MP rejection; historical evidence remains in `.my-dev-kit-context/reports/batch-5-corrected/final-report.md`, without committing its large binary. Neither superseded fixture is used for positive acceptance.

Pure/unit contracts complement real browser inspection, JPEG/PNG conversion, downloads, misleading filename detection, invalid payload rejection, cheap oversize rejection, worker termination, stale messages, URL cleanup, privacy and responsive tests. Browser instrumentation does not require production test hooks. Existing image-tool and application regressions remain mandatory. Observer protects existing Image Converter structure through executable acceptance; a HEIC inspected-state observation is supplementary.

## Production dependency license gate

The decoder bundles libheif 1.22.2; heic-to package metadata is LGPL-3.0. THIRD_PARTY_NOTICES and exact public license copies are engineering artifacts, separate from fixture MIT licensing. Implementation is allowed; human/legal release approval remains required. `HEIC_RELEASE_LICENSE_APPROVAL = REQUIRED`; `HEIC_RELEASE_READY = NO`. No legal-compliance conclusion is made. npm audit does not independently establish embedded native/libheif security.
