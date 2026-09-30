# Image Resizer

## Ownership and scope

Batch 4 delegates only identical source presentation to the presentation-only
`component/tool/image/ImageSourcePanel.tsx` (see `ImageSourcePanel.md`). The
Resizer keeps all selection/state, URL ownership, generations, controls,
results, telemetry and operation logic below.

`src/module/tool/image/ImageResizerTool.tsx` owns local React state, selection,
previews, actions, recoverable feedback and object URLs. `imageResizer.ts` owns
target-dimension, ratio and filename rules. `imageResizer.client.ts`
owns operation-specific off-DOM canvas resizing. Proven common source signatures,
limits, formatting, decode and inspection are owned by `imageFile.ts` and
`imageFile.client.ts`, specified in [ImageFile](ImageFile.md). The existing
registry, server tool/category routes, ToolClientFrame and ToolErrorBoundary
remain the routing, lifecycle and unexpected React failure owners.

This tool resizes one JPEG, PNG or WebP locally. It adds no shared file framework,
decoder dependency, upload, persistence, crop, rotation, quality control or format
picker. Decorative canvas remains prohibited; the functional canvas is never
appended to the UI.

## Validation and processing

Actual initial bytes are authoritative: JPEG SOI, PNG's eight-byte signature,
or RIFF plus WEBP. Names, extensions and declared MIME (including image/jpg) do
not override detected encoding. Selection clears previous selection/result and
invalidates asynchronous work before validating a nonempty file, at most
26,214,400 bytes (25 MiB), supported signature, browser decodability, positive
integer dimensions and at most 30,000,000 source pixels.

Native `createImageBitmap()` decodes the image. Selection retains only the File
and dimensions, never an idle bitmap. Resize validates positive, finite integer
target width and height and a target area no larger than 30,000,000 pixels before
allocating a canvas. It decodes again, enables high-quality smoothing, draws at
exact target dimensions and encodes a Blob. Every bitmap is closed in a finally
path, and temporary canvas backing memory is released after encoding.

Output preserves detected format: JPEG/image/jpeg/.jpg, PNG/image/png/.png and
WebP/image/webp/.webp. JPEG and WebP use fixed encoding quality 0.92; PNG receives
no lossy quality parameter. There are no compression claims. Metadata preservation
(EXIF, ICC profiles, comments or other ancillary metadata) is not guaranteed.

## Interaction and local state

The local state family is idle, selected, processing, success, validation failure
and processing failure. Valid selection displays filename, size, original
dimensions and an accessible source preview. Width and Height start at the source
dimensions; Preserve aspect ratio starts enabled. A width edit derives height as
max(1, round(width * originalHeight / originalWidth)); a height edit derives width
from the original ratio. Unlocked dimensions are independent.

Resize image clears the previous result and revalidates dimensions. During resize
its label is Resizing… and duplicate submissions are blocked. Success displays
output dimensions, size, format, preview and Download resized image. The filename
is `<basename>-<width>x<height>.<canonical-extension>`: strip only the final source
extension and use image when the basename is unusable.

A generation token invalidates outstanding work on new selection, Reset and
unmount. Asynchronous results are adopted only for the current generation. Reset
also clears the native file input, dimensions, errors and previews, restores the
aspect lock and returns to idle. New selection always restores original dimensions
and the aspect lock. No stale operation may replace newer state.

## Resources, privacy and feedback

The component owns at most one source preview URL and one result URL. The result
URL serves both preview and download; download does not allocate another URL.
Replacement, Reset and unmount revoke lost ownership. Pending stale operations
do not create owned preview URLs. URLs remain live while their consumers use them.

File contents, filename, dimensions, size, MIME, Blobs and URLs stay in local
browser/component state. They never enter queries, storage, analytics, logs or
external requests. The UI states: Processed locally in your browser. Your image
is not uploaded. Exactly one successful execution event goes through trackEvent
with only toolId and slug: image-resizer. Opening telemetry belongs to
ToolClientFrame; the tool does not call setQuery.

Expected failures stay inside the tool with role=alert: empty/oversized file,
unsupported signature, undecodable/corrupt image, source area over 30 MP, invalid
width/height, target area over 30 MP, missing canvas context and encoding failure.
Raw browser exceptions are not shown or logged; file metadata remains local.
Source and requested-area limits show actual dimensions/pixels. Canvas failures
identify resizing; encoding failures name the detected output format. Unknown
failures identify reading/resizing and suggest Reset. See ImageFileProcessing
for the shared source-feedback policy. Unexpected
React failures remain owned by ToolErrorBoundary.

All controls have labels, previews have meaningful alt text, actions support
keyboard use, and bounded solid surfaces use existing semantic tokens. The
workspace uses natural document scrolling at desktop and mobile sizes.

## Validation evidence

Pure unit tests cover signatures, exact resource boundaries, invalid dimensions,
original-ratio calculations and canonical filenames. Registry/metadata/category
tests protect registration and SEO. Committed 80x60 generated JPEG, transparent
PNG and WebP fixtures have provenance and SHA-256 records. Both Chromium projects
prove actual resize dimensions, MIME, downloads, PNG alpha, aspect unlocking,
recoverable errors, limits, stale results, URL cleanup, privacy and responsive
flow. The complete existing browser suite protects prior behavior. Frontend
Observer captures protected routes before edits and the resizer's source/result
state afterward. Build and browser resource measurements compare with Batch 1.
