/*
 * Deterministic text metrics for the Word / Character Counter.
 * Pure: no React, telemetry, storage or network access.
 */

export const TEXT_MAX_INPUT_BYTES = 1_048_576;

export interface TextMetric {
    wordCount: number;
    characterCount: number;
    characterWithoutWhitespaceCount: number;
    lineCount: number;
}

export type TextMetricErrorCode = "input-too-large" | "segmenter-unavailable";

export interface TextMetricError {
    code: TextMetricErrorCode;
    message: string;
}

export type TextMetricResult =
    | { ok: true; metric: TextMetric }
    | { ok: false; error: TextMetricError };

const ERROR_MESSAGE: Record<TextMetricErrorCode, string> = {
    "input-too-large": "Text is larger than the 1 MiB limit.",
    "segmenter-unavailable": "This browser does not support the Unicode character segmentation required by this tool.",
};

const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
const LINE_SEPARATOR_PATTERN = /\r\n|\r|\n/g;
const WHITESPACE_CODE_POINT = /^\p{White_Space}$/u;

interface GraphemeSegmenter {
    segment(input: string): Iterable<{ segment: string }>;
}

function createGraphemeSegmenter(): GraphemeSegmenter | null {
    const Segmenter = (Intl as { Segmenter?: new (locale: string, options: { granularity: "grapheme" }) => GraphemeSegmenter }).Segmenter;
    if (typeof Segmenter !== "function") return null;
    return new Segmenter("en", { granularity: "grapheme" });
}

function isWhitespaceGrapheme(grapheme: string): boolean {
    for (const codePoint of grapheme) {
        if (!WHITESPACE_CODE_POINT.test(codePoint)) return false;
    }
    return true;
}

function fail(code: TextMetricErrorCode): TextMetricResult {
    return { ok: false, error: { code, message: ERROR_MESSAGE[code] } };
}

function countMatch(pattern: RegExp, text: string): number {
    let count = 0;
    for (const match of text.matchAll(pattern)) {
        if (match) count++;
    }
    return count;
}

export function measureText(text: string): TextMetricResult {
    if (text.length > TEXT_MAX_INPUT_BYTES || new TextEncoder().encode(text).length > TEXT_MAX_INPUT_BYTES) {
        return fail("input-too-large");
    }
    if (text.length === 0) {
        return { ok: true, metric: { wordCount: 0, characterCount: 0, characterWithoutWhitespaceCount: 0, lineCount: 0 } };
    }

    const segmenter = createGraphemeSegmenter();
    if (!segmenter) return fail("segmenter-unavailable");

    let characterCount = 0;
    let characterWithoutWhitespaceCount = 0;
    for (const { segment } of segmenter.segment(text)) {
        characterCount++;
        if (!isWhitespaceGrapheme(segment)) characterWithoutWhitespaceCount++;
    }

    return {
        ok: true,
        metric: {
            wordCount: countMatch(WORD_PATTERN, text),
            characterCount,
            characterWithoutWhitespaceCount,
            lineCount: countMatch(LINE_SEPARATOR_PATTERN, text) + 1,
        },
    };
}
