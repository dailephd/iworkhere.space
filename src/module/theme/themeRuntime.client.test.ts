// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { applyAppearance, setTheme, getThemeFromDom, THEME_INIT_SCRIPT } from "./themeRuntime.client";
import { listThemes, listPalettes, type ColorMode } from "./themeRegistry";

beforeEach(() => {
    for (const name of ["data-theme", "data-palette", "data-theme-preference"]) document.documentElement.removeAttribute(name);
    document.documentElement.classList.remove("dark");
});
describe("theme runtime", () => {
    test.each(listThemes())("applies and reads legacy mode $id", ({ id }) => {
        setTheme(id);
        expect(document.documentElement.dataset.theme).toBe(id === "system" ? "light" : id);
        expect(getThemeFromDom()).toBe(id);
    });
    for (const palette of listPalettes().filter(p => p.id !== "onedark")) {
        test.each(["light", "dark"] as ColorMode[])(`${palette.id} supports %s independent of OS`, mode => {
            applyAppearance({ palette: palette.id, mode }, mode === "light");
            expect(document.documentElement.dataset.theme).toBe(mode);
            expect(document.documentElement.dataset.palette).toBe(palette.id);
            expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
        });
    }
    test.each([false, true])("System resolves OS dark=%s without changing preference", prefersDark => {
        applyAppearance({ palette: "cobalt", mode: "system" }, prefersDark);
        expect(document.documentElement.dataset.theme).toBe(prefersDark ? "dark" : "light");
        expect(getThemeFromDom()).toBe("system");
    });
    test("One Dark remains dark and System leaves legacy mode", () => {
        applyAppearance({ palette: "onedark", mode: "light" }, false);
        expect(document.documentElement.dataset.theme).toBe("onedark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        setTheme("system"); expect(document.documentElement.dataset.palette).toBe("original");
        expect(getThemeFromDom()).toBe("system");
    });
    test.each(["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum", "unknown", "system"])("sanitizes invalid effective value %s", id => {
        document.documentElement.dataset.theme = id;
        expect(getThemeFromDom()).toBe("system");
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(document.documentElement.dataset.palette).toBe("original");
    });
    test.each(["system", "light", "dark"])("pre-paint script renders fixed dark for palette onedark with retained mode %s", mode => {
        localStorage.setItem("palette", JSON.stringify("onedark")); localStorage.setItem("theme", JSON.stringify(mode));
        new Function(THEME_INIT_SCRIPT)();
        expect(document.documentElement.dataset.palette).toBe("onedark");
        expect(document.documentElement.dataset.theme).toBe("onedark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        expect(localStorage.getItem("theme")).toBe(JSON.stringify(mode));
    });
    test("pre-paint script keeps supporting legacy theme onedark", () => {
        localStorage.setItem("theme", JSON.stringify("onedark"));
        new Function(THEME_INIT_SCRIPT)();
        expect(document.documentElement.dataset.theme).toBe("onedark");
        expect(document.documentElement.dataset.palette).toBe("onedark");
    });
    test("absent DOM theme resolves default System", () => expect(getThemeFromDom()).toBe("system"));
});
