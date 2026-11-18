import { expect, it, vi } from "vitest";
import { collectWindow } from "./reportingCollector";
import { PUBLIC_PROJECT } from "./reportingMonitoringSource";
import { invocationCount, reconcileWindow } from "./reportingMonitoringWindow";
import { vercelMonitoringProvider, vercelReadCommand, type VercelReadRequest } from "./reportingVercelSource";

const window = { start: "2026-11-18T11:00:00.000Z", end: "2026-11-18T11:05:00.000Z" };
const observed = "2026-11-18T11:20:00.000Z";
const attempt = { source: "observability-health", schemaVersion: 1, operation: "ingestion", status: "attempt", attemptId: "00000000-0000-4000-8000-000000000001", startedAt: "2026-11-18T11:01:00.000Z", timestamp: "2026-11-18T11:01:00.000Z" };
const success = { ...attempt, status: "success", timestamp: "2026-11-18T11:01:01.000Z" };
const log = () => ({ requestId: "private-request", timestamp: attempt.startedAt, requestPath: "/api/metric", requestMethod: "POST", statusCode: 204, environment: "production", logs: [{ message: JSON.stringify(attempt) }, { message: JSON.stringify(success) }, { message: "private diagnostic support text" }], headers: { authorization: "private" } });
const point = (value = 1) => ({ dimensions: { requestPath: "/api/metric", requestMethod: "POST", httpStatus: "204" }, values: { value } });
const counter = () => ({ summary: [point()], series: [{ ...point(), timestamp: window.start }], queryId: "private-query", meta: { statistics: {} } });

it("uses only the fixed project-scoped APIs, with no account/team discovery", async () => {
    const read = vi.fn(async (request: VercelReadRequest) => JSON.stringify(request.kind === "logs" ? { rows: [log()], hasMoreRows: false } : counter()));
    const provider = vercelMonitoringProvider(read);
    const logs = await provider.logs(window), counts = invocationCount(await provider.counts(window), window);
    expect(reconcileWindow(window, observed, logs, counts)).toMatchObject({ outcome: "complete", requestCount: 1, records: [{ ...attempt, httpStatus: 204 }, { ...success, httpStatus: 204 }] });
    expect(logs).not.toMatch(/private diagnostic|support text|headers|authorization|private-query/);
    expect(read.mock.calls[0][0].path).toContain(`projectId=${PUBLIC_PROJECT}`);
    expect(read.mock.calls[1][0].body).toMatchObject({ scope: { projectIds: [PUBLIC_PROJECT] }, bucketSeconds: 300, metrics: { value: { metric: "vercel.function_invocation.count", aggregation: "count" } }, outputs: ["value"] });
    for (const [request] of read.mock.calls) {
        const command = vercelReadCommand(request);
        expect(command.args).not.toContain("--scope");
        expect(command.args).not.toContain("--token");
        expect(command.args).toContain("--non-interactive");
        expect(command.args.join(" ")).not.toMatch(/\/teams|\/user|--all/);
    }
});
it("does not turn absent API fields into independent zero traffic", async () => {
    const provider = vercelMonitoringProvider(async () => "{}");
    await expect(provider.logs(window)).rejects.toThrow();
    await expect(provider.counts(window)).rejects.toThrow();
});
it.each([Date.parse(attempt.startedAt), "2026-11-18T11:01:00Z"])("preserves platform timestamp precision", async timestamp => {
    const provider = vercelMonitoringProvider(async () => JSON.stringify({ rows: [{ ...log(), timestamp }], hasMoreRows: false }));
    expect(JSON.parse(await provider.logs(window)).timestamp).toBe(Date.parse(attempt.startedAt));
});
it("follows bounded request-log pagination without storing unrelated messages", async () => {
    const read = vi.fn().mockResolvedValueOnce(JSON.stringify({ rows: [log()], hasMoreRows: true })).mockResolvedValueOnce(JSON.stringify({ rows: [], hasMoreRows: false }));
    expect((await vercelMonitoringProvider(read).logs(window)).split("\n")).toHaveLength(1);
    expect(read.mock.calls[1][0].path).toContain("page=1");
});
it("fails partial on pagination failure while retaining valid independent counters", async () => {
    const read = vi.fn(async (request: VercelReadRequest) => {
        if (request.kind === "counts") return JSON.stringify(counter());
        if (request.path.includes("page=1")) throw Error("private provider token");
        return JSON.stringify({ rows: [log()], hasMoreRows: true });
    });
    const finish = vi.fn(async () => {});
    expect(await collectWindow(window, { begin: async () => {}, finish }, vercelMonitoringProvider(read), () => new Date(observed))).toBe("partial");
    expect(finish).toHaveBeenCalledWith(expect.any(String), window, expect.objectContaining({ independentRequestCount: 1, records: [] }));
    expect(JSON.stringify(finish.mock.calls)).not.toContain("private provider token");
});
it.each([
    { rows: [log()], hasMoreRows: "false" },
    { rows: [{ ...log(), environment: "preview" }], hasMoreRows: false },
    { rows: [{ ...log(), projectId: "other" }], hasMoreRows: false },
    { rows: [{ ...log(), timestamp: "private" }], hasMoreRows: false },
    { rows: [{ ...log(), logs: [{ message: "truncated", messageTruncated: true }] }], hasMoreRows: false },
    { rows: [{ ...log(), logs: [{ message: JSON.stringify({ ...attempt, harmless: { support: "private" } }) }] }], hasMoreRows: false },
])("rejects unavailable, truncated and private operation evidence", async value => {
    await expect(vercelMonitoringProvider(async () => JSON.stringify(value)).logs(window)).rejects.toThrow();
});
it("bounds pages, requests and total source bytes", async () => {
    const provider = vercelMonitoringProvider(async () => JSON.stringify({ rows: Array(1000).fill(log()), hasMoreRows: true }));
    await expect(provider.logs(window)).rejects.toThrow("source_truncated");
    await expect(vercelMonitoringProvider(async () => "x".repeat(8 * 1024 * 1024 + 1)).logs(window)).rejects.toThrow("source_truncated");
});
it("retains the explicit source-truncation checkpoint reason", async () => {
    const finish = vi.fn(async () => {});
    const provider = vercelMonitoringProvider(async request => request.kind === "logs"
        ? JSON.stringify({ rows: Array(1000).fill(log()), hasMoreRows: true }) : JSON.stringify(counter()));
    await collectWindow(window, { begin: async () => {}, finish }, provider, () => new Date(observed));
    expect(finish).toHaveBeenCalledWith(expect.any(String), window, expect.objectContaining({ outcome: "partial", reason: "source_truncated" }));
});
it.each([NaN, Infinity, -1, 9007199254740992])("rejects invalid counter values", async value => {
    const raw = { ...counter(), summary: [point(value)] };
    const provider = vercelMonitoringProvider(async () => JSON.stringify(raw));
    await expect(provider.counts(window)).rejects.toThrow();
});
it("rejects unknown dimensions, unsafe identity strings and capped counter groups", async () => {
    for (const raw of [
        { ...counter(), summary: [{ ...point(), dimensions: { ...point().dimensions, email: "private" } }] },
        { ...counter(), summary: [{ ...point(), dimensions: { ...point().dimensions, requestPath: "/private?token=x" } }] },
        { ...counter(), summary: Array(100).fill(point()) },
    ]) await expect(vercelMonitoringProvider(async () => JSON.stringify(raw)).counts(window)).rejects.toThrow();
});
it("retains independent failure evidence when application logs are unavailable", async () => {
    const read = async (request: VercelReadRequest) => {
        if (request.kind === "logs") throw Error("unavailable");
        return JSON.stringify({ ...counter(), summary: [{ dimensions: { ...point().dimensions, httpStatus: "503" }, values: { value: 2 } }], series: [] });
    };
    const finish = vi.fn(async () => {});
    await collectWindow(window, { begin: async () => {}, finish }, vercelMonitoringProvider(read), () => new Date(observed));
    expect(finish).toHaveBeenCalledWith(expect.any(String), window, expect.objectContaining({ outcome: "partial", independentFailureCount: 2 }));
});
