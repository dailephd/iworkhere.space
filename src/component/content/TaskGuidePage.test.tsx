/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskGuidePage } from "./TaskGuidePage";
import type { TaskGuidePageProp } from "./TaskGuidePage";

const PROP: TaskGuidePageProp = {
    title: "Sample Workflow",
    description: "A short description of the sample workflow.",
    startingMaterial: "Two sample PDFs.",
    expectedOutcome: "One checked PDF.",
    reviewedOn: "2026-10-27",
    step: [
        { heading: "First step", explanation: "Do the first thing and download it.", toolLink: { title: "Split PDF", href: "/tool/split-pdf", summary: "Pull pages out." } },
        { heading: "Check it", explanation: "Compare the pages with your list." },
    ],
    example: [{
        toolLink: { title: "Merge PDF", href: "/tool/merge-pdf", summary: "Join PDFs." },
        task: "Join two PDFs.",
        outcome: "Five pages in the order A1, A2, B1, B2, B3.",
        limitation: "Only static pages are supported.",
        sourceLink: [{ title: "Download source PDF: source-001.pdf (2 pages, 100 bytes)", href: "/examples/v0.4.4/merge-pdf/source-001.pdf" }],
        outputLink: [{ title: "Download result PDF: result.pdf (5 pages, 200 bytes)", href: "/examples/v0.4.4/merge-pdf/result.pdf" }],
    }],
    verification: ["Count the pages."],
    limitation: ["Signatures may not survive."],
    relatedToolLink: [{ title: "Merge PDF", href: "/tool/merge-pdf", summary: "Join PDFs." }],
};

function render(prop: TaskGuidePageProp = PROP): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<TaskGuidePage {...prop} />);
    return host;
}

describe("TaskGuidePage", () => {
    it("renders one article with a single H1 and the labelled sections in reading order", () => {
        const host = render();
        expect(host.querySelectorAll("article")).toHaveLength(1);
        expect(host.querySelectorAll("h1")).toHaveLength(1);
        expect(host.querySelector("h1")!.textContent).toBe("Sample Workflow");
        expect([...host.querySelectorAll("article > section > h2")].map(heading => heading.textContent)).toEqual([
            "Steps", "Worked examples", "How to check the result yourself", "Limits to know", "Tools used in this guide",
        ]);
        expect(host.textContent).toContain("Two sample PDFs.");
        expect(host.textContent).toContain("One checked PDF.");
    });

    it("renders the steps as an ordered list with a registry link only where one is provided", () => {
        const host = render();
        const step = [...host.querySelectorAll("ol > li")];
        expect(step).toHaveLength(2);
        expect(step[0].querySelector("h3")!.textContent).toBe("First step");
        expect(step[0].querySelector("a")!.getAttribute("href")).toBe("/tool/split-pdf");
        expect(step[0].querySelector("a")!.textContent).toBe("Open Split PDF");
        expect(step[1].querySelector("a")).toBeNull();
    });

    it("shows example sources and results as visitor-initiated download links with their given names", () => {
        const host = render();
        const link = [...host.querySelectorAll<HTMLAnchorElement>("a[download]")];
        expect(link.map(one => one.getAttribute("href"))).toEqual(["/examples/v0.4.4/merge-pdf/source-001.pdf", "/examples/v0.4.4/merge-pdf/result.pdf"]);
        expect(link[0].textContent).toBe("Download source PDF: source-001.pdf (2 pages, 100 bytes)");
        expect(host.textContent).toContain("separate runs and are not one combined result");
        expect(host.textContent).toContain("Five pages in the order A1, A2, B1, B2, B3.");
    });

    it("states the review date, the manual handoff and the limits", () => {
        const host = render();
        expect(host.querySelector("time")!.getAttribute("datetime")).toBe("2026-10-27");
        expect(host.textContent).toContain("you select it again yourself");
        expect(host.textContent).toContain("Signatures may not survive.");
        expect(host.textContent).toContain("Count the pages.");
    });

    it("uses only server-renderable presentation: no client state, form control, image, script or ad slot", () => {
        const host = render();
        expect(host.querySelectorAll("button, input, select, textarea, form, img, video, iframe, script, ins, aside, dialog")).toHaveLength(0);
        expect(host.innerHTML).not.toMatch(/adsbygoogle|data-ad|<script/i);
        const link = [...host.querySelectorAll("a")];
        expect(link.length).toBeGreaterThan(0);
        for (const one of link) {
            expect(one.getAttribute("href"), one.textContent ?? "").toMatch(/^\/(?:tool|examples)\//);
            expect(one.textContent!.trim(), "every link has an accessible name").not.toBe("");
        }
    });

    it("fabricates nothing: sizes and counts appear only when the caller supplies them", () => {
        const host = render({ ...PROP, example: [], relatedToolLink: [] });
        expect(host.textContent).not.toMatch(/\d+(?:,\d{3})* bytes|\d+ pages/);
        expect(host.querySelectorAll("a[download]")).toHaveLength(0);
    });
});
