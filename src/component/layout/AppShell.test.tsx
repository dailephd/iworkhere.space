import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppShell from "./AppShell";

describe("AppShell", () => {
    it("owns the sole main landmark, exposes the skip target, and places the exact Footer in flow", () => {
        const html = renderToStaticMarkup(
            createElement(AppShell, null, createElement("h1", null, "Workspace")),
        );
        expect(html.match(/<main\b/g)).toHaveLength(1);
        expect(html).toContain('href="#main-content"');
        expect(html).toContain('id="main-content"');
        expect(html).toContain("Skip to main content");
        expect(html).toContain("© 2026 iworkhere.space created by dailephd LLC");
        expect(html).not.toContain("MainScroll");
        expect(html.indexOf("Workspace")).toBeLessThan(
            html.indexOf("© 2026 iworkhere.space created by dailephd LLC"),
        );
    });
});
