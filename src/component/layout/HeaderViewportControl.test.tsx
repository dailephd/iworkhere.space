/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { HeaderViewportControl } from "./HeaderViewportControl";

type ObserverCallback = (entryList: Array<{ isIntersecting: boolean }>) => void;
let observerCallback: ObserverCallback | undefined;
let disconnect = vi.fn<() => void>();
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
                <a href={`${window.location.origin}/`}>Home</a>
            </nav>
            <button type="button">Themes</button>
        </HeaderViewportControl>
    );
}

async function render() { await act(async () => root.render(<Page />)); }
async function intersect(isIntersecting: boolean) { await act(async () => observerCallback!([{ isIntersecting }])); }
const control = () => host.querySelector<HTMLButtonElement>("button[aria-controls]");
const header = () => host.querySelector("header")!;
const footprint = () => header().parentElement as HTMLElement;
function setHeaderHeight(height: number) { header().getBoundingClientRect = () => ({ height }) as DOMRect; }
async function resize() { await act(async () => resizeCallback!()); }
async function press(key: string) { await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); }); }

describe("HeaderViewportControl", () => {
    beforeEach(async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        pathname = "/";
        observerCallback = undefined;
        disconnect = vi.fn<() => void>();
        resizeCallback = undefined;
        resizeObserved = [];
        resizeDisconnect = vi.fn<() => void>();
        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: () => void) { resizeCallback = callback; }
            observe(target: Element) { resizeObserved.push(target); }
            disconnect() { resizeDisconnect(); }
        });
        vi.stubGlobal("IntersectionObserver", class {
            constructor(callback: ObserverCallback) { observerCallback = callback; }
            observe() {}
            disconnect() { disconnect(); }
        });
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        await render();
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    });

    it("renders the in-flow header with no control at the top of the page", () => {
        expect(header().dataset.headerState).toBe("flow");
        expect(header().className).not.toContain("fixed");
        expect(control()).toBeNull();
    });

    it("server-renders only the header subtree without the control", () => {
        const html = renderToStaticMarkup(<Page />);
        expect(html.match(/<header\b/g)).toHaveLength(1);
        expect(html).not.toContain("Show navigation");
    });

    it("keeps the header while it is partially visible", async () => {
        await intersect(true);
        expect(control()).toBeNull();
    });

    it("shows a collapsed control with aria wiring when the header is fully outside the viewport", async () => {
        await intersect(false);
        expect(control()!.textContent).toBe("Show navigation");
        expect(control()!.getAttribute("aria-expanded")).toBe("false");
        expect(control()!.getAttribute("aria-controls")).toBe(header().id);
        expect(header().dataset.headerState).toBe("flow");
    });

    it("expands the same header as an overlay and hides it again", async () => {
        await intersect(false);
        const original = header();
        await act(async () => control()!.click());
        expect(header()).toBe(original);
        expect(header().dataset.headerState).toBe("overlay");
        expect(header().className).toContain("fixed");
        expect(control()!.textContent).toBe("Hide navigation");
        expect(control()!.getAttribute("aria-expanded")).toBe("true");
        await act(async () => control()!.click());
        expect(header().dataset.headerState).toBe("flow");
        expect(control()!.textContent).toBe("Show navigation");
    });

    it("keeps exactly one header and one navigation landmark in every state", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        expect(host.querySelectorAll("header")).toHaveLength(1);
        expect(host.querySelectorAll("nav")).toHaveLength(1);
        expect(host.querySelectorAll('[aria-label="Primary navigation"]')).toHaveLength(1);
    });

    it("closes on Escape and returns focus from the hidden header to the control", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        host.querySelector<HTMLAnchorElement>("a")!.focus();
        await press("Escape");
        expect(header().dataset.headerState).toBe("flow");
        expect(document.activeElement).toBe(control());
    });

    it("leaves Escape to an open modal dialog", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        const dialog = document.createElement("dialog");
        dialog.setAttribute("open", "");
        document.body.append(dialog);
        await press("Escape");
        dialog.remove();
        expect(header().dataset.headerState).toBe("overlay");
    });

    it("leaves Escape to an open header popover", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        host.querySelector("button")!.setAttribute("aria-expanded", "true");
        await press("Escape");
        expect(header().dataset.headerState).toBe("overlay");
    });

    it("closes when a navigation destination is selected", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        const link = host.querySelector<HTMLAnchorElement>("a")!;
        link.addEventListener("click", event => event.preventDefault());
        await act(async () => link.click());
        expect(header().dataset.headerState).toBe("flow");
    });

    it("closes when the route changes while expanded", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        pathname = "/discover";
        await render();
        expect(header().dataset.headerState).toBe("flow");
    });

    it("restores ordinary behavior and removes the control when returning to the top", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        await intersect(true);
        expect(header().dataset.headerState).toBe("flow");
        expect(control()).toBeNull();
    });

    it("keeps the header's layout footprint while it is an overlay", async () => {
        await intersect(false);
        setHeaderHeight(96);
        await act(async () => control()!.click());
        expect(footprint().style.minHeight).toBe("96px");
        await act(async () => control()!.click());
        expect(footprint().style.minHeight).toBe("");
    });

    it("does not clip header content such as the theme popover while it is an overlay", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        expect(header().className).not.toMatch(/overflow|max-h/);
    });

    it("keeps the footprint and the Hide control offset in step with the header height while expanded", async () => {
        await intersect(false);
        setHeaderHeight(65);
        await act(async () => control()!.click());
        expect(resizeObserved).toEqual([header()]);
        expect(footprint().style.minHeight).toBe("65px");
        expect(control()!.style.top).toBe("69px");

        setHeaderHeight(227.5);
        await resize();
        expect(footprint().style.minHeight).toBe("227.5px");
        expect(control()!.style.top).toBe("231.5px");

        setHeaderHeight(65);
        await resize();
        expect(footprint().style.minHeight).toBe("65px");
        expect(control()!.style.top).toBe("69px");
    });

    it("observes the header size only while expanded and disconnects when it closes", async () => {
        await intersect(false);
        expect(resizeObserved).toHaveLength(0);
        await act(async () => control()!.click());
        expect(resizeObserved).toHaveLength(1);
        expect(resizeDisconnect).not.toHaveBeenCalled();
        await act(async () => control()!.click());
        expect(resizeDisconnect).toHaveBeenCalledTimes(1);
        expect(footprint().style.minHeight).toBe("");
    });

    it("keeps the IntersectionObserver on the stable footprint, not the repositioned header", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        expect(disconnect).not.toHaveBeenCalled();
        expect(resizeObserved).not.toContain(footprint());
    });

    it("moves focus to the visible control when a same-route link closes the overlay", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        const home = [...host.querySelectorAll<HTMLAnchorElement>("a")].find(link => link.textContent === "Home")!;
        home.addEventListener("click", event => event.preventDefault());
        home.focus();
        await act(async () => home.click());
        expect(header().dataset.headerState).toBe("flow");
        expect(document.activeElement).toBe(control());
    });

    it("leaves focus to Next.js when a link to another route closes the overlay", async () => {
        await intersect(false);
        await act(async () => control()!.click());
        const link = host.querySelector<HTMLAnchorElement>('a[href="/discover"]')!;
        link.addEventListener("click", event => event.preventDefault());
        link.focus();
        await act(async () => link.click());
        expect(header().dataset.headerState).toBe("flow");
        expect(document.activeElement).toBe(link);
    });

    it("disconnects the observer on unmount", async () => {
        await act(async () => root.unmount());
        expect(disconnect).toHaveBeenCalledTimes(1);
        root = createRoot(host);
    });
});
