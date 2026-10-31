/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: unknown }) =>
        createElement("a", { href, ...props }, children as never),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

import { VerticalNav } from "./VerticalNav";
import { defaultNavItem } from "@/app/navData";

describe("VerticalNav", () => {
    it("keeps existing destinations and marks the current route", () => {
        const html = renderToStaticMarkup(
            createElement(VerticalNav, {
                item: defaultNavItem,
                ariaLabel: "Primary navigation",
            }),
        );
        expect(html).toContain('aria-label="Primary navigation"');
        expect(html).toContain('href="/"');
        expect(html).toContain('href="/discover"');
        expect(html).toContain('aria-current="page"');
        expect(html).toContain("Home");
        expect(html).toContain("All tools");
        expect(html).toContain("Workflows");
    });
});

describe("VerticalNav responsive disclosure markup", () => {
    const categoryItem = [
        { id: "category-document", label: "PDF Tools", href: "/category/document" },
        { id: "category-converter", label: "Converters", href: "/category/converter" },
    ];
    function render() {
        const host = document.createElement("div");
        host.innerHTML = renderToStaticMarkup(createElement(VerticalNav, { item: defaultNavItem, categoryItem, ariaLabel: "Primary navigation" }));
        return host;
    }

    it("renders exactly the four primary links in order and no category link inside the primary list", () => {
        const host = render();
        const primary = [...host.querySelectorAll("[data-primary-nav-list] > li > a")];
        expect(primary.map(link => link.getAttribute("href"))).toEqual(["/", "/discover", "/workflows", "/guide"]);
        expect(primary.map(link => link.textContent)).toEqual(["Home", "All tools", "Workflows", "Guides"]);
        expect(host.querySelectorAll("nav")).toHaveLength(1);
    });

    it("renders each category once with its supplied label in a separate list", () => {
        const host = render();
        const category = [...host.querySelectorAll("[data-category-nav-list] a")];
        expect(category.map(link => link.getAttribute("href"))).toEqual(["/category/document", "/category/converter"]);
        expect(category.map(link => link.textContent)).toEqual(["PDF Tools", "Converters"]);
    });

    it("starts collapsed with aria-controls pointing at elements that exist", () => {
        const host = render();
        const menu = host.querySelector('button[aria-label="Menu"]')!;
        const categories = [...host.querySelectorAll("button")].find(button => button.textContent === "Categories")!;
        for (const button of [menu, categories]) {
            expect(button.getAttribute("aria-expanded")).toBe("false");
            expect(host.querySelector(`[id="${button.getAttribute("aria-controls")}"]`)).not.toBeNull();
        }
    });

    it("omits the Categories disclosure when no category is supplied", () => {
        const host = document.createElement("div");
        host.innerHTML = renderToStaticMarkup(createElement(VerticalNav, { item: defaultNavItem, ariaLabel: "Primary navigation" }));
        expect([...host.querySelectorAll("button")].some(button => button.textContent === "Categories")).toBe(false);
        expect(host.querySelector("[data-category-nav-list]")).toBeNull();
    });
});

describe("VerticalNav interactive disclosure", () => {
    const categoryItem = [{ id: "category-document", label: "PDF Tools", href: "/category/document" }];
    let host: HTMLDivElement;
    let root: Root;

    function mount() {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        act(() => root.render(createElement(VerticalNav, { item: defaultNavItem, categoryItem, ariaLabel: "Primary navigation" })));
    }
    function unmount() {
        act(() => root.unmount());
        host.remove();
    }
    const menu = () => host.querySelector<HTMLButtonElement>('button[aria-label="Menu"]')!;
    const categories = () => host.querySelector<HTMLButtonElement>("[data-category-button]")!;

    it("toggles the Menu, shows the overlay panel and closes with Escape while returning focus to the Menu button", () => {
        mount();
        try {
            act(() => menu().click());
            expect(menu().getAttribute("aria-expanded")).toBe("true");
            expect(host.querySelector("[data-nav-panel]")!.className).toContain("fixed");
            act(() => host.querySelector<HTMLAnchorElement>("[data-primary-nav-list] a")!.focus());
            act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
            expect(menu().getAttribute("aria-expanded")).toBe("false");
            expect(document.activeElement).toBe(menu());
            expect(host.querySelector("[data-nav-panel]")!.className).toContain("hidden");
        } finally { unmount(); }
    });

    it("closes the Menu on an outside press and when a destination link is activated", () => {
        mount();
        try {
            act(() => menu().click());
            act(() => { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
            expect(menu().getAttribute("aria-expanded")).toBe("false");
            act(() => menu().click());
            expect(menu().getAttribute("aria-expanded")).toBe("true");
            const link = host.querySelector<HTMLAnchorElement>("[data-category-nav-list] a")!;
            link.addEventListener("click", event => event.preventDefault());
            act(() => link.click());
            expect(menu().getAttribute("aria-expanded")).toBe("false");
        } finally { unmount(); }
    });

    it("opens the Categories disclosure independently of the Menu and closes it with Escape", () => {
        mount();
        try {
            act(() => categories().click());
            expect(categories().getAttribute("aria-expanded")).toBe("true");
            expect(menu().getAttribute("aria-expanded")).toBe("false");
            expect(host.querySelector("[data-category-nav]")!.className).toContain("lg:block");
            act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
            expect(categories().getAttribute("aria-expanded")).toBe("false");
            expect(host.querySelector("[data-category-nav]")!.className).toContain("lg:hidden");
        } finally { unmount(); }
    });
});
