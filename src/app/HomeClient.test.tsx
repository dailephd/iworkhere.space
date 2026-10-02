/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import HomeClient from "./HomeClient";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));
it("renders peer named islands with their correct tool links and category markers", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["image", "math"], toolItem: [
            { slug: "image-resizer", name: "Image Resizer", description: "Resize", category: "image" },
            { slug: "calculator", name: "Calculator", description: "Calculate", category: "math" },
        ],
    }));
    const islands = [...host.querySelectorAll('[data-surface="section-island"]')];
    expect(islands).toHaveLength(2);
    expect(islands.map(section => section.querySelector("h2")?.textContent)).toEqual(["Image tools", "All other tools"]);
    expect(islands[0].className).toBe(islands[1].className);
    expect(islands[0].querySelector('a[href="/tool/image-resizer"]')?.getAttribute("data-category")).toBe("image");
    expect(islands[1].querySelector('a[href="/tool/calculator"]')?.getAttribute("data-category")).toBe("math");
    expect(islands[0].querySelector('a[href="/tool/calculator"]')).toBeNull();
});
