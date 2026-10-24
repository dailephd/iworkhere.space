/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";
import { FooterViewportControl } from "./FooterViewportControl";

let host: HTMLDivElement;
let root: Root;
let resizeCallback: (() => void) | undefined;
let resizeDisconnect = vi.fn<() => void>();
let footerHeight = 56;

function Page() {
    return <FooterViewportControl><Footer action={<button type="button">Report Issues — report a problem or suggestion</button>} /></FooterViewportControl>;
}

async function render() { await act(async () => root.render(<Page />)); }
const footer = () => host.querySelector("footer")!;
const documentRoot = () => document.documentElement;
async function resize() { await act(async () => resizeCallback!()); }

describe("FooterViewportControl", () => {
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        localStorage.clear();
        documentRoot().setAttribute("data-footer", "collapsed");
        documentRoot().style.removeProperty("--footer-clearance");
        resizeCallback = undefined;
        resizeDisconnect = vi.fn<() => void>();
        footerHeight = 56;
        const measure = HTMLElement.prototype.getBoundingClientRect;
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            return this.matches("footer") ? ({ height: footerHeight }) as DOMRect : measure.call(this);
        });
        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: () => void) { resizeCallback = callback; }
            observe() {}
            disconnect() { resizeDisconnect(); }
        });
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        localStorage.clear();
        documentRoot().removeAttribute("data-footer");
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("always renders one visible footer and ignores stored or document collapse state", async () => {
        localStorage.setItem("footer-preference", JSON.stringify("collapsed"));
        await render();
        expect(host.querySelectorAll("footer")).toHaveLength(1);
        expect(footer().textContent).toContain("© 2026 iworkhere.space created by dailephd LLC");
        expect(footer().querySelector('a[href="/contact"]')).not.toBeNull();
        expect(footer().querySelector('a[href="/privacy"]')).not.toBeNull();
        expect(footer().querySelectorAll("button")).toHaveLength(1);
        expect(footer().textContent).toContain("Report Issues — report a problem or suggestion");
        expect(footer().querySelector('[data-footer-toggle], [aria-expanded], [aria-controls]')).toBeNull();
        expect(footer().querySelector('[data-footer-when], [data-footer-detail]')).toBeNull();
        expect(documentRoot().getAttribute("data-footer")).toBe("collapsed");
        expect(Object.keys(localStorage)).toEqual(["footer-preference"]);
    });

    it("keeps invalid or blocked browser storage irrelevant", async () => {
        localStorage.setItem("footer-preference", "not json{");
        const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
        await render();
        expect(footer().querySelector('a[href="/contact"]')).not.toBeNull();
        expect(footer().querySelector('a[href="/privacy"]')).not.toBeNull();
        expect(getItem).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        expect(footer().textContent).toContain("© 2026 iworkhere.space created by dailephd LLC");
    });

    it("renders readable links in the no-script flow fallback", () => {
        const html = renderToStaticMarkup(<Page />);
        expect(html.match(/<footer\b/g)).toHaveLength(1);
        expect(html).toContain("<noscript><style>");
        expect(html).toContain("position:static!important");
        expect(html).toContain('href="/contact"');
        expect(html).toContain('href="/privacy"');
        expect(html).not.toContain("footer-toggle");
        expect(html).not.toContain("Hide footer");
        expect(html).not.toContain("Show footer");
        expect(html).not.toContain("aria-controls");
    });

    it("publishes measured footer clearance and keeps an end-of-page reader at the end", async () => {
        const scrollTo = vi.fn();
        vi.stubGlobal("scrollTo", scrollTo);
        Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
        const metrics = { scrollTop: 1000 };
        Object.defineProperty(documentRoot(), "scrollTop", { get: () => metrics.scrollTop, configurable: true });
        Object.defineProperty(documentRoot(), "scrollHeight", { get: () => 1644 + (parseFloat(documentRoot().style.getPropertyValue("--footer-clearance")) || 0), configurable: true });
        try {
            await render();
            footer().getBoundingClientRect = () => ({ height: footerHeight }) as DOMRect;
            await resize();
            expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("56px");
            footerHeight = 112;
            await resize();
            expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("112px");
            expect(scrollTo).toHaveBeenCalledWith({ top: 1056, behavior: "instant" });
            scrollTo.mockClear();
            metrics.scrollTop = 400;
            footerHeight = 56;
            await resize();
            expect(scrollTo).not.toHaveBeenCalled();
        } finally {
            delete (documentRoot() as unknown as Record<string, unknown>).scrollTop;
            delete (documentRoot() as unknown as Record<string, unknown>).scrollHeight;
            Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
        }
    });

    it("follows a shortened visual viewport and keeps the fixed footer above the keyboard", async () => {
        Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
        const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
        Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
        await render();
        viewport.height = 500;
        await act(async () => viewport.dispatchEvent(new Event("resize")));
        expect(footer().style.transform).toBe("translateY(-300px)");
        viewport.height = 800;
        await act(async () => viewport.dispatchEvent(new Event("resize")));
        expect(footer().style.transform).toBe("");
        delete (window as unknown as Record<string, unknown>).visualViewport;
        Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    });

    it("scrolls a focused field above the footer when the software keyboard shortens the viewport", async () => {
        Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
        const viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 0, scale: 1 });
        Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
        const scrollBy = vi.fn();
        vi.stubGlobal("scrollBy", scrollBy);
        await render();
        footer().getBoundingClientRect = () => ({ top: 444, bottom: 500, height: 56 }) as DOMRect;
        const field = document.createElement("input");
        host.append(field);
        field.getBoundingClientRect = () => ({ top: 460, bottom: 520, height: 60 }) as DOMRect;
        await act(async () => field.focus());
        expect(scrollBy).toHaveBeenCalledWith({ top: 76, behavior: "instant" });
        delete (window as unknown as Record<string, unknown>).visualViewport;
        Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    });

    it("disconnects its resize observer and removes clearance on unmount", async () => {
        await render();
        await resize();
        await act(async () => root.unmount());
        expect(resizeDisconnect).toHaveBeenCalledTimes(1);
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("");
        root = createRoot(host);
    });
});
