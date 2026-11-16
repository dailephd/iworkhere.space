import { activitySource, isoFormat, vitalQuery } from "./aggregateQuery";
import identity from "./reportingIdentity.json";
import type { Query } from "./query";
import { RANGE, rangePlan, type RangePlan } from "./range";
import { invalid, member, object, timestamp } from "./reportingContract";

export interface ReportingQuery { activity: Query; vital: Query; evidence: Query }
/** Private, fixed read-only statements. Inputs are a server-created canonical range plan. */
export function reportingQuery(plan: RangePlan): ReportingQuery {
    object(plan, ["range", "source", "granularity", "start", "end", "today"]);
    const expected = rangePlan(member(plan.range, RANGE), new Date(timestamp(plan.end)));
    if (Object.keys(expected).some(key => expected[key as keyof RangePlan] !== plan[key as keyof RangePlan])) return invalid();
    const parameter = plan.source === "raw" ? [plan.start, plan.end] : [plan.start, plan.end, plan.today];
    const toolParameter = parameter.length + 1, routeParameter = parameter.length + 2;
    const activity: Query = {
        text: `WITH activity AS (${activitySource(plan, "reporting")}), normalized AS (
            SELECT kind, event_name, count,
                CASE WHEN tool_id IN (SELECT jsonb_array_elements_text($${toolParameter}::jsonb)) THEN tool_id ELSE NULL END AS tool,
                CASE WHEN pathname IN (SELECT jsonb_array_elements_text($${routeParameter}::jsonb)) THEN pathname ELSE NULL END AS route,
                CASE WHEN failure_category IN ('window-error', 'unhandled-rejection', 'tool-render-error') THEN failure_category ELSE 'unknown' END AS category,
                tool_id <> '' AS has_tool
            FROM activity
        ), summary AS (
            SELECT 'total' AS section, NULL::text AS identity,
                coalesce(sum(count) FILTER (WHERE event_name = 'tool_opened'), 0) AS opens,
                coalesce(sum(count) FILTER (WHERE event_name = 'tool_executed'), 0) AS executions,
                coalesce(sum(count) FILTER (WHERE kind = 'client-error'), 0) AS errors,
                coalesce(sum(count) FILTER (WHERE kind = 'navigation'), 0) AS navigation FROM normalized
            UNION ALL
            SELECT 'tool', tool,
                coalesce(sum(count) FILTER (WHERE event_name = 'tool_opened'), 0),
                coalesce(sum(count) FILTER (WHERE event_name = 'tool_executed'), 0),
                coalesce(sum(count) FILTER (WHERE kind = 'client-error'), 0), 0
                FROM normalized WHERE has_tool GROUP BY tool
            UNION ALL
            SELECT 'route', route, 0, 0, 0, sum(count) FROM normalized WHERE kind = 'navigation' GROUP BY route
            UNION ALL
            SELECT 'error', category, 0, 0, sum(count), 0 FROM normalized WHERE kind = 'client-error' GROUP BY category
        ) SELECT section, identity, opens, executions, errors, navigation FROM summary ORDER BY section, identity`,
        parameter: [...parameter, JSON.stringify(identity.tool.map(item => item.id)), JSON.stringify(identity.route)],
    };
    // Compare only fully retained UTC days. Yesterday is in grace until 03:15 UTC
    // (02:15 schedule + 1h); current day is never expected to be complete.
    const evidence: Query = {
        text: `WITH bounds AS (
            SELECT $1::timestamptz AS observed_at, $2::timestamptz AS today,
                (date_trunc('day', ($1::timestamptz - interval '90 days') AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + CASE WHEN $1::timestamptz - interval '90 days' = date_trunc('day', ($1::timestamptz - interval '90 days') AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' THEN interval '0 days' ELSE interval '1 day' END AS retained_from
        ), raw_day AS (
            SELECT (occurred_at AT TIME ZONE 'UTC')::date AS day,
                count(*) FILTER (WHERE kind <> 'web-vital') AS events,
                count(*) FILTER (WHERE kind = 'web-vital') AS samples
            FROM observability.event, bounds WHERE occurred_at < today AND (occurred_at >= retained_from
                OR NOT EXISTS (SELECT 1 FROM observability.rollup_day r WHERE r.day = (occurred_at AT TIME ZONE 'UTC')::date)) GROUP BY 1
        ), expected AS (
            SELECT day FROM raw_day UNION SELECT r.day FROM observability.rollup_day r, bounds
            WHERE r.day >= (retained_from AT TIME ZONE 'UTC')::date AND r.day < (today AT TIME ZONE 'UTC')::date
            UNION SELECT d.day FROM observability.daily_event d, bounds
            WHERE d.day >= (retained_from AT TIME ZONE 'UTC')::date AND d.day < (today AT TIME ZONE 'UTC')::date
            UNION SELECT v.day FROM observability.daily_vital v, bounds
            WHERE v.day >= (retained_from AT TIME ZONE 'UTC')::date AND v.day < (today AT TIME ZONE 'UTC')::date
        ), compared AS (
            SELECT e.day, r.day IS NULL AS missing,
                coalesce(raw.events, 0) <> coalesce(d.events, 0) OR coalesce(raw.samples, 0) <> coalesce(v.samples, 0) AS mismatch,
                ((e.day + 1)::timestamp AT TIME ZONE 'UTC') + interval '3 hours 15 minutes' <= bounds.observed_at AS overdue
            FROM expected e CROSS JOIN bounds LEFT JOIN raw_day raw ON raw.day = e.day
            LEFT JOIN observability.rollup_day r ON r.day = e.day
            LEFT JOIN (SELECT day, sum(count) AS events FROM observability.daily_event, bounds
                WHERE day >= (retained_from AT TIME ZONE 'UTC')::date AND day < (today AT TIME ZONE 'UTC')::date GROUP BY day) d ON d.day = e.day
            LEFT JOIN (SELECT day, sum(sample_count) AS samples FROM observability.daily_vital, bounds
                WHERE day >= (retained_from AT TIME ZONE 'UTC')::date AND day < (today AT TIME ZONE 'UTC')::date GROUP BY day) v ON v.day = e.day
        ) SELECT to_char(bounds.observed_at AT TIME ZONE 'UTC', ${isoFormat}) AS observed_at,
            to_char(retained_from AT TIME ZONE 'UTC', ${isoFormat}) AS retained_from,
            (SELECT count(*) FROM observability.event WHERE occurred_at >= bounds.observed_at - interval '24 hours' AND occurred_at < bounds.observed_at) AS recent_event_count,
            (SELECT count(*) FROM compared WHERE missing AND overdue) AS missing_completed_days,
            (SELECT count(*) FROM compared WHERE NOT missing AND mismatch AND overdue) AS mismatched_completed_days,
            (SELECT count(*) FROM compared WHERE (missing OR mismatch) AND NOT overdue) AS pending_grace_days,
            (SELECT to_char(max(received_at) AT TIME ZONE 'UTC', ${isoFormat}) FROM observability.event WHERE received_at < bounds.observed_at) AS last_raw_received,
            (SELECT to_char(max(day), 'YYYY-MM-DD') FROM observability.rollup_day WHERE day < (bounds.today AT TIME ZONE 'UTC')::date) AS last_rollup_day
            FROM bounds`,
        parameter: [plan.end, plan.today],
    };
    return { activity, vital: vitalQuery(plan), evidence };
}
