// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToolPageTemplate } from "./ToolPageTemplate";
import { ToolClientFrame } from "./ToolClientFrame";
import { getToolBySlug } from "@/module/tool/registry";
import { captureError } from "@/module/observability";
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
