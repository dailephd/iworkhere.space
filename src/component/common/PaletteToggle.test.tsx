/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaletteToggle } from "./PaletteToggle";

let host: HTMLDivElement;
let root: Root;

describe("PaletteToggle", () => {
    beforeEach(async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        localStorage.clear();
        document.documentElement.removeAttribute("data-palette");
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        await act(async () => root.render(createElement(PaletteToggle)));
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        localStorage.clear();
        document.documentElement.removeAttribute("data-palette");
        vi.restoreAllMocks();
    });
    it("exposes six source palettes plus original utility colors", async () => {
        const trigger = host.querySelector("button")!;
        expect(trigger.textContent).toBe("Palettes");
        await act(async () => trigger.click());
        const options = [...host.querySelectorAll('[role="listbox"][aria-label="Color palette"] [role="option"]')];
        expect(options).toHaveLength(7);
        expect(options.map(item => item.textContent)).toEqual([
            "Utility (original)", "Mineral Research", "Oxblood Atelier", "Signal Green",
            "Cobalt & Terracotta", "Amber & Graphite", "Violet & Graphite",
        ]);
    });
    it("persists and applies palette independently of active theme", async () => {
        document.documentElement.setAttribute("data-theme", "dark");
        const trigger = host.querySelector("button")!;
        await act(async () => trigger.click());
        const option = [...host.querySelectorAll('[role="option"]')].find(
            el => el.textContent === "Mineral Research",
        ) as HTMLButtonElement;
        await act(async () => option.click());
        expect(document.documentElement.getAttribute("data-palette")).toBe("mineral");
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        expect(localStorage.getItem("palette")).toBe(JSON.stringify("mineral"));
        await act(async () => trigger.click());
        expect(host.querySelector('[role="option"][aria-selected="true"]')?.textContent)
            .toBe("Mineral Research");
    });
});
