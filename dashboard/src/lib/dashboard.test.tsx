import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardView } from "../component/DashboardView";
import { fixtureRepository } from "../test/fixtureRepository";
import { dashboardModel, type DashboardData } from "./model";
import { dashboardQuery } from "./query";
import { binTime, parseRange, rangePlan, RANGE } from "./range";
import config from "../../next.config";
import { metadata } from "../app/layout";

const now = new Date("2026-10-01T12:00:00Z");
describe("canonical dashboard ranges", () => {
    it.each(RANGE)("accepts %s", range => expect(parseRange(range)).toBe(range));
    it.each([undefined, "", "all time", "today", "1d", "DROP TABLE", ["7d"], null])("falls back to 24h for %j", value => expect(parseRange(value)).toBe("24h"));
    it.each([
        ["24h", "raw", "hour"], ["7d", "raw", "day"], ["30d", "raw", "day"], ["90d", "raw", "day"],
        ["180d", "daily", "day"], ["1y", "daily", "week"], ["all", "daily", "month"],
    ] as const)("chooses %s source and granularity", (range, source, granularity) => {
        const plan = rangePlan(range, now);
        expect(plan).toMatchObject({ source, granularity });
        const query = dashboardQuery(plan);
        expect(query.activity.parameter).toHaveLength(source === "raw" ? 2 : 3);
        if (source === "raw") {
            expect(query.activity.text).not.toContain("observability.daily_event");
            expect(query.vital.text).not.toContain("observability.daily_vital");
            expect(query.vital.text).toContain("percentile_cont(0.75)");
        } else {
            expect(query.activity.text).toContain("observability.daily_event");
            expect(query.activity.text).toContain("day < ($3::timestamptz");
            expect(query.activity.text).toContain("occurred_at >= $3::timestamptz");
            expect(query.vital.text).toContain("observability.daily_vital");
            expect(query.vital.text).toContain("percentile_cont(0.50)");
        }
        expect(query.activity.text).toContain(`date_trunc('${granularity}'`);
    });
    it("uses exact rolling 90-day raw cutoff and UTC long-range boundary", () => {
        expect(rangePlan("90d", now).start).toBe("2026-07-03T12:00:00.000Z");
        expect(rangePlan("180d", now).start).toBe("2026-04-04T00:00:00.000Z");
        expect(rangePlan("1y", new Date("2024-02-29T12:00:00Z")).start).toBe("2023-02-28T00:00:00.000Z");
    });
    it("projects driver timestamps to explicit UTC ISO text for React", () => {
        const query = dashboardQuery(rangePlan("24h", now));
        expect(query.activity.text).toContain("to_char(date_trunc");
        expect(query.failure.text).toContain("to_char(occurred_at AT TIME ZONE 'UTC'");
        expect(query.freshness.text).toContain("to_char(max(received_at) AT TIME ZONE 'UTC'");
        expect(query.freshness.text).toContain("to_char(max(day), 'YYYY-MM-DD')");
        expect(query.failure.text).toContain('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    });
    it.each([
        ["hour", "2026-10-01T19:00:00.000Z"], ["day", "2026-10-01T00:00:00.000Z"],
        ["week", "2026-09-28T00:00:00.000Z"], ["month", "2026-10-01T00:00:00.000Z"],
    ] as const)("bins %s in UTC", (granularity, expected) => expect(binTime("2026-10-01T19:38:22Z", granularity)).toBe(expected));
});
describe("aggregate view model", () => {
    it.each(RANGE)("preserves exact source count totals through %s binning", range => {
        const plan = rangePlan(range, now), data = fixtureRepository(plan), model = dashboardModel(data, plan);
        expect(model.series.reduce((sum, p) => sum + p.count, 0)).toBe(data.activity.reduce((sum, p) => sum + Number(p.count), 0));
        expect(model.opens).toBe(14);
        expect(model.copied).toBe(6);
        expect(model.errors).toBe(2);
        expect(model.failureCount).toBe(2);
        expect(model.performance[0].label).toBe(plan.source === "raw" ? "Range p75" : "Typical daily p75");
        expect(JSON.stringify(model)).not.toContain("NaN");
    });
    it("combines complete daily history and current raw day once", () => {
        const plan = rangePlan("180d", now), model = dashboardModel(fixtureRepository(plan), plan);
        expect(model.navigation).toBe(58);
        expect(model.executions).toBe(101);
        expect(model.tool[0]).toMatchObject({ name: "image-resizer", opens: 14, executions: 101, errors: 2 });
        expect(model.failingRoute).toEqual([{ name: "/tool/image-resizer", count: 2 }]);
        expect(model.failureCategory).toEqual([{ name: "tool-render-error", count: 2 }]);
        expect(model.referrer).toEqual([{ name: "search.example", count: 58 }]);
    });
    it("supports empty database without invented measurements or chart points", () => {
        const empty: DashboardData = { activity: [], vital: [], failure: [], diagnostic: [], freshness: { last_raw_received: null, last_rollup_day: null } };
        const plan = rangePlan("24h", now), model = dashboardModel(empty, plan);
        expect(model.empty).toBe(true);
        expect(model.series).toEqual([]);
        expect(model.performance.every(p => p.value === null)).toBe(true);
        const html = renderToStaticMarkup(<DashboardView model={model} plan={plan} />);
        expect(html).toContain("No data yet");
        expect(html).not.toMatch(/NaN|<svg/);
    });
    it("rejects invalid count or vital values rather than displaying NaN", () => {
        const plan = rangePlan("24h", now), data = fixtureRepository(plan);
        data.activity[0].count = "invalid";
        expect(() => dashboardModel(data, plan)).toThrow("Invalid aggregate count");
        const other = fixtureRepository(plan);
        other.vital[0].value = Infinity;
        expect(() => dashboardModel(other, plan)).toThrow("Invalid vital measurement");
    });
    it("labels long-range percentile semantics, viewport basis and all sections", () => {
        const plan = rangePlan("1y", now);
        const html = renderToStaticMarkup(<DashboardView plan={plan} model={dashboardModel(fixtureRepository(plan), plan)} />);
        for (const title of ["Overview", "Performance", "Tool usage", "Reliability", "Routes", "Referrers", "Viewport class", "Recent failures", "Data freshness"]) expect(html).toContain(title);
        expect(html).toContain("unweighted median");
        expect(html).toContain("not the full-range raw p75");
        expect(html).toContain("Viewport width only");
        expect(html).toContain('href="?range=all"');
        expect(html).toContain('aria-current="page"');
        expect(html).not.toMatch(/Unique visitors|Users|Conversion rate/);
    });
});
describe("privacy and deployment boundaries", () => {
    it.each(RANGE)("selects only privacy-approved metrics for %s", range => {
        for (const [name, query] of Object.entries(dashboardQuery(rangePlan(range, now)))) {
            if (name !== "diagnostic") expect(query.text).not.toMatch(/\b(filename|message|stack|metadata|email|cookie|ip_address|full_url|query_string|hash|user_id|session_id|image|blob|file)\b/i);
            else {
                expect(query.text).toContain("observability.error_diagnostic");
                expect(query.text).toContain("LIMIT 25");
                expect(query.text).not.toMatch(/\b(filename|input|output|email|cookie|ip_address|full_url|query_string|user_id|session_id)\b/i);
            }
            expect(query.text).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i);
            expect(query.text).not.toContain("SELECT *");
        }
    });
    it("guards database imports from every client-component dependency graph", () => {
        const root = path.resolve("src");
        function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.[tm]sx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []); }
        const file = files(root);
        const source = new Map(file.map(f => [f, readFileSync(f, "utf8")]));
        const visited = new Set<string>();
        function inspect(f: string): void {
            if (visited.has(f)) return;
            visited.add(f);
            const code = source.get(f) ?? "";
            expect(code).not.toMatch(/database\.server|@neondatabase\/serverless|OBSERVABILITY_DASHBOARD_DATABASE_URL/);
            const imported = Array.from(code.matchAll(/from\s+["'](\.[^"']+)["']/g), match => match[1]);
            for (const importedPath of imported) {
                const target = path.resolve(path.dirname(f), importedPath);
                const dependency = file.find(candidate => [target, `${target}.ts`, `${target}.tsx`].includes(candidate));
                if (dependency) inspect(dependency);
            }
        }
        file.filter(f => /^\s*["']use client["']/.test(source.get(f) ?? "")).forEach(inspect);
        expect(readFileSync(path.join(root, "lib/database.server.ts"), "utf8")).toContain('import "server-only"');
        expect(readFileSync(path.join(root, "app/page.tsx"), "utf8")).toContain('dynamic = "force-dynamic"');
        expect(readFileSync(path.join(root, "lib/database.server.ts"), "utf8")).not.toContain("fixtureRepository");
    });
    it("includes robots metadata and response headers", async () => {
        expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true });
        expect(await config.headers!()).toContainEqual({ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] });
    });
    it("has no application-auth dependencies", () => {
        const pkg = JSON.parse(readFileSync("package.json", "utf8"));
        expect(Object.keys(pkg.dependencies)).toEqual(["@neondatabase/serverless", "next", "react", "react-dom"]);
    });
});
describe("diagnostic presentation", () => {
    it("renders actual messages, identifiers, causes, origin and runtime safely", () => {
        const plan = rangePlan("24h", now), data = fixtureRepository(plan);
        data.diagnostic[0].message = '<script>alert("fixture")</script> Resize worker initialization failed';
        data.diagnostic[0].stack = '<img src=x onerror=alert(1)>\n at resize (app.js:40:2)';
        const html = renderToStaticMarkup(<DashboardView plan={plan} model={dashboardModel(data, plan)} />);
        for (const value of ["Resize worker initialization failed", "00000000-0000-4000-8000-000000000001", "a".repeat(64), "client", "Worker could not start", "Nested fixture cause", "fixture-commit", "production", "FixtureBrowser", "React component stack", "app.js:40:2"]) expect(html).toContain(value);
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("&lt;img");
        expect(html).not.toContain('<script>alert');
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('class="diagnostic-code"');
    });
    it("bounds dashboard Turbopack to its own package instead of public instrumentation", () => {
        expect(config.turbopack?.root).toBe(path.resolve("."));
    });
    it("represents server errors, empty details and legacy metrics honestly", () => {
        const plan = rangePlan("24h", now), data = fixtureRepository(plan);
        Object.assign(data.diagnostic[0], { origin: "server", stack: null, cause: null, component_stack: null, deployment_context: {}, server_context: { method: "GET", routeType: "render" } });
        const html = renderToStaticMarkup(<DashboardView plan={plan} model={dashboardModel(data, plan)} />);
        expect(html).toContain("Server runtime context");
        expect(html).toContain("Not supplied");
        expect(html).toContain("legacy events have no diagnostic record");
        expect(html).not.toContain("React component stack");
    });
    it("does not claim an empty diagnostic range has detailed failures", () => {
        const plan = rangePlan("90d", now), data = fixtureRepository(plan);
        data.diagnostic = [];
        const html = renderToStaticMarkup(<DashboardView plan={plan} model={dashboardModel(data, plan)} />);
        expect(html).toContain("No detailed diagnostics in this range.");
        expect(html).not.toContain("Resize worker initialization failed");
    });
    it.each(RANGE)("bounds detailed diagnostic query to selected %s range independently of metric source", range => {
        const plan = rangePlan(range, now), query = dashboardQuery(plan).diagnostic;
        expect(query.parameter).toEqual([plan.start, plan.end]);
        expect(query.text).toContain("received_at >= $1::timestamptz AND received_at < $2::timestamptz");
        expect(query.text).toContain("ORDER BY received_at DESC, id DESC LIMIT 25");
        expect(query.text).not.toContain("daily_event");
    });
});
