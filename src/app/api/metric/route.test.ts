import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { POST } from "./route";
import { persistMetric } from "@/module/observability/persistence.server";

vi.mock("@/module/observability/persistence.server", async importOriginal => ({ ...await importOriginal<typeof import("@/module/observability/persistence.server")>(), persistMetric: vi.fn() }));
beforeEach(() => { vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "false"); vi.clearAllMocks(); });

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const base = { timestamp: "2026-10-01T00:00:00Z", pathname: "/" };
const request = (body: unknown) => new Request("http://localhost/api/metric", { method: "POST", body: JSON.stringify(body) });
it.each([
    { ...base, type: "analytic-event", event: "tool_opened", prop: { toolId: "image-resizer", slug: "image-resizer" } },
    { ...base, type: "web-vital", name: "CLS", value: 0.01, delta: 0.01, id: "v5-123" },
    { ...base, type: "navigation", navigationType: "push" },
    { ...base, type: "client-error", failureCategory: "tool-render-error", toolId: "image-resizer", deviceClass: "tablet" },
])("accepts validated $type with 204 and structured logs", async body => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await POST(request(body))).status).toBe(204);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ source: "application-metric", ...body });
});
it.each([{}, { ...base, type: "unknown" }, { ...base, type: "navigation", navigationType: "push", filename: "private.png" }, { ...base, type: "web-vital", name: "CLS", value: "invalid", delta: 1, id: "v5" }, { ...base, type: "navigation", navigationType: "push", metadata: "x".repeat(9000) }])("rejects malformed/oversized/unknown metadata", async body => {
    expect((await POST(request(body))).status).toBe(400);
});
it("rejects invalid JSON", async () => expect((await POST(new Request("http://localhost/api/metric", { method: "POST", body: "{" }))).status).toBe(400));
it("disabled persistence never connects", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await POST(request({ ...base, type: "client-error", failureCategory: "unknown" }))).status).toBe(204);
    expect(persistMetric).not.toHaveBeenCalled();
});
it("enabled persistence inserts accepted events", async () => {
    vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const body = { ...base, type: "client-error", failureCategory: "window-error" };
    expect((await POST(request(body))).status).toBe(204);
    expect(persistMetric).toHaveBeenCalledWith(body);
});
it("database/configuration failure returns no diagnostics", async () => {
    vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
    vi.mocked(persistMetric).mockRejectedValueOnce(new Error("postgresql://private:password@secret-host/db"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request({ ...base, type: "client-error", failureCategory: "unknown" }));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/private|password|secret-host|postgresql/);
});
it.each(["message", "stack", "meta", "filename", "error"])("rejects client error diagnostic %s", async key => {
    expect((await POST(request({ ...base, type: "client-error", failureCategory: "unknown", [key]: "private" }))).status).toBe(400);
});
it.each(["not-allowed", undefined])("rejects invalid error category %s", async failureCategory => {
    expect((await POST(request({ ...base, type: "client-error", failureCategory }))).status).toBe(400);
});
it.each(["/?private", "/#secret"])("rejects query/hash before any database call", async pathname => {
    vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
    expect((await POST(request({ ...base, pathname, type: "client-error", failureCategory: "unknown" }))).status).toBe(400);
    expect(persistMetric).not.toHaveBeenCalled();
});
it("rejects cross-origin production ingestion before logging or persistence", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
    expect((await POST(new Request("https://example.com/api/metric", { method: "POST", headers: { origin: "https://other.invalid" }, body: JSON.stringify({ ...base, type: "client-error", failureCategory: "unknown" }) }))).status).toBe(403);
    expect(persistMetric).not.toHaveBeenCalled();
});
