import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventRecord, maintainObservability, persistMetric, reportPersistenceFailure, sameOriginMetricRequest } from "./persistence.server";

const { query, sql, neonMock } = vi.hoisted(() => {
    const query = vi.fn().mockResolvedValue([]);
    const sql = Object.assign(vi.fn().mockResolvedValue([]), { query });
    return { query, sql, neonMock: vi.fn(() => sql) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/fixture"); });
afterEach(() => vi.unstubAllEnvs());
const base = { timestamp: "1900-01-01T00:00:00Z", pathname: "/" };
describe("durable observability projection", () => {
    it("normalizes absent viewport and never persists client timestamp or vital identifiers", async () => {
        const metric = { ...base, type: "web-vital" as const, name: "LCP", value: 500, delta: 5, id: "v5-1" };
        expect(eventRecord(metric)).toEqual({ kind: "web-vital", pathname: "/", toolId: null, eventName: null, metricName: "LCP", metricValue: 500, metricRating: null, failureCategory: null, deviceClass: "unknown", referrerHost: null, navigationType: null });
        await persistMetric(metric);
        expect(sql).toHaveBeenCalledTimes(1);
        const args = sql.mock.calls[0];
        expect(args.slice(1)).not.toContain(base.timestamp);
        expect(args.slice(1)).not.toContain("v5-1");
        expect(args[0].join("")).toMatch(/INSERT INTO observability.event/);
    });
    it("projects each approved variant using only explicit columns", () => {
        expect(eventRecord({ ...base, type: "analytic-event", event: "tool_executed", prop: { toolId: "image-resizer", slug: "image-resizer" } })).toMatchObject({ toolId: "image-resizer", eventName: "tool_executed" });
        expect(eventRecord({ ...base, type: "navigation", navigationType: "initial", referrerHostname: "example.com" })).toMatchObject({ referrerHost: "example.com", navigationType: "initial" });
        expect(eventRecord({ ...base, type: "client-error", failureCategory: "tool-render-error", toolId: "image-resizer", deviceClass: "mobile" })).toMatchObject({ failureCategory: "tool-render-error", toolId: "image-resizer", deviceClass: "mobile" });
    });
    it("fails clearly on missing configuration without printing credentials", async () => {
        vi.stubEnv("OBSERVABILITY_DATABASE_URL", undefined);
        await expect(persistMetric({ ...base, type: "client-error", failureCategory: "unknown" })).rejects.toThrow("configuration missing");
        expect(neonMock).not.toHaveBeenCalled();
    });
    it("maintenance calls the transactional SQL owner only when enabled", async () => {
        vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "false");
        await expect(maintainObservability()).rejects.toThrow("disabled");
        expect(query).not.toHaveBeenCalled();
        vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
        await maintainObservability();
        expect(query).toHaveBeenCalledWith("SELECT rolled_day_count, deleted_event_count FROM observability.maintain()", []);
    });
    it("operational logs have a fixed safe shape", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        reportPersistenceFailure("insert");
        expect(JSON.parse(log.mock.calls[0][0])).toEqual({ source: "observability-operation", operation: "insert", status: "unavailable" });
        log.mockRestore();
    });
    it.each([
        [{ origin: "https://example.com", "sec-fetch-site": "same-origin" }, true],
        [{ origin: "https://attacker.invalid" }, false],
        [{ "sec-fetch-site": "cross-site" }, false],
        [{ "sec-fetch-site": "same-site" }, false],
        [{ "sec-fetch-site": "none" }, true],
        [{}, true],
    ])("checks available production browser headers %j", (headers, accepted) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
        expect(sameOriginMetricRequest(new Request("https://example.com/api/metric", { headers: headers as HeadersInit }))).toBe(accepted);
        vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "false");
        expect(sameOriginMetricRequest(new Request("https://example.com/api/metric", { headers: { origin: "https://other.invalid" } }))).toBe(true);
    });
});
