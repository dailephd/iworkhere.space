import identity from "./reportingIdentity.json";
import { RANGE, rangePlan, type Range } from "./range";
import { array, count, databaseCount, invalid, measurement, member, object, ReportingUnavailable, timestamp } from "./reportingContract";
import { assessReportingHealth, validateReportingHealth, type DatabaseEvidence, type MonitoringEvidence, type ReportingHealth } from "./reportingHealth";

export const MAX_REPORTING_BYTES = 24 * 1024;
export const TOP_LIMIT = 10;
export const VITAL_NAME = ["LCP", "INP", "CLS", "FCP", "TTFB", "FID"] as const;
export const ERROR_CATEGORY = ["window-error", "unhandled-rejection", "tool-render-error", "unknown"] as const;
export const LIMITATION = ["events_not_unique_users", "best_effort_telemetry", "historical_pre_a1_duplicate_opens_possible", "client_errors_not_all_server_errors", "source_counts_not_proof_of_complete_ingestion", "missing_evidence_not_zero_activity", "raw_retention_90_days", "daily_plus_incomplete_current_utc_day", "typical_daily_p75_is_unweighted_median_not_full_range_p75", "historical_rollup_completeness_unverified"] as const;
export interface ReportingRequest { schemaVersion: 1; range: Range }
export interface ToolActivity { toolId: string | null; opens: number; executions: number; errors: number }
export interface RouteActivity { route: string | null; count: number }
export interface ClientError { category: typeof ERROR_CATEGORY[number]; count: number }
export interface ReportingVital {
    name: typeof VITAL_NAME[number]; value: number | null; unit: "ms" | "unitless";
    sampleCount: number; statistic: "range_p75" | "typical_daily_p75";
}
export interface ResultLimit { limit: 10; omittedActivityTools: number; omittedExecutionTools: number; omittedRoutes: number }
export interface ReportingResponse {
    schemaVersion: 1;
    operation: "observability_report";
    range: Range;
    start: string;
    end: string;
    timezone: "UTC";
    source: "raw" | "daily_and_current_raw";
    semantics: { clock: "server_receipt"; count: "events"; toolRanking: "opens_plus_executions_plus_errors"; executionRanking: "executions"; routeRanking: "navigations"; completeness: "selected_source_only" };
    navigationCount: number;
    toolOpenCount: number;
    toolExecutionCount: number;
    clientErrorCount: number;
    toolActivity: ToolActivity[];
    executionActivity: ToolActivity[];
    routeActivity: RouteActivity[];
    clientError: ClientError[];
    vital: ReportingVital[];
    health: ReportingHealth;
    limitation: typeof LIMITATION[number][];
    limited: ResultLimit;
}
const toolId = identity.tool.map(item => item.id);
function canonicalTool(value: unknown): string | null { return value === null ? null : member(value, toolId); }
function canonicalRoute(value: unknown): string | null { return value === null ? null : member(value, identity.route); }
export function reportingRequest(value: unknown): ReportingRequest {
    try {
        const row = object(value, ["schemaVersion", "range"]);
        if (row.schemaVersion !== 1) return invalid();
        return { schemaVersion: 1, range: member(row.range, RANGE) };
    } catch { throw new ReportingUnavailable("invalid_request"); }
}
function validateTool(value: unknown): ToolActivity {
    const row = object(value, ["toolId", "opens", "executions", "errors"]);
    canonicalTool(row.toolId); count(row.opens); count(row.executions); count(row.errors);
    count(Number(row.opens) + Number(row.executions) + Number(row.errors));
    return value as ToolActivity;
}
function unique(value: unknown[], key: (item: unknown) => unknown): void {
    if (new Set(value.map(key)).size !== value.length) return invalid();
}
/** Exact positive allowlists at every object/array boundary, before serialization. */
export function validateReportingResponse(value: unknown): ReportingResponse {
    const row = object(value, ["schemaVersion", "operation", "range", "start", "end", "timezone", "source", "semantics", "navigationCount", "toolOpenCount", "toolExecutionCount", "clientErrorCount", "toolActivity", "executionActivity", "routeActivity", "clientError", "vital", "health", "limitation", "limited"]);
    if (row.schemaVersion !== 1 || row.operation !== "observability_report" || row.timezone !== "UTC") return invalid();
    const range = member(row.range, RANGE), end = timestamp(row.end), plan = rangePlan(range, new Date(end));
    if (timestamp(row.start) !== plan.start || row.source !== (plan.source === "raw" ? "raw" : "daily_and_current_raw")) return invalid();
    const semantics = object(row.semantics, ["clock", "count", "toolRanking", "executionRanking", "routeRanking", "completeness"]);
    if (semantics.clock !== "server_receipt" || semantics.count !== "events" || semantics.toolRanking !== "opens_plus_executions_plus_errors" || semantics.executionRanking !== "executions" || semantics.routeRanking !== "navigations" || semantics.completeness !== "selected_source_only") return invalid();
    for (const name of ["navigationCount", "toolOpenCount", "toolExecutionCount", "clientErrorCount"]) count(row[name]);
    for (const name of ["toolActivity", "executionActivity"]) {
        const items = array(row[name], TOP_LIMIT); items.forEach(validateTool); unique(items, item => (item as ToolActivity).toolId);
        const tools = items as ToolActivity[];
        for (const [field, total] of [["opens", "toolOpenCount"], ["executions", "toolExecutionCount"], ["errors", "clientErrorCount"]] as const) {
            if (count(tools.reduce((sum, item) => sum + item[field], 0)) > Number(row[total])) return invalid();
        }
    }
    const routes = array(row.routeActivity, TOP_LIMIT);
    for (const item of routes) { const route = object(item, ["route", "count"]); canonicalRoute(route.route); if (count(route.count) > Number(row.navigationCount)) return invalid(); }
    unique(routes, item => (item as RouteActivity).route);
    if (count((routes as RouteActivity[]).reduce((sum, item) => sum + item.count, 0)) > Number(row.navigationCount)) return invalid();
    const errors = array(row.clientError, ERROR_CATEGORY.length);
    for (const item of errors) { const error = object(item, ["category", "count"]); member(error.category, ERROR_CATEGORY); count(error.count); }
    unique(errors, item => (item as ClientError).category);
    if (count((errors as ClientError[]).reduce((sum, item) => sum + item.count, 0)) !== row.clientErrorCount) return invalid();
    const vitals = array(row.vital, VITAL_NAME.length);
    if (vitals.length !== VITAL_NAME.length) return invalid();
    for (const item of vitals) {
        const vital = object(item, ["name", "value", "unit", "sampleCount", "statistic"]);
        const name = member(vital.name, VITAL_NAME); count(vital.sampleCount);
        if (vital.unit !== (name === "CLS" ? "unitless" : "ms") || vital.statistic !== (plan.source === "raw" ? "range_p75" : "typical_daily_p75")) return invalid();
        if (vital.sampleCount === 0 ? vital.value !== null : vital.value === null) return invalid();
        if (vital.value !== null) measurement(vital.value);
    }
    unique(vitals, item => (item as ReportingVital).name);
    const health = validateReportingHealth(row.health); if (health.observedAt !== end) return invalid();
    const limitation = array(row.limitation, LIMITATION.length); limitation.forEach(item => member(item, LIMITATION));
    if (limitation.length !== LIMITATION.length || new Set(limitation).size !== LIMITATION.length) return invalid();
    const limited = object(row.limited, ["limit", "omittedActivityTools", "omittedExecutionTools", "omittedRoutes"]);
    if (limited.limit !== TOP_LIMIT) return invalid();
    for (const key of ["omittedActivityTools", "omittedExecutionTools", "omittedRoutes"]) count(limited[key]);
    for (const [field, omitted, maximum] of [["toolActivity", "omittedActivityTools", toolId.length + 1], ["executionActivity", "omittedExecutionTools", toolId.length + 1], ["routeActivity", "omittedRoutes", identity.route.length + 1]] as const) {
        const length = (row[field] as unknown[]).length, missing = Number(limited[omitted]);
        if (length + missing > maximum || (missing > 0 && length !== TOP_LIMIT)) return invalid();
    }
    if ((row.toolActivity as unknown[]).length !== (row.executionActivity as unknown[]).length || limited.omittedActivityTools !== limited.omittedExecutionTools) return invalid();
    // Bound the complete DTO, never truncate JSON strings or totals.
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_REPORTING_BYTES) throw new ReportingUnavailable("size_limit");
    return value as ReportingResponse;
}
export function serializeReportingResponse(value: unknown): string { return JSON.stringify(validateReportingResponse(value)); }

export interface ReportingData { activity: unknown; vital: unknown; evidence: unknown }
function evidenceFromRow(value: unknown): DatabaseEvidence {
    const rows = array(value, 1); if (rows.length !== 1) return invalid();
    const row = object(rows[0], ["observed_at", "retained_from", "recent_event_count", "missing_completed_days", "mismatched_completed_days", "pending_grace_days", "last_raw_received", "last_rollup_day"]);
    return { observedAt: timestamp(row.observed_at), retainedFrom: timestamp(row.retained_from), recentEventCount: databaseCount(row.recent_event_count), missingCompletedDays: databaseCount(row.missing_completed_days), mismatchedCompletedDays: databaseCount(row.mismatched_completed_days), pendingGraceDays: databaseCount(row.pending_grace_days), lastRawReceived: row.last_raw_received as string | null, lastRollupDay: row.last_rollup_day as string | null };
}
/** Project only validated aggregates. Never spread DB records or accept DashboardData. */
export function reportingModel(requestValue: unknown, dataValue: unknown, now: Date, monitoring: MonitoringEvidence | null = null): ReportingResponse {
    const request = reportingRequest(requestValue), plan = rangePlan(request.range, now);
    const data = object(dataValue, ["activity", "vital", "evidence"]);
    const activity = array(data.activity, 1 + toolId.length + 1 + identity.route.length + 1 + ERROR_CATEGORY.length);
    const tool: ToolActivity[] = [], route: RouteActivity[] = [], clientError: ClientError[] = [];
    let total: { navigation: number; opens: number; executions: number; errors: number } | null = null;
    for (const item of activity) {
        const row = object(item, ["section", "identity", "opens", "executions", "errors", "navigation"]);
        const section = member(row.section, ["total", "tool", "route", "error"]);
        const opens = databaseCount(row.opens), executions = databaseCount(row.executions), errors = databaseCount(row.errors), navigation = databaseCount(row.navigation);
        if (section === "total") { if (total || row.identity !== null) return invalid(); total = { navigation, opens, executions, errors }; }
        if (section === "tool") { if (navigation !== 0) return invalid(); tool.push({ toolId: canonicalTool(row.identity), opens, executions, errors }); }
        if (section === "route") { if (opens + executions + errors !== 0) return invalid(); route.push({ route: canonicalRoute(row.identity), count: navigation }); }
        if (section === "error") { if (opens + executions + navigation !== 0) return invalid(); clientError.push({ category: member(row.identity, ERROR_CATEGORY), count: errors }); }
    }
    if (!total) return invalid();
    unique(tool, item => (item as ToolActivity).toolId); unique(route, item => (item as RouteActivity).route); unique(clientError, item => (item as ClientError).category);
    // Cross-check complete aggregate rows BEFORE ranking or omission.
    if (count(tool.reduce((sum, item) => sum + item.opens, 0)) !== total.opens || count(tool.reduce((sum, item) => sum + item.executions, 0)) !== total.executions
        || count(route.reduce((sum, item) => sum + item.count, 0)) !== total.navigation || count(clientError.reduce((sum, item) => sum + item.count, 0)) !== total.errors
        || count(tool.reduce((sum, item) => sum + item.errors, 0)) > total.errors) return invalid();
    for (const item of tool) count(item.opens + item.executions + item.errors);
    const byId = (a: ToolActivity, b: ToolActivity) => (a.toolId ?? "").localeCompare(b.toolId ?? "");
    const ranked = [...tool].sort((a, b) => (b.opens + b.executions + b.errors) - (a.opens + a.executions + a.errors) || byId(a, b));
    const execution = [...tool].sort((a, b) => b.executions - a.executions || byId(a, b));
    route.sort((a, b) => b.count - a.count || (a.route ?? "").localeCompare(b.route ?? ""));
    const vitalRows = array(data.vital, VITAL_NAME.length);
    const vitalMap = new Map<string, { sampleCount: number; value: number }>();
    for (const item of vitalRows) {
        const row = object(item, ["metric_name", "sample_count", "value"]), name = member(row.metric_name, VITAL_NAME);
        if (vitalMap.has(name)) return invalid();
        const sampleCount = databaseCount(row.sample_count); if (sampleCount === 0) return invalid();
        // Neon returns percentile_cont as double precision (number).
        vitalMap.set(name, { sampleCount, value: measurement(row.value) });
    }
    const vital: ReportingVital[] = VITAL_NAME.map(name => ({ name, value: vitalMap.get(name)?.value ?? null, sampleCount: vitalMap.get(name)?.sampleCount ?? 0, unit: name === "CLS" ? "unitless" : "ms", statistic: plan.source === "raw" ? "range_p75" : "typical_daily_p75" }));
    const health = assessReportingHealth(plan.end, evidenceFromRow(data.evidence), monitoring);
    return validateReportingResponse({ schemaVersion: 1, operation: "observability_report", range: request.range, start: plan.start, end: plan.end, timezone: "UTC", source: plan.source === "raw" ? "raw" : "daily_and_current_raw",
        semantics: { clock: "server_receipt", count: "events", toolRanking: "opens_plus_executions_plus_errors", executionRanking: "executions", routeRanking: "navigations", completeness: "selected_source_only" },
        navigationCount: total.navigation, toolOpenCount: total.opens, toolExecutionCount: total.executions, clientErrorCount: total.errors,
        toolActivity: ranked.slice(0, TOP_LIMIT), executionActivity: execution.slice(0, TOP_LIMIT), routeActivity: route.slice(0, TOP_LIMIT), clientError, vital, health,
        limitation: [...LIMITATION], limited: { limit: TOP_LIMIT, omittedActivityTools: Math.max(0, tool.length - TOP_LIMIT), omittedExecutionTools: Math.max(0, tool.length - TOP_LIMIT), omittedRoutes: Math.max(0, route.length - TOP_LIMIT) } });
}
