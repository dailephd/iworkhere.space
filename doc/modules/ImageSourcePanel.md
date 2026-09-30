# Image Source Panel

## Three-workflow evidence

After Converter independently passed its focused pure/component/registry tests
and all 32 desktop/mobile browser tests, its source section was compared with
the accepted Resizer and Compressor. All three expose the same heading, file
input, accept hints, limit helper, reading status, filename, dimension/size/format
line and contained native Blob-URL preview. The markup, accessible labels, display
semantics and styling are equivalent. Only this presentation is shared.

## Owner and props

`src/component/tool/image/ImageSourcePanel.tsx` receives a heading ID, input ref,
file change handler, selecting flag and optional display-ready source data:
name, width, height, formatted bytes, format label and preview URL. It imports
React types only, never tool/domain modules. A parent-provided heading ID keeps
the existing aria-labelledby relationship stable.

The panel renders Source image, Choose image, the JPEG/PNG/WebP file accept hint,
the 25 MiB/30 megapixel helper, Reading image… status, source information and
Selected source image preview. It forwards input events/ref without processing
them. It has no state, effects, File reads, validation, decode, URL ownership,
generations, result state, Reset, operation controls, telemetry, storage or query.

All three tool owners retain these responsibilities locally. Result semantics
remain distinct: resized dimensions, compression savings/no-reduction, and
changed encoding. No result panel or image lifecycle abstraction is introduced.
Component tests verify presentation and callback/ref forwarding; full image
browser regression protects the integrated workflows after extraction.
