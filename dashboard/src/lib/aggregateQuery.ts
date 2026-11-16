import type { RangePlan } from "./range";
import type { Query } from "./query";

// These are explicit safe columns, shared by the two count sources only.
const rawDimension = `kind, pathname, coalesce(tool_id, '') AS tool_id,
    coalesce(event_name, '') AS event_name, coalesce(failure_category, '') AS failure_category,
    device_class, coalesce(referrer_host, '') AS referrer_host`;
export const dimension = "kind, pathname, tool_id, event_name, failure_category, device_class, referrer_host";
// PostgreSQL timestamps normally decode to JS Date in Neon. Project ISO text
// explicitly so React receives safe display-ready strings, never Date objects.
export const isoFormat = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

/** Only fixed projections; never caller-provided SQL or identifiers. */
export function activitySource(plan: RangePlan, purpose: "dashboard" | "reporting" = "dashboard"): string {
    const selected = purpose === "reporting" ? "kind, pathname, tool_id, event_name, failure_category" : dimension;
    const rawSelected = purpose === "reporting"
        ? "kind, pathname, coalesce(tool_id, '') AS tool_id, coalesce(event_name, '') AS event_name, coalesce(failure_category, '') AS failure_category"
        : rawDimension;
    return plan.source === "raw" ? `
        SELECT occurred_at AS time, ${rawSelected}, 1::bigint AS count FROM observability.event
        WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz AND kind <> 'web-vital'` : `
        SELECT day::timestamp AT TIME ZONE 'UTC' AS time, ${selected}, count FROM observability.daily_event
        WHERE day >= ($1::timestamptz AT TIME ZONE 'UTC')::date AND day < ($3::timestamptz AT TIME ZONE 'UTC')::date
        UNION ALL
        SELECT occurred_at AS time, ${rawSelected}, 1::bigint AS count FROM observability.event
        WHERE occurred_at >= $3::timestamptz AND occurred_at < $2::timestamptz AND kind <> 'web-vital'`;
}

export function vitalQuery(plan: RangePlan): Query {
    const parameter = [plan.start, plan.end, plan.today];
    return plan.source === "raw" ? {
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
}
