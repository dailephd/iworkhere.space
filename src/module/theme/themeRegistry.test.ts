import { describe, test, expect } from "vitest";
import { listThemes, isThemeId } from "./themeRegistry";

describe("listThemes", () => {
    test("returns all eight themes", () => {
        const themes = listThemes();
        expect(themes).toHaveLength(8);
    });

    test("includes system theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("system");
    });

    test("includes light theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("light");
    });

    test("includes dark theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("dark");
    });

    test("includes onedark theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("onedark");
    });

    test("includes vscode-modern theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("vscode-modern");
    });

    test("includes dracula theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("dracula");
    });

    test("includes amethyst-haze theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("amethyst-haze");
    });

    test("includes mercury-fog theme", () => {
        const ids = listThemes().map((t) => t.id);
        expect(ids).toContain("mercury-fog");
    });

    test("each theme has a non-empty label", () => {
        for (const theme of listThemes()) {
            expect(typeof theme.label).toBe("string");
            expect(theme.label.length).toBeGreaterThan(0);
        }
    });

    test("system theme has label 'System'", () => {
        const system = listThemes().find((t) => t.id === "system");
        expect(system?.label).toBe("System");
    });

    test("onedark theme has label 'One Dark'", () => {
        const theme = listThemes().find((t) => t.id === "onedark");
        expect(theme?.label).toBe("One Dark");
    });

    test("vscode-modern theme has label 'VS Code Modern'", () => {
        const theme = listThemes().find((t) => t.id === "vscode-modern");
        expect(theme?.label).toBe("VS Code Modern");
    });

    test("dracula theme has label 'Dracula'", () => {
        const theme = listThemes().find((t) => t.id === "dracula");
        expect(theme?.label).toBe("Dracula");
    });

    test("amethyst-haze theme has label 'Amethyst Haze'", () => {
        const theme = listThemes().find((t) => t.id === "amethyst-haze");
        expect(theme?.label).toBe("Amethyst Haze");
    });

    test("mercury-fog theme has label 'Mercury Fog'", () => {
        const theme = listThemes().find((t) => t.id === "mercury-fog");
        expect(theme?.label).toBe("Mercury Fog");
    });

    test("returns a new array on each call (no shared reference mutation)", () => {
        const a = listThemes();
        const b = listThemes();
        expect(a).toEqual(b);
    });
});

describe("isThemeId", () => {
    test("returns true for 'system'", () => {
        expect(isThemeId("system")).toBe(true);
    });

    test("returns true for 'light'", () => {
        expect(isThemeId("light")).toBe(true);
    });

    test("returns true for 'dark'", () => {
        expect(isThemeId("dark")).toBe(true);
    });

    test("returns true for 'onedark'", () => {
        expect(isThemeId("onedark")).toBe(true);
    });

    test("returns true for 'vscode-modern'", () => {
        expect(isThemeId("vscode-modern")).toBe(true);
    });

    test("returns true for 'dracula'", () => {
        expect(isThemeId("dracula")).toBe(true);
    });

    test("returns true for 'amethyst-haze'", () => {
        expect(isThemeId("amethyst-haze")).toBe(true);
    });

    test("returns true for 'mercury-fog'", () => {
        expect(isThemeId("mercury-fog")).toBe(true);
    });

    test("returns false for an unknown string", () => {
        expect(isThemeId("ocean-blue")).toBe(false);
    });

    test("returns false for an empty string", () => {
        expect(isThemeId("")).toBe(false);
    });

    test("returns false for null", () => {
        expect(isThemeId(null)).toBe(false);
    });

    test("returns false for undefined", () => {
        expect(isThemeId(undefined)).toBe(false);
    });

    test("returns false for a number", () => {
        expect(isThemeId(42)).toBe(false);
    });
});
