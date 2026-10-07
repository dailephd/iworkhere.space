/*
 * Strict, token-preserving JSON formatter / validator.
 *
 * Output is produced from the validated token stream. Token lexemes are copied
 * verbatim from the input; only insignificant whitespace changes. No JavaScript
 * value is ever materialized, so numbers, escapes, duplicate member names and
 * member order cannot be coerced or collapsed.
 *
 * The scanner uses an explicit stack, so nesting depth never grows the call
 * stack.
 */

export const JSON_MAX_INPUT_BYTES = 1_048_576;
export const JSON_MAX_OUTPUT_LENGTH = 16_777_216;

export type JsonFormatMode = "format" | "minify";

export type JsonFormatErrorCode =
    | "input-too-large"
    | "output-too-large"
    | "empty"
    | "bom"
    | "comments-not-allowed"
    | "unexpected-character"
    | "unexpected-end"
    | "trailing-content"
    | "trailing-comma"
    | "expected-key"
    | "expected-colon"
    | "expected-comma-or-close"
    | "invalid-literal"
    | "invalid-number"
    | "invalid-escape"
    | "control-character"
    | "unterminated-string";

export interface JsonFormatError {
    code: JsonFormatErrorCode;
    message: string;
    offset: number;
    line: number;
    column: number;
}

export type JsonFormatResult =
    | { ok: true; output: string }
    | { ok: false; error: JsonFormatError };

const ERROR_MESSAGE: Record<JsonFormatErrorCode, string> = {
    "input-too-large": "Input is larger than the 1 MiB limit.",
    "output-too-large": "Formatted output would be too large. Use Minify or reduce nesting.",
    "empty": "Input is empty. Enter a JSON value.",
    "bom": "A byte order mark is not allowed before JSON text.",
    "comments-not-allowed": "Comments are not allowed in strict JSON.",
    "unexpected-character": "Unexpected character.",
    "unexpected-end": "Unexpected end of input.",
    "trailing-content": "Unexpected content after the JSON value.",
    "trailing-comma": "Trailing commas are not allowed.",
    "expected-key": "Expected a double-quoted property name.",
    "expected-colon": "Expected a colon after the property name.",
    "expected-comma-or-close": "Expected a comma or a closing bracket.",
    "invalid-literal": "Invalid literal. Use true, false or null.",
    "invalid-number": "Invalid number.",
    "invalid-escape": "Invalid escape sequence in string.",
    "control-character": "Control characters must be escaped inside strings.",
    "unterminated-string": "String is not terminated.",
};

type State = "value" | "value-or-close" | "key" | "key-or-close" | "colon" | "comma-or-close" | "end";

const NUMBER_PATTERN = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const HEX_PATTERN = /^[0-9a-fA-F]{4}$/;

function isJsonWhitespace(char: string): boolean {
    return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
}

function fail(input: string, code: JsonFormatErrorCode, offset: number): JsonFormatResult {
    return { ok: false, error: { code, message: ERROR_MESSAGE[code], ...locate(input, offset) } };
}

function locate(input: string, offset: number): { offset: number; line: number; column: number } {
    let line = 1;
    let lineStart = 0;
    for (let i = 0; i < offset; i++) {
        const char = input[i];
        if (char === "\n") {
            line++;
            lineStart = i + 1;
        } else if (char === "\r") {
            if (input[i + 1] === "\n") {
                if (i + 1 < offset) {
                    line++;
                    lineStart = i + 2;
                    i++;
                }
            } else {
                line++;
                lineStart = i + 1;
            }
        }
    }
    return { offset, line, column: offset - lineStart + 1 };
}

/* Returns the index just after the closing quote, or an error code with its offset. */
function scanString(input: string, start: number): { end: number } | { code: JsonFormatErrorCode; offset: number } {
    let i = start + 1;
    while (i < input.length) {
        const char = input[i];
        if (char === '"') return { end: i + 1 };
        if (char < " ") return { code: "control-character", offset: i };
        if (char === "\\") {
            const next = input[i + 1];
            if (next === undefined) return { code: "unterminated-string", offset: start };
            if (next === "u") {
                if (!HEX_PATTERN.test(input.slice(i + 2, i + 6))) return { code: "invalid-escape", offset: i };
                i += 6;
                continue;
            }
            if ('"\\/bfnrt'.includes(next)) {
                i += 2;
                continue;
            }
            return { code: "invalid-escape", offset: i };
        }
        i++;
    }
    return { code: "unterminated-string", offset: start };
}

export function transformJson(input: string, mode: JsonFormatMode): JsonFormatResult {
    if (input.length > JSON_MAX_INPUT_BYTES || new TextEncoder().encode(input).length > JSON_MAX_INPUT_BYTES) {
        return fail(input, "input-too-large", 0);
    }
    if (input.startsWith("﻿")) return fail(input, "bom", 0);

    const pretty = mode === "format";
    const parts: string[] = [];
    const stack: Array<"{" | "["> = [];
    let state: State = "value";
    let afterComma = false;
    let outputLength = 0;

    const emit = (text: string): void => {
        parts.push(text);
        outputLength += text.length;
    };
    const newline = (depth: number): string => (pretty ? "\n" + "  ".repeat(depth) : "");

    let i = 0;
    let sawToken = false;
    while (i < input.length) {
        const char = input[i];
        if (isJsonWhitespace(char)) {
            i++;
            continue;
        }
        sawToken = true;
        if (outputLength > JSON_MAX_OUTPUT_LENGTH) return fail(input, "output-too-large", i);

        if (state === "end") return fail(input, "trailing-content", i);

        if (state === "colon") {
            if (char !== ":") return fail(input, "expected-colon", i);
            emit(pretty ? ": " : ":");
            state = "value";
            afterComma = false;
            i++;
            continue;
        }

        if (state === "comma-or-close") {
            const top = stack[stack.length - 1];
            if (char === ",") {
                emit(",");
                state = top === "{" ? "key" : "value";
                afterComma = true;
                i++;
                continue;
            }
            if ((char === "}" && top === "{") || (char === "]" && top === "[")) {
                stack.pop();
                emit(newline(stack.length) + char);
                state = stack.length === 0 ? "end" : "comma-or-close";
                i++;
                continue;
            }
            return fail(input, char === "/" ? "comments-not-allowed" : "expected-comma-or-close", i);
        }

        if (state === "key" || state === "key-or-close") {
            if (char === "}" && state === "key-or-close") {
                stack.pop();
                emit("}");
                state = stack.length === 0 ? "end" : "comma-or-close";
                i++;
                continue;
            }
            if (char === "}" && afterComma) return fail(input, "trailing-comma", i);
            if (char !== '"') return fail(input, char === "/" ? "comments-not-allowed" : "expected-key", i);
            const scanned = scanString(input, i);
            if ("code" in scanned) return fail(input, scanned.code, scanned.offset);
            emit(newline(stack.length) + input.slice(i, scanned.end));
            state = "colon";
            i = scanned.end;
            continue;
        }

        /* state is "value" or "value-or-close" */
        if (char === "]" && state === "value-or-close") {
            stack.pop();
            emit("]");
            state = stack.length === 0 ? "end" : "comma-or-close";
            i++;
            continue;
        }
        if (char === "]" && afterComma && stack.length > 0) return fail(input, "trailing-comma", i);

        const inArray = stack[stack.length - 1] === "[";
        const prefix = inArray ? newline(stack.length) : "";

        if (char === "{" || char === "[") {
            emit(prefix + char);
            stack.push(char);
            state = char === "{" ? "key-or-close" : "value-or-close";
            afterComma = false;
            i++;
            continue;
        }

        let end = -1;
        if (char === '"') {
            const scanned = scanString(input, i);
            if ("code" in scanned) return fail(input, scanned.code, scanned.offset);
            end = scanned.end;
        } else if (char === "-" || isDigit(char)) {
            NUMBER_PATTERN.lastIndex = i;
            const match = NUMBER_PATTERN.exec(input);
            if (!match) return fail(input, "invalid-number", i);
            end = i + match[0].length;
            const following = input[end];
            if (following !== undefined && (isDigit(following) || following === "." || following === "e" || following === "E" || following === "+" || following === "-")) {
                return fail(input, "invalid-number", i);
            }
        } else if (char === "t" || char === "f" || char === "n") {
            const literal = char === "t" ? "true" : char === "f" ? "false" : "null";
            if (!input.startsWith(literal, i)) return fail(input, "invalid-literal", i);
            end = i + literal.length;
        } else {
            return fail(input, char === "/" ? "comments-not-allowed" : "unexpected-character", i);
        }

        emit(prefix + input.slice(i, end));
        state = stack.length === 0 ? "end" : "comma-or-close";
        afterComma = false;
        i = end;
    }

    if (!sawToken) return fail(input, "empty", 0);
    if (state !== "end") return fail(input, "unexpected-end", input.length);
    return { ok: true, output: parts.join("") };
}

export function formatJson(input: string): JsonFormatResult {
    return transformJson(input, "format");
}

export function minifyJson(input: string): JsonFormatResult {
    return transformJson(input, "minify");
}
