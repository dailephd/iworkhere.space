import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import jsQR from "jsqr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    QR_ERROR_CORRECTION,
    QR_MAX_PAYLOAD_BYTES,
    QR_OUTPUT_SIZE,
    QR_QUIET_ZONE_MODULES,
    generateQrMatrix,
    generateQrRaster,
    renderQrRaster,
    type QrMatrixResult,
    type QrRaster,
} from "./qrCode";

const encoder = vi.hoisted(() => ({ calls: [] as unknown[][], failWith: null as Error | null }));

vi.mock("uqr", async importOriginal => {
    const actual = await importOriginal<typeof import("uqr")>();
    return {
        ...actual,
        encode: (...args: Parameters<typeof actual.encode>) => {
            encoder.calls.push(args);
            if (encoder.failWith) throw encoder.failWith;
            return actual.encode(...args);
        },
    };
});

const actualEncode = async () => (await vi.importActual<typeof import("uqr")>("uqr")).encode;

const ASCII_2048 = "a".repeat(2048);
const MULTIBYTE_2048 = "é".repeat(1024);
const DECODE_CASE: Array<[string, string]> = [
    ["plain text", "hello world"],
    ["URL text", "https://example.com/path?a=1&b=é#frag"],
    ["Unicode and emoji", "Héllo 世界 😀 ñ"],
    ["leading and trailing spaces", "  padded text  "],
    ["2048 ASCII bytes", ASCII_2048],
    ["2048 multibyte bytes", MULTIBYTE_2048],
];

function matrixOf(text: string): boolean[][] {
    const result = generateQrMatrix(text);
    if (!result.ok) throw new Error(`expected a matrix for ${text.length} chars`);
    return result.matrix;
}

function rasterOf(text: string): QrRaster {
    const result = generateQrRaster(text);
    if (!result.ok) throw new Error("expected a raster");
    return result.raster;
}

// Test-only QR format-information reader. It reads the 15 format bits from both
// copies in the matrix, removes the 0x5412 mask and checks the BCH(15,5) code.
// Error-correction bits: 01 = L, 00 = M, 11 = Q, 10 = H.
function readFormat(matrix: boolean[][], copy: 1 | 2): number {
    const size = matrix.length;
    const positions: Array<[number, number]> = [];
    if (copy === 1) {
        for (let i = 0; i <= 5; i += 1) positions.push([8, i]);
        positions.push([8, 7], [8, 8], [7, 8]);
        for (let i = 9; i <= 14; i += 1) positions.push([14 - i, 8]);
    } else {
        for (let i = 0; i <= 7; i += 1) positions.push([size - 1 - i, 8]);
        for (let i = 8; i <= 14; i += 1) positions.push([8, size - 15 + i]);
    }
    let bits = 0;
    positions.forEach(([x, y], i) => {
        if (matrix[y][x]) bits |= 1 << i;
    });
    return bits ^ 0x5412;
}

function isValidFormatCodeword(bits: number): boolean {
    let remainder = bits;
    for (let i = 14; i >= 10; i -= 1) {
        if ((remainder >>> i) & 1) remainder ^= 0x537 << (i - 10);
    }
    return remainder === 0;
}

function readEccLevel(matrix: boolean[][]): "L" | "M" | "Q" | "H" {
    const first = readFormat(matrix, 1);
    const second = readFormat(matrix, 2);
    expect(second).toBe(first);
    expect(isValidFormatCodeword(first)).toBe(true);
    const levelBits = (first >>> 13) & 0b11;
    return ({ 0b01: "L", 0b00: "M", 0b11: "Q", 0b10: "H" } as const)[levelBits as 0 | 1 | 2 | 3];
}

function decode(raster: QrRaster): string | null {
    return jsQR(raster.data, raster.width, raster.height)?.data ?? null;
}

function expectOk(result: QrMatrixResult) {
    expect(result.ok).toBe(true);
}

beforeEach(() => {
    encoder.calls.length = 0;
    encoder.failWith = null;
});

describe("QR constants", () => {
    it("freezes the v0.4 contract", () => {
        expect(QR_MAX_PAYLOAD_BYTES).toBe(2048);
        expect(QR_OUTPUT_SIZE).toBe(512);
        expect(QR_ERROR_CORRECTION).toBe("M");
        expect(QR_QUIET_ZONE_MODULES).toBe(4);
    });
});

describe("payload validation", () => {
    it("generates nothing for an empty payload and never calls the encoder", () => {
        expect(generateQrMatrix("")).toEqual({ ok: false, error: { code: "empty-input", message: "Enter text or a URL to generate a QR code." } });
        expect(generateQrRaster("").ok).toBe(false);
        expect(encoder.calls).toHaveLength(0);
    });

    it.each([
        ["ordinary text", "hello"],
        ["a URL", "https://example.com/"],
        ["Unicode", "naïve café 世界"],
        ["emoji", "👩‍👩‍👧‍👦 🇨🇦 😀"],
        ["whitespace only", "   \t\n  "],
    ])("accepts %s", (_name, text) => {
        expectOk(generateQrMatrix(text));
    });

    it("accepts exactly 2048 ASCII bytes", () => {
        expect(new TextEncoder().encode(ASCII_2048)).toHaveLength(2048);
        expectOk(generateQrMatrix(ASCII_2048));
    });

    it("accepts exactly 2048 multibyte UTF-8 bytes even though .length is 1024", () => {
        expect(MULTIBYTE_2048).toHaveLength(1024);
        expect(new TextEncoder().encode(MULTIBYTE_2048)).toHaveLength(2048);
        expectOk(generateQrMatrix(MULTIBYTE_2048));
    });

    it("rejects 2049 bytes before the encoder runs without echoing the payload", () => {
        const text = "SECRET-PAYLOAD-".padEnd(2049, "x");
        const result = generateQrMatrix(text);
        expect(result).toEqual({ ok: false, error: { code: "input-too-large", message: "QR code text must be 2,048 UTF-8 bytes or less." } });
        expect(JSON.stringify(result)).not.toContain("SECRET");
        expect(encoder.calls).toHaveLength(0);
    });

    it("measures bytes, not characters, when rejecting multibyte text", () => {
        const text = "é".repeat(1024) + "a";
        expect(text).toHaveLength(1025);
        expect(generateQrMatrix(text)).toMatchObject({ ok: false, error: { code: "input-too-large" } });
    });

    it("reports a bounded error when the encoder throws", () => {
        encoder.failWith = new RangeError("Data too long SECRET-PAYLOAD");
        const result = generateQrMatrix("SECRET-PAYLOAD");
        expect(result).toEqual({ ok: false, error: { code: "encoder-failure", message: "Could not generate the QR code." } });
        expect(JSON.stringify(result)).not.toContain("SECRET");
    });
});

describe("encoder options and exact input", () => {
    it("passes the exact UTF-8 bytes with ECC M, boost off and no library border", () => {
        const text = "  Héllo 😀  ";
        generateQrMatrix(text);
        expect(encoder.calls).toHaveLength(1);
        const [data, options] = encoder.calls[0];
        expect(Array.isArray(data)).toBe(true);
        expect(data).toEqual(Array.from(new TextEncoder().encode(text)));
        expect(options).toEqual({ ecc: "M", boostEcc: false, border: 0 });
    });

    it("does not trim or normalize: decomposed and composed text give distinct matrices", () => {
        const composed = "café";
        const decomposed = "café";
        expect(composed).not.toBe(decomposed);
        expect(matrixOf(composed)).not.toEqual(matrixOf(decomposed));
        expect(decode(rasterOf(decomposed))).toBe(decomposed);
        expect(decode(rasterOf(" a "))).toBe(" a ");
    });

    it("does not rewrite URL-looking text", () => {
        const text = "HTTPS://Example.COM/Path";
        expect(decode(rasterOf(text))).toBe(text);
    });
});

describe("matrix", () => {
    it.each(DECODE_CASE)("is a square matrix of booleans for %s", (_name, text) => {
        const matrix = matrixOf(text);
        const size = matrix.length;
        expect(size).toBeGreaterThanOrEqual(21);
        expect((size - 17) % 4).toBe(0);
        expect(size).toBeLessThanOrEqual(177);
        for (const row of matrix) {
            expect(row).toHaveLength(size);
            for (const cell of row) expect(typeof cell).toBe("boolean");
        }
    });

    it.each(DECODE_CASE)("advertises error-correction level M in its format information for %s", (_name, text) => {
        expect(readEccLevel(matrixOf(text))).toBe("M");
    });

    it("has a format reader that distinguishes all four levels (control)", async () => {
        const encode = await actualEncode();
        const read = (ecc: "L" | "M" | "Q" | "H") => readEccLevel(encode("control", { ecc, boostEcc: false, border: 0 }).data);
        expect([read("L"), read("M"), read("Q"), read("H")]).toEqual(["L", "M", "Q", "H"]);
    });

    it("would detect an upgraded level: a boosted short payload no longer reads as M (control)", async () => {
        const encode = await actualEncode();
        const boosted = encode("hi", { ecc: "M", boostEcc: true, border: 0 }).data;
        expect(readEccLevel(boosted)).not.toBe("M");
        expect(readEccLevel(matrixOf("hi"))).toBe("M");
    });
});

describe("raster", () => {
    function expectSymbolMatches(matrix: boolean[][], raster: QrRaster) {
        const { moduleScale, offsetX, offsetY } = raster;
        const pixel = (x: number, y: number) => raster.data[(y * raster.width + x) * 4];
        for (let row = 0; row < matrix.length; row += 1) {
            for (let column = 0; column < matrix.length; column += 1) {
                const expected = matrix[row][column] ? 0 : 255;
                const x = offsetX + column * moduleScale;
                const y = offsetY + row * moduleScale;
                expect(pixel(x, y)).toBe(expected);
                expect(pixel(x + moduleScale - 1, y + moduleScale - 1)).toBe(expected);
            }
        }
    }

    function checkerboard(size: number): boolean[][] {
        return Array.from({ length: size }, (_row, y) => Array.from({ length: size }, (_cell, x) => (x + y) % 2 === 0));
    }

    it.each([21, 25, 57, 101, 133, 169, 177])("renders a %i-module matrix as an exact 512x512 integer-scaled symbol", size => {
        const matrix = checkerboard(size);
        const raster = renderQrRaster(matrix);
        const scale = Math.floor(512 / (size + 8));

        expect(raster.width).toBe(512);
        expect(raster.height).toBe(512);
        expect(raster.data).toBeInstanceOf(Uint8ClampedArray);
        expect(raster.data).toHaveLength(512 * 512 * 4);
        expect(raster.moduleScale).toBe(scale);
        expect(Number.isInteger(raster.moduleScale)).toBe(true);
        expect(raster.moduleScale).toBeGreaterThanOrEqual(1);

        const symbol = size * scale;
        expect(raster.offsetX).toBe(Math.floor((512 - symbol) / 2));
        expect(raster.offsetY).toBe(raster.offsetX);
        expect(raster.offsetX).toBeGreaterThanOrEqual(4 * scale);
        expect(512 - raster.offsetX - symbol).toBeGreaterThanOrEqual(4 * scale);
        // Centered: left and right margins differ by at most one pixel.
        expect(Math.abs(raster.offsetX - (512 - raster.offsetX - symbol))).toBeLessThanOrEqual(1);

        expectSymbolMatches(matrix, raster);
    });

    it("uses only exact black and white opaque pixels and a white quiet zone", () => {
        const raster = rasterOf("quiet zone");
        let black = 0;
        let other = 0;
        const d = raster.data;
        for (let i = 0; i < d.length; i += 4) {
            const isWhite = d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255 && d[i + 3] === 255;
            const isBlack = d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0 && d[i + 3] === 255;
            if (isBlack) black += 1;
            else if (!isWhite) other += 1;
        }
        expect(other).toBe(0);
        expect(black).toBeGreaterThan(0);

        const quiet = 4 * raster.moduleScale;
        let nonWhiteInQuietZone = 0;
        for (let y = 0; y < 512; y += 1) {
            for (let x = 0; x < 512; x += 1) {
                const inside = x >= quiet && x < 512 - quiet && y >= quiet && y < 512 - quiet;
                if (!inside && raster.data[(y * 512 + x) * 4] !== 255) nonWhiteInQuietZone += 1;
            }
        }
        expect(nonWhiteInQuietZone).toBe(0);
    });

    it("is deterministic", () => {
        expect(Buffer.from(rasterOf("same input").data).equals(Buffer.from(rasterOf("same input").data))).toBe(true);
    });

    it("rejects matrices that are empty, non-square or too large to scale", () => {
        expect(() => renderQrRaster([])).toThrow(RangeError);
        expect(() => renderQrRaster([[true, false], [true]])).toThrow(RangeError);
        expect(() => renderQrRaster(checkerboard(505))).toThrow(RangeError);
    });
});

describe("independent decode of project-rendered pixels (test-only jsQR)", () => {
    it.each(DECODE_CASE)("decodes %s exactly", (_name, text) => {
        expect(decode(rasterOf(text))).toBe(text);
    });

    it("decodes whitespace-only text exactly", () => {
        expect(decode(rasterOf("   "))).toBe("   ");
    });
});

describe("test-only decoder boundary", () => {
    function sourceFiles(directory: string): string[] {
        return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) return sourceFiles(path);
            return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [path] : [];
        });
    }

    it("never imports jsqr from production source", () => {
        const production = sourceFiles("src").filter(path => !/\.(test|spec)\.[tj]sx?$/.test(path));
        expect(production.length).toBeGreaterThan(50);
        const importers = production.filter(path => /["']jsqr["']/.test(readFileSync(path, "utf8")));
        expect(importers).toEqual([]);
    });

    it("keeps the pinned versions exact", () => {
        const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
        };
        expect(manifest.dependencies.uqr).toBe("0.1.3");
        expect(manifest.devDependencies.jsqr).toBe("1.4.0");
        expect(manifest.dependencies.jsqr).toBeUndefined();
    });
});
