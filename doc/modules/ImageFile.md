# Image File

## Evidence and boundary

The independently passing Resizer and Compressor established identical semantics
for these source concerns: format type, MIME/extension/label metadata, signature
detection, source-size limit, decoded source dimensions/area, byte formatting,
basename extraction, signature reading, native decode and source inspection.
These responsibilities alone are shared. No UI, hook, local state, object URL,
generation token, telemetry, action or canvas encoder is shared.

## Pure owner: imageFile.ts

ImageFileFormat is jpeg, png or webp. IMAGE_FILE_ENCODING maps these to
image/jpeg/jpg/JPEG, image/png/png/PNG and image/webp/webp/WebP.
detectImageFileFormat uses JPEG SOI, the full PNG eight-byte signature and RIFF
plus WEBP markers; extension and declared MIME are irrelevant.

MAX_SOURCE_BYTES is 26,214,400. validateImageFileSize rejects empty/nonfinite
sizes and anything larger, with the existing user-facing messages.
MAX_PIXEL_AREA is 30,000,000. validateImageFileDimension applies only to decoded
source dimensions: each finite, positive and integer, and area at or below the
limit. Resizer target validation and aspect-ratio rules remain in imageResizer.ts.

formatImageFileBytes preserves B / one-decimal KiB / one-decimal MiB presentation.
imageFileBasename strips only the final extension, trims, and falls back to image.
Operation filenames remain owned by each operation.

## Browser owner: imageFile.client.ts

readImageFileFormat reads the first twelve File bytes and rejects unsupported
signatures. decodeImageFile wraps createImageBitmap and normalizes decode
failure to a safe common ImageFileError, with no logging or metadata exposure.
Its caller owns the returned bitmap and must close it in a finally path.
inspectImageFile decodes, validates source dimensions, returns only dimensions,
and always closes the bitmap, including invalid-area failure.

The tool coordinates byte-size validation before signature/decode, stale-work
invalidation and local previews. Shared functions never retain files, bitmaps,
URLs or state. They use no query, storage, analytics, logging or network API.

## Validation

The retained Resizer/Compressor pure tests exercise the common rules after
extraction. Focused client tests protect decode normalization and bitmap cleanup;
real desktop/mobile Chromium tests remain authoritative for actual encoding,
format, dimensions, PNG transparency, lifecycle, privacy and downloads.
