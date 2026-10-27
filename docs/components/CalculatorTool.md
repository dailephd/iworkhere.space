# Component: CalculatorTool

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/math/CalculatorTool.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/math/CalculatorTool.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/tool/math/CalculatorTool.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (CalculatorTool)
- Derived from single-file merged unit "CalculatorTool".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

The expression input runs the current expression with Enter, keyboard `=`, or
the on-screen equals button. Keyboard equals does not insert a parser-invalid
character; all three actions use the same calculation handler.

Evaluation is a safe recursive-descent parser inside the component file (no
`eval`, no `Function`, no library):

```
expression = product (("+" | "-") product)*
product    = unary (("*" | "/") unary)*
unary      = ("+" | "-") unary | primary
primary    = number | "(" expression ")"
number     = digits ["." [digits]] | "." digits
```

Unary signs bind above `*` and `/`; equal-precedence operators are
left-associative; whitespace separates tokens but never fuses numbers. Every
operation result must be finite (division by zero is `Result is not finite.`),
negative zero displays as `0`, and nesting deeper than 200 levels is
rejected. Running an empty expression shows an alert
(`Enter an expression to calculate.`); the untouched initial state keeps its
placeholder. Error output is rendered in a `role="alert"` region.

## Usage guide coverage

`/tool/calculator` has a server-rendered usage guide owned by
`src/module/tool/guide.ts` (`getToolGuide("calculator")`). It documents basic
arithmetic, operator precedence and parentheses, negative numbers, invalid
expressions and numeric limits, and expression sharing and privacy, and links
to Time Arithmetic, Length Converter and Weight Converter.

Verified behavior the guide relies on (see `guideExample.test.tsx`):

- `2 + 3 * 4` is `14`, `(2 + 3) * 4` is `20`, `7 / 2` is `3.5`.
- Signs are unary and bind above multiplication: `-5 + 2` is `-3`,
  `2 * -3` and `2 * (-3)` are `-6`, `2 / -2` is `-1`, `1--2` is `3`,
  `-(2+3)` is `-5`, `--2` is `2`. (Earlier releases rewrote a sign after an
  operator as `0 -`, so `2 * -3` wrongly gave `-3`.)
- Errors: `Invalid character: "&"`, `Invalid number.` (a bare `.`),
  `Invalid expression.` (incomplete input, adjacent numbers, `2(3)`,
  `2 ** 3`), `Mismatched parentheses.`, `Result is not finite.`,
  `Enter an expression to calculate.`.
- Fractional results are rounded to at most 12 decimals; arithmetic is
  JavaScript floating point.
- The expression is written to the `expr` query parameter, so the guide warns
  against entering sensitive values in a shared address.
