import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getAllTool } from "@/module/tool/metadata";
import AboutPage, { metadata } from "./page";

describe("about page", () => {
    const html = renderToStaticMarkup(<AboutPage />);

    it("uses the canonical page metadata", () => {
        expect(metadata.title).toBe("iworkhere");
        expect(metadata.description).toContain("dailephd LLC");
        expect(metadata.alternates).toEqual({ canonical: "https://iworkhere.space/about" });
        expect(metadata.openGraph).toMatchObject({ url: "https://iworkhere.space/about", title: "About — iworkhere.space" });
    });

    it("has exactly one H1 and a semantic H2 outline without skipped levels", () => {
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).toContain(">About iworkhere.space</h1>");
        expect(html.match(/<h2\b/g)).toHaveLength(6);
        expect(html).not.toContain("<h3");
        expect(html.match(/<article\b/g)).toHaveLength(1);
        expect(html.match(/aria-labelledby="about-[a-z]+"/g)).toHaveLength(6);
    });

    it("states the publisher identity and the registry-derived catalog size", () => {
        expect(html).toContain("dailephd LLC");
        expect(html).toContain(`${getAllTool().length} tools in 7 categories`);
    });

    it("describes real capabilities, local processing, tests and limits honestly", () => {
        for (const text of ["Merge PDFs", "Resize and compress images", "Format and validate JSON", "in your browser", "They are not uploaded to our servers", "Changes are checked with automated type checking, linting, unit tests, browser tests and a production-container build", "not full editors", "do not guarantee that a tool is free of errors", "We do not promise a reply"]) expect(html).toContain(text);
    });

    it("links to Contact Us, the Privacy Policy and All tools", () => {
        expect(html).toContain('href="/contact"');
        expect(html).toContain('href="/privacy"');
        expect(html).toContain('href="/discover"');
    });

    it("shows no private address, advertising frame, script or form", () => {
        expect(html).not.toContain("@");
        expect(html).not.toMatch(/Advertisement|adsbygoogle|<script|<form|<button|<input/);
    });

    it("lists published releases only", () => {
        expect(html).toContain("v0.4.2");
        expect(html).not.toContain("v0.4.3");
    });
});
