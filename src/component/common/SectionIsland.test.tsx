/** @vitest-environment jsdom */
import React from "react";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionIsland } from "./SectionIsland";

describe("SectionIsland", () => {
    it("labels its section and contains caller content without owning data", () => {
        const host = document.createElement("div");
        host.innerHTML = renderToStaticMarkup(<SectionIsland headingId="tools" heading="Tools" description="Local utilities"><Link href="/tool/example">Example</Link></SectionIsland>);
        expect(host.querySelector("section")?.getAttribute("aria-labelledby")).toBe("tools");
        expect(host.querySelector("section")?.getAttribute("data-surface")).toBe("section-island");
        expect(host.querySelector("h2")?.textContent).toBe("Tools");
        expect(host.querySelector("p")?.textContent).toBe("Local utilities");
        expect(host.querySelector("a")?.getAttribute("href")).toBe("/tool/example");
    });
    it("does not render an empty description", () => {
        const markup = renderToStaticMarkup(<SectionIsland headingId="tools" heading="Tools">Content</SectionIsland>);
        expect(markup).not.toContain("<p");
    });
});
