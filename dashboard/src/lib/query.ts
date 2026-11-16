import { activitySource, dimension, isoFormat, vitalQuery } from "./aggregateQuery";
import type { RangePlan } from "./range";

export interface Query {
    text: string;
    parameter: string[];
}
export interface DashboardQuery {
    activity: Query;
    vital: Query;
    failure: Query;
    diagnostic: Query;
    freshness: Query;
}
export function dashboardQuery(plan: RangePlan): DashboardQuery {
    const parameter = [plan.start, plan.end, plan.today];
    const source = activitySource(plan);
    const activity = {
        text: `WITH activity AS (${source})
            SELECT to_char(date_trunc('${plan.granularity}', time AT TIME ZONE 'UTC'), ${isoFormat}) AS bin,
            ${dimension}, sum(count) AS count FROM activity
            GROUP BY bin, ${dimension} ORDER BY bin, ${dimension}`,
        parameter: plan.source === "raw" ? parameter.slice(0, 2) : parameter,
    };
    const vital = vitalQuery(plan);
    // Long ranges show only retained raw failures, explicitly labeled in the UI.
    const failure = {
        text: `SELECT to_char(occurred_at AT TIME ZONE 'UTC', ${isoFormat}) AS occurred_at, pathname, tool_id, failure_category, device_class FROM observability.event
            WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz AND kind = 'client-error'
            ORDER BY occurred_at DESC, id DESC LIMIT 25`,
        parameter: parameter.slice(0, 2),
    };
    const freshness = {
        text: `SELECT (SELECT to_char(max(received_at) AT TIME ZONE 'UTC', ${isoFormat}) FROM observability.event) AS last_raw_received,
            (SELECT to_char(max(day), 'YYYY-MM-DD') FROM observability.rollup_day) AS last_rollup_day`,
        parameter: [],
    };
    const diagnostic = {
        text: `SELECT id::text, to_char(received_at AT TIME ZONE 'UTC', ${isoFormat}) AS received_at,
            to_char(reported_at AT TIME ZONE 'UTC', ${isoFormat}) AS reported_at,
            fingerprint, origin, severity, error_name, message, stack, cause, error_detail, component_stack,
            pathname, tool_id, boundary, failure_category, client_context, server_context, deployment_context
            FROM observability.error_diagnostic
            WHERE received_at >= $1::timestamptz AND received_at < $2::timestamptz
            ORDER BY received_at DESC, id DESC LIMIT 25`,
        parameter: parameter.slice(0, 2),
    };
    return { activity, vital, failure, freshness, diagnostic };
}
