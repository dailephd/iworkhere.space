import type { ActivityRow, DashboardData } from "../lib/model";
import { binTime, type RangePlan } from "../lib/range";

/** Isolated test adapter. No production module imports this file or selects it by env. */
export function fixtureRepository(plan: RangePlan): DashboardData {
    const today = new Date(plan.today).getTime();
    const hour = 3_600_000, day = 24 * hour;
    const make = (time: number, kind: string, eventName: string, count: number, category = ""): ActivityRow => ({
        bin: new Date(time).toISOString(), kind, pathname: kind === "navigation" ? "/" : "/tool/image-resizer",
        tool_id: kind === "navigation" ? "" : "image-resizer", event_name: eventName,
        failure_category: category, device_class: "desktop", referrer_host: kind === "navigation" ? "search.example" : "", count,
    });
    const raw = [make(today + hour, "navigation", "", 22), make(today + 2 * hour, "analytic-event", "tool_opened", 14), make(today + 2 * hour, "analytic-event", "tool_executed", 11), make(today + 2 * hour, "analytic-event", "tool_result_copied", 6), make(today + 2 * hour, "client-error", "", 2, "tool-render-error"), make(today - day + hour, "navigation", "", 36)];
    const daily = [make(today - day, "navigation", "", 36), make(today - 60 * day, "analytic-event", "tool_executed", 90), make(today - 200 * day, "navigation", "", 220), make(today - 500 * day, "navigation", "", 800)];
    const source = plan.source === "raw" ? raw : [...daily, ...raw.filter(row => row.bin >= plan.today)];
    const activity = source.filter(row => row.bin >= plan.start && row.bin < plan.end).map(row => ({ ...row, bin: binTime(row.bin, plan.granularity) }));
    return {
        diagnostic: [{
            id: "00000000-0000-4000-8000-000000000001", received_at: new Date(today + 2 * hour).toISOString(), reported_at: new Date(today + 2 * hour).toISOString(),
            fingerprint: "a".repeat(64), origin: "client", severity: "error", error_name: "TypeError",
            message: "Resize worker initialization failed: " + "long-fixture-context ".repeat(150),
            stack: "TypeError: Resize worker initialization failed\n" + " at resize (https://example.com/_next/static/chunks/fixture.js:40:2)\n".repeat(200),
            cause: { name: "Error", message: "Worker could not start", cause: { name: "RangeError", message: "Nested fixture cause" } },
            error_detail: { name: "TypeError", code: "EWORKER", errors: [{ name: "Error", message: "Aggregate child" }] },
            component_stack: "\n at ResizeTool\n at ToolErrorBoundary", pathname: "/tool/image-resizer", tool_id: "image-resizer", boundary: "ToolErrorBoundary", failure_category: "tool-render-error",
            client_context: { userAgent: "FixtureBrowser", viewportWidth: 390, viewportHeight: 844, devicePixelRatio: 2, online: false, visibilityState: "hidden" }, server_context: {}, deployment_context: { commitSha: "fixture-commit", environment: "production", region: "iad1" },
        }],
        activity,
        vital: [{ metric_name: "LCP", sample_count: 44, value: plan.source === "raw" ? 1420 : 1590 }, { metric_name: "INP", sample_count: 28, value: 92 }, { metric_name: "CLS", sample_count: 44, value: .034 }, { metric_name: "FCP", sample_count: 44, value: 870 }, { metric_name: "TTFB", sample_count: 44, value: 135 }],
        failure: [{ occurred_at: new Date(today + 2 * hour).toISOString(), pathname: "/tool/image-resizer", tool_id: "image-resizer", failure_category: "tool-render-error", device_class: "desktop" }],
        freshness: { last_raw_received: new Date(today + 2 * hour).toISOString(), last_rollup_day: new Date(today - day).toISOString().slice(0, 10) },
    };
}
