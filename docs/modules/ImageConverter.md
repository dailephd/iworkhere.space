# Image Converter

## Contract

JPG / PNG / WebP Converter is a client-only, offline image tool registered at
`/tool/image-converter`. It accepts one local JPEG, PNG or WebP, using actual
encoded signatures rather than the filename or declared MIME. Source validation,
inspection, decoding, metadata labels, byte formatting and basename extraction
reuse `imageFile.ts` and `imageFile.client.ts` unchanged. Limits are 25 MiB and
30 megapixels. Files and file metadata never enter query state, storage, logs,
analytics or application requests.

## Pure rules: imageConverter.ts

Output options follow JPEG, PNG, WebP order after removing the source format.
Defaults are JPEG → PNG, PNG → JPEG, WebP → JPEG. All six distinct pairs are
accepted; same-format pairs are rejected with a request to select another format.
JPEG and WebP target Quality is an integer from 10 to 100 in steps of 5,
default 90, passed to the browser as quality / 100. PNG has no quality requirement
or control. JPEG requires white flattening; PNG and WebP retain alpha.
Filenames use the shared basename plus `-converted` and canonical jpg/png/webp
extension, with the shared `image` fallback.

## Browser encoder: imageConverter.client.ts

Validate the source size, encoded source format, pair and applicable Quality.
Decode through ImageFile, validate decoded dimensions, allocate an off-DOM
same-size canvas, acquire a 2D context, fill the full canvas solid white
`#ffffff` for JPEG, then draw the bitmap. Encode with the exact target MIME;
PNG receives no quality argument. Reject null, empty or MIME-mismatched output.
Always close the bitmap and release the canvas backing memory in finally.
No resizing or metadata transfer is performed. Metadata preservation is not
guaranteed.

## Local UI: ImageConverterTool.tsx

States are idle, selected, processing, success, validation failure and processing
failure. Source information and preview precede Conversion settings. Show only
the other two output formats and conditional Quality. Convert image requires an
explicit action; duplicate active submissions are prevented. Results show source
and output format, dimensions, byte sizes, preview and Download converted image.
Byte differences are not compression savings. The existing semantic surfaces,
tokens and natural document flow are retained.

New selection clears errors/results, resets Quality to 90, detects the source
and establishes its deterministic default. Output changes retain Quality;
output/quality changes clear and revoke results without reconversion. Reset
clears the native input and selection. Generation tokens invalidate work on
replacement, Reset and unmount; stale completions never adopt results or emit
telemetry. The tool owns at most one source URL and one result URL, revoking
them on replacement, Reset and unmount and revoking results on settings changes.
Each current successful conversion emits exactly one tool_executed event with
only toolId and slug image-converter. Opening telemetry remains in ToolClientFrame.

## Operation feedback

Same-format conversion asks for a different output format. Canvas failure
identifies conversion. Null, empty or MIME-mismatched output is rejected with
the requested target format and Reset/other-format/current-browser actions.
Unknown errors identify reading/converting. Shared source feedback follows
ImageFileProcessing; cancellation and stale work show no alert.

## Validation and acceptance

Pure tests cover options, defaults, all six pairs, same-format rejection,
Quality, transparency policy and filenames. Component tests cover safe telemetry,
failure, stale completion and settings invalidation. Real desktop/mobile Chromium
tests decode all six outputs, verify exact MIME, dimensions and downloaded bytes,
prove alpha preservation and near-white JPEG flattening, MIME fallback failure,
resource errors, URL cleanup, privacy and stale bitmap cleanup. The actual completed
mobile workflow must exceed 844px, use document scrolling, keep main/workspace
overflow untrapped, and reach the footer by window scrolling. Both viewports must
have no horizontal overflow. Observer protects the accepted Compressor structure;
no supplementary Observer scroll gate applies. Resizer, Compressor, discovery
and all inherited validation remain required.

No HEIC, dependency, server conversion, batch processing or generic image framework.

## Delivery 2 presentation contract

Reuse the approved Resizer grammar: 280–320px source/settings track beside a flexible preview/result stage at desktop; mobile source, preview, settings, and result actions stack logically. Local source/result previews preserve actual aspect ratio. Existing semantic palette/material classes provide all four themes; no new shared processing/state owner. Errors, limits, quality/transparency behavior, downloads, cancellation and URL/worker lifecycle remain unchanged. HEIC source composition remains local.
