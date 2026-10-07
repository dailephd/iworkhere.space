# Module: QrCode

## Contract

`src/module/tool/everyday/qrCode.ts` is a pure, UI-independent module that turns
text into a QR module matrix and a deterministic 512×512 RGBA raster. It has no
React, DOM, canvas, storage, telemetry or network access. Its only dependency is
the exact-pinned production encoder `uqr@0.1.3` (MIT, no dependencies). Browser
canvas, PNG and object-URL work belong to `QrCodeGeneratorTool.tsx`.

### Constants

Fixed in v0.4; none is configurable.

```text
QR_MAX_PAYLOAD_BYTES  = 2048
QR_OUTPUT_SIZE        = 512
QR_ERROR_CORRECTION   = "M"
QR_QUIET_ZONE_MODULES = 4
```

### Payload

The payload is the string exactly as typed. It is never trimmed, Unicode
normalized, lowercased, parsed, protocol-prefixed or otherwise rewritten. URL
lookalikes, whitespace-only text, Unicode and emoji are ordinary non-empty text.

- Empty string: generates nothing (`empty-input`).
- Limit: 2,048 UTF-8 bytes measured with `TextEncoder`. Exactly 2,048 is
  accepted; 2,049 is rejected (`input-too-large`) **before** the encoder is
  called. String `.length` is never the limit.
- Error messages are bounded, project-owned and never echo the payload.

### Encoder boundary

The payload is encoded to UTF-8 bytes and passed to `uqr.encode` as a plain
`number[]` (the encoder selects byte mode for arrays, never for typed arrays or
strings it might classify as numeric/alphanumeric) with:

```text
ecc:      "M"
boostEcc: false      (the encoder must not silently upgrade ECC)
border:   0          (the project owns the quiet zone)
```

No encoder default for ECC, ECC boost or border is relied on. The returned
`data` is a square `boolean[][]` (`true` = black). Encoder exceptions become the
bounded `encoder-failure` result.

### Raster

```text
moduleScale = floor(512 / (moduleCount + 8))      // 4 quiet modules per side
symbolPixels = moduleCount * moduleScale
offsetX = offsetY = floor((512 - symbolPixels) / 2)
```

`moduleScale >= 1` is required (a version-40 symbol, 177 modules, yields 2).
Modules are never stretched fractionally. The symbol is centered; each side's
quiet area is at least `4 * moduleScale` pixels (extra centering pixels are
allowed). Background is white, modules black, no anti-aliasing, exact RGBA:

```text
white: 255,255,255,255
black:   0,  0,  0,255
```

Output shape: `{ width, height, data: Uint8ClampedArray, moduleScale, offsetX,
offsetY }` with `width = height = 512` and `data.length = 512 * 512 * 4`.

### PNG correctness expectations

The component encodes the raster as a PNG. The downloaded file must carry the PNG
signature `89 50 4E 47 0D 0A 1A 0A`, a first `IHDR` chunk reporting 512×512, and
pixels that an independent decoder reads back as the original payload.

### Test boundary

Correctness is never proven by the encoder library itself:

- a test-only format-information reader decodes the matrix's format bits and
  must report ECC level `M`;
- test-only `jsqr@1.4.0` decodes the project-rendered RGBA pixels and must
  return the exact payload (plain text, URL, Unicode/emoji, 2,048 ASCII bytes,
  2,048 multibyte bytes).

`jsqr` is a devDependency and is never imported from production source.

### Privacy

The module receives and returns text, matrices and pixels only. It performs no
logging, telemetry, network, persistence or query-state access.
