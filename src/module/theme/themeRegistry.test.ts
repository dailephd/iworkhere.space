import { describe, test, expect } from "vitest";
import { DEFAULT_APPEARANCE, listThemes, isThemeId, listPalettes, listColorModes, isPaletteId, isColorMode } from "./themeRegistry";

const ids = ["system", "light", "dark", "onedark"];
const retired = ["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum"];
describe("theme registry", () => {
    test("has exactly the four canonical choices in order", () => {
        expect(listThemes()).toHaveLength(4);
        expect(listThemes().map(theme => theme.id)).toEqual(ids);
        expect(listThemes().map(theme => theme.label)).toEqual(["System", "Light", "Dark", "One Dark"]);
        expect(listThemes().map(theme => theme.description)).toEqual([
            "Follow light or dark system preference", "Clean colorful light", "Restrained slate dark",
            "Purple developer dark",
        ]);
    });
    test.each(ids)("accepts %s", id => expect(isThemeId(id)).toBe(true));
    test.each([...retired, "unknown", "", null, undefined, 42])("rejects %s", id => expect(isThemeId(id)).toBe(false));
});

describe("palette registry", () => {
    test("defaults to Violet & Graphite with System mode", () => {
        expect(DEFAULT_APPEARANCE).toEqual({ palette: "original", mode: "system" });
    });
    test("has the documented six identities plus the preserved legacy choice", () => {
        expect(listPalettes().map(p => p.id)).toEqual(["mineral", "oxblood", "signal", "cobalt", "amber", "original", "onedark"]);
        expect(listPalettes().map(p => p.label)).toEqual(["Mineral Research", "Oxblood Atelier", "Signal Green", "Cobalt & Terracotta", "Amber & Graphite", "Violet & Graphite", "One Dark"]);
        expect(listColorModes().map(m => m.id)).toEqual(["system", "light", "dark"]);
    });
    test.each(["", null, 42, "dracula", "effects"])("rejects unknown palette and mode %s", value => {
        expect(isPaletteId(value)).toBe(false); expect(isColorMode(value)).toBe(false);
    });
});
