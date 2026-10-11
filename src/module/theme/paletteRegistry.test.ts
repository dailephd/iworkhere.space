import { describe, expect, it } from "vitest";
import { isPaletteId, listPalettes } from "./paletteRegistry";

describe("palette registry", () => {
    it("retains utility colors and all six source palettes", () => {
        expect(listPalettes().map(palette => palette.id)).toEqual([
            "utility", "mineral", "oxblood", "signal", "cobalt", "amber", "original",
        ]);
        expect(new Set(listPalettes().map(palette => palette.label)).size).toBe(7);
        expect(listPalettes().every(palette => palette.swatch.length === 2)).toBe(true);
    });
    it("rejects unknown palette identifiers", () => {
        expect(isPaletteId("mineral")).toBe(true);
        for (const value of ["", "dracula", "javascript:alert(1)", null, undefined]) {
            expect(isPaletteId(value)).toBe(false);
        }
    });
});
