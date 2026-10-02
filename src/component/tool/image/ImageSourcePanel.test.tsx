/** @vitest-environment jsdom */
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ImageSourcePanel } from "./ImageSourcePanel";

afterEach(() => vi.unstubAllGlobals());
it("presents caller-supplied source information and forwards the input ref/event", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div"), root = createRoot(host), inputRef = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    await act(async () => root.render(createElement(ImageSourcePanel, {
        titleId: "source-test", inputRef, onChange, selecting: true,
        source: { name: "local.png", width: 240, height: 180, formattedBytes: "10 KiB", formatLabel: "PNG", previewUrl: "blob:local" },
    })));
    expect(host.querySelector("section")?.getAttribute("aria-labelledby")).toBe("source-test");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Reading image…");
    expect(host.textContent).toContain("Source: 240 × 180 px · 10 KiB · PNG");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("blob:local");
    expect(host.querySelector("img")?.getAttribute("alt")).toBe("Selected source image preview");
    expect(inputRef.current?.accept).toBe("image/jpeg,image/png,image/webp");
    await act(async () => inputRef.current!.dispatchEvent(new Event("change", { bubbles: true })));
    expect(onChange).toHaveBeenCalledOnce();
    await act(async () => root.render(createElement(ImageSourcePanel, { titleId: "source-test", inputRef, onChange, selecting: false, source: null })));
    expect(host.querySelector("img")).toBeNull(); expect(host.querySelector('[role="status"]')).toBeNull();
    expect(inputRef.current).toBe(host.querySelector("input"));
    await act(async () => root.unmount());
});

it("can omit its inline preview while retaining source presentation", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div"), root = createRoot(host), inputRef = createRef<HTMLInputElement>();
    await act(async () => root.render(createElement(ImageSourcePanel, {
        titleId: "source-test", inputRef, onChange: vi.fn(), selecting: false, showPreview: false,
        source: { name: "local.png", width: 240, height: 180, formattedBytes: "10 KiB", formatLabel: "PNG", previewUrl: "blob:local" },
    })));
    expect(host.textContent).toContain("local.png");
    expect(host.querySelector("img")).toBeNull();
    await act(async () => root.unmount());
});
