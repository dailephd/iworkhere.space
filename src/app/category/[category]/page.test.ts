import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "@/component/layout/AppShell";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: unknown }) =>
        createElement("a", { href, ...props }, children as never),
}));

import CategoryPage from "./page";

describe("category route", () => {
    it("renders existing category tools inside the shell's single main landmark", async () => {
        const categoryContent = await CategoryPage({
            params: Promise.resolve({ category: "text" }),
        });
        const html = renderToStaticMarkup(
            createElement(AppShell, null, categoryContent),
        );
        expect(html.match(/<main\b/g)).toHaveLength(1);
        expect(html).toContain("Text &amp; Code Tool");
        expect(html).toContain('href="/tool/slugify"');
        expect(html).toContain('id="main-content"');
    });
});
