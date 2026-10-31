// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToolPageTemplate } from "./ToolPageTemplate";
import { ToolClientFrame } from "./ToolClientFrame";
import { ToolSurface, toolSurfaceClassName } from "./ToolSurface";
import { getToolCategoryLabel } from "@/module/tool/category";
import ToolPage from "@/app/tool/[slug]/page";
import { getToolGuide } from "@/module/tool/guide";
import { getToolBySlug, tool_definition_list } from "@/module/tool/registry";
import { getToolByIdList } from "@/module/tool/metadata";
import { getValueExample } from "@/module/tool/valueExamples";
import { captureError, trackEvent } from "@/module/observability";
import { reportClientErrorMetric } from "@/module/observability/errorMetric.client";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn() }),
    usePathname: () => "/tool/json-formatter",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/script", () => ({ default: (props: { id: string; src: string }) => <script async id={props.id} src={props.src} /> }));
vi.mock("@/module/observability", () => ({ captureError: vi.fn(), logEvent: vi.fn(), trackEvent: vi.fn() }));
vi.mock("@/module/observability/errorMetric.client", () => ({ reportClientErrorMetric: vi.fn() }));

let root: Root;
let element: HTMLDivElement;
let shouldThrow: boolean;
const failure = new Error("Controlled tool render failure");
const initialize = vi.fn();
function RecoverableTool() {
    if (shouldThrow) throw failure;
    return <p>Working utility content</p>;
}
function page(slug = "json-formatter") {
    const tool = getToolBySlug(slug)!;
    return <ToolPageTemplate tool={tool} breadcrumb={[]} relatedTool={[]}
        toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />;
}
function expectAdFreeFallback() {
    expect(element.textContent).toContain("Something went wrong");
    expect(element.querySelectorAll("ins.adsbygoogle")).toHaveLength(0);
    expect(element.querySelector('aside[aria-label="Right advertising area"]')).toBeNull();
    expect(element.querySelector("#google-adsense")).toBeNull();
    expect(element.textContent).not.toContain("Advertisement");
    // The whole frame is replaced, including its grid, header space and right rail.
    expect(element.children).toHaveLength(1);
    expect(element.firstElementChild?.className).not.toContain("grid");
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 176 } as DOMRect);
    window.adsbygoogle = [];
    window.adsbygoogle.push = initialize;
    shouldThrow = false;
    element = document.createElement("div");
    root = createRoot(element);
});
afterEach(async () => {
    await act(async () => root.unmount());
    delete window.adsbygoogle;
    vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks();
});

it("removes the complete ad frame on failure, keeps failed retries ad-free, and restores it on recovery", async () => {
    await act(async () => root.render(page()));
    expect(element.textContent).toContain("Working utility content");
    expect(element.querySelectorAll("ins.adsbygoogle")).toHaveLength(2);
    expect(initialize).toHaveBeenCalledTimes(2);

    shouldThrow = true;
    await act(async () => root.render(page()));
    expectAdFreeFallback();
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(reportClientErrorMetric).toHaveBeenCalledTimes(1);
    expect(reportClientErrorMetric).toHaveBeenCalledWith(failure, { failureCategory: "tool-render-error", toolId: "json-formatter" });
    expect(captureError).toHaveBeenCalledWith(failure, expect.objectContaining({ toolId: "json-formatter", boundary: "ToolErrorBoundary" }));

    await act(async () => element.querySelector("button")!.click());
    expectAdFreeFallback();
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(captureError).toHaveBeenCalledTimes(2);
    expect(reportClientErrorMetric).toHaveBeenCalledTimes(2);

    shouldThrow = false;
    await act(async () => element.querySelector("button")!.click());
    expect(element.textContent).toContain("Working utility content");
    expect(element.textContent).not.toContain("Something went wrong");
    expect(element.querySelectorAll("ins.adsbygoogle")).toHaveLength(2);
    expect(initialize).toHaveBeenCalledTimes(4);
    await act(async () => root.render(page()));
    expect(initialize).toHaveBeenCalledTimes(4);
});

it("does not carry a failed tool state into another registered tool or an ineligible page", async () => {
    shouldThrow = true;
    await act(async () => root.render(page()));
    expectAdFreeFallback();
    expect(initialize).not.toHaveBeenCalled();
    shouldThrow = false;
    await act(async () => root.render(page("calculator")));
    expect(element.textContent).toContain("Working utility content");
    expect(element.querySelectorAll("ins.adsbygoogle")).toHaveLength(2);
    expect(initialize).toHaveBeenCalledTimes(2);
    await act(async () => root.render(<h1>Catalog</h1>));
    expect(element.querySelectorAll("ins.adsbygoogle")).toHaveLength(0);
    expect(element.textContent).toBe("Catalog");
    expect(initialize).toHaveBeenCalledTimes(2);
});

it("keeps a healthy tool free of advertising on a non-production deployment even with the enabled production flag", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await act(async () => root.render(page()));
    expect(element.textContent).toContain("Working utility content");
    expect(element.querySelectorAll("ins.adsbygoogle, #google-adsense, aside")).toHaveLength(0);
    expect(element.textContent).not.toContain("Advertisement");
    expect(initialize).not.toHaveBeenCalled();
});

it("keeps both healthy and failed tools free of advertising when the global flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    await act(async () => root.render(page()));
    expect(element.querySelectorAll("ins.adsbygoogle, #google-adsense, aside")).toHaveLength(0);
    expect(element.textContent).not.toContain("Advertisement");
    shouldThrow = true;
    await act(async () => root.render(page()));
    expectAdFreeFallback();
    expect(initialize).not.toHaveBeenCalled();
});

// Nine tool pages carry a worked example: the five v0.4.3 tools and the four added in v0.4.4.
const WITH_EXAMPLE = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter", "merge-pdf", "split-pdf", "image-compressor", "heic-converter"];
function featuredPage(slug: string, withExample = true) {
    const tool = getToolBySlug(slug)!;
    return <ToolPageTemplate tool={tool} guide={getToolGuide(tool.id)} breadcrumb={[{ label: "Home", href: "/" }, { label: tool.name }]} relatedTool={getToolByIdList(getToolGuide(tool.id)?.relatedToolId ?? [])}
        example={withExample ? getValueExample(tool.id) : undefined}
        toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />;
}

it("gives exactly the nine example tools an example and every other registered tool none", async () => {
    for (const tool of tool_definition_list) {
        const result = (await ToolPage({ params: Promise.resolve({ slug: tool.slug }) })) as React.ReactElement<{ example?: { toolId: string } }>;
        expect(result.props.example?.toolId, tool.id).toBe(WITH_EXAMPLE.includes(tool.id) ? tool.id : undefined);
    }
    expect(tool_definition_list.filter(tool => WITH_EXAMPLE.includes(tool.id))).toHaveLength(WITH_EXAMPLE.length);
});

it.each(WITH_EXAMPLE)("renders the %s page as tool, How to use, Worked example, then details and Related tools", async slug => {
    await act(async () => root.render(featuredPage(slug)));
    const tool = [...element.querySelectorAll("p")].find(value => value.textContent === "Working utility content")!;
    expect(tool).toBeDefined();
    const panel = element.querySelector('section[aria-labelledby$="-example-heading"]')!;
    const guide = element.querySelector('section[aria-label="Tool guide"]')!;
    const howTo = guide.querySelector("#tool-how-to-use-title")!;
    const reference = guide.querySelector("#tool-reference-title")!;
    const related = guide.querySelector("#tool-related-title")!;
    expect(panel).not.toBeNull();
    expect(guide).not.toBeNull();
    const follows = (earlier: Element, later: Element) => Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(tool, howTo)).toBe(true);
    expect(follows(howTo, panel)).toBe(true);
    expect(follows(panel, reference)).toBe(true);
    expect(follows(reference, related)).toBe(true);
    expect(guide.contains(panel)).toBe(true);
    expect(element.querySelectorAll("h1")).toHaveLength(1);
    expect(element.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
    expect(guide.querySelector("h2")?.textContent).toBe("How to use");
    expect([...guide.querySelectorAll("h2")].map(one => one.textContent)).toEqual(["How to use", "Worked example", "Details and limits", "Related tools"]);
    expect(guide.querySelectorAll("h3").length).toBeGreaterThan(1);
});

it.each(WITH_EXAMPLE)("renders the %s page without any example section when no example is supplied", async slug => {
    await act(async () => root.render(featuredPage(slug, false)));
    expect(element.textContent).not.toContain("Worked example");
    expect(element.querySelector('section[aria-labelledby$="-example-heading"]')).toBeNull();
    expect(element.querySelector('section[aria-label="Tool guide"]')).not.toBeNull();
});

it.each(["json-formatter", "word-character-counter", "qr-code-generator"])("renders the guided %s page with no example section or placeholder, even though its guide has its own example", async slug => {
    // Their guides carry an input-and-output example, but "Worked example" names only the tool-page panel.
    await act(async () => root.render(featuredPage(slug)));
    expect(element.textContent).not.toContain("Worked example");
    expect(element.querySelector('section[aria-labelledby$="-example-heading"]')).toBeNull();
    expect(element.querySelectorAll('a[href^="/examples/"], img[src^="/examples/"]')).toHaveLength(0);
});

it("adds no advertising slot, script or telemetry call when an example is shown", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    await act(async () => root.render(featuredPage("compress-pdf", false)));
    const withoutExample = vi.mocked(trackEvent).mock.calls.map(call => JSON.stringify(call));
    await act(async () => root.unmount());
    vi.mocked(trackEvent).mockClear();
    root = createRoot(element);
    await act(async () => root.render(featuredPage("compress-pdf")));
    expect(element.textContent).toContain("Worked example");
    expect(element.querySelectorAll("ins.adsbygoogle, #google-adsense, aside, script")).toHaveLength(0);
    expect(captureError).not.toHaveBeenCalled();
    expect(reportClientErrorMetric).not.toHaveBeenCalled();
    expect(vi.mocked(trackEvent).mock.calls.map(call => JSON.stringify(call))).toEqual(withoutExample);
});

it("replaces the whole page, example included, with the ad-free fallback when the tool fails", async () => {
    shouldThrow = true;
    await act(async () => root.render(featuredPage("compress-pdf")));
    expectAdFreeFallback();
    expect(element.textContent).not.toContain("Worked example");
});

const GUIDE_LINK_TOOL: Record<string, string[]> = {
    "split-pdf": ["assemble-pdf-packet"], "merge-pdf": ["assemble-pdf-packet"], "compress-pdf": ["assemble-pdf-packet"],
    "images-to-pdf": ["assemble-pdf-packet", "heic-photos-to-pdf"], "image-converter": ["prepare-image-for-upload"],
    "image-resizer": ["prepare-image-for-upload", "pdf-pages-for-slides"], "image-compressor": ["prepare-image-for-upload"],
    "heic-converter": ["heic-photos-to-pdf"], "pdf-to-image": ["pdf-pages-for-slides"],
};

it("resolves workflow links for exactly the participating tools, pointing directly at the operational workflow routes", async () => {
    for (const tool of tool_definition_list) {
        const result = (await ToolPage({ params: Promise.resolve({ slug: tool.slug }) })) as React.ReactElement<{ taskGuideLink?: { title: string; href: string; summary: string }[] }>;
        const link = result.props.taskGuideLink ?? [];
        expect(link.map(one => one.href), tool.id).toEqual((GUIDE_LINK_TOOL[tool.id] ?? []).map(slug => `/workflows/${slug}`));
        for (const one of link) {
            expect(one.title.length).toBeGreaterThan(10);
            expect(one.summary.length).toBeGreaterThan(20);
        }
    }
});

it("renders task-guide links in their own labelled section after the tool guidance and keeps the page ad-free", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    const tool = getToolBySlug("images-to-pdf")!;
    await act(async () => root.render(<ToolPageTemplate tool={tool} breadcrumb={[]} relatedTool={[]} guide={getToolGuide(tool.id)}
        taskGuideLink={[{ title: "Assemble an Ordered PDF Packet", href: "/guide/assemble-pdf-packet", summary: "One ordered PDF." }]}
        toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />));
    const guide = element.querySelector('section[aria-label="Tool guide"]')!;
    const section = element.querySelector("section[data-task-guide-link]")!;
    expect(section.querySelector("h2")?.textContent).toBe("Use this tool in a workflow");
    expect(guide.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(guide.contains(section)).toBe(false);
    expect(section.querySelector("a")!.getAttribute("href")).toBe("/guide/assemble-pdf-packet");
    expect(element.querySelectorAll("h1")).toHaveLength(1);
    expect(element.querySelectorAll("ins.adsbygoogle, #google-adsense, aside, script")).toHaveLength(0);
});

it("shows the canonical category cue for every registered tool, from the registry category only (AUD-013)", async () => {
    expect(tool_definition_list).toHaveLength(18);
    for (const tool of tool_definition_list) {
        await act(async () => root.render(<ToolPageTemplate tool={tool} breadcrumb={[]} relatedTool={[]}
            toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />));
        const header = element.querySelector("header[data-category]");
        expect(header?.getAttribute("data-category"), tool.id).toBe(tool.category);
        expect(header?.querySelector("[data-category-cue]")?.textContent, tool.id).toBe(getToolCategoryLabel(tool.category));
        expect(element.querySelectorAll("h1"), tool.id).toHaveLength(1);
        expect(element.querySelector("h1")?.textContent, tool.id).toBe(tool.name);
    }
});

it("ToolSurface applies one role class per kind, labels its section from the title and never adds an H1", async () => {
    await act(async () => root.render(<div>
        <ToolSurface kind="work" title="Source" description="Pick a file">content</ToolSurface>
        <ToolSurface kind="preview" aria-label="Preview">preview</ToolSurface>
        <ToolSurface kind="result" aria-labelledby="own-heading"><h2 id="own-heading">Done</h2></ToolSurface>
        <ToolSurface kind="feedback" tone="error" role="alert">bad input</ToolSurface>
        <ToolSurface kind="feedback" tone="warning">careful</ToolSurface>
    </div>));
    const section = [...element.querySelectorAll("section")];
    expect(section.map(one => one.className.split(" ")[0])).toEqual(["tool-work", "tool-preview", "tool-result", "tool-feedback", "tool-feedback"]);
    const work = section[0];
    expect(work.getAttribute("aria-labelledby")).toBe(work.querySelector("h2")?.id);
    expect(work.querySelector("h2")?.textContent).toBe("Source");
    expect(section[1].getAttribute("aria-label")).toBe("Preview");
    expect(section[2].getAttribute("aria-labelledby")).toBe("own-heading");
    expect(section[3].getAttribute("data-tone")).toBe("error");
    expect(section[3].getAttribute("role")).toBe("alert");
    expect(section[4].getAttribute("data-tone")).toBe("warning");
    expect(work.getAttribute("data-tone")).toBeNull();
    expect(element.querySelectorAll("h1")).toHaveLength(0);
    expect(toolSurfaceClassName("work", "space-y-4")).toBe("tool-work min-w-0 space-y-4");
});

it("renders no workflow section without links and replaces it with the fallback when the tool fails", async () => {
    const tool = getToolBySlug("json-formatter")!;
    await act(async () => root.render(<ToolPageTemplate tool={tool} breadcrumb={[]} relatedTool={[]} taskGuideLink={[]}
        toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />));
    expect(element.querySelector("section[data-task-guide-link]")).toBeNull();
    shouldThrow = true;
    await act(async () => root.unmount());
    root = createRoot(element);
    await act(async () => root.render(<ToolPageTemplate tool={tool} breadcrumb={[]} relatedTool={[]}
        taskGuideLink={[{ title: "Prepare an Image for an Upload", href: "/guide/prepare-image-for-upload", summary: "A checked image." }]}
        toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />));
    expectAdFreeFallback();
    expect(element.querySelector("section[data-task-guide-link]")).toBeNull();
});
