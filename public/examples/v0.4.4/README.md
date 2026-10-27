# v0.4.4 demonstration assets

Reference inputs and real outputs for four more tools: Merge PDF, Split PDF, Image Compressor and HEIC → JPG / PNG Converter. Together with the five v0.4.3 examples (`public/examples/v0.4.3/`, unchanged) there are nine worked examples. `manifest.json` records every binary's path, media type, byte count, SHA-256, dimensions or pages, example ID, role, origin and producing operation, plus the recorded steps and settings of each operation. `src/module/tool/valueExamples.ts` projects it onto the tool pages. Nothing here is fetched until a visitor selects a download link.

## Provenance and permissions

| Example | Source | Origin |
| --- | --- | --- |
| `merge-pdf` | `merge-pdf/source-001.pdf`, `merge-pdf/source-002.pdf` | Original to iworkhere.space. pdf-lib draws tinted pages with very large labels A1, A2 and B1, B2, B3. Source 1 is portrait (300 × 400 pt), source 2 is landscape (420 × 300 pt). |
| `split-pdf` | `split-pdf/source.pdf` | Original to iworkhere.space. pdf-lib draws four differently tinted 300 × 400 pt pages labelled P1 to P4. |
| `image-compressor` | `image-compressor/source.jpg` | Original to iworkhere.space. A small rasterizer draws a 960 × 640 illustration (house, hills, sun, soil) with deterministic grain over the lower half; the browser canvas encodes it as JPEG at 0.92. |
| `heic-converter` | `heic-converter/source.heic` | **Not project-authored.** An upstream synthetic test fixture, `asym-base.heic` from the su-engineering/heic-web project, pinned to commit `3261b10a31625dcb395b82081b3e9f7d10c9fc2c`, used under that project's MIT license. |

The PDF sources and the raster scene are deterministic and byte-reproducible. The JPEG source is encoded by Chromium's canvas, so it is committed as an immutable asset and identified by its SHA-256.

### The upstream HEIC fixture

`heic-converter/source.heic` is a copy of an upstream file, not a project creation. It is 3,554 bytes, Git blob `c6da5cea205f31fe2eab42c704583ee35f1dd27f`, SHA-256 `b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119`, 480 × 320 px. It is a generated geometric pattern, not a photograph, and contains no personal data. The upstream project's MIT license is reproduced unchanged in `heic-converter/LICENSE.txt`, below a short notice that states the file is an upstream fixture. The same file is the repository's existing HEIC test fixture (`test/fixtures/images/heic-source.heic`); the generator refuses to run unless its byte count, SHA-256 and Git blob id all match. This license covers the test fixture only. It is separate from the decision to ship the HEIC decoder in production, which remains the owner-approved release-license gate recorded in `docs/modules/HeicConverter.md`.

`heic-converter/converted.jpg` and `heic-converter/converted.png` are outputs of the HEIC converter tool run on that fixture.

## How each output was produced

`script/v044ExampleFixtures.ts` launches Chromium against a production build of the app, drives the real tool page with the steps recorded in `manifest.json` (choosing the file, setting the listed controls, pressing the real button) and saves the file the tool actually downloads. It does not merge, split, compress or convert anything itself. To regenerate into a scratch directory without touching these files:

```
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
npx tsx script/v044ExampleFixtures.ts --base-url http://127.0.0.1:3100 --output-root <scratch directory>
```

The generator refuses to overwrite an existing file unless `--overwrite` is passed. Chromium 153.0.8010.12, Playwright 1.63.0 and pdf-lib 1.17.1 produced the committed files.

| Output | Tool path |
| --- | --- |
| `merge-pdf/result.pdf` | Merge PDF: under "Choose PDFs", select `source-001.pdf` then `source-002.pdf` (that is the merge order), press "Merge PDF", then "Download merged PDF". Five pages: A1, A2, B1, B2, B3. |
| `split-pdf/result-001.pdf`, `split-pdf/result-002.pdf` | Split PDF: under "Choose PDF", select `source.pdf`; enter `3,1` in "Pages for output group 1"; press "Add output group"; enter `2-3` in "Pages for output group 2"; press "Split PDF"; then use "Download output group 1" and "Download output group 2". Group 1 is P3, P1 (reordered); group 2 is P2, P3 (overlapping group 1 on page 3). |
| `image-compressor/compressed.jpg` | Image Compressor: under "Choose image", select `source.jpg`; move "Quality" to 40; press "Compress image"; then "Download compressed image". |
| `heic-converter/converted.jpg` | HEIC → JPG / PNG: under "Choose HEIC image", select `source.heic`; set "Output format" to JPEG and "Quality" to 90; press "Convert image"; then "Download converted image". |
| `heic-converter/converted.png` | The same, with "Output format" set to PNG (PNG has no Quality control). |

## Independent verification

`src/module/tool/valueExamples.test.ts` reads the committed files, not just the manifest, and fails if a file is missing, replaced or altered. It checks byte count, SHA-256 and the magic bytes against the declared media type, image dimensions parsed from the JPEG, PNG and HEIF headers, and PDF pages through PDF.js text extraction and rendering. It also checks:

- Merge PDF: the five output pages carry the labels A1, A2, B1, B2, B3 in that order, and each page renders identically to the corresponding source page.
- Split PDF: result 1 holds P3 then P1, result 2 holds P2 then P3, and every page renders identically to its source page. The recorded group expressions parse to those pages with the tool's own selection parser, and the recorded download names equal the tool's own naming functions.
- Image Compressor: the output is smaller than the source, is a valid JPEG with the same dimensions, and the recorded Quality is one the tool accepts.
- HEIC: the source is byte-identical to the verified upstream fixture and the license text matches the pinned upstream license; the PNG decodes to 480 × 320 with the expected shapes at known points; the JPEG header reports the same size.
- Reproduction steps use only control labels, headings and option values present in the tool source.

`test/e2e/value-examples.spec.ts` covers what needs a browser: it decodes the JPEG and PNG outputs natively and samples their pixels, confirms the committed files are served with their recorded sizes and SHA-256, and re-runs every recorded operation on the real tool with the committed sources. `test/e2e/tool-value-examples.spec.ts` checks the example section on each tool page and that no sample is fetched until a visitor selects a link.

## Limits of these examples

They show real behavior on these small files. They do not promise that any other file will shrink, convert identically, or produce the same bytes.

- **Compression is not a typical rate.** The grainy sample JPEG went from 141,841 to 31,132 bytes at Quality 40. A smooth or already heavily compressed image can shrink far less, and when the result would not be smaller the Image Compressor reports "No smaller file produced" and offers no download. No such file is included because the tool produces none.
- **Browser-encoded bytes vary.** JPEG and PNG outputs came from Chromium's encoders and can differ in size and bytes in other browsers and platforms. Regenerating with the same Chromium reproduced the three image outputs byte for byte.
- **PDF output bytes vary between runs.** Regenerating Merge PDF and Split PDF with the same browser gave different compressed content stream bytes in `result.pdf`, `result-001.pdf` and `result-002.pdf`, with identical pages: the same text and the same rendered pixels. Treat the committed SHA-256 values as the identity of these committed files, and the page content as the reproducible part.
- **The HEIC sample is small and synthetic.** Phone photos are far larger and take longer to decode, and the fixture has no transparency, so it shows no HEIC alpha behavior. Metadata and color profiles are not preserved by the tool.
