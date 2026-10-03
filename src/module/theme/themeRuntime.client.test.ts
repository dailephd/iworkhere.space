// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { setTheme, getThemeFromDom } from "./themeRuntime.client";
import { listThemes } from "./themeRegistry";

beforeEach(() => document.documentElement.removeAttribute("data-theme"));
describe("theme runtime", () => {
    test.each(listThemes())("applies and reads $id", ({ id }) => {
        setTheme(id);
        expect(document.documentElement.getAttribute("data-theme")).toBe(id === "system" ? null : id);
        expect(getThemeFromDom()).toBe(id);
    });
    test("System clears an explicit theme", () => {
        setTheme("onedark");
        setTheme("system");
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });
    test.each(["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum", "unknown", "system"])("clears invalid explicit DOM value %s", id => {
        document.documentElement.setAttribute("data-theme", id);
        expect(getThemeFromDom()).toBe("system");
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });
    test("absent DOM theme is System", () => expect(getThemeFromDom()).toBe("system"));
});
