// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ToolErrorBoundary } from "./ToolErrorBoundary";
import { RustLogProvider } from "@/module/log/RustLogProvider";
import { setLogProvider } from "@/module/log/logger";
import { reportClientError } from "@/module/observability/clientInstrumentation";
import { webcrypto } from "node:crypto";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("renders recovery UI and emits one technical log plus one safe error metric", async () => {
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", "true");
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("crypto", webcrypto);
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    setLogProvider(new RustLogProvider());
    const error = new Error("private-file.png must not enter metrics");
    function ThrowingTool(): React.ReactNode { throw error; }
    const element = document.createElement("div");
    const root = createRoot(element);
    try {
        await act(async () => { root.render(<ToolErrorBoundary toolId="image-resizer"><ThrowingTool /></ToolErrorBoundary>); });
        expect(element.textContent).toContain("Something went wrong");
        expect(element.querySelector("button")?.textContent).toBe("Try again");
        reportClientError(error, "window-error");
        await vi.waitFor(() => expect(fetchMock.mock.calls.filter(call => call[0] === "/api/log")).toHaveLength(1));
        const metrics = fetchMock.mock.calls.filter(call => call[0] === "/api/metric");
        const logs = fetchMock.mock.calls.filter(call => call[0] === "/api/log");
        expect(metrics).toHaveLength(1);
        expect(logs).toHaveLength(1);
        expect(JSON.parse(logs[0][1].body).diagnostic).toMatchObject({ error: { message: error.message }, context: { failureCategory: "tool-render-error", boundary: "ToolErrorBoundary", componentStack: expect.stringContaining("ThrowingTool") } });
        expect(JSON.parse(metrics[0][1].body)).toMatchObject({ type: "client-error", failureCategory: "tool-render-error", toolId: "image-resizer" });
        expect(metrics[0][1].body).not.toMatch(/private-file|message|stack|meta/);
    } finally { await act(async () => root.unmount()); }
});
