// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { loadTheme, storeTheme, loadAppearance, storeAppearance } from "./themeStorage";
import { listThemes, listPalettes } from "./themeRegistry";
import { storage } from "@/lib/storage";

beforeEach(() => localStorage.clear());
describe("theme storage", () => {
    test.each(listThemes())("persists and loads $id", ({ id }) => {
        storeTheme(id);
        expect(loadTheme()).toBe(id);
        expect(localStorage.getItem("theme")).toBe(JSON.stringify(id));
    });
    test.each(["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum", "unknown", 42])("removes invalid stored value %s", id => {
        storage.set("theme", id);
        expect(loadTheme()).toBeNull();
        expect(localStorage.getItem("theme")).toBeNull();
    });
    test("clears malformed JSON", () => {
        localStorage.setItem("theme", "{");
        expect(loadTheme()).toBeNull();
        expect(localStorage.getItem("theme")).toBeNull();
    });
    test("absent storage allows System fallback", () => expect(loadTheme()).toBeNull());
});

describe("appearance storage", () => {
    test.each(listPalettes())("persists palette $id through the adapter", ({ id }) => {
        storeAppearance({ palette: id, mode: "dark" });
        expect(loadAppearance()).toEqual({ palette: id, mode: "dark" });
        expect(localStorage.getItem("palette")).toBe(JSON.stringify(id));
    });
    test("defaults to Violet & Graphite and System", () => expect(loadAppearance()).toEqual({ palette: "original", mode: "system" }));
    test("preserves the existing One Dark preference", () => {
        storeTheme("onedark"); expect(loadAppearance()).toEqual({ palette: "onedark", mode: "dark" });
    });
    test.each(["system", "light", "dark"] as const)("One Dark keeps the retained ordinary mode %s in storage and on load", mode => {
        storeAppearance({ palette: "oxblood", mode });
        storeAppearance({ palette: "onedark", mode });
        expect(localStorage.getItem("palette")).toBe(JSON.stringify("onedark"));
        expect(localStorage.getItem("theme")).toBe(JSON.stringify(mode));
        expect(loadAppearance()).toEqual({ palette: "onedark", mode });
        storeAppearance({ palette: "cobalt", mode: loadAppearance().mode });
        expect(loadAppearance()).toEqual({ palette: "cobalt", mode });
    });
    test("legacy theme onedark with an ordinary or absent palette loads One Dark with the conservative dark mode", () => {
        storeTheme("onedark"); storage.set("palette", "amber");
        expect(loadAppearance()).toEqual({ palette: "onedark", mode: "dark" });
    });
    test("palette onedark without a usable mode falls back to dark", () => {
        storage.set("palette", "onedark");
        expect(loadAppearance()).toEqual({ palette: "onedark", mode: "dark" });
        storage.set("theme", 42);
        expect(loadAppearance()).toEqual({ palette: "onedark", mode: "dark" });
        expect(localStorage.getItem("theme")).toBeNull();
    });
    test("invalid palette does not discard a valid mode", () => {
        storage.set("palette", "unknown"); storeTheme("dark");
        expect(loadAppearance()).toEqual({ palette: "original", mode: "dark" });
        expect(localStorage.getItem("palette")).toBeNull();
    });
    test("invalid mode does not discard a valid palette", () => {
        storage.set("theme", 42); storage.set("palette", "oxblood");
        expect(loadAppearance()).toEqual({ palette: "oxblood", mode: "system" });
    });
});
