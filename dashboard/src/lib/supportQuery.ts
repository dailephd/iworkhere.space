/**
 * Read-only support queries. They select only from the SELECT-only dashboard views of the
 * support schema; every variable is a bound parameter, never interpolated into SQL.
 */
export interface SupportQuery {
    text: string;
    parameter: string[];
}

export const SUPPORT_PAGE_SIZE = 25;
export const SUPPORT_REPORT_ID = /^SR-[0-9A-HJKMNP-TV-Z]{16}$/;

const isoFormat = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

export function supportListQuery(page: number): SupportQuery {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
    const offset = (safePage - 1) * SUPPORT_PAGE_SIZE;
    return {
        // One extra row reveals whether a next page exists without a second count query.
        text: `SELECT id, category, area, tool_id, pathname, to_char(received_at AT TIME ZONE 'UTC', ${isoFormat}) AS received_at,
            dead_job_count::int AS dead_job_count, undelivered_job_count::int AS undelivered_job_count, (tracker_issue_url IS NOT NULL) AS has_tracker
            FROM support.dashboard_report ORDER BY received_at DESC, id LIMIT $1::integer OFFSET $2::integer`,
        parameter: [String(SUPPORT_PAGE_SIZE + 1), String(offset)],
    };
}

export function supportHealthQuery(): SupportQuery {
    return {
        text: `SELECT undelivered_count::int AS undelivered_count, retrying_count::int AS retrying_count, dead_count::int AS dead_count,
            failing_count::int AS failing_count, to_char(oldest_pending_at AT TIME ZONE 'UTC', ${isoFormat}) AS oldest_pending_at
            FROM support.dashboard_health`,
        parameter: [],
    };
}

export function supportDetailQuery(id: string): SupportQuery {
    return {
        text: `SELECT id, category, area, tool_id, pathname, to_char(received_at AT TIME ZONE 'UTC', ${isoFormat}) AS received_at,
            description, expected, observed, contact_email, contact_consent, tracker_issue_url,
            to_char(narrative_purged_at AT TIME ZONE 'UTC', ${isoFormat}) AS narrative_purged_at,
            to_char(contact_purged_at AT TIME ZONE 'UTC', ${isoFormat}) AS contact_purged_at
            FROM support.dashboard_report WHERE id = $1::text`,
        parameter: [id],
    };
}

export function supportJobQuery(id: string): SupportQuery {
    return {
        text: `SELECT kind, status, attempt_count::int AS attempt_count, failure_code,
            to_char(next_attempt_at AT TIME ZONE 'UTC', ${isoFormat}) AS next_attempt_at,
            to_char(delivered_at AT TIME ZONE 'UTC', ${isoFormat}) AS delivered_at,
            to_char(updated_at AT TIME ZONE 'UTC', ${isoFormat}) AS updated_at
            FROM support.dashboard_job WHERE report_id = $1::text ORDER BY created_at, kind`,
        parameter: [id],
    };
}
