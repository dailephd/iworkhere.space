import { afterEach, describe, expect, it } from "vitest"
import { TEXT_MAX_INPUT_BYTES, measureText, type TextMetric, type TextMetricResult } from "./textMetric"

function metricOf(result: TextMetricResult): TextMetric {
    if (!result.ok) throw new Error(`expected success, got ${result.error.code}`)
    return result.metric
}

const measure = (text: string) => metricOf(measureText(text))
const words = (text: string) => measure(text).wordCount
const characters = (text: string) => measure(text).characterCount
const withoutWhitespace = (text: string) => measure(text).characterWithoutWhitespaceCount
const lines = (text: string) => measure(text).lineCount

describe("empty and simple input", () => {
    it("returns zero for every metric on empty input", () => {
        expect(measure("")).toEqual({ wordCount: 0, characterCount: 0, characterWithoutWhitespaceCount: 0, lineCount: 0 })
    })

    it("measures simple ASCII", () => {
        expect(measure("Hello world")).toEqual({ wordCount: 2, characterCount: 11, characterWithoutWhitespaceCount: 10, lineCount: 1 })
    })

    it("counts characters but no words or non-whitespace for spaces only", () => {
        expect(measure("   ")).toEqual({ wordCount: 0, characterCount: 3, characterWithoutWhitespaceCount: 0, lineCount: 1 })
    })
})

describe("words", () => {
    it.each(["hello", "don't", "don’t", "rock'n'roll", "123", "x1y2", "你好世界"])("counts %s as one word", (text) => {
        expect(words(text)).toBe(1)
    })

    it.each([
        ["well-known", 2],
        ["foo_bar", 2],
        ["a/b", 2],
        ["one two  three", 3],
        ["(hello), world!", 2],
        ["--- ... !!!", 0],
        ["'quoted' words", 2],
        ["trailing' apostrophe", 2],
        ["it''s", 2],
        ["don't stop", 2],
        ["3.14", 2],
        ["😀 😀", 0],
        ["Γειά σου", 2],
        ["Привет мир", 2],
    ])("counts %j as %i", (text, expected) => {
        expect(words(text)).toBe(expected)
    })

    it("keeps decomposed combining marks inside the word", () => {
        expect(words("café résumé")).toBe(2)
        expect(words("é")).toBe(1)
    })

    it("does not start a word at a combining mark", () => {
        expect(words("́")).toBe(0)
    })
})

describe("characters (grapheme clusters)", () => {
    it.each([
        ["combining acute accent", "é"],
        ["emoji with skin tone", "👍🏽"],
        ["emoji ZWJ sequence", "👩‍💻"],
        ["regional-indicator flag", "🇯🇵"],
        ["family ZWJ sequence", "👨‍👩‍👧‍👦"],
    ])("counts %s as one character", (_name, text) => {
        expect(characters(text)).toBe(1)
        expect(withoutWhitespace(text)).toBe(1)
    })

    it("counts two flags as two characters and ignores UTF-16 length", () => {
        expect(characters("🇯🇵🇺🇸")).toBe(2)
        expect("😀".length).toBe(2)
        expect(characters("😀")).toBe(1)
        expect(characters("a😀é")).toBe(3)
    })

    it("counts mixed Unicode text by user-perceived characters", () => {
        expect(characters("你好, мир! Γειά")).toBe(13)
    })
})

describe("characters excluding whitespace", () => {
    it.each([
        ["space", " "],
        ["tab", "\t"],
        ["LF", "\n"],
        ["CR", "\r"],
        ["NBSP", " "],
        ["ideographic space", "　"],
        ["CRLF", "\r\n"],
    ])("excludes %s", (_name, text) => {
        expect(characters(text)).toBe(1)
        expect(withoutWhitespace(text)).toBe(0)
        expect(withoutWhitespace(`a${text}b`)).toBe(2)
    })

    it("counts U+200B ZERO WIDTH SPACE because it is not Unicode White_Space", () => {
        expect(characters("a​b")).toBe(3)
        expect(withoutWhitespace("a​b")).toBe(3)
    })

    it("counts the same graphemes as Characters", () => {
        expect(measure("a  \t\r\nb")).toMatchObject({ characterCount: 6, characterWithoutWhitespaceCount: 2 })
    })
})

describe("lines", () => {
    it.each([
        ["", 0],
        ["a", 1],
        ["a\n", 2],
        ["\n", 2],
        ["a\nb", 2],
        ["a\r\nb", 2],
        ["a\rb", 2],
        ["\r", 2],
        ["a\r\nb\rc\nd\n", 5],
        ["\r\n\r\n", 3],
        ["\n\r", 3],
    ])("counts %j as %i lines", (text, expected) => {
        expect(lines(text)).toBe(expected)
    })

    it("does not split on NEL, LINE SEPARATOR or PARAGRAPH SEPARATOR", () => {
        expect(lines("a\u0085b c d")).toBe(1)
    })
})

describe("byte limit", () => {
    it("accepts exactly 1,048,576 UTF-8 bytes of ASCII", () => {
        const text = "a".repeat(TEXT_MAX_INPUT_BYTES)
        expect(measureText(text).ok).toBe(true)
    })

    it("rejects 1,048,577 bytes", () => {
        const result = measureText("a".repeat(TEXT_MAX_INPUT_BYTES + 1))
        expect(result).toEqual({ ok: false, error: { code: "input-too-large", message: "Text is larger than the 1 MiB limit." } })
    })

    it("measures UTF-8 bytes, not string length", () => {
        const atLimit = "é".repeat(TEXT_MAX_INPUT_BYTES / 2)
        expect(atLimit.length).toBeLessThan(TEXT_MAX_INPUT_BYTES)
        expect(measureText(atLimit).ok).toBe(true)
        expect(measureText(atLimit + "a")).toMatchObject({ ok: false, error: { code: "input-too-large" } })
        expect(measureText("😀".repeat(TEXT_MAX_INPUT_BYTES / 4 + 1))).toMatchObject({ ok: false, error: { code: "input-too-large" } })
    })

    it("completes at the boundary with realistic mixed content and exact counts", () => {
        const unit = "Don't stop-believing 世界 é 😀\r\n"
        const text = unit.repeat(Math.floor(TEXT_MAX_INPUT_BYTES / new TextEncoder().encode(unit).length))
        expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(TEXT_MAX_INPUT_BYTES)
        const repeats = text.length / unit.length
        expect(measure(text)).toEqual({
            wordCount: repeats * 5,
            characterCount: repeats * 28,
            characterWithoutWhitespaceCount: repeats * 23,
            lineCount: repeats + 1,
        })
    })

    it("does not backtrack catastrophically on adversarial apostrophe runs", () => {
        const text = "a'".repeat(TEXT_MAX_INPUT_BYTES / 4)
        expect(measureText(text).ok).toBe(true)
        expect(measureText("'".repeat(TEXT_MAX_INPUT_BYTES)).ok).toBe(true)
    })
})

describe("Intl.Segmenter capability", () => {
    const original = Intl.Segmenter

    afterEach(() => {
        Object.defineProperty(Intl, "Segmenter", { value: original, configurable: true, writable: true })
    })

    function removeSegmenter() {
        Object.defineProperty(Intl, "Segmenter", { value: undefined, configurable: true, writable: true })
    }

    it("returns an explicit unsupported error with no approximate counts for non-empty input", () => {
        removeSegmenter()
        const result = measureText("é 😀")
        expect(result).toEqual({
            ok: false,
            error: { code: "segmenter-unavailable", message: "This browser does not support the Unicode character segmentation required by this tool." },
        })
        expect(result).not.toHaveProperty("metric")
    })

    it("still reports zeros for empty input and over-limit before capability", () => {
        removeSegmenter()
        expect(measure("")).toEqual({ wordCount: 0, characterCount: 0, characterWithoutWhitespaceCount: 0, lineCount: 0 })
        expect(measureText("a".repeat(TEXT_MAX_INPUT_BYTES + 1))).toMatchObject({ ok: false, error: { code: "input-too-large" } })
    })

    it("restores support after the simulation", () => {
        removeSegmenter()
        Object.defineProperty(Intl, "Segmenter", { value: original, configurable: true, writable: true })
        expect(measureText("abc").ok).toBe(true)
    })
})
