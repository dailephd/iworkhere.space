/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderViewportControl } from "./HeaderViewportControl";

let resizeCallback: (() => void) | undefined;
let resizeObserved: Element[] = [];
let resizeDisconnect = vi.fn<() => void>();

let host: HTMLDivElement;
let root: Root;

function Page() {
    return (
        <HeaderViewportControl>
            <nav aria-label="Primary navigation">
                <a href="/discover">All tools</a>
            </nav>
            <button type="button">Themes</button>
        </HeaderViewportControl>
    );
}

const header = () => host.querySelector("header")!;
const footprint = () => header().parentElement as HTMLElement;
function setHeaderHeight(height: number) { header().getBoundingClientRect = () => ({ height }) as DOMRect; }
async function render() { await act(async () => root.render(<Page />)); }

describe("HeaderViewportControl", () => {
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        resizeCallback = undefined;
        resizeObserved = [];
        resizeDisconnect = vi.fn<() => void>();
        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: () => void) { resizeCallback = callback; }
            observe(target: Element) { resizeObserved.push(target); }
            disconnect() { resizeDisconnect(); }
        });
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        document.documentElement.style.removeProperty("--header-height");
        vi.unstubAllGlobals();
    });

    it("renders one fixed header with its children and no navigation toggle", async () => {
        await render();
        expect(host.querySelectorAll("header")).toHaveLength(1);
        expect(header().className).toContain("fixed inset-x-0 top-0");
        expect(header().querySelector('nav[aria-label="Primary navigation"]')).not.toBeNull();
        expect(host.querySelector("button[aria-controls], button[aria-expanded]")).toBeNull();
        expect(host.textContent).not.toMatch(/Show navigation|Hide navigation/);
        expect(header().hasAttribute("data-header-state")).toBe(false);
    });

    it("reserves the measured header height in document flow and publishes it for anchors", async () => {
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = () => ({ height: 96 }) as DOMRect;
        try {
            await render();
        } finally {
            Element.prototype.getBoundingClientRect = original;
        }
        expect(footprint().style.minHeight).toBe("96px");
        expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("96px");
        expect(resizeObserved).toEqual([header()]);
    });

    it("follows the header height when navigation wraps after a resize", async () => {
        await render();
        setHeaderHeight(148);
        await act(async () => resizeCallback!());
        expect(footprint().style.minHeight).toBe("148px");
        expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("148px");
    });

    it("stops observing and clears the published height on unmount", async () => {
        await render();
        await act(async () => root.unmount());
        expect(resizeDisconnect).toHaveBeenCalledTimes(1);
        expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("");
        root = createRoot(host);
    });

    it("keeps a single-row footprint and a static no-JavaScript fallback in the server markup", () => {
        const html = renderToStaticMarkup(<Page />);
        expect(html.match(/<header\b/g)).toHaveLength(1);
        expect(html).toContain("data-header-footprint");
        expect(html).toContain("min-h-16");
        expect(html).toContain("<noscript>");
        expect(html).toContain("[data-site-header]{position:static!important}");
    });
});
