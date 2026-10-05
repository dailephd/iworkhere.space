# Deterministic PDF fixtures

These synthetic documents are project-owned test content, authored for this
repository with no third-party document content or attribution requirement.
They are not user documents. `manifest.json` records every committed file's
purpose, byte count and SHA-256. Consumers are document-domain tests and
`script/pdfFoundationSmoke.ts`; no browser test downloads external PDFs.

Regenerate with `node node_modules/tsx/dist/cli.mjs script/pdfFixture.ts` using
pdf-lib 1.17.1 and the canonical QPDF 12.4.2 artifacts. Fixed dates, producer,
page content and deterministic save settings make the recipe repeatable.
JPEG/PNG derivatives embed the project-owned geometric `resizer-source` images;
their original provenance and identities are in `../images/README.md`.

The corpus covers text/vector, JPEG, alpha PNG, mixed content, all fourteen
standard fonts, rotated/mixed-size pages, numbered ordering, multipage,
structurally optimized, encrypted, truncated, invalid-body, false-header,
damaged-xref recovery, 101-page rejection and oversized page-box rejection.
The page-count fixture is small; no large binary corpus is required.
Encryption is generated with fixed test-only reader/owner passwords and
QPDF's static ID/IV flags solely for fixture reproducibility; these unsafe flags
are never used for production document processing. Encryption is unsupported.

PDF.js independently parses and renders producer outputs. Damaged-xref parsing
does not establish repair or output safety. No output fidelity claim is derived
only from a producer parsing its own output.

Batch 4 adds `render-dpi-limit.pdf`: two labeled vector pages, 320×240 and
1200×900 points. At 300 DPI the second exceeds the 4096-side limit; at 150 DPI
both fit. This proves atomic preflight and lower-DPI recovery. Its producer,
fixed dates, content and checksum follow the existing fixture owner. Regenerate
this fixture and `page-export-limit.pdf` (20 labeled pages proving the output
boundary) with `node node_modules/tsx/dist/cli.mjs script/pdfFixture.ts
--render-limit-only`; that focused mode does not initialize or invoke QPDF.
