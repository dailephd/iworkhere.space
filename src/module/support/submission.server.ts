import "server-only";
import { MalformedBodyError, PayloadTooLargeError, readBoundedJson } from "./body";
import type { NormalizedReport, ReportReceipt, SupportErrorBody } from "./contract";
import { SUPPORT_SCHEMA_VERSION } from "./contract";
import type { SupportContextSource } from "./context";
import { sameOriginSupportRequest } from "./origin";
import { reportSupportFailure } from "./operation.server";
import type { SubmitOutcome } from "./persistence.server";
import type { ChallengeResult } from "./turnstile.server";
import { parseReportRequest } from "./validation";

export interface SubmissionDependency {
    source: SupportContextSource;
    challenge: (token: string) => Promise<ChallengeResult>;
    submit: (report: NormalizedReport, idempotencyKey: string) => Promise<SubmitOutcome>;
}

function json(status: number, body: ReportReceipt | SupportErrorBody): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function failure(status: number, error: SupportErrorBody["error"], fieldError?: SupportErrorBody["fieldError"]): Response {
    return json(status, fieldError ? { error, fieldError } : { error });
}

/**
 * Report intake. Order: origin, bounded body, exact-field validation, challenge,
 * then one atomic persistence call. A receipt is returned only after durable commit.
 */
export async function handleReportRequest(request: Request, dependency: SubmissionDependency): Promise<Response> {
    if (!sameOriginSupportRequest(request)) return failure(403, "forbidden_origin");
    let body: unknown;
    try { body = await readBoundedJson(request); }
    catch (error) {
        if (error instanceof PayloadTooLargeError) return failure(413, "payload_too_large");
        if (error instanceof MalformedBodyError) return failure(400, "invalid_request");
        return failure(400, "invalid_request");
    }
    const parsed = parseReportRequest(body, dependency.source);
    if (!parsed.ok) return failure(400, "invalid_request", parsed.fieldError);

    const challenge = await dependency.challenge(parsed.turnstileToken);
    if (challenge === "unavailable") { reportSupportFailure("challenge", "unavailable"); return failure(503, "unavailable"); }
    if (challenge === "rejected") return failure(429, "challenge_failed");

    try {
        const outcome = await dependency.submit(parsed.report, parsed.idempotencyKey);
        if (outcome.kind === "conflict") return failure(409, "idempotency_conflict");
        if (outcome.kind === "rate_limited") return failure(429, "rate_limited");
        return json(201, { schemaVersion: SUPPORT_SCHEMA_VERSION, reportId: outcome.reportId, receivedAt: outcome.receivedAt });
    } catch {
        reportSupportFailure("intake", "unavailable");
        return failure(503, "unavailable");
    }
}
