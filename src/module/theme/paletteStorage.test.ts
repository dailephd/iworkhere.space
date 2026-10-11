// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { storage } from "@/lib/storage";
import { listPalettes } from "./paletteRegistry";
import { loadPalette, storePalette } from "./paletteStorage";
import { getPaletteFromDom, setPalette } from "./paletteRuntime.client";

beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-palette");
});

describe("palette storage and runtime", () => {
    it.each(listPalettes())("round-trips $id", ({ id }) => {
        storePalette(id);
        expect(loadPalette()).toBe(id);
        expect(localStorage.getItem("palette")).toBe(JSON.stringify(id));
        setPalette(id);
        expect(getPaletteFromDom()).toBe(id);
        expect(document.documentElement.getAttribute("data-palette")).toBe(id === "utility" ? null : id);
    });
    it("clears invalid storage and DOM values", () => {
        storage.set("palette", "unknown");
        expect(loadPalette()).toBeNull();
        expect(localStorage.getItem("palette")).toBeNull();
        document.documentElement.setAttribute("data-palette", "unknown");
        expect(getPaletteFromDom()).toBe("utility");
        expect(document.documentElement.hasAttribute("data-palette")).toBe(false);
    });
});
