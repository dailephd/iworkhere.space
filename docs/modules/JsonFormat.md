# Module: JsonFormat

## Contract

`src/module/tool/developer/jsonFormat.ts` is a pure, UI-independent module that
validates strict JSON text and re-emits it as pretty or minified text while
preserving every token lexeme. It has no dependency, no DOM, no network and no
storage.

### Input

Strict RFC 8259 JSON. Any value is a valid root (object, array, string, number,
`true`, `false`, `null`). JSON whitespace is only space, tab, LF, CR.

Rejected with a stable error: empty or whitespace-only input; a leading BOM;
comments; trailing commas; trailing content after the root; single-quoted
strings; unquoted keys; `NaN`/`Infinity`; leading-zero numbers; malformed
fraction or exponent; raw control characters (< U+0020) in strings; malformed
escapes; unterminated strings/containers; missing colon or comma.

### Lexical preservation

Output is produced from the validated token stream, never from a materialized
JavaScript value, and never via `JSON.parse` → `JSON.stringify`. Number lexemes
(`12345678901234567890123`, `1E+2`, `-0`, `1.0`), string lexemes (original escape
spelling, escaped emoji, lone-surrogate escapes, `\/`), literal spellings, member
order and duplicate member names are emitted verbatim. Only insignificant
whitespace changes.

### Algorithm

A small explicit scanner with an **explicit stack** (iterative; call depth does
not grow with nesting), so near-1 MiB pathological nesting returns a normal
result or error rather than a `RangeError`.

### Output

- Format: 2-space indent; `": "` after object keys; `,` then newline; `{}` and
  `[]` stay compact; closing delimiter aligned with its parent; no trailing
  newline.
- Minify: no insignificant whitespace.
- Invariants: `format(format(x)) == format(x)`; `minify(format(x)) ==
  minify(x)`; token-sequence equality across input, formatted and minified.

### Errors

Structured result: stable `code`, bounded project-owned `message` (never echoes
input), zero-based `offset` in UTF-16 code units, 1-based `line` and `column`.
Line breaks are LF, CRLF (one break) and CR. The contract never depends on
engine `JSON.parse` wording. Invalid input yields no output.

### Size limit

1,048,576 UTF-8 bytes measured with `TextEncoder`. Exactly the limit is
accepted; one more byte is rejected before scanning. String `.length` is never
the limit. The limit constant is exported from this module.

### Privacy

The module receives and returns text only. It performs no logging or telemetry.
