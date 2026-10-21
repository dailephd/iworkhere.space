# v0.4.3 demonstration assets

Reference inputs and real outputs for five existing tools: Compress PDF, PDF to JPG / PNG, Images to PDF, Image Resizer and JPG / PNG / WebP Converter. `manifest.json` records every file's path, media type, byte count, SHA-256, dimensions or pages, example ID, role and producing operation. `src/module/tool/valueExamples.ts` turns those facts into typed descriptive records, keyed by the existing tool ID.

## Provenance and permissions

Every source file is original to iworkhere.space and was generated for this project by `script/v043ExampleFixtures.ts`. Nothing is copied from a third-party document, screenshot, photograph, branded graphic or user upload. There is no personal data, contact information, script or other active content. The files may be redistributed with the site.

| Example | Source | How the source is made |
| --- | --- | --- |
| `compress-pdf` | `compress-pdf/source.pdf` | pdf-lib draws a two-page study log (text and bar shapes), fixed dates, no object streams; page 2 carries a 90 degree rotation. |
| `pdf-to-image` | `pdf-to-image/source.pdf` | pdf-lib draws two tinted pages labeled "Page 1" and "Page 2"; page 2 is rotated 90 degrees. |
| `images-to-pdf` | `images-to-pdf/source-001.png`, `images-to-pdf/source-002.jpg` | A small rasterizer draws an orange panel with a numeral 1 inside a transparent margin (PNG); the browser canvas encodes a teal numeral 2 as JPEG. |
| `image-resizer` | `image-resizer/source.png` | The rasterizer draws an 800 × 600 grid, ring, triangle, rectangle and four colored corner markers. |
| `image-converter` | `image-converter/source.png` | The rasterizer draws a 480 × 320 transparent PNG with a ring (its hole is transparent), a rectangle and a triangle. |

The PDF and PNG sources are deterministic. The JPEG source is encoded by Chromium's canvas, so it is committed as an immutable asset and identified by its SHA-256; other browsers would encode different bytes.

## How each output was produced

The generator launches Chromium against a production build of the app, drives the real tool page with the recorded steps in `manifest.json` (choosing the file, setting the listed controls, pressing the real button) and saves the file the tool actually downloads. It does not process anything itself and no tool was changed. The saved names differ from the tool's download names (for example `source-compressed.pdf` is stored as `processed.pdf`); each operation records the original download name.

| Output | Tool path |
| --- | --- |
| `compress-pdf/processed.pdf` | Compress PDF: pinned QPDF 12.4.2 with `--object-streams=generate --recompress-flate --compression-level=9 --deterministic-id`, then the tool's own independent PDF.js check. |
| `pdf-to-image/page-001.png`, `pdf-to-image/page-002.jpg` | PDF to JPG / PNG: two operations, page 1 as PNG and page 2 as JPG, both 150 DPI, default JPEG quality. |
| `images-to-pdf/result.pdf` | Images to PDF: both images in the listed order, one page each. |
| `image-resizer/resized.png` | Image Resizer: width 400 with Preserve aspect ratio on, which derives height 300. |
| `image-converter/converted.jpg`, `image-converter/converted.webp` | Image Converter: two operations from the same PNG, default quality 90. |

## Independent verification

`src/module/tool/valueExamples.test.ts` reads the committed files, not just the manifest, and fails if a file is missing, replaced or altered. It checks byte count, SHA-256, magic bytes against the declared media type, and image dimensions parsed from the PNG, JPEG and WebP headers. It also checks:

- Compress PDF: the output is smaller; the existing PDF.js verifier finds identical page geometry, rotation, text and rendered pixels in both files; and re-running the pinned QPDF with the production arguments reproduces `processed.pdf` byte for byte.
- PDF to Image: the page labels and rendering of the two source pages differ, and the image sizes equal the real page geometry (including rotation) at 150 DPI.
- Images to PDF: PDF.js renders two pages whose sizes match the image pixel sizes in the listed order, the transparent margin shows the viewer background, the JPEG stream is embedded unchanged and the PNG has a soft mask.
- Image Resizer: the output is exactly half the source, matches the tool's height derivation, and keeps the corner markers.
- Image Converter: the source has real transparency, and the WebP carries an alpha channel.
- Reproduction steps use only control labels, headings and option values present in the tool source.

`test/e2e/value-examples.spec.ts` covers what needs a browser: it decodes each image natively, confirms the JPEG is flattened to white where the source was transparent, the WebP keeps its transparent pixels, the PDF-to-image outputs match PDF.js reference rasters, and the committed files are served from the site with the right media type. It also repeats every recorded operation on the real tool and compares the result with the committed file.

## Limits of these examples

They show real behavior on these small files. They do not promise that any other file will shrink, convert identically, or produce the same bytes. Browser-encoded outputs (PNG, JPEG and WebP) can differ in size and bytes between browsers and platforms, so only their decoded properties are verified across runs. The compression result is one small document, not a typical saving.
