// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { loadTheme, storeTheme } from "./themeStorage";
import { listThemes } from "./themeRegistry";
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
