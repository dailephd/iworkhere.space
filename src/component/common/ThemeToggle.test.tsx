/** @vitest-environment jsdom */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listThemes } from "@/module/theme/themeRegistry";
import { ThemeToggle } from "./ThemeToggle";
import { ThemeProvider } from "./ThemeProvider";

let host: HTMLDivElement;
let root: Root;

describe("ThemeToggle", () => {
    beforeEach(async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        await act(async () => root.render(createElement(ThemeToggle)));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
        vi.restoreAllMocks();
    });

    it("uses the compact Themes trigger and presents every canonical choice", async () => {
        const trigger = host.querySelector("button")!;
        expect(trigger.textContent?.trim()).toBe("Themes");
        expect(trigger.querySelector("svg")).toBeNull();
        await act(async () => trigger.click());
        const options = [...host.querySelectorAll('[role="option"]')];
        expect(options).toHaveLength(4);
        expect(options.every(option => option.tagName === "BUTTON")).toBe(true);
        expect(options.filter(option => option.getAttribute("aria-selected") === "true")).toHaveLength(1);
        expect(options.map((option) => option.textContent?.trim())).toEqual(
            listThemes().map((theme) => theme.label),
        );
    });

    it("provider clears retired storage and stale DOM while selecting System", async () => {
        await act(async () => root.unmount());
        localStorage.setItem("theme", JSON.stringify("dracula"));
        document.documentElement.setAttribute("data-theme", "dracula");
        root = createRoot(host);
        await act(async () => root.render(<ThemeProvider><ThemeToggle /></ThemeProvider>));
        expect(localStorage.getItem("theme")).toBeNull();
        expect(document.documentElement.getAttribute("data-theme")).toBeNull();
        await act(async () => host.querySelector("button")!.click());
        const selected = host.querySelector('[aria-selected="true"]');
        expect(selected?.textContent?.trim()).toBe("System");
    });

    it("applies and persists every registry theme through the existing runtime", async () => {
        const trigger = host.querySelector("button")!;
        for (const theme of listThemes()) {
            await act(async () => trigger.click());
            const option = [...host.querySelectorAll('[role="option"]')].find(
                (candidate) => candidate.textContent?.trim() === theme.label,
            );
            expect(option).toBeDefined();
            await act(async () => (option as HTMLButtonElement).click());
            expect(localStorage.getItem("theme")).toBe(JSON.stringify(theme.id));
            expect(document.documentElement.getAttribute("data-theme")).toBe(
                theme.id === "system" ? null : theme.id,
            );
        }
    });
});
