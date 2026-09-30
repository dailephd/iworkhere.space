# Deterministic image fixtures

## HEIC fixture - positive decoder/converter acceptance

Local fixture: `heic-source.heic`. Source: [su-engineering/heic-web](https://github.com/su-engineering/heic-web), pinned commit `3261b10a31625dcb395b82081b3e9f7d10c9fc2c`, upstream path `test/fixtures/generated/asym-base.heic`.

Upstream Git blob and local `git hash-object`: `c6da5cea205f31fe2eab42c704583ee35f1dd27f`. Exact upstream/local size: **3,554 bytes**. Local SHA-256: `b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119`.

License: **MIT**. The pinned upstream LICENSE is copied verbatim to `licenses/heic-web-MIT.txt`. The pinned CONTRIBUTING.md requires permission to redistribute committed fixtures, excludes personal/private photographs, and licenses contributions under MIT. The fixture README identifies generated fixtures as committed and reproducible.

Generation: synthetic asymmetric geometric pattern, generated from scratch by `tools/make-fixtures.sh` using ImageMagick background, rectangles, circle, polygon and bar; encoded with `heif-enc -q 92`. The pinned generated manifest records **480 x 320**, **153,600 pixels**, bit depth **10**, brand **heix**, rotation 0 and no mirroring. Actual heic-to 1.5.2 worker inspection and JPEG/PNG browser output decode also measure **480 x 320**. Preview is PNG at 480 x 320 (no upscaling). Consumer: `test/e2e/heic-converter.spec.ts`.

Provenance sources at that exact commit: [LICENSE](https://github.com/su-engineering/heic-web/blob/3261b10a31625dcb395b82081b3e9f7d10c9fc2c/LICENSE), [contribution policy](https://github.com/su-engineering/heic-web/blob/3261b10a31625dcb395b82081b3e9f7d10c9fc2c/CONTRIBUTING.md), [generation script](https://github.com/su-engineering/heic-web/blob/3261b10a31625dcb395b82081b3e9f7d10c9fc2c/tools/make-fixtures.sh), [manifest](https://github.com/su-engineering/heic-web/blob/3261b10a31625dcb395b82081b3e9f7d10c9fc2c/test/fixtures/generated/manifest.json).

No real-alpha or metadata-preservation proof is claimed. This test-fixture license is separate from the production decoder release-license gate. Earlier rejected fixture evidence remains in the ignored Batch 5 reports; those superseded binaries are not committed.

Fixtures enter this directory when a real tool test first needs them. Batch 1
adds the convention only; no conversion or image product fixture is implied.

Each fixture must have a record alongside it documenting:

| Field | Required evidence |
| --- | --- |
| Purpose | Exact behavior and edge case being tested |
| Provenance | Generated or sourced; creator/source and reproducible generation recipe or source reference |
| License/ownership | Known rights and any attribution requirement |
| Format | Actual encoding and expected MIME type, not just extension |
| Dimensions | Pixel width, height and decoded area |
| Transparency | Presence/absence of alpha and the intended transparent region |
| Consumer | Named tool and test file |
| Identity | SHA-256 checksum for the committed binary |

Prefer tiny, deterministic generated geometric fixtures. Later batches may add
JPEG, transparent PNG, WebP and HEIC when their tests require them. A HEIC fixture
must have known provenance before Batch 5 functional conversion acceptance.
Tests must use committed local fixtures, never download arbitrary internet images.
Do not commit large photographs for realism. Keep fixture generation separate
from measured processing behavior so a generator cannot hide a decoder failure.

## Image Resizer fixtures

Generated once by the project author in headless Chromium **153.0.8010.12**
(Playwright 1.63.0). No third-party content: project-owned geometric test assets
authored for this repository, with no third-party license or attribution requirement.

Recipe: create an off-DOM 80×60 canvas. PNG starts transparent; JPEG/WebP start
white (`#ffffff`). Fill the right half (40,0,40,60) violet (`#5b4bd8`) and the
bottom-left (0,30,40,30) cyan (`#0891b2`). Encode once with `toDataURL()` using
each actual MIME and fixed 0.92 quality. Tests consume fixed committed bytes and
never regenerate them. Independent verification read the saved bytes, checked
signatures, decoded with createImageBitmap, sampled alpha and calculated SHA-256.

| Fixture | Purpose / consumer | Actual format | Dimensions / area | Transparency | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| resizer-source.jpg | Image Resizer JPEG resize, download, aspect ratio, lifecycle and privacy; test/e2e/image-resizer.spec.ts | JPEG, image/jpeg; 1,000 bytes | 80×60 / 4,800 pixels | Opaque; alpha at (5,5) = 255 | da9bb9cc7764ac5a544178c0697906399ef2509df92aded8402780e2b9e8394b |
| resizer-source.png | Image Resizer PNG resize and alpha preservation; test/e2e/image-resizer.spec.ts | PNG, image/png; 309 bytes | 80×60 / 4,800 pixels | Top-left region x<40,y<30 transparent; alpha at (5,5) = 0 | 5c31c01ef0063be9828fbf4a7e62a48c851eeab442fad8bc847d048a2d3b3dba |
| resizer-source.webp | Image Resizer WebP resize and download; test/e2e/image-resizer.spec.ts | WebP, image/webp; 650 bytes | 80×60 / 4,800 pixels | Opaque; alpha at (5,5) = 255 | 617e551b0782ff9c663a5bf189610cc8ddbb1aa9c2879a25829dd0f37eadd0be |

Provenance for every row: generated using the recipe above; creator/owner is the
repository project author. The PNG output test samples (2,2) after resizing to
40×30, safely inside the corresponding transparent region.

## Image Compressor fixtures

Generated once by the repository project author with Playwright **1.63.0** and
headless Chromium **153.0.8010.12**. All content is project-owned geometric test
artwork, with no third-party content, license or attribution requirement.
Tests consume fixed committed bytes; they never regenerate the fixtures.

Recipe: create a 240×180 off-DOM canvas with a diagonal linear gradient from
`#5b4bd8` at (0,0) to `#0891b2` at (240,180). At each (x,y) where x and y are
multiples of six, fill a 3×3 square with RGB((17x+3y)%256,(7x+11y)%256,
(5x+19y)%256). JPEG and WebP encode using `toDataURL(actualMime, 1)`.
For PNG, clear the top-left 30×30 region before lossless encoding. Insert one
safe, nonessential `tEXt` chunk before IEND: Latin-1 keyword `Fixture provenance`,
NUL, then 160 repetitions of `iworkhere.space deterministic owned geometric test fixture. `.
The PNG chunk CRC is CRC-32 (polynomial 0xedb88320, initial/final XOR 0xffffffff)
over the chunk type and payload. This deliberately non-minimal PNG proves that
native re-encoding can remove nonessential payload; it does not imply every PNG
can become smaller or that metadata is preserved.

Independent verification read the saved files, checked signatures and every PNG
chunk CRC, decoded with createImageBitmap, checked 240×180 dimensions and alpha
at (2,2), calculated SHA-256, and performed native same-size encoding at quality
60 for JPEG/WebP and without a quality parameter for PNG.

| Fixture | Purpose / consumer | Actual format / source bytes | Dimensions / area | Transparency | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| compressor-source.jpg | Image Compressor quality-60 reduction, downloads, metrics, lifecycle and privacy; test/e2e/image-compressor.spec.ts | JPEG, image/jpeg / 107,911 | 240×180 / 43,200 pixels | Opaque, alpha (2,2) = 255 | 2436b9fcce72d32d50b14a5dfe73b365730b7108efca259aea039f41c8ad2af4 |
| compressor-source.png | Image Compressor native lossless reduction and alpha preservation; test/e2e/image-compressor.spec.ts | PNG, image/png / 70,798 | 240×180 / 43,200 pixels | Top-left 30×30 transparent, alpha (2,2) = 0 | d3081b6e2dad9436a04a701bbc460796364b9e62b9048e3ea656717125895641 |
| compressor-source.webp | Image Compressor quality-60 reduction and downloads; test/e2e/image-compressor.spec.ts | WebP, image/webp / 26,982 | 240×180 / 43,200 pixels | Opaque, alpha (2,2) = 255 | 86e9a7238386d93cce18094167a31dd6dae79edb6de5f93432f822df52edae33 |

The existing `resizer-source.png` is also consumed by Image Compressor's
no-reduction test: same-size native encoding produces the same 309-byte file,
with no result URL or download. Its original provenance and checksum remain above.


## Converter transparent WebP

The Converter six-pair tests reuse compressor-source.jpg and compressor-source.png.
The existing WebP fixtures are opaque, so exactly one additional fixture is used.

`converter-transparent.webp` is project-owned geometric artwork generated locally
by headless Chromium 153.0.8010.12 (Playwright 1.63.0), without third-party content
or attribution requirements. Recipe: transparent 240 x 180 off-DOM canvas, fill
(30,0,210,180) with #5b4bd8 and (0,30,30,150) with #0891b2, then
`toDataURL("image/webp", 1)`. The top-left 30 x 30 remains transparent.
Independent saved-byte decode verified image/webp, 240 x 180 (43,200 pixels),
and RGBA (0,0,0,0) at (2,2). Consumer: test/e2e/image-converter.spec.ts,
transparent WebP to PNG alpha preservation and WebP to JPEG white flattening.
SHA-256: fb27276e4d2de53c309031b566dc77b6f6f56ff3e5ad5c068b06621f99d301b4.
Tests consume committed bytes and do not regenerate the fixture.
