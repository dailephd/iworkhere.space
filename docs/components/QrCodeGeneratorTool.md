# Component: QrCodeGeneratorTool

## Contract

`src/module/tool/everyday/QrCodeGeneratorTool.tsx` is the client component for
the `qr-code-generator` tool (category `everyday`). It implements
`ToolComponentProp`, owns UI state plus the browser canvas, PNG Blob and
object-URL lifecycle, and delegates all QR behavior to `qrCode.ts` (see
[QrCode](../modules/QrCode.md)).

### UI

- labeled textarea `Text or URL`;
- `Generate QR code` button;
- preview image named `Generated QR code preview`;
- `Download PNG` link;
- `Reset` button;
- an error region with `role="alert"`.

There are no mode, color, size or ECC controls.

### Generate

Generate is disabled only when `input.length === 0`; the input is never trimmed,
so whitespace-only text is a valid payload. For non-empty input the component:
validates and encodes through `generateQrRaster`; draws the 512×512 RGBA into an
offscreen canvas; encodes it to a PNG Blob synchronously (`canvas.toDataURL`, see
"PNG encoding" below); creates one object URL for the Blob; shows the preview and
`Download PNG`; and only then emits telemetry.
Generation is always explicit; there is no live regeneration.

### Encoder loading

The component loads `qrCode.ts` (and its `uqr` encoder) through a single memoized
dynamic import. It requests the chunk once on mount, without generating anything,
emitting telemetry, using payload text or surfacing an error; a failed preload is
retried when Generate is selected. Generate therefore awaits the module before
rasterizing, and the generation ticket guards this wait: an edit, replacement generation, Reset or unmount while the module is
loading discards the continuation. If the module cannot be loaded, the bounded
message `Could not generate the QR code.` is shown, `captureError` receives only
the tool id and a fixed boundary name (never the payload), no preview or download
is created and no success event is emitted.

### Stale-result clearing

Editing the input while a result exists revokes the object URL and clears the
preview, the download action and any error. A QR for previous text is never
downloadable after editing.

Every generation takes a local sequence number. Input edits, replacement
generations, Reset and unmount advance the sequence, and the continuation after
the asynchronous module load proceeds only if its number is still current. Once the
module is available the rest of generation (rasterize, draw, PNG encode, create the
URL) runs synchronously in one task, so no stale result can be installed after that
point; no timing delays are used.

### PNG encoding

The PNG is produced with the synchronous `canvas.toDataURL("image/png")`, decoded to
bytes and wrapped in an `image/png` Blob. `canvas.toBlob` is deliberately not used:
Chromium schedules its encoding on idle periods, so on a page whose main thread has no
idle time the callback was measured at about 1.6–1.9 s in this app (and could stretch
toward 5 s), delaying the preview. A response that is not a PNG data URL, malformed
base64 or an encoding exception produces the bounded `Could not prepare the QR code
PNG.` error with no download.

### Object-URL lifecycle

Each PNG object URL is revoked before it is replaced, when input invalidates the
result, on Reset and on unmount. A stale generation never creates a URL.

### Download

The download action is an anchor to the current object URL with
`download="qr-code.png"`. It exists only for the current generation.

### Reset

Reset advances the sequence, revokes the current URL, clears input, preview,
download and error, restores the Generate-disabled initial state, and returns
focus to the input.

### Errors

Errors are bounded user-facing messages that never contain the payload:

- over 2,048 UTF-8 bytes: `QR code text must be 2,048 UTF-8 bytes or less.` The
  entered text is retained, any previous preview/download is cleared and the
  encoder is not called;
- encoder failure: `Could not generate the QR code.`;
- canvas/PNG failure: `Could not prepare the QR code PNG.` No download URL is
  created and no success event is emitted.

### Privacy and telemetry

Browser-local. No network request, persistence or query state carries the
payload (`persist: "none"`, `shareableQuery: false`); the tool uses no
`storage`, `setQuery` or `fetch`. Only the observability facade is used:
`tool_executed` once per successful current result, after the PNG and URL exist,
with `{ toolId, slug }` only. Payload, byte length, QR version, matrix size,
module count, URL, PNG bytes and Blob URL never appear in `trackEvent`,
`logEvent` or `captureError`. No download-specific or copy event exists.

### Tests

Production-bundle isolation: a Playwright test requests every unrelated route in a
fresh browser context and asserts that no emitted script contains the `uqr` encoder
(identified by its own error text, not by hashed file names), and that the QR route
does load it. Initial state, disabled Generate, whitespace-only input, generation, preview,
Blob/URL creation, download action and filename, stale clearing on edit,
revocation on edit/replacement/Reset/unmount, stale module-load continuations,
synchronous PNG encoding (no `toBlob`), over-limit, encoder failure, PNG-encode
failure modes, identity-only telemetry, no network,
no storage, no query state. Browser tests download the real PNG, verify its
signature and IHDR, and decode it independently with test-only `jsqr`.
