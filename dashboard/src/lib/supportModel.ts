export interface SupportListRow {
    id: string;
    category: string;
    area: string;
    tool_id: string | null;
    pathname: string;
    received_at: string;
    dead_job_count: number;
    undelivered_job_count: number;
    has_tracker: boolean;
}

export interface SupportHealthRow {
    undelivered_count: number;
    retrying_count: number;
    dead_count: number;
    failing_count: number;
    oldest_pending_at: string | null;
}

export interface SupportReportRow {
    id: string;
    category: string;
    area: string;
    tool_id: string | null;
    pathname: string;
    received_at: string;
    description: string | null;
    expected: string | null;
    observed: string | null;
    contact_email: string | null;
    contact_consent: boolean;
    tracker_issue_url: string | null;
    narrative_purged_at: string | null;
    contact_purged_at: string | null;
}

export interface SupportJobRow {
    kind: string;
    status: string;
    attempt_count: number;
    failure_code: string | null;
    next_attempt_at: string;
    delivered_at: string | null;
    updated_at: string;
}

export interface SupportListData { report: SupportListRow[]; hasNext: boolean; health: SupportHealthRow }
export interface SupportDetailData { report: SupportReportRow; job: SupportJobRow[] }

function count(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid support count");
    return parsed;
}

export function listRowFrom(row: Record<string, unknown>): SupportListRow {
    return {
        id: String(row.id), category: String(row.category), area: String(row.area), tool_id: row.tool_id == null ? null : String(row.tool_id),
        pathname: String(row.pathname), received_at: String(row.received_at), dead_job_count: count(row.dead_job_count),
        undelivered_job_count: count(row.undelivered_job_count), has_tracker: row.has_tracker === true,
    };
}

export function healthRowFrom(row: Record<string, unknown> | undefined): SupportHealthRow {
    return {
        undelivered_count: count(row?.undelivered_count ?? 0), retrying_count: count(row?.retrying_count ?? 0), dead_count: count(row?.dead_count ?? 0),
        failing_count: count(row?.failing_count ?? 0), oldest_pending_at: row?.oldest_pending_at == null ? null : String(row.oldest_pending_at),
    };
}

function text(value: unknown): string | null { return value == null ? null : String(value); }

export function reportRowFrom(row: Record<string, unknown>): SupportReportRow {
    return {
        id: String(row.id), category: String(row.category), area: String(row.area), tool_id: text(row.tool_id), pathname: String(row.pathname),
        received_at: String(row.received_at), description: text(row.description), expected: text(row.expected), observed: text(row.observed),
        contact_email: text(row.contact_email), contact_consent: row.contact_consent === true, tracker_issue_url: text(row.tracker_issue_url),
        narrative_purged_at: text(row.narrative_purged_at), contact_purged_at: text(row.contact_purged_at),
    };
}

export function jobRowFrom(row: Record<string, unknown>): SupportJobRow {
    return {
        kind: String(row.kind), status: String(row.status), attempt_count: count(row.attempt_count), failure_code: text(row.failure_code),
        next_attempt_at: String(row.next_attempt_at), delivered_at: text(row.delivered_at), updated_at: String(row.updated_at),
    };
}

/** Whole minutes between an ISO timestamp and now; null when there is nothing pending. */
export function ageMinutes(iso: string | null, now: Date): number | null {
    if (!iso) return null;
    const then = Date.parse(iso);
    return Number.isNaN(then) ? null : Math.max(0, Math.floor((now.getTime() - then) / 60_000));
}

export function ageLabel(minutes: number | null): string {
    if (minutes === null) return "Nothing pending";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours < 48 ? `${hours} h ${minutes % 60} min` : `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** Only a GitHub issue URL is ever linked; any other value renders as plain text. */
export function safeIssueUrl(url: string | null): string | null {
    return url && /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/issues\/[0-9]+$/.test(url) ? url : null;
}
