/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listPalettes } from "@/module/theme/themeRegistry";
import { ThemeToggle } from "./ThemeToggle";
import { ThemeProvider } from "./ThemeProvider";

let host: HTMLDivElement;
let root: Root;
async function render() { await act(async () => root.render(<ThemeProvider><ThemeToggle /></ThemeProvider>)); }
async function open() { await act(async () => host.querySelector("button")!.click()); }
async function choose(value: string) { await act(async () => host.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click()); }

describe("ThemeToggle", () => {
    beforeEach(async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
        host = document.createElement("div"); document.body.append(host);
        root = createRoot(host); await render();
    });
    afterEach(async () => {
        await act(async () => root.unmount()); host.remove(); localStorage.clear();
        for (const name of ["data-theme", "data-palette", "data-theme-preference"]) document.documentElement.removeAttribute(name);
        document.documentElement.classList.remove("dark"); vi.restoreAllMocks();
    });
    it("keeps the compact trigger and exposes seven palettes and three native modes", async () => {
        expect(host.querySelector("button")!.textContent?.trim()).toBe("Themes");
        await open();
        expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Appearance settings");
        expect([...host.querySelectorAll("fieldset")].map(field => field.querySelector("legend")?.textContent)).toEqual(["Palette", "Color mode"]);
        expect([...host.querySelectorAll("fieldset:first-of-type label")].map(label => label.textContent)).toEqual(listPalettes().map(palette => palette.label + (palette.id === "original" ? "Default" : "")));
        expect(host.querySelectorAll('input[type="radio"]')).toHaveLength(10);
        expect(host.querySelectorAll("input:checked")).toHaveLength(2);
        expect(host.querySelector<HTMLInputElement>('input[value="original"]')!.checked).toBe(true);
        expect(host.querySelector<HTMLInputElement>('input[value="system"]')!.checked).toBe(true);
    });
    it("shows an aria-hidden hero, section and action swatch for every palette and marks only the original as Default", async () => {
        await open();
        for (const palette of listPalettes()) {
            const swatch = host.querySelector(`[data-palette-swatch="${palette.id}"]`)!;
            expect(swatch.getAttribute("aria-hidden")).toBe("true");
            expect([...swatch.querySelectorAll("[data-swatch-part]")].map(part => part.getAttribute("data-swatch-part"))).toEqual(["hero", "section", "action"]);
        }
        expect(host.querySelectorAll("fieldset:first-of-type label")).toHaveLength(7);
        const original = host.querySelector<HTMLInputElement>('input[value="original"]')!;
        expect(document.getElementById(original.getAttribute("aria-describedby")!)?.textContent).toBe("Default");
        expect(host.querySelectorAll('input[type="radio"][aria-describedby]')).toHaveLength(1);
    });
    it("explains One Dark, disables the mode radios and restores the stored mode when leaving it", async () => {
        await open(); await choose("light");
        expect(host.textContent).not.toContain("fixed dark appearance");
        await choose("onedark");
        expect(localStorage.getItem("theme")).toBe(JSON.stringify("light"));
        expect(localStorage.getItem("palette")).toBe(JSON.stringify("onedark"));
        expect(host.textContent).toContain("One Dark uses a fixed dark appearance; color mode does not apply.");
        for (const mode of ["system", "light", "dark"]) expect(host.querySelector<HTMLInputElement>(`input[value="${mode}"]`)!.disabled).toBe(true);
        await choose("mineral");
        expect(host.textContent).not.toContain("fixed dark appearance");
        expect(host.querySelector<HTMLInputElement>('input[value="light"]')!.checked).toBe(true);
        expect(host.querySelector<HTMLInputElement>('input[value="light"]')!.disabled).toBe(false);
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(localStorage.getItem("theme")).toBe(JSON.stringify("light"));
    });
    it("clears retired storage while preserving an independently valid palette", async () => {
        await act(async () => root.unmount());
        localStorage.setItem("theme", JSON.stringify("dracula")); localStorage.setItem("palette", JSON.stringify("cobalt"));
        root = createRoot(host); await render(); await open();
        expect(localStorage.getItem("theme")).toBeNull();
        expect(document.documentElement.dataset.palette).toBe("cobalt");
        expect(host.querySelector<HTMLInputElement>('input[value="system"]')!.checked).toBe(true);
    });
    it("applies and persists all palettes without closing the controls", async () => {
        await open(); await choose("cobalt");
        for (const palette of listPalettes()) {
            await choose(palette.id);
            expect(localStorage.getItem("palette")).toBe(JSON.stringify(palette.id));
            expect(document.documentElement.dataset.palette).toBe(palette.id);
            expect(host.querySelector('[role="dialog"]')).not.toBeNull();
        }
        expect(host.querySelector<HTMLInputElement>('input[value="light"]')!.matches(":disabled")).toBe(true);
        expect(host.querySelector<HTMLFieldSetElement>("fieldset:last-of-type")!.disabled).toBe(true);
        await choose("mineral"); await choose("light");
        expect(localStorage.getItem("theme")).toBe(JSON.stringify("light"));
        expect(document.documentElement.dataset.theme).toBe("light");
    });
    it("still changes appearance when persistence is blocked", async () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
        await open(); await choose("amber"); await choose("dark");
        expect(document.documentElement.dataset.palette).toBe("amber");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(host.querySelector<HTMLInputElement>('input[value="amber"]')!.checked).toBe(true);
    });
    it("focuses the selected palette and returns focus after Escape", async () => {
        await open(); expect(document.activeElement).toBe(host.querySelector('input[value="original"]'));
        await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
        expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(host.querySelector("button"));
    });
});
