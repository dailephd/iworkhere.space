// @vitest-environment jsdom

import { describe, test, expect, beforeEach } from "vitest";
import { setTheme, getThemeFromDom } from "./themeRuntime.client";

beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
});

describe("setTheme", () => {
    test("sets data-theme to 'light'", () => {
        setTheme("light");
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    test("sets data-theme to 'dark'", () => {
        setTheme("dark");
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    test("sets data-theme to 'onedark'", () => {
        setTheme("onedark");
        expect(document.documentElement.getAttribute("data-theme")).toBe("onedark");
    });

    test("sets data-theme to 'vscode-modern'", () => {
        setTheme("vscode-modern");
        expect(document.documentElement.getAttribute("data-theme")).toBe("vscode-modern");
    });

    test("sets data-theme to 'dracula'", () => {
        setTheme("dracula");
        expect(document.documentElement.getAttribute("data-theme")).toBe("dracula");
    });

    test("sets data-theme to 'amethyst-haze'", () => {
        setTheme("amethyst-haze");
        expect(document.documentElement.getAttribute("data-theme")).toBe("amethyst-haze");
    });

    test("sets data-theme to 'mercury-fog'", () => {
        setTheme("mercury-fog");
        expect(document.documentElement.getAttribute("data-theme")).toBe("mercury-fog");
    });

    test("removes data-theme attribute when theme is 'system'", () => {
        document.documentElement.setAttribute("data-theme", "dark");
        setTheme("system");
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });

    test("removing data-theme for system works even when no attribute was set", () => {
        setTheme("system");
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });
});

describe("getThemeFromDom", () => {
    test("returns 'system' when no data-theme attribute is present", () => {
        expect(getThemeFromDom()).toBe("system");
    });

    test("returns 'light' when data-theme is 'light'", () => {
        document.documentElement.setAttribute("data-theme", "light");
        expect(getThemeFromDom()).toBe("light");
    });

    test("returns 'dark' when data-theme is 'dark'", () => {
        document.documentElement.setAttribute("data-theme", "dark");
        expect(getThemeFromDom()).toBe("dark");
    });

    test("returns 'onedark' when data-theme is 'onedark'", () => {
        document.documentElement.setAttribute("data-theme", "onedark");
        expect(getThemeFromDom()).toBe("onedark");
    });

    test("returns 'vscode-modern' when data-theme is 'vscode-modern'", () => {
        document.documentElement.setAttribute("data-theme", "vscode-modern");
        expect(getThemeFromDom()).toBe("vscode-modern");
    });

    test("returns 'dracula' when data-theme is 'dracula'", () => {
        document.documentElement.setAttribute("data-theme", "dracula");
        expect(getThemeFromDom()).toBe("dracula");
    });

    test("returns 'amethyst-haze' when data-theme is 'amethyst-haze'", () => {
        document.documentElement.setAttribute("data-theme", "amethyst-haze");
        expect(getThemeFromDom()).toBe("amethyst-haze");
    });

    test("returns 'mercury-fog' when data-theme is 'mercury-fog'", () => {
        document.documentElement.setAttribute("data-theme", "mercury-fog");
        expect(getThemeFromDom()).toBe("mercury-fog");
    });

    test("returns 'system' for an unrecognized data-theme value", () => {
        document.documentElement.setAttribute("data-theme", "unknown-theme");
        expect(getThemeFromDom()).toBe("system");
    });
});
