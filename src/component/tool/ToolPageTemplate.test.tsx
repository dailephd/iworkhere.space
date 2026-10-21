// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToolPageTemplate } from "./ToolPageTemplate";
import { ToolClientFrame } from "./ToolClientFrame";
import ToolPage from "@/app/tool/[slug]/page";
import { getToolGuide } from "@/module/tool/guide";
import { getToolBySlug, tool_definition_list } from "@/module/tool/registry";
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

const FEATURED = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter"];
function featuredPage(slug: string, withExample = true) {
    const tool = getToolBySlug(slug)!;
    return <ToolPageTemplate tool={tool} guide={getToolGuide(tool.id)} breadcrumb={[{ label: "Home", href: "/" }, { label: tool.name }]} relatedTool={[]}
        example={withExample ? getValueExample(tool.id) : undefined}
        toolUi={<ToolClientFrame toolId={tool.id} ToolComponent={RecoverableTool} />} />;
}

it("gives exactly the five featured tools an example and every other registered tool none", async () => {
    for (const tool of tool_definition_list) {
        const result = (await ToolPage({ params: Promise.resolve({ slug: tool.slug }) })) as React.ReactElement<{ example?: { toolId: string } }>;
        expect(result.props.example?.toolId, tool.id).toBe(FEATURED.includes(tool.id) ? tool.id : undefined);
    }
    expect(tool_definition_list.filter(tool => FEATURED.includes(tool.id))).toHaveLength(FEATURED.length);
});

it.each(FEATURED)("renders the %s example after the working tool and before the guide, keeping page structure", async slug => {
    await act(async () => root.render(featuredPage(slug)));
    const tool = [...element.querySelectorAll("p")].find(value => value.textContent === "Working utility content")!;
    expect(tool).toBeDefined();
    const panel = element.querySelector('section[aria-labelledby$="-example-heading"]')!;
    const guide = element.querySelector('section[aria-label="Tool guide"]')!;
    expect(panel).not.toBeNull();
    expect(guide).not.toBeNull();
    expect(tool.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.parentElement).toBe(guide.parentElement);
    expect(guide.contains(panel)).toBe(false);
    expect(element.querySelectorAll("h1")).toHaveLength(1);
    expect(element.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
    expect(guide.querySelector("h2")?.textContent).toBe("How to use");
    expect(guide.querySelectorAll("h2").length).toBeGreaterThan(1);
});

it.each(FEATURED)("renders the %s page without any example section when no example is supplied", async slug => {
    await act(async () => root.render(featuredPage(slug, false)));
    expect(element.textContent).not.toContain("Worked example");
    expect(element.querySelector('section[aria-labelledby$="-example-heading"]')).toBeNull();
    expect(element.querySelector('section[aria-label="Tool guide"]')).not.toBeNull();
});

it("renders an unfeatured tool with no example section or placeholder", async () => {
    await act(async () => root.render(featuredPage("json-formatter")));
    expect(element.textContent).not.toContain("Worked example");
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
