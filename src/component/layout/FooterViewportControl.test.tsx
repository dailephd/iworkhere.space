/** @vitest-environment jsdom */
import React, { act } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";
import { FooterViewportControl } from "./FooterViewportControl";
import { FOOTER_INIT_SCRIPT, FOOTER_PREFERENCE_KEY } from "./footerPreference";

let host: HTMLDivElement;
let root: Root;
let resizeCallback: (() => void) | undefined;
let resizeDisconnect = vi.fn<() => void>();
let footerHeight = 56;

function Page() {
    return (
        <FooterViewportControl>
            <Footer action={<button type="button">Report a problem or suggestion</button>} />
        </FooterViewportControl>
    );
}

async function render() { await act(async () => root.render(<Page />)); }
const toggle = () => host.querySelector<HTMLButtonElement>("[data-footer-toggle]")!;
const footer = () => host.querySelector("footer")!;
const documentRoot = () => document.documentElement;
const reportAction = () => [...host.querySelectorAll("button")].find(button => button.textContent === "Report a problem or suggestion")!;
async function resize() { await act(async () => resizeCallback!()); }

describe("FooterViewportControl", () => {
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        localStorage.clear();
        documentRoot().removeAttribute("data-footer");
        documentRoot().style.removeProperty("--footer-clearance");
        resizeCallback = undefined;
        resizeDisconnect = vi.fn<() => void>();
        footerHeight = 56;
        // jsdom has no layout: the footer reports the scripted height from the moment it mounts, as a browser measures it.
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

    it("is expanded for a fresh visitor and exposes one footer with the existing content", async () => {
        await render();
        expect(host.querySelectorAll("footer")).toHaveLength(1);
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        expect(documentRoot().getAttribute("data-footer")).toBeNull();
        expect(footer().textContent).toContain("© 2026 iworkhere.space created by dailephd LLC");
        expect(footer().querySelector('a[href="/privacy"]')!.textContent).toBe("Privacy Policy");
        expect(host.querySelector('[data-footer-when="expanded"]')!.hasAttribute("hidden")).toBe(false);
        expect(host.querySelector('[data-footer-when="collapsed"]')!.hasAttribute("hidden")).toBe(true);
    });

    it("adopts a saved collapsed preference", async () => {
        localStorage.setItem(FOOTER_PREFERENCE_KEY, JSON.stringify("collapsed"));
        await render();
        expect(documentRoot().getAttribute("data-footer")).toBe("collapsed");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        expect(host.querySelector('[data-footer-when="collapsed"]')!.hasAttribute("hidden")).toBe(false);
    });

    it("keeps a saved expanded preference", async () => {
        localStorage.setItem(FOOTER_PREFERENCE_KEY, JSON.stringify("expanded"));
        await render();
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        expect(documentRoot().getAttribute("data-footer")).toBeNull();
    });

    it.each(["garbage", "", "Collapsed", "1", "{\"state\":\"collapsed\"}", "not json{"])("falls back to expanded for the invalid stored value %j", async (stored) => {
        localStorage.setItem(FOOTER_PREFERENCE_KEY, stored);
        await render();
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        expect(documentRoot().getAttribute("data-footer")).not.toBe("collapsed");
    });

    it("starts collapsed when the pre-paint script already marked the document", async () => {
        documentRoot().setAttribute("data-footer", "collapsed");
        await render();
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
    });

    it("pre-paint script collapses only for the exact saved value and tolerates unreadable storage", () => {
        const run = () => new Function(FOOTER_INIT_SCRIPT)();
        localStorage.setItem(FOOTER_PREFERENCE_KEY, JSON.stringify("expanded"));
        run();
        expect(documentRoot().getAttribute("data-footer")).toBeNull();
        localStorage.setItem(FOOTER_PREFERENCE_KEY, "nonsense{");
        run();
        expect(documentRoot().getAttribute("data-footer")).toBeNull();
        localStorage.setItem(FOOTER_PREFERENCE_KEY, JSON.stringify("collapsed"));
        run();
        expect(documentRoot().getAttribute("data-footer")).toBe("collapsed");
        documentRoot().removeAttribute("data-footer");
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
        expect(run).not.toThrow();
        expect(documentRoot().getAttribute("data-footer")).toBeNull();
    });

    it("stays usable for the session when browser storage is unavailable", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
        await render();
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        await act(async () => toggle().click());
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        await act(async () => toggle().click());
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
    });

    it("collapses and expands and persists each change", async () => {
        await render();
        await act(async () => toggle().click());
        expect(documentRoot().getAttribute("data-footer")).toBe("collapsed");
        expect(JSON.parse(localStorage.getItem(FOOTER_PREFERENCE_KEY)!)).toBe("collapsed");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        await act(async () => toggle().click());
        expect(documentRoot().getAttribute("data-footer")).toBe("expanded");
        expect(JSON.parse(localStorage.getItem(FOOTER_PREFERENCE_KEY)!)).toBe("expanded");
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
    });

    it("stores only the footer preference", async () => {
        await render();
        await act(async () => toggle().click());
        expect(Object.keys(localStorage)).toEqual([FOOTER_PREFERENCE_KEY]);
    });

    it("never navigates and never scrolls the page when toggled", async () => {
        const scroll = vi.fn();
        vi.stubGlobal("scrollTo", scroll);
        const before = window.location.href;
        await render();
        await act(async () => toggle().click());
        await act(async () => toggle().click());
        expect(window.location.href).toBe(before);
        expect(scroll).not.toHaveBeenCalled();
    });

    it("keeps the reporting action outside the content hidden by the collapsed state", async () => {
        await render();
        await act(async () => toggle().click());
        expect(reportAction()).toBeDefined();
        expect(reportAction().closest("[data-footer-detail]")).toBeNull();
        expect(host.querySelectorAll("button")).toHaveLength(2);
    });

    it("hides only the copyright and the privacy link when collapsed, so privacy returns on expansion", async () => {
        await render();
        const detail = [...host.querySelectorAll("[data-footer-detail]")].map(element => element.textContent);
        expect(detail).toEqual(["© 2026 iworkhere.space created by dailephd LLC", "Privacy Policy"]);
        const css = readFileSync(path.resolve(__dirname, "../../app/global.css"), "utf8");
        expect(css).toContain(':root[data-footer="collapsed"] [data-footer-detail] { display: none; }');
        await act(async () => toggle().click());
        await act(async () => toggle().click());
        expect(host.querySelector('a[href="/privacy"]')).not.toBeNull();
    });

    it("points aria-controls at the element that contains the footer content", async () => {
        await render();
        const controlled = document.getElementById(toggle().getAttribute("aria-controls")!)!;
        expect(controlled).not.toBeNull();
        expect(controlled.contains(host.querySelector('a[href="/privacy"]'))).toBe(true);
        expect(footer().contains(controlled)).toBe(true);
    });

    it("moves focus to the visible toggle when collapsing would hide the focused control", async () => {
        await render();
        host.querySelector<HTMLAnchorElement>('a[href="/privacy"]')!.focus();
        expect(document.activeElement?.textContent).toBe("Privacy Policy");
        await act(async () => toggle().click());
        expect(document.activeElement).toBe(toggle());
    });

    it("leaves focus on the reporting action when collapsing", async () => {
        await render();
        reportAction().focus();
        await act(async () => toggle().click());
        expect(document.activeElement).toBe(reportAction());
    });

    it("renders one footer on the server, expanded, with a no-script fallback that keeps the page readable", () => {
        const html = renderToStaticMarkup(<Page />);
        expect(html.match(/<footer\b/g)).toHaveLength(1);
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain("<noscript><style>");
        expect(html).toContain("position:static!important");
        expect(html).toContain('href="/privacy"');
    });

    it("publishes the footer's measured height as the one shell clearance value and follows changes", async () => {
        const setProperty = vi.spyOn(documentRoot().style, "setProperty");
        await render();
        footer().getBoundingClientRect = () => ({ height: footerHeight }) as DOMRect;
        await resize();
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("56px");
        footerHeight = 112;
        await resize();
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("112px");
        await resize();
        expect(setProperty).toHaveBeenCalledTimes(2);
    });

    it("publishes the new clearance in the toggle's own commit, without waiting for the observer", async () => {
        vi.stubGlobal("scrollTo", vi.fn());
        await render();
        footer().getBoundingClientRect = () => ({ height: footerHeight }) as DOMRect;
        await resize();
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("56px");

        // The collapsed tab is shorter; no observer callback is delivered between the click and the assertion.
        footerHeight = 36;
        await act(async () => toggle().click());
        expect(documentRoot().getAttribute("data-footer")).toBe("collapsed");
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("36px");

        footerHeight = 56;
        await act(async () => toggle().click());
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("56px");

        // The observer that follows finds nothing left to publish.
        const setProperty = vi.spyOn(documentRoot().style, "setProperty");
        await resize();
        expect(setProperty).not.toHaveBeenCalled();
    });

    it("keeps a reader parked at the end at the end in the same commit as the toggle, and leaves a mid-page reader alone", async () => {
        const scrollTo = vi.fn();
        vi.stubGlobal("scrollTo", scrollTo);
        Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
        const metrics = { scrollTop: 1000 };
        Object.defineProperty(documentRoot(), "scrollTop", { get: () => metrics.scrollTop, configurable: true });
        // The document height is the content plus the published clearance, as with the real spacer.
        Object.defineProperty(documentRoot(), "scrollHeight", { get: () => 1644 + (parseFloat(documentRoot().style.getPropertyValue("--footer-clearance")) || 0), configurable: true });
        try {
            await render();
            footer().getBoundingClientRect = () => ({ height: footerHeight }) as DOMRect;
            await resize();
            expect(scrollTo).not.toHaveBeenCalled();

            // At the end of the document (1000 + 700 = 1700 = 1644 + 56): a taller footer keeps the reader at the new end.
            footerHeight = 112;
            await act(async () => toggle().click());
            expect(scrollTo).toHaveBeenCalledWith({ top: 1056, behavior: "instant" });

            scrollTo.mockClear();
            metrics.scrollTop = 400;
            footerHeight = 56;
            await act(async () => toggle().click());
            expect(scrollTo).not.toHaveBeenCalled();
        } finally {
            delete (documentRoot() as unknown as Record<string, unknown>).scrollTop;
            delete (documentRoot() as unknown as Record<string, unknown>).scrollHeight;
            Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
        }
    });

    it("disconnects the observer and removes the clearance on unmount", async () => {
        await render();
        footer().getBoundingClientRect = () => ({ height: 56 }) as DOMRect;
        await resize();
        await act(async () => root.unmount());
        expect(resizeDisconnect).toHaveBeenCalledTimes(1);
        expect(documentRoot().style.getPropertyValue("--footer-clearance")).toBe("");
        root = createRoot(host);
    });

    it("uses a layer below the open report dialog and the header overlay", async () => {
        await render();
        expect(footer().className).toContain("z-30");
        expect(footer().className).toContain("fixed");
    });
    it("keeps a reader parked at the end of the page at the end when the footer height changes, and leaves a mid-page reader alone", async () => {
        const scrollTo = vi.fn();
        vi.stubGlobal("scrollTo", scrollTo);
        Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
        const metrics = { scrollTop: 1000 };
        Object.defineProperty(documentRoot(), "scrollTop", { get: () => metrics.scrollTop, configurable: true });
        // The document height is the content plus the published clearance, as with the real spacer.
        Object.defineProperty(documentRoot(), "scrollHeight", { get: () => 1644 + (parseFloat(documentRoot().style.getPropertyValue("--footer-clearance")) || 0), configurable: true });
        try {
            await render();
            footer().getBoundingClientRect = () => ({ height: 56 }) as DOMRect;
            await resize();
            // The first measurement only publishes the clearance.
            expect(scrollTo).not.toHaveBeenCalled();

            // At the end of the document (1000 + 700 = 1700): the new height keeps the reader at the new end.
            footerHeight = 112;
            footer().getBoundingClientRect = () => ({ height: footerHeight }) as DOMRect;
            await resize();
            expect(scrollTo).toHaveBeenCalledWith({ top: 1056, behavior: "instant" });

            // Mid-page: the scroll position is not touched.
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

    describe("visual viewport", () => {
        let viewport: EventTarget & { height: number; offsetTop: number; scale: number };
        function changeViewport(next: Partial<{ height: number; offsetTop: number; scale: number }>) {
            Object.assign(viewport, next);
            viewport.dispatchEvent(new Event("resize"));
        }

        beforeEach(() => {
            Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
            viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
            Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
            vi.stubGlobal("scrollBy", vi.fn());
        });
        afterEach(() => {
            delete (window as unknown as Record<string, unknown>).visualViewport;
            Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
        });

        it("raises the footer by the part of the layout viewport the keyboard hides, and restores it afterwards", async () => {
            await render();
            expect(footer().style.transform).toBe("");
            await act(async () => changeViewport({ height: 500 }));
            expect(footer().style.transform).toBe("translateY(-300px)");
            // A panned visual viewport that again reaches the layout bottom needs no offset.
            await act(async () => changeViewport({ height: 500, offsetTop: 300 }));
            expect(footer().style.transform).toBe("");
            await act(async () => changeViewport({ height: 800, offsetTop: 0 }));
            expect(footer().style.transform).toBe("");
        });

        it("treats a pinch-zoomed viewport as no keyboard", async () => {
            await render();
            await act(async () => changeViewport({ height: 400, scale: 2 }));
            expect(footer().style.transform).toBe("");
        });

        it("scrolls a focused field that the raised footer covers back above it, and ignores buttons", async () => {
            await render();
            const field = document.createElement("input");
            const button = document.createElement("button");
            host.append(field, button);
            footer().getBoundingClientRect = () => ({ top: 450 }) as DOMRect;
            field.getBoundingClientRect = () => ({ top: 400, bottom: 480 }) as DOMRect;
            await act(async () => field.focus());
            expect(window.scrollBy).toHaveBeenCalledWith({ top: 30, behavior: "instant" });

            vi.mocked(window.scrollBy).mockClear();
            button.getBoundingClientRect = () => ({ top: 400, bottom: 480 }) as DOMRect;
            await act(async () => button.focus());
            expect(window.scrollBy).not.toHaveBeenCalled();
        });

        it("never scrolls a tall field's top out of the visible area", async () => {
            await render();
            const field = document.createElement("textarea");
            host.append(field);
            viewport.offsetTop = 100;
            footer().getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
            field.getBoundingClientRect = () => ({ top: 120, bottom: 600 }) as DOMRect;
            await act(async () => field.focus());
            expect(window.scrollBy).toHaveBeenCalledWith({ top: 20, behavior: "instant" });
        });

        it("leaves the page alone when the overlapped field is inside a dialog", async () => {
            await render();
            const dialog = document.createElement("dialog");
            const field = document.createElement("input");
            dialog.append(field);
            host.append(dialog);
            footer().getBoundingClientRect = () => ({ top: 450 }) as DOMRect;
            field.getBoundingClientRect = () => ({ top: 400, bottom: 480 }) as DOMRect;
            await act(async () => field.focus());
            expect(window.scrollBy).not.toHaveBeenCalled();
        });

        it("removes its listeners and the offset on unmount", async () => {
            await render();
            await act(async () => changeViewport({ height: 500 }));
            const element = footer();
            await act(async () => root.unmount());
            expect(element.style.transform).toBe("");
            changeViewport({ height: 300 });
            expect(element.style.transform).toBe("");
            root = createRoot(host);
        });
    });
});
