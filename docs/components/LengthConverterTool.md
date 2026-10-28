# Component: LengthConverterTool

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/everyday/LengthConverterTool.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/everyday/LengthConverterTool.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/tool/everyday/LengthConverterTool.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (LengthConverterTool)
- Derived from single-file merged unit "LengthConverterTool".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.


## Numeric input and range

Conversion multiplies the value by one combined factor (`TO_METERS[from] /
TO_METERS[to]`), so converting a value to the same unit is exact and never
overflows (`1e308` stays `1e+308`). The whole trimmed value must be a
number: blank input shows `Invalid input: enter a number.` in a
`role="alert"` region. A browser number field reports unparsable text such as
`1e` or `1e999` as an empty value, so those also show the blank message; the
component's own full-string check is a second line of defence. A result that
overflows (for example 1e308 miles in millimeters) shows
`Result is out of range for this conversion.` and never `Infinity` or
`NaN`. Output keeps the existing rounding to at most six decimals, so very
small values display `0`; rounding is a display choice, not a measure of
accuracy. Companion tests: `LengthConverterTool.test.tsx`.
