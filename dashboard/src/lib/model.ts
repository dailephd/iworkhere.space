import { binTime, type RangePlan } from "./range";

export interface ActivityRow {
    bin: string;
    kind: string;
    pathname: string;
    tool_id: string;
    event_name: string;
    failure_category: string;
    device_class: string;
    referrer_host: string;
    count: string | number;
}
export interface VitalRow { metric_name: string; sample_count: string | number; value: number | string }
export interface FailureRow { occurred_at: string; pathname: string; tool_id: string | null; failure_category: string; device_class: string }
export interface FreshnessRow { last_raw_received: string | null; last_rollup_day: string | null }
export interface DashboardData {
    activity: ActivityRow[];
    vital: VitalRow[];
    failure: FailureRow[];
    freshness: FreshnessRow;
}
export interface CountItem { name: string; count: number }
export interface ToolItem { name: string; opens: number; executions: number; errors: number }
export interface SeriesPoint { bin: string; count: number; navigations: number; executions: number }
export interface PerformanceItem { name: string; value: number | null; sampleCount: number; label: string }
export interface DashboardModel {
    empty: boolean;
    navigation: number;
    opens: number;
    executions: number;
    copied: number;
    errors: number;
    failureCount: number;
    tool: ToolItem[];
    failureCategory: CountItem[];
    failingRoute: CountItem[];
    failingTool: CountItem[];
    route: CountItem[];
    referrer: CountItem[];
    device: CountItem[];
    series: SeriesPoint[];
    performance: PerformanceItem[];
    failure: FailureRow[];
    freshness: FreshnessRow;
}
function count(value: string | number): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid aggregate count");
    return parsed;
}
function ranked(map: Map<string, number>): CountItem[] {
    return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10);
}
function add(map: Map<string, number>, key: string, value: number): void {
    map.set(key, (map.get(key) ?? 0) + value);
}
export function dashboardModel(data: DashboardData, plan: RangePlan): DashboardModel {
    const tool = new Map<string, ToolItem>();
    const failureCategory = new Map<string, number>();
    const failingRoute = new Map<string, number>();
    const failingTool = new Map<string, number>();
    const route = new Map<string, number>();
    const referrer = new Map<string, number>();
    const device = new Map<string, number>();
    const series = new Map<string, SeriesPoint>();
    let navigation = 0, opens = 0, executions = 0, copied = 0, errors = 0;
    for (const row of data.activity) {
        const amount = count(row.count);
        const bin = binTime(row.bin, plan.granularity);
        const point = series.get(bin) ?? { bin, count: 0, navigations: 0, executions: 0 };
        point.count += amount;
        add(device, row.device_class, amount);
        if (row.kind === "navigation") {
            navigation += amount;
            point.navigations += amount;
            add(route, row.pathname, amount);
            add(referrer, row.referrer_host || "No referrer recorded", amount);
        }
        if (row.event_name === "tool_opened") opens += amount;
        if (row.event_name === "tool_executed") { executions += amount; point.executions += amount; }
        if (row.event_name === "tool_result_copied") copied += amount;
        if (row.kind === "client-error") {
            errors += amount;
            add(failureCategory, row.failure_category, amount);
            add(failingRoute, row.pathname, amount);
            if (row.tool_id) add(failingTool, row.tool_id, amount);
        }
        if (row.tool_id) {
            const item = tool.get(row.tool_id) ?? { name: row.tool_id, opens: 0, executions: 0, errors: 0 };
            if (row.event_name === "tool_opened") item.opens += amount;
            if (row.event_name === "tool_executed") item.executions += amount;
            if (row.kind === "client-error") item.errors += amount;
            tool.set(row.tool_id, item);
        }
        series.set(bin, point);
    }
    const label = plan.source === "raw" ? "Range p75" : "Typical daily p75";
    const performance = ["LCP", "INP", "CLS", "FCP", "TTFB", "FID"].map(name => {
        const row = data.vital.find(row => row.metric_name === name);
        const sampleCount = row ? count(row.sample_count) : 0;
        const value = row && sampleCount > 0 ? Number(row.value) : null;
        if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error("Invalid vital measurement");
        return { name, sampleCount, value, label };
    });
    return {
        empty: data.activity.length === 0 && data.vital.length === 0,
        navigation, opens, executions, copied, errors, failureCount: errors,
        tool: Array.from(tool.values()).sort((a, b) => (b.opens + b.executions + b.errors) - (a.opens + a.executions + a.errors) || a.name.localeCompare(b.name)).slice(0, 10),
        failureCategory: ranked(failureCategory), failingRoute: ranked(failingRoute), failingTool: ranked(failingTool), route: ranked(route), referrer: ranked(referrer), device: ranked(device),
        series: Array.from(series.values()).sort((a, b) => a.bin.localeCompare(b.bin)),
        performance, failure: data.failure, freshness: data.freshness,
    };
}
