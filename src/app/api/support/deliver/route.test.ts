import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST, dynamic, maxDuration, runtime } from "./route";

const { neonMock, query } = vi.hoisted(() => {
    const query = vi.fn();
    return { query, neonMock: vi.fn(() => ({ query })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));

const request = (authorization?: string, method = "GET") => new Request("https://iworkhere.space/api/support/deliver", { method, headers: authorization ? { authorization } : {} });
beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); query.mockReset(); query.mockResolvedValue([]); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("is a dynamic Node.js route with a bounded duration", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
    expect(maxDuration).toBeLessThanOrEqual(60);
});
it.each([[undefined], ["Bearer nope"]])("performs no work and never connects for authorization %j", async authorization => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("SUPPORT_WORKER_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    for (const handler of [GET, POST]) expect((await handler(request(authorization))).status).toBe(401);
    expect(neonMock).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
it("uses only the dedicated worker credential and drains an empty queue for Vercel Cron (GET)", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("SUPPORT_WORKER_DATABASE_URL", "postgresql://worker:fixture@example.invalid/db");
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://obs:fixture@example.invalid/db");
    vi.stubEnv("SUPPORT_RETENTION_ENABLED", "");
    const response = await GET(request("Bearer cron-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 0, delivered: 0, retried: 0, dead: 0, purged: false });
    expect(neonMock).toHaveBeenCalledWith("postgresql://worker:fixture@example.invalid/db", expect.anything());
    expect(query.mock.calls.map(call => call[0]).join()).not.toMatch(/purge_expired/);
});
it("accepts a manual POST with the same secret and enables purge only on the explicit retention flag", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("SUPPORT_WORKER_DATABASE_URL", "postgresql://worker:fixture@example.invalid/db");
    vi.stubEnv("SUPPORT_RETENTION_ENABLED", "true");
    const response = await POST(request("Bearer cron-secret", "POST"));
    expect(response.status).toBe(200);
    expect((await response.json()).purged).toBe(true);
});
it("answers 503 when the worker credential is absent, without echoing configuration", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("SUPPORT_WORKER_DATABASE_URL", "");
    const response = await GET(request("Bearer cron-secret"));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
});
