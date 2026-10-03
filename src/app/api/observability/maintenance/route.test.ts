import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { maintainObservability, reportPersistenceFailure } from "@/module/observability/persistence.server";

vi.mock("@/module/observability/persistence.server", () => ({ maintainObservability: vi.fn(), reportPersistenceFailure: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "isolated-test-secret"); });
afterEach(() => vi.unstubAllEnvs());
const request = (authorization?: string) => new Request("https://example.com/api/observability/maintenance", { headers: authorization ? { authorization } : {} });
it("rejects missing CRON_SECRET configuration", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect((await GET(request("Bearer isolated-test-secret"))).status).toBe(401);
    expect(maintainObservability).not.toHaveBeenCalled();
});
it.each([undefined, "Bearer wrong", "Basic isolated-test-secret", "Bearer isolated-test-secrex"])("rejects invalid authorization %s", async authorization => {
    expect((await GET(request(authorization))).status).toBe(401);
    expect(maintainObservability).not.toHaveBeenCalled();
});
it("authorizes the exact secret and delegates maintenance", async () => {
    expect((await GET(request("Bearer isolated-test-secret"))).status).toBe(204);
    expect(maintainObservability).toHaveBeenCalledTimes(1);
});
it("returns empty 503 and a safe operation category on database failure", async () => {
    vi.mocked(maintainObservability).mockRejectedValueOnce(new Error("private connection diagnostics"));
    const response = await GET(request("Bearer isolated-test-secret"));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(reportPersistenceFailure).toHaveBeenCalledWith("maintenance");
});
