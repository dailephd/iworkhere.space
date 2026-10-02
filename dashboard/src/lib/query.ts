import type { RangePlan } from "./range";

export interface Query {
    text: string;
    parameter: string[];
}
export interface DashboardQuery {
    activity: Query;
    vital: Query;
    failure: Query;
    freshness: Query;
}
// These are explicit safe columns, shared by the two count sources only.
const rawDimension = `kind, pathname, coalesce(tool_id, '') AS tool_id,
    coalesce(event_name, '') AS event_name, coalesce(failure_category, '') AS failure_category,
    device_class, coalesce(referrer_host, '') AS referrer_host`;
const dimension = "kind, pathname, tool_id, event_name, failure_category, device_class, referrer_host";
// PostgreSQL timestamps normally decode to JS Date in Neon. Project ISO text
// explicitly so React receives safe display-ready strings, never Date objects.
const isoFormat = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

export function dashboardQuery(plan: RangePlan): DashboardQuery {
    const parameter = [plan.start, plan.end, plan.today];
    const activitySource = plan.source === "raw" ? `
        SELECT occurred_at AS time, ${rawDimension}, 1::bigint AS count FROM observability.event
        WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz AND kind <> 'web-vital'` : `
        SELECT day::timestamp AT TIME ZONE 'UTC' AS time, ${dimension}, count FROM observability.daily_event
        WHERE day >= ($1::timestamptz AT TIME ZONE 'UTC')::date AND day < ($3::timestamptz AT TIME ZONE 'UTC')::date
        UNION ALL
        SELECT occurred_at AS time, ${rawDimension}, 1::bigint AS count FROM observability.event
        WHERE occurred_at >= $3::timestamptz AND occurred_at < $2::timestamptz AND kind <> 'web-vital'`;
    const activity = {
        text: `WITH activity AS (${activitySource})
            SELECT to_char(date_trunc('${plan.granularity}', time AT TIME ZONE 'UTC'), ${isoFormat}) AS bin,
            ${dimension}, sum(count) AS count FROM activity
            GROUP BY bin, ${dimension} ORDER BY bin, ${dimension}`,
        parameter: plan.source === "raw" ? parameter.slice(0, 2) : parameter,
    };
    const vital = plan.source === "raw" ? {
        text: `SELECT metric_name, count(*) AS sample_count, percentile_cont(0.75) WITHIN GROUP (ORDER BY metric_value) AS value
            FROM observability.event WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz AND kind = 'web-vital'
            GROUP BY metric_name ORDER BY metric_name`,
        parameter: parameter.slice(0, 2),
    } : {
        text: `WITH daily AS (
            SELECT metric_name, sample_count, p75 FROM observability.daily_vital
            WHERE day >= ($1::timestamptz AT TIME ZONE 'UTC')::date AND day < ($3::timestamptz AT TIME ZONE 'UTC')::date
            UNION ALL
            SELECT metric_name, count(*) AS sample_count, percentile_cont(0.75) WITHIN GROUP (ORDER BY metric_value) AS p75
            FROM observability.event WHERE occurred_at >= $3::timestamptz AND occurred_at < $2::timestamptz AND kind = 'web-vital'
            GROUP BY pathname, metric_name, device_class
        ) SELECT metric_name, sum(sample_count) AS sample_count, percentile_cont(0.50) WITHIN GROUP (ORDER BY p75) AS value
            FROM daily GROUP BY metric_name ORDER BY metric_name`,
        parameter,
    };
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
    return { activity, vital, failure, freshness };
}
