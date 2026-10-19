import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createPrivateIssue } from "./github.server";
import { connectSupport } from "./neon.server";
import { reportSupportFailure } from "./operation.server";
import type { SupportSql } from "./persistence.server";
import { SupportUnavailableError } from "./persistence.server";
import type { DeliveryPayload, ProviderResult, ProviderSet } from "./provider.server";
import { sendContactReceipt, sendOperatorEmail } from "./resend.server";

export interface DeliverySummary {
    claimed: number;
    delivered: number;
    retried: number;
    dead: number;
    purged: boolean;
}

export interface DeliveryDependency {
    sql: SupportSql;
    provider: ProviderSet;
    batch?: number;
    retentionEnabled?: boolean;
    now?: () => number;
    /** Stop starting new jobs after this many milliseconds so the invocation stays inside its duration. */
    budgetMs?: number;
}

const DEFAULT_BATCH = 5;
const DEFAULT_BUDGET_MS = 40_000;

export function defaultProviderSet(): ProviderSet {
    return {
        githubIssue: payload => createPrivateIssue(payload),
        operatorEmail: (payload, jobId) => sendOperatorEmail(payload, jobId),
        contactReceipt: (payload, jobId) => sendContactReceipt(payload, jobId),
    };
}

export function defaultWorkerSql(): SupportSql {
    const url = process.env.SUPPORT_WORKER_DATABASE_URL;
    if (!url) throw new SupportUnavailableError();
    return connectSupport(url, 15_000);
}

export function defaultDeliveryDependency(): DeliveryDependency {
    return { sql: defaultWorkerSql(), provider: defaultProviderSet(), retentionEnabled: process.env.SUPPORT_RETENTION_ENABLED === "true" };
}

function payloadFrom(row: Record<string, unknown>): DeliveryPayload | null {
    const received = row.received_at instanceof Date ? row.received_at.toISOString() : typeof row.received_at === "string" ? new Date(row.received_at).toISOString() : null;
    if (typeof row.report_id !== "string" || typeof row.kind !== "string" || typeof row.category !== "string" || typeof row.area !== "string" || typeof row.pathname !== "string" || !received) return null;
    if (row.kind !== "github_issue" && row.kind !== "operator_email" && row.kind !== "contact_receipt") return null;
    return {
        reportId: row.report_id, kind: row.kind, category: row.category, area: row.area, toolId: typeof row.tool_id === "string" ? row.tool_id : null,
        pathname: row.pathname, receivedAt: received, contactEmail: typeof row.contact_email === "string" ? row.contact_email : null,
    };
}

async function deliverJob(payload: DeliveryPayload, jobId: string, provider: ProviderSet): Promise<ProviderResult> {
    try {
        if (payload.kind === "github_issue") return await provider.githubIssue(payload);
        if (payload.kind === "operator_email") return await provider.operatorEmail(payload, jobId);
        return await provider.contactReceipt(payload, jobId);
    } catch {
        return { ok: false, code: "unknown", retryable: true };
    }
}

/**
 * Drains due outbox jobs. Claims are lease-based (SKIP LOCKED in the database), provider
 * calls run outside any transaction, and every job finishes as delivered, retried or dead.
 */
export async function runDelivery(dependency: DeliveryDependency): Promise<DeliverySummary> {
    const summary: DeliverySummary = { claimed: 0, delivered: 0, retried: 0, dead: 0, purged: false };
    const now = dependency.now ?? Date.now;
    const started = now();
    const claimed = await dependency.sql.query("SELECT job_id, lease_token FROM support.claim_jobs($1::integer)", [dependency.batch ?? DEFAULT_BATCH]);
    summary.claimed = claimed.length;
    for (const claim of claimed) {
        const jobId = String(claim.job_id);
        const token = String(claim.lease_token);
        if (now() - started > (dependency.budgetMs ?? DEFAULT_BUDGET_MS)) break; // The lease expires and the job is recovered by the next run.
        const rows = await dependency.sql.query("SELECT * FROM support.job_payload($1::uuid, $2::uuid)", [jobId, token]);
        const payload = rows[0] ? payloadFrom(rows[0]) : null;
        if (!payload) {
            await dependency.sql.query("SELECT support.fail_job($1::uuid, $2::uuid, $3::text, $4::boolean)", [jobId, token, "payload_missing", false]);
            summary.dead += 1;
            continue;
        }
        const result = await deliverJob(payload, jobId, dependency.provider);
        if (result.ok) {
            await dependency.sql.query("SELECT support.complete_job($1::uuid, $2::uuid, $3::text, $4::integer, $5::text)", [jobId, token, result.providerRef, result.issueNumber ?? null, result.issueUrl ?? null]);
            summary.delivered += 1;
        } else {
            const status = await dependency.sql.query("SELECT support.fail_job($1::uuid, $2::uuid, $3::text, $4::boolean) AS status", [jobId, token, result.code, result.retryable]);
            if (status[0]?.status === "dead") summary.dead += 1; else summary.retried += 1;
            reportSupportFailure("delivery", result.code);
        }
    }
    if (dependency.retentionEnabled) {
        await dependency.sql.query("SELECT narrative_purged, contact_purged FROM support.purge_expired()", []);
        summary.purged = true;
    }
    return summary;
}

/** Timing-safe bearer check; an unset secret never authorizes. */
export function authorizedCronRequest(request: Request, secret: string | undefined = process.env.CRON_SECRET): boolean {
    const authorization = request.headers.get("authorization");
    if (!secret || !authorization) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const supplied = Buffer.from(authorization);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function handleDeliveryRequest(request: Request, dependency: () => DeliveryDependency = defaultDeliveryDependency): Promise<Response> {
    if (!authorizedCronRequest(request)) return new Response(null, { status: 401 });
    try {
        const summary = await runDelivery(dependency());
        return new Response(JSON.stringify(summary), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    } catch {
        reportSupportFailure("maintenance", "unavailable");
        return new Response(null, { status: 503 });
    }
}
