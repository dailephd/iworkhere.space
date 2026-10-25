import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound, { metadata } from "./not-found";

describe("app not-found", () => {
    it("uses the exact browser title and is not indexable", () => {
        expect(metadata.title).toBe("iworkhere");
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it("explains the missing page and links to All tools", () => {
        const html = renderToStaticMarkup(<NotFound />);
        expect(html).toContain("Page not found");
        expect(html).toContain('href="/discover"');
    });
});
