import { describe, expect, it } from "vitest"
import { JSON_MAX_INPUT_BYTES, formatJson, minifyJson, transformJson, type JsonFormatError } from "./jsonFormat"

function okOutput(result: ReturnType<typeof formatJson>): string {
    if (!result.ok) throw new Error(`expected success, got ${result.error.code}`)
    return result.output
}

function errorOf(result: ReturnType<typeof formatJson>): JsonFormatError {
    if (result.ok) throw new Error("expected an error")
    return result.error
}

/* Independent test-only oracle: lexeme sequence of valid JSON text. */
function lexemes(text: string): string[] {
    return text.match(/"(?:[^"\\]|\\.)*"|-?[0-9][0-9.eE+-]*|true|false|null|[{}[\],:]/g) ?? []
}

describe("valid roots", () => {
    it.each([
        ['{"a":1}', '{\n  "a": 1\n}'],
        ["[1,2]", "[\n  1,\n  2\n]"],
        ['"text"', '"text"'],
        ["42", "42"],
        ["true", "true"],
        ["false", "false"],
        ["null", "null"],
    ])("formats %s", (input, expected) => {
        expect(okOutput(formatJson(input))).toBe(expected)
        expect(okOutput(minifyJson(input))).toBe(input)
    })

    it("accepts every permitted whitespace character around and between tokens", () => {
        const spaced = " \t\n\r{ \t\n\r\"a\" \t\n\r: \t\n\r[ \t\n\r1 \t\n\r, \t\n\r2 \t\n\r] \t\n\r} \t\n\r"
        expect(okOutput(minifyJson(spaced))).toBe('{"a":[1,2]}')
    })
})

describe("layout", () => {
    it("uses exactly two-space indentation, one space after colons, and no trailing newline", () => {
        const input = '{"a":{"b":[1,{"c":null}],"d":[]},"e":{}}'
        const expected = [
            "{",
            '  "a": {',
            '    "b": [',
            "      1,",
            "      {",
            '        "c": null',
            "      }",
            "    ],",
            '    "d": []',
            "  },",
            '  "e": {}',
            "}",
        ].join("\n")
        expect(okOutput(formatJson(input))).toBe(expected)
        expect(expected.endsWith("\n")).toBe(false)
    })

    it("keeps empty containers compact", () => {
        expect(okOutput(formatJson("{}"))).toBe("{}")
        expect(okOutput(formatJson("[]"))).toBe("[]")
        expect(okOutput(formatJson("[ { } , [ ] ]"))).toBe("[\n  {},\n  []\n]")
    })

    it("minifies mixed structures", () => {
        expect(okOutput(minifyJson('{ "a" : [ 1 , { "b" : "x y" } ] , "c" : null }'))).toBe('{"a":[1,{"b":"x y"}],"c":null}')
    })
})

describe("invalid grammar", () => {
    it.each<[string, string, string]>([
        ["empty", "", "empty"],
        ["whitespace only", " \t\r\n ", "empty"],
        ["byte order mark", "﻿{}", "bom"],
        ["line comment", '{"a":1} // c', "trailing-content"],
        ["comment inside object", '{"a":1, /* c */ "b":2}', "comments-not-allowed"],
        ["comment before value", "[ // c\n1]", "comments-not-allowed"],
        ["trailing comma in object", '{"a":1,}', "trailing-comma"],
        ["trailing comma in array", "[1,]", "trailing-comma"],
        ["trailing content", "{} {}", "trailing-content"],
        ["trailing scalar content", "1 2", "trailing-content"],
        ["single-quoted string", "'a'", "unexpected-character"],
        ["unquoted key", "{a:1}", "expected-key"],
        ["leading zero", "01", "invalid-number"],
        ["negative leading zero", "-01", "invalid-number"],
        ["missing fraction digits", "1.", "invalid-number"],
        ["missing exponent digits", "1e", "invalid-number"],
        ["signed exponent without digits", "1e+", "invalid-number"],
        ["lone minus", "-", "invalid-number"],
        ["leading plus", "+1", "unexpected-character"],
        ["NaN", "NaN", "unexpected-character"],
        ["Infinity", "Infinity", "unexpected-character"],
        ["misspelled literal", "tru", "invalid-literal"],
        ["raw control character", '"a\u0001b"', "control-character"],
        ["raw newline in string", '"a\nb"', "control-character"],
        ["invalid escape", '"\\x"', "invalid-escape"],
        ["short unicode escape", '"\\u12"', "invalid-escape"],
        ["unterminated string", '"abc', "unterminated-string"],
        ["unterminated array", "[1", "unexpected-end"],
        ["unterminated object", '{"a":1', "unexpected-end"],
        ["missing colon", '{"a" 1}', "expected-colon"],
        ["missing comma in array", "[1 2]", "expected-comma-or-close"],
        ["missing comma in object", '{"a":1 "b":2}', "expected-comma-or-close"],
        ["mismatched close", "[1}", "expected-comma-or-close"],
        ["missing value", '{"a":}', "unexpected-character"],
    ])("rejects %s", (_name, input, code) => {
        for (const mode of ["format", "minify"] as const) {
            const result = transformJson(input, mode)
            expect(result.ok).toBe(false)
            expect(errorOf(result).code).toBe(code)
        }
    })

    it("returns a bounded project-owned message that never echoes input", () => {
        const error = errorOf(formatJson('{"secret-key-name": tru}'))
        expect(error.message.length).toBeLessThan(100)
        expect(error.message).not.toContain("secret")
    })
})

describe("lexical preservation", () => {
    it("preserves number lexemes exactly", () => {
        const input = "[12345678901234567890123,1E+2,-0,1.0,1.50e-10,0.1000]"
        expect(okOutput(minifyJson(input))).toBe(input)
        expect(okOutput(formatJson(input))).toBe("[\n  12345678901234567890123,\n  1E+2,\n  -0,\n  1.0,\n  1.50e-10,\n  0.1000\n]")
    })

    it("preserves string lexemes and escape spelling exactly", () => {
        const input = '["é","\\/","\\u00e9","\\ud83d\\ude00","😀","\\ud800","\\"\\\\\\b\\f\\n\\r\\t"]'
        expect(okOutput(minifyJson(input))).toBe(input)
    })

    it("preserves duplicate member names, their order, and member order", () => {
        const input = '{"b":1,"a":2,"b":3,"a":4}'
        expect(okOutput(minifyJson(input))).toBe(input)
        expect(okOutput(formatJson(input))).toBe('{\n  "b": 1,\n  "a": 2,\n  "b": 3,\n  "a": 4\n}')
    })

    it("preserves keys containing escapes", () => {
        expect(okOutput(minifyJson('{"\\u0061":1}'))).toBe('{"\\u0061":1}')
    })
})

describe("invariants", () => {
    const samples = [
        '{"a":[1,2,{"b":null}],"c":"x","c":"y"}',
        "[ [ ] , { } , [ [ 1 ] ] ]",
        " 123456789012345678901234567890 ",
        '{"deep":{"deeper":{"deepest":[true,false,null,-0.0e+00]}}}',
        '"\\u00e9\\/"',
    ]

    it.each(samples)("is idempotent and format/minify consistent for %s", (input) => {
        const formatted = okOutput(formatJson(input))
        expect(okOutput(formatJson(formatted))).toBe(formatted)
        expect(okOutput(minifyJson(formatted))).toBe(okOutput(minifyJson(input)))
    })

    it.each(samples)("keeps the same token sequence across input, formatted and minified output for %s", (input) => {
        const tokens = lexemes(input)
        expect(lexemes(okOutput(formatJson(input)))).toEqual(tokens)
        expect(lexemes(okOutput(minifyJson(input)))).toEqual(tokens)
    })

    it("agrees with JSON.parse on safe values (oracle only)", () => {
        const input = '{"a":[1,2.5,"x",true,null],"b":{"c":"d"}}'
        expect(JSON.parse(okOutput(formatJson(input)))).toEqual(JSON.parse(input))
        expect(JSON.parse(okOutput(minifyJson(input)))).toEqual(JSON.parse(input))
    })
})

describe("error location", () => {
    it("reports offset, line and column for LF", () => {
        const error = errorOf(formatJson('{\n  "a": tru\n}'))
        expect(error).toMatchObject({ code: "invalid-literal", message: "Invalid literal. Use true, false or null.", offset: 9, line: 2, column: 8 })
    })

    it("treats CRLF as one line break", () => {
        const error = errorOf(formatJson('{\r\n  "a": tru\r\n}'))
        expect(error).toMatchObject({ code: "invalid-literal", offset: 10, line: 2, column: 8 })
    })

    it("treats a lone CR as a line break", () => {
        const error = errorOf(formatJson('{\r  "a": tru\r}'))
        expect(error).toMatchObject({ code: "invalid-literal", offset: 9, line: 2, column: 8 })
    })

    it("locates trailing commas, trailing content and unexpected end", () => {
        expect(errorOf(formatJson("[1,\n]"))).toMatchObject({ code: "trailing-comma", offset: 4, line: 2, column: 1 })
        expect(errorOf(formatJson("{}\nx"))).toMatchObject({ code: "trailing-content", offset: 3, line: 2, column: 1 })
        expect(errorOf(formatJson("[1,\n2"))).toMatchObject({ code: "unexpected-end", offset: 5, line: 2, column: 2 })
    })

    it("counts columns in UTF-16 code units", () => {
        const error = errorOf(formatJson('["😀", tru]'))
        expect(error).toMatchObject({ code: "invalid-literal", offset: 7, line: 1, column: 8 })
    })

    it("locates unterminated strings at the opening quote", () => {
        expect(errorOf(formatJson('["a", "b'))).toMatchObject({ code: "unterminated-string", offset: 6 })
    })
})

describe("size limit", () => {
    const filler = (bytes: number) => `"${"a".repeat(bytes - 2)}"`

    it("accepts exactly 1 MiB of UTF-8", () => {
        const input = filler(JSON_MAX_INPUT_BYTES)
        expect(new TextEncoder().encode(input).length).toBe(1_048_576)
        expect(okOutput(minifyJson(input))).toBe(input)
    })

    it("rejects one more byte before scanning, even if the content is invalid", () => {
        const input = filler(JSON_MAX_INPUT_BYTES + 1)
        expect(errorOf(minifyJson(input)).code).toBe("input-too-large")
        expect(errorOf(minifyJson("{".repeat(JSON_MAX_INPUT_BYTES + 1))).code).toBe("input-too-large")
    })

    it("measures UTF-8 bytes, not string length", () => {
        const multibyte = `"${"é".repeat(524_288)}"`
        expect(multibyte.length).toBeLessThan(JSON_MAX_INPUT_BYTES)
        expect(new TextEncoder().encode(multibyte).length).toBeGreaterThan(JSON_MAX_INPUT_BYTES)
        expect(errorOf(minifyJson(multibyte)).code).toBe("input-too-large")
    })
})

describe("deep nesting", () => {
    const depth = JSON_MAX_INPUT_BYTES / 2
    const nested = "[".repeat(depth) + "]".repeat(depth)

    it("minifies near-limit nesting without a call-stack error", () => {
        expect(nested.length).toBe(JSON_MAX_INPUT_BYTES)
        expect(okOutput(minifyJson(nested))).toBe(nested)
    })

    it("returns a normal bounded error for pretty output that would explode", () => {
        const result = formatJson(nested)
        expect(result.ok).toBe(false)
        expect(errorOf(result).code).toBe("output-too-large")
    })

    it("formats moderately deep nesting and reports unterminated deep input normally", () => {
        const moderate = "[".repeat(1_000) + "]".repeat(1_000)
        expect(okOutput(formatJson(moderate)).split("\n")).toHaveLength(1_999)
        expect(errorOf(minifyJson("[".repeat(100_000))).code).toBe("unexpected-end")
    })
})
