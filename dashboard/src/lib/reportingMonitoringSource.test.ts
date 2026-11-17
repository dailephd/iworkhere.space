import { expect, it } from "vitest";
import { healthOperationMessages } from "./reportingMonitoringSource";
import { collectReportingMonitoring } from "./reportingMonitoring";
const event = { source: "observability-health", schemaVersion: 1, operation: "ingestion", status: "attempt", attemptId: "00000000-0000-4000-8000-000000000001", startedAt: "2026-11-17T10:00:00.000Z", timestamp: "2026-11-17T10:00:00.000Z" };
const row = () => ({ projectId: "prj_OZIQho0P485NwArPlWTQuYfSQtNI", environment: "production", requestPath: "/api/metric", headers: { authorization: "private" }, message: "support private@example.invalid", logs: [{ message: JSON.stringify(event) }, { message: "private diagnostic stack" }] });
it("projects only fixed operational messages from the exact public project/runtime path", () => expect(healthOperationMessages(JSON.stringify(row()))).toEqual([event]));
it.each([{ environment: "preview" }, { projectId: "other" }, { requestPath: "/api/support/report" }, { requestPath: "/api/log" }])("ignores wrong provider scope %j", extra => expect(healthOperationMessages(JSON.stringify({ ...row(), ...extra }))).toEqual([]));
it("rejects malformed and oversized provider results without returning diagnostics", () => {
    expect(() => healthOperationMessages("not JSON private")).toThrow("log_shape");
    expect(() => healthOperationMessages("x".repeat(8 * 1024 * 1024 + 1))).toThrow("log_limit");
});
it("rejects private values hiding in apparently harmless operational properties before durable summary", () => {
    const value = { ...row(), logs: [{ message: JSON.stringify({ ...event, safe: { values: ["support body"] } }) }] };
    const messages = healthOperationMessages(JSON.stringify(value));
    expect(() => collectReportingMonitoring("2026-11-17T12:00:00.000Z", { from: "2026-11-17T11:00:00.000Z", until: "2026-11-17T12:00:00.000Z", instrumentedFrom: "2026-11-17T00:00:00.000Z", complete: false }, messages)).toThrow();
});
