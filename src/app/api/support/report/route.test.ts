import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST, dynamic, runtime } from "./route";

const { neonMock, query } = vi.hoisted(() => {
    const query = vi.fn();
    return { query, neonMock: vi.fn(() => ({ query })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));

const KEY = "5f1f2b0e-9a3c-4b8a-8d1e-0a1b2c3d4e5f";
const report = (overrides: Record<string, unknown> = {}) => ({
    schemaVersion: 1, category: "tool_failure", area: "tool", toolId: "merge-pdf", pathname: "/tool/merge-pdf", description: "The download is empty.",
    contactConsent: false, idempotencyKey: KEY, turnstileToken: "challenge-token", ...overrides,
});
const request = (body: unknown) => new Request("https://iworkhere.space/api/support/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const verifierSucceeds = () => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })));

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("SUPPORT_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    vi.stubEnv("SUPPORT_TURNSTILE_SECRET", "server-secret");
    query.mockReset();
    query.mockResolvedValue([{ outcome: "created", report_id: "SR-0123456789ABCDEF", received_at: "2026-10-19T12:00:00Z" }]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("is a dynamic Node.js route so a receipt always comes from a live database call", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
});
it("accepts a registered tool, verifies the challenge and returns the durable receipt", async () => {
    verifierSucceeds();
    const response = await POST(request(report()));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ schemaVersion: 1, reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" });
    expect(neonMock).toHaveBeenCalledWith("postgresql://fixture:fixture@example.invalid/db", expect.anything());
    expect(query).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(query.mock.calls)).not.toContain("challenge-token");
});
it("rejects a tool that is not in the registry before any provider or database call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(request(report({ toolId: "not-a-registered-tool" })));
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
it("fails closed when the challenge secret is missing", async () => {
    vi.stubEnv("SUPPORT_TURNSTILE_SECRET", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await POST(request(report()))).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
it("answers 503 without a receipt when the intake database is not configured", async () => {
    verifierSucceeds();
    vi.stubEnv("SUPPORT_DATABASE_URL", "");
    const response = await POST(request(report()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
});
it("answers 503 when the database call fails", async () => {
    verifierSucceeds();
    query.mockRejectedValue(new Error("connection reset"));
    expect((await POST(request(report()))).status).toBe(503);
});
it("does not expose other HTTP methods", async () => {
    const route = await import("./route");
    expect(Object.keys(route).filter(name => /^(GET|PUT|PATCH|DELETE)$/.test(name))).toEqual([]);
});
