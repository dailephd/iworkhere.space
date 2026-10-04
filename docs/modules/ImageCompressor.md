# Image Compressor

Batch 4 preserves this behavior and delegates identical source presentation to
`component/tool/image/ImageSourcePanel.tsx` (see `ImageSourcePanel.md`). The
Compressor still owns selection, state, URLs, generations, controls, results,
telemetry and its encoder. The independent Batch 3 extraction evidence below
remains historical source-file evidence.

Image Compressor is a browser-only, offline tool at `/tool/image-compressor`. Its registered state policy is `persist: none`, `shareableQuery: false`. It accepts JPEG, PNG and WebP by encoded signature, independently of filename or declared MIME. JPEG uses SOI bytes, PNG its eight-byte signature, and WebP RIFF plus WEBP markers.

## Source and processing

Reject empty files and files exceeding 26,214,400 bytes (25 MiB). Decode with `createImageBitmap`, validate positive integer dimensions and at most 30,000,000 pixels before allocating a canvas. Close every bitmap after inspection or processing. Use an off-DOM 2D canvas at exactly the source dimensions, draw the source, and encode the detected original format. Release the canvas backing memory after encoding. No decoder, PNG codec, worker, server or upload is involved. Metadata preservation is not guaranteed.

JPEG and WebP expose Quality from 10 to 100 in steps of 5, initially 80. Encoding uses quality / 100. Lower quality usually reduces bytes but may reduce fidelity. PNG has no quality control or encoder quality parameter: it uses lossless native browser re-encoding, which cannot reduce every PNG.

## Outcomes

Compare actual source File bytes and encoded Blob bytes. Only outputBytes < inputBytes is a reduced result. Calculate bytesSaved = inputBytes - outputBytes and percentSaved = bytesSaved / inputBytes * 100. Show unchanged dimensions, detected format, source/output sizes, actual savings, a preview and `Download compressed image`, headed `Compressed image ready`.

An equal or larger candidate is a successful encoding with reduced = false, not a processing error. Show source and candidate sizes and a clear no-reduction message. Retain no candidate Blob URL and offer no download. Suggest lower quality for JPEG/WebP; explain native PNG limitations for PNG.

Download names are `<basename>-compressed.<extension>`, stripping only the final source extension and using `image` when the trimmed basename is empty. Canonical extensions are jpg, png and webp. Preview and download share the same output URL.

## Local lifecycle and privacy

The component owns selection, controls, previews, errors and the idle/selected/processing/success/validation failure/processing failure state family. It owns at most one source URL and one reduced-result URL. Revoke lost ownership on replacement, Quality changes invalidating output, Reset and unmount. Quality changes never automatically encode. Duplicate active submissions are blocked.

New selection invalidates async generations, clears/revokes previous state, restores Quality 80, validates and establishes source information and preview. Reset additionally clears the native file input. Unmount invalidates async work. An obsolete generation cannot adopt a selection/result or emit successful execution telemetry; processing still closes its temporary resources.

Filename and other source information appear only in local UI. Never use query state, storage, logging, analytics metadata or network requests for file information. Display: `Processed locally in your browser. Your image is not uploaded.`

ToolClientFrame owns opening telemetry. Each current valid completed encoding, including no reduction, emits exactly one `tool_executed` through trackEvent with only toolId and slug: image-compressor. Validation, decode and processing failures emit no successful execution event.

## Errors and accessibility

Recoverable UI feedback covers empty/oversized/unsupported/corrupt sources, invalid dimensions or pixel area, invalid quality, missing canvas context, failed encoding and wrong output MIME. Canvas failures identify compression; encoding failures name the detected
format. Quality feedback states 10–100 in steps of 5. Unknown failures identify
reading/compressing and suggest Reset. No reduction remains a successful outcome,
not an error. See ImageFileProcessing for shared source feedback. Never expose
raw exceptions or send file metadata to logs. Expected failures stay in the tool; unexpected React failures remain owned by ToolErrorBoundary.

Label file and Quality inputs, Compress image and Reset buttons, previews and download. Blocking feedback uses role=alert. Use existing semantic surfaces/tokens and natural document scrolling, with contained previews and reachable actions/footer at desktop and mobile sizes.

## Evidence and sharing boundary

Pure tests cover signatures, size/dimension boundaries, quality, savings and filenames. Real Chromium tests prove JPEG/WebP quality-60 reduction, native PNG reduction and transparency, unchanged dimensions, no reduction, downloads, quality invalidation, stale operations, URL cleanup, privacy and responsive behavior. Existing Resizer and application regressions remain required.

Implement the Compressor independently before comparing it with Resizer. Only proven equivalent source-file primitives may move to imageFile.ts and imageFile.client.ts after a separate ImageFile specification. UI, state, URL ownership, tokens, telemetry, actions and operation-specific canvas encoding remain local. Converter and HEIC are excluded.

The passing independent implementations confirmed all ten authorized source
concerns equivalent. They now use [ImageFile](ImageFile.md); imageCompressor.ts
retains quality, savings and filename rules, and imageCompressor.client.ts
retains the operation-specific same-size encoder. Lifecycle, operation controls
and result UI remain in ImageCompressorTool.tsx. Only identical source
presentation delegates to the presentation-only ImageSourcePanel.

## Delivery 2 presentation contract

Reuse the approved Resizer grammar: 280–320px source/settings track beside a flexible preview/result stage at desktop; mobile source, preview, settings, and result actions stack logically. Local source/result previews preserve actual aspect ratio. Existing semantic palette/material classes provide all four themes; no new shared processing/state owner. Errors, limits, quality/transparency behavior, downloads, cancellation and URL/worker lifecycle remain unchanged. HEIC source composition remains local.
