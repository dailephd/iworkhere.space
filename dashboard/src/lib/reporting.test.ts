import { describe, expect, it } from "vitest";
import { dashboardModel } from "./model";
import { dashboardQuery } from "./query";
import { activitySource, vitalQuery } from "./aggregateQuery";
import { RANGE, rangePlan } from "./range";
import { reportingQuery } from "./reportingQuery";
import { MAX_REPORTING_BYTES, reportingModel, reportingRequest, serializeReportingResponse } from "./reportingModel";
import identity from "./reportingIdentity.json";
import { reportingFixture, reportingNow as now } from "../test/reportingFixture";
import { fixtureRepository } from "../test/fixtureRepository";

const request = { schemaVersion: 1, range: "24h" };
const response = () => reportingModel(request, reportingFixture(), now);

describe("range and existing dashboard equivalence", () => {
    it.each(RANGE)("preserves %s totals, vital statistics and current day", range => {
        const plan = rangePlan(range, now), dashboard = dashboardModel(fixtureRepository(plan), plan);
        const report = reportingModel({ schemaVersion: 1, range }, reportingFixture(range), now);
        expect([report.navigationCount, report.toolOpenCount, report.toolExecutionCount, report.clientErrorCount]).toEqual([dashboard.navigation, dashboard.opens, dashboard.executions, dashboard.errors]);
        expect(report.toolActivity[0]).toEqual({ toolId: dashboard.tool[0].name, opens: dashboard.tool[0].opens, executions: dashboard.tool[0].executions, errors: dashboard.tool[0].errors });
        expect(report.routeActivity.map(item => ({ name: item.route, count: item.count }))).toEqual(dashboard.route);
        expect(report.vital.map(item => [item.value, item.sampleCount])).toEqual(dashboard.performance.map(item => [item.value, item.sampleCount]));
        expect(report.vital.every(item => item.statistic === (plan.source === "raw" ? "range_p75" : "typical_daily_p75"))).toBe(true);
        expect(report.start).toBe(plan.start); expect(report.end).toBe(plan.end);
        const query = reportingQuery(plan);
        expect(query.vital).toEqual(dashboardQuery(plan).vital);
        expect(query.vital).toEqual(vitalQuery(plan));
        expect(dashboardQuery(plan).activity.text).toContain(activitySource(plan));
        expect(query.activity.text).toContain(activitySource(plan, "reporting"));
        if (plan.source === "daily") {
            expect(query.activity.text).toContain("day < ($3::timestamptz");
            expect(query.activity.text).toContain("occurred_at >= $3::timestamptz");
        }
        expect(serializeReportingResponse(report)).not.toMatch(/Resize worker|stack|fingerprint|FixtureBrowser|search.example/);
    });
    it.each([
        ["24h", "2024-03-01T00:00:00Z", "2024-02-29T00:00:00.000Z"],
        ["24h", "2027-01-01T00:00:00Z", "2026-12-31T00:00:00.000Z"],
        ["1y", "2024-02-29T23:59:59Z", "2023-02-28T00:00:00.000Z"],
        ["1y", "2025-03-01T00:00:00Z", "2024-03-01T00:00:00.000Z"],
        ["7d", "2027-01-01T00:00:00Z", "2026-12-25T00:00:00.000Z"],
    ] as const)("uses UTC/calendar boundary for %s %s", (range, instant, start) => expect(rangePlan(range, new Date(instant)).start).toBe(start));
    it("keeps rolling 24h distinct from yesterday", () => expect(rangePlan("24h", now).start).toBe("2026-09-30T12:00:00.000Z"));
    it("represents empty selected data with null vitals, not invented samples", () => {
        const fixture = reportingFixture();
        fixture.activity = [{ section: "total", identity: null, opens: 0, executions: 0, errors: 0, navigation: 0 }]; fixture.vital = [];
        const result = reportingModel(request, fixture, now);
        expect(result.navigationCount).toBe(0); expect(result.toolActivity).toEqual([]);
        expect(result.vital.every(item => item.value === null && item.sampleCount === 0)).toBe(true);
        expect(result.health.state).toBe("INSUFFICIENT_EVIDENCE");
    });
});
describe("complete totals and independent rankings", () => {
    it("ranks executions over all tools before top ten; totals include omitted rows", () => {
        const tools = identity.tool.slice(0, 12).map((item, index) => ({ section: "tool", identity: item.id, opens: index < 10 ? 100 : 0, executions: index === 11 ? 99 : 1, errors: 0, navigation: 0 }));
        const fixture = reportingFixture();
        fixture.activity = [{ section: "total", identity: null, opens: 1000, executions: 110, errors: 0, navigation: 0 }, ...tools];
        const result = reportingModel(request, fixture, now);
        expect(result.toolActivity).toHaveLength(10); expect(result.toolActivity.some(item => item.toolId === identity.tool[11].id)).toBe(false);
        expect(result.executionActivity[0].toolId).toBe(identity.tool[11].id);
        expect(result.toolOpenCount).toBe(1000); expect(result.toolExecutionCount).toBe(110);
        expect(result.limited.omittedActivityTools).toBe(2); expect(result.limited.omittedExecutionTools).toBe(2);
        expect(Buffer.byteLength(serializeReportingResponse(result))).toBeLessThan(MAX_REPORTING_BYTES);
    });
    it("preserves all route totals and reports omitted ranked routes", () => {
        const routes = identity.route.slice(0, 12).map((route, index) => ({ section: "route", identity: route, opens: 0, executions: 0, errors: 0, navigation: index + 1 }));
        const fixture = reportingFixture(); fixture.activity = [{ section: "total", identity: null, opens: 0, executions: 0, errors: 0, navigation: 78 }, ...routes];
        const result = reportingModel(request, fixture, now);
        expect(result.navigationCount).toBe(78); expect(result.routeActivity[0].count).toBe(12); expect(result.limited.omittedRoutes).toBe(2);
    });
    it("accepts explicit Other bucket without returning untrusted identities", () => {
        const fixture = reportingFixture(); fixture.activity = [
            { section: "total", identity: null, opens: 1, executions: 0, errors: 0, navigation: 1 },
            { section: "tool", identity: null, opens: 1, executions: 0, errors: 0, navigation: 0 },
            { section: "route", identity: null, opens: 0, executions: 0, errors: 0, navigation: 1 }];
        const result = reportingModel(request, fixture, now); expect(result.toolActivity[0].toolId).toBeNull(); expect(result.routeActivity[0].route).toBeNull();
    });
});
describe("fixed read-only query boundary", () => {
    it.each(RANGE)("uses minimal parameterized %s queries and explicit health evidence", range => {
        const query = reportingQuery(rangePlan(range, now));
        for (const item of Object.values(query)) {
            expect(item.text).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|support|error_diagnostic|message|stack|cause|referrer_host)\b/i);
            expect(item.text).not.toContain("SELECT *"); expect(item.text).not.toContain("LIMIT 10");
        }
        expect(query.activity.text).toContain("jsonb_array_elements_text");
        expect(query.evidence.text).toContain("missing AND overdue");
        expect(query.evidence.text).toContain("NOT EXISTS");
        expect(query.evidence.text).toContain("interval '90 days'");
        expect(query.evidence.text).toContain("interval '3 hours 15 minutes'");
        expect(query.evidence.parameter).toEqual([now.toISOString(), "2026-10-01T00:00:00.000Z"]);
    });
});
describe("strict request and privacy boundary", () => {
    it.each([{}, null, [], { ...request, schemaVersion: 2 }, { ...request, range: "yesterday" }, { ...request, sql: "SELECT 1" }, { ...request, range: ["7d"] }, { ...request, range: "24h; DROP TABLE" }])("rejects invalid request %j", value => expect(() => reportingRequest(value)).toThrow("invalid_request"));
    const forbidden = ["contact@example.invalid", "Bearer secret", "postgresql://secret", "C:\\private\\file.txt", "(2+2)*100", "filename.pdf", { message: "private", stack: "secret", cause: { context: ["support text"] } }, ["browser input", { contact_email: "private" }]];
    it.each(forbidden)("rejects forbidden data at every object depth: %j", payload => {
        const targets = [[], ["semantics"], ["toolActivity", 0], ["executionActivity", 0], ["routeActivity", 0], ["clientError", 0], ["vital", 0], ["health"], ["health", "evidence"], ["limited"]];
        for (const target of targets) {
            const result = structuredClone(response()) as unknown as Record<string, unknown>;
            let item: unknown = result;
            for (const key of target) item = (item as Record<string | number, unknown>)[key];
            (item as Record<string, unknown>).summary = payload;
            expect(() => serializeReportingResponse(result)).toThrow();
        }
    });
    it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1, "private text", { error: "secret" }, ["secret"]])("rejects invalid count %j before output", payload => {
        const result = { ...response(), navigationCount: payload }; expect(() => serializeReportingResponse(result)).toThrow();
    });
    it("rejects unsafe identities, units, statistics, strings and numeric measurements", () => {
        const mutate = [(r: ReturnType<typeof response>) => { r.toolActivity[0].toolId = "unknown-tool"; },
            (r: ReturnType<typeof response>) => { r.routeActivity[0].route = "/private/customer"; },
            (r: ReturnType<typeof response>) => { r.vital[0].unit = "seconds" as never; },
            (r: ReturnType<typeof response>) => { r.vital[0].statistic = "mean" as never; },
            (r: ReturnType<typeof response>) => { r.vital[0].value = NaN; },
            (r: ReturnType<typeof response>) => { r.vital[0].value = Infinity; },
            (r: ReturnType<typeof response>) => { r.health.reason = ["raw private exception" as never]; },
            (r: ReturnType<typeof response>) => { r.end = "private@example.invalid"; }];
        for (const change of mutate) { const result = response(); change(result); expect(() => serializeReportingResponse(result)).toThrow(); }
    });
    it("rejects unexpected producer rows and diagnostic/support-shaped result objects", () => {
        for (const payload of forbidden) {
            const fixture = reportingFixture(); (fixture.activity as Record<string, unknown>[])[0].summary = payload;
            expect(() => reportingModel(request, fixture, now)).toThrow();
        }
        expect(() => reportingModel(request, { ...reportingFixture(), diagnostic: [{ message: "secret" }] }, now)).toThrow();
        expect(() => reportingModel(request, { error: { description: "support" } }, now)).toThrow();
        const fixture = reportingFixture(); (fixture.activity as Record<string, unknown>[])[1].identity = "unknown-tool";
        expect(() => reportingModel(request, fixture, now)).toThrow();
    });
    it("rejects oversized, sparse, accessor, prototype and serialization-hook results", () => {
        expect(() => serializeReportingResponse({ ...response(), summary: "secret".repeat(20000) })).toThrow();
        expect(() => serializeReportingResponse({ ...response(), toolActivity: Array(10000).fill(response().toolActivity[0]) })).toThrow();
        const sparse = response(); sparse.toolActivity = Array(2); expect(() => serializeReportingResponse(sparse)).toThrow();
        const accessor = response(); Object.defineProperty(accessor, "navigationCount", { get() { throw new Error("must not execute"); } }); expect(() => serializeReportingResponse(accessor)).toThrow("invalid_result");
        const result = response(); Object.defineProperty(result, "toJSON", { value: () => "private" }); expect(() => serializeReportingResponse(result)).toThrow();
        expect(() => serializeReportingResponse(Object.assign(Object.create({ private: "secret" }), response()))).toThrow();
    });
    it("rejects inconsistent or overflowing producer totals and duplicate vital rows", () => {
        const fixture = reportingFixture(); (fixture.activity as Record<string, unknown>[])[0].opens = Number.MAX_SAFE_INTEGER;
        expect(() => reportingModel(request, fixture, now)).toThrow();
        const duplicate = reportingFixture(); duplicate.vital = [ ...(duplicate.vital as unknown[]), (duplicate.vital as unknown[])[0] ];
        expect(() => reportingModel(request, duplicate, now)).toThrow();
    });
});

it("rejects forged query plans before constructing statements", () => {
    const plan = rangePlan("24h", now);
    for (const change of [{ start: "2026-01-01T00:00:00.000Z" }, { end: "DROP TABLE" }, { source: "daily" }, { today: "2026-09-30T00:00:00.000Z" }, { granularity: "month" }, { range: "yesterday" }, { sql: "SELECT 1" }]) {
        expect(() => reportingQuery({ ...plan, ...change } as never)).toThrow();
    }
});
it("rejects invalid error categories, missing keys, response versions and inconsistent health", () => {
    const result = response();
    result.clientError[0].category = "server-stack" as never;
    expect(() => serializeReportingResponse(result)).toThrow();
    expect(() => serializeReportingResponse({ ...response(), schemaVersion: 2 })).toThrow();
    const missing = response() as unknown as Record<string, unknown>; delete missing.start;
    expect(() => serializeReportingResponse(missing)).toThrow();
    const health = response(); health.health.state = "HEALTHY_WITH_EVIDENCE";
    expect(() => serializeReportingResponse(health)).toThrow();
});
it("rejects malformed intermediate rows, unknown metrics, unsafe routes and oversized row sets", () => {
    for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "3.14", "1e2", "secret expression"]) {
        const fixture = reportingFixture(); (fixture.activity as Record<string, unknown>[])[0].navigation = value;
        expect(() => reportingModel(request, fixture, now)).toThrow();
    }
    const unknown = reportingFixture(); (unknown.vital as Record<string, unknown>[])[0].metric_name = "private";
    expect(() => reportingModel(request, unknown, now)).toThrow();
    const route = reportingFixture(); (route.activity as Record<string, unknown>[]).find(item => item.section === "route")!.identity = "/?token=private";
    expect(() => reportingModel(request, route, now)).toThrow();
    const huge = reportingFixture(); huge.activity = Array(10000).fill((huge.activity as unknown[])[0]);
    expect(() => reportingModel(request, huge, now)).toThrow();
});

it("rejects inconsistent top-N and omitted-result claims", () => {
    const result = response(); result.limited.omittedRoutes = 1;
    expect(() => serializeReportingResponse(result)).toThrow();
    const totals = response(); totals.toolActivity.push({ toolId: "calculator", opens: totals.toolOpenCount, executions: 0, errors: 0 });
    expect(() => serializeReportingResponse(totals)).toThrow();
});
