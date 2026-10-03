import { afterEach, expect, it, vi } from "vitest";
import { onRequestError } from "./instrumentation";
import { persistDiagnostic } from "@/module/observability/persistence.server";

vi.mock("@/module/observability/persistence.server", () => ({ persistenceEnabled: () => true, persistDiagnostic: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });
it("captures real server fields, render context and deployment without unsafe headers", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "fixture-commit");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_REGION", "iad1");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new TypeError("Server render failed password=fixture-password"), { digest: "fixture-digest" });
    await onRequestError(error, { path: "/tool/image-resizer?secret=private#fragment", method: "POST", headers: { authorization: "Bearer fixture-auth", cookie: "session=fixture-cookie", "set-cookie": "fixture-cookie", "x-forwarded-for": "192.0.2.1", "x-vercel-id": "iad1::request-fixture", unsafe: "fixture-header" } }, { routerKind: "App Router", routePath: "/tool/[slug]", routeType: "render", renderSource: "server-rendering", revalidateReason: "stale" });
    const record = JSON.parse(log.mock.calls[0][0]);
    expect(record).toMatchObject({ source: "application-error", origin: "server", severity: "error", error: { name: "TypeError", message: "Server render failed password=[REDACTED]", digest: "fixture-digest" }, context: { pathname: "/tool/image-resizer", method: "POST", routePath: "/tool/[slug]", routeType: "render", routerKind: "App Router", renderSource: "server-rendering", revalidateReason: "stale", runtime: "nodejs", requestId: "iad1::request-fixture" }, deployment: { commitSha: "fixture-commit", environment: "production", region: "iad1" } });
    expect(record.error.stack).toContain("instrumentation.test.ts");
    expect(JSON.stringify(record)).not.toMatch(/fixture-password|fixture-auth|fixture-cookie|fixture-header|192\.0\.2\.1|private|fragment|authorization|set-cookie/i);
    expect(persistDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ id: record.id, fingerprint: record.fingerprint }));
});
it("logs independently of persistence failure and never recurses", async () => {
    vi.mocked(persistDiagnostic).mockRejectedValueOnce(new Error("database password=fixture-secret"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(onRequestError(new RangeError("route failed"), { path: "/api/health?q=private", method: "GET", headers: {} }, { routerKind: "App Router", routePath: "/api/health", routeType: "route", revalidateReason: undefined })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.parse(log.mock.calls[0][0]).error.message).toBe("route failed");
    expect(log.mock.calls.join(" ")).not.toContain("fixture-secret");
    expect(persistDiagnostic).toHaveBeenCalledTimes(1);
});
