/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ToolComponentProp, ToolQueryOption } from "@/module/tool/type";
import { ToolClientFrame } from "./ToolClientFrame";
import { captureError, trackEvent } from "@/module/observability";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), search: "expr=old&remove=stale" }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: navigation.replace }),
    usePathname: () => "/tool/example",
    useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@/module/observability", () => ({ captureError: vi.fn(), logEvent: vi.fn(), trackEvent: vi.fn() }));

let host: HTMLDivElement;
let root: Root;
let option: ToolQueryOption | undefined;
let next: Record<string, string>;
function QueryTool({ query, setQuery }: ToolComponentProp) {
    return <><output>{query?.expr}</output><button onClick={() => setQuery?.(next, option)}>Update</button></>;
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    option = undefined;
    next = { expr: "private-expression", empty: "" };
    navigation.search = "expr=old&remove=stale";
    window.history.replaceState(null, "", "/tool/example?expr=old");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function update() {
    await act(async () => root.render(<ToolClientFrame toolId="example" ToolComponent={QueryTool} />));
    await act(async () => host.querySelector("button")!.click());
}
it("keeps server navigation as the default for existing tool consumers", async () => {
    await update();
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/tool/example?expr=private-expression", { scroll: false });
});
it("updates only the current history entry for an opted-in local query", async () => {
    option = { sameDocument: true };
    const length = window.history.length;
    await update();
    expect(window.location.pathname + window.location.search).toBe("/tool/example?expr=private-expression");
    expect(window.history.length).toBe(length);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(captureError).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("tool_executed", { toolId: "example", slug: "example" });
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain("private-expression");
});
it("removes empty query values on reset without navigating", async () => {
    option = { sameDocument: true }; next = { expr: "" };
    await update();
    expect(window.location.pathname + window.location.search).toBe("/tool/example");
    expect(navigation.replace).not.toHaveBeenCalled();
});
it("reports history failures safely without falling back to a server navigation", async () => {
    option = { sameDocument: true };
    const error = new DOMException("History unavailable", "SecurityError");
    vi.spyOn(window.history, "replaceState").mockImplementation(() => { throw error; });
    await update();
    expect(captureError).toHaveBeenCalledExactlyOnceWith(error, { toolId: "example", boundary: "ToolClientFrame.setQuery" });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(host.querySelector("button")).not.toBeNull();
});
it("reads shared and default query values without writing history during render", () => {
    navigation.search = "expr=7*8";
    const replace = vi.spyOn(window.history, "replaceState");
    expect(renderToString(<ToolClientFrame toolId="example" ToolComponent={QueryTool} defaultQuery={{ expr: "2+2" }} />)).toContain("7*8");
    navigation.search = "";
    expect(renderToString(<ToolClientFrame toolId="example" ToolComponent={QueryTool} defaultQuery={{ expr: "2+2" }} />)).toContain("2+2");
    expect(replace).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
});
