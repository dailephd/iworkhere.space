import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { beforeEach } from "vitest";
import { createErrorDiagnostic, serializeDiagnosticError } from "@/module/observability/diagnostic";
const valid = { level: "info", message: "Application event", timestamp: "2026-10-01T00:00:00Z", pathname: "/tool/image-resizer", meta: { toolId: "image-resizer" } };
const request = (body: unknown) => new Request("http://localhost/api/log", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "false"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it.each(["debug", "info", "warn", "error"])("accepts safe %s structured logs", async level => {
    const log = vi.spyOn(console, level === "warn" ? "warn" : level === "error" ? "error" : "log").mockImplementation(() => {});
    expect((await POST(request({ ...valid, level }))).status).toBe(204);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ source: "application-log", ...valid, level });
});
it.each([{}, { ...valid, level: "critical" }, { ...valid, message: "x".repeat(4097) }, { ...valid, url: "https://example.com/?private" }, { ...valid, meta: { filename: "private.png" } }, { ...valid, pathname: "/?expr=private" }, { ...valid, timestamp: "invalid" }, { ...valid, meta: { input: "x".repeat(9000) } }])("rejects invalid or unsafe log bodies", async body => {
    expect((await POST(request(body))).status).toBe(400);
});
it("rejects invalid JSON", async () => expect((await POST(new Request("http://localhost/api/log", { method: "POST", body: "{" }))).status).toBe(400));
it("preserves actual errors, useful stacks, causes, aggregates and React context in runtime JSON", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new AggregateError([new TypeError("child failure")], "Resize worker initialization failed", { cause: new RangeError("worker cause") });
    const diagnostic = await createErrorDiagnostic(serializeDiagnosticError(error), { pathname: valid.pathname, toolId: "image-resizer", boundary: "ToolErrorBoundary", failureCategory: "tool-render-error", componentStack: "\n at ResizeTool\n at ToolErrorBoundary" }, "client");
    expect((await POST(request({ ...valid, level: "error", message: error.message, diagnostic }))).status).toBe(204);
    const record = JSON.parse(log.mock.calls[0][0]);
    expect(record).toMatchObject({ source: "application-error", id: diagnostic.id, fingerprint: diagnostic.fingerprint, error: { name: "AggregateError", message: "Resize worker initialization failed", cause: { name: "RangeError", message: "worker cause" }, errors: [{ name: "TypeError", message: "child failure" }] }, context: { componentStack: expect.stringContaining("ResizeTool") } });
    expect(record.error.stack).toContain("route.test.ts");
    expect(record.error.message).not.toBe("Client failure");
});
it("redacts representative diagnostic secrets again at the server boundary", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const diagnostic = await createErrorDiagnostic(serializeDiagnosticError(new Error("fixture")), { pathname: valid.pathname, failureCategory: "window-error" }, "client");
    diagnostic.error.message = "Resize failed password=fixture-password apiKey=fixture-api postgres://fixture-user:fixture-db@host/db\nAuthorization: Bearer fixture-auth\nCookie: fixture-cookie";
    expect((await POST(request({ ...valid, level: "error", diagnostic }))).status).toBe(204);
    const record = JSON.parse(log.mock.calls[0][0]);
    expect(record.error.message).toContain("Resize failed");
    expect(JSON.stringify(record)).not.toMatch(/fixture-password|fixture-api|fixture-db|fixture-auth|fixture-cookie/);
});
it("accepts useful stacks above the old 8 KiB bound and rejects complete payloads above 64 KiB", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("worker failed");
    error.stack = "Error: worker failed\n" + " at resize (https://example.com/app.js:10:2)\n".repeat(400);
    const diagnostic = await createErrorDiagnostic(serializeDiagnosticError(error), { pathname: valid.pathname, failureCategory: "window-error" }, "client");
    expect(JSON.stringify(diagnostic).length).toBeGreaterThan(8192);
    expect((await POST(request({ ...valid, level: "error", diagnostic }))).status).toBe(204);
    expect((await POST(new Request("http://localhost/api/log", { method: "POST", body: " ".repeat(65537) }))).status).toBe(400);
});
it("rejects browser deployment claims and arbitrary diagnostic context", async () => {
    const d = await createErrorDiagnostic(serializeDiagnosticError(new Error("safe failure")), { pathname: valid.pathname, failureCategory: "unknown" }, "client");
    for (const diagnostic of [{ ...d, deployment: { commitSha: "fake" } }, { ...d, context: { ...d.context, input: "private-user-input" } }, { ...d, error: { ...d.error, file: "private-bytes" } }, { ...d, origin: "server" }]) expect((await POST(request({ ...valid, level: "error", diagnostic }))).status).toBe(400);
});
