import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage, { metadata } from "./page";

const approvedParagraph = [
    "iworkhere.space brings together practical online tools for working with files, text, and data. Whether you need to combine PDF files, resize an image, extract text from HTML, format JSON, or convert measurements, you can handle these tasks directly in your browser without installing separate software.",
    "Each tool is built around a specific task, with a straightforward interface and the controls needed to get the job done. The collection covers PDF documents, images, text, calculations, unit conversions, and developer utilities.",
    "Our focus is on making common operations easy to complete without unnecessary complexity. When a tool has specific requirements or limitations, such as supported file formats, size restrictions, or output options, you can find that information alongside the tool itself.",
    "Explore the complete collection on the All tools page.",
    "The PDF, image, text, JSON, and QR code utilities process their inputs directly in your browser rather than uploading them to our servers for processing. This allows you to work with files and text on your own device.",
    "The website also uses services for hosting, analytics, and communication. Our Privacy Policy explains how these services handle information and how browser storage is used.",
    "iworkhere.space is developed and maintained by dailephd LLC. We continue to improve existing utilities and develop new ones, with an emphasis on practical functionality, clear interfaces, and accurate guidance.",
    "If you encounter a problem, have feedback, or would like to suggest a tool, please contact us.",
];

const approvedHeading = ["Tools designed for everyday work", "Working in your browser", "About the publisher"];

const textOf = (fragment: string) => fragment.replace(/<[^>]+>/g, "");

describe("about page", () => {
    const html = renderToStaticMarkup(<AboutPage />);

    it("shows every approved paragraph exactly once and in order", () => {
        const paragraph = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/g)].map(match => textOf(match[1]));
        expect(paragraph).toEqual(approvedParagraph);
    });

    it("has one article, exactly one H1 and exactly the three approved H2 headings in order", () => {
        expect(html.match(/<article\b/g)).toHaveLength(1);
        expect([...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)].map(match => textOf(match[1]))).toEqual(["About iworkhere.space"]);
        expect([...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(match => textOf(match[1]))).toEqual(approvedHeading);
        expect(html).not.toContain("<h3");
    });

    it("links All tools, Privacy Policy and contact us to their routes with the shared focus style", () => {
        const link = [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map(match => ({ text: match[2], href: /href="([^"]*)"/.exec(match[1])?.[1], attribute: match[1] }));
        expect(link.map(({ text, href }) => ({ text, href }))).toEqual([
            { text: "All tools", href: "/discover" },
            { text: "Privacy Policy", href: "/privacy" },
            { text: "contact us", href: "/contact" },
        ]);
        for (const { attribute } of link) expect(attribute).toContain("focus-visible:outline");
    });

    it("identifies the product and the publisher", () => {
        expect(html).toContain("iworkhere.space");
        expect(html).toContain("dailephd LLC");
    });

    it("keeps none of the obsolete sections or dynamic content", () => {
        for (const heading of ["Who publishes it", "What the tools do", "How it is maintained", "Limits", "Release history", "Contact and privacy"]) expect(html, heading).not.toContain(heading);
        expect(html).not.toMatch(/v0\.\d+\.\d+/);
        expect(html).not.toMatch(/\d+ tools in \d+ categories/);
        expect(html).not.toMatch(/type checking|linting|unit tests|browser tests|production-container/i);
        expect(html).not.toMatch(/<ul|<li/);
    });

    it("shows no private address, advertising frame, script or form", () => {
        expect(html).not.toContain("@");
        expect(html).not.toMatch(/Advertisement|adsbygoogle|<script|<form|<button|<input/);
    });

    it("keeps the canonical page metadata and updates the description", () => {
        expect(metadata.title).toBe("About - iworkhere");
        expect(metadata.description).toBe("Learn about iworkhere.space, its browser-based tools for files and data, local processing, and the company behind the site.");
        expect(metadata.alternates).toEqual({ canonical: "https://iworkhere.space/about" });
        expect(metadata.openGraph).toMatchObject({ url: "https://iworkhere.space/about", title: "About — iworkhere.space" });
    });
});
