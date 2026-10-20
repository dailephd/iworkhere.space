import "server-only";

export type ProviderFailureCode = "timeout" | "network" | "http_4xx" | "http_5xx" | "rate_limited" | "auth" | "not_private" | "misconfigured" | "unknown";

/** Minimal job payload: reference and routing metadata only, never report text. */
export interface DeliveryPayload {
    reportId: string;
    kind: "github_issue" | "operator_email" | "contact_receipt";
    category: string;
    area: string;
    toolId: string | null;
    pathname: string;
    receivedAt: string;
    /** Present only for a consented contact receipt. */
    contactEmail: string | null;
}

export type ProviderResult =
    | { ok: true; providerRef: string; issueNumber?: number; issueUrl?: string }
    | { ok: false; code: ProviderFailureCode; retryable: boolean };

export interface ProviderSet {
    githubIssue(payload: DeliveryPayload): Promise<ProviderResult>;
    operatorEmail(payload: DeliveryPayload, jobId: string): Promise<ProviderResult>;
    contactReceipt(payload: DeliveryPayload, jobId: string): Promise<ProviderResult>;
}

export const PROVIDER_TIMEOUT_MS = 8_000;

/** Failures an operator can fix (credentials, repository) stay retryable until the dead-letter limit. */
export function failure(code: ProviderFailureCode): ProviderResult {
    return { ok: false, code, retryable: code !== "http_4xx" };
}

export function statusFailure(status: number): ProviderResult {
    if (status === 401 || status === 403) return failure("auth");
    if (status === 429) return failure("rate_limited");
    if (status === 408) return failure("timeout");
    if (status >= 500) return failure("http_5xx");
    return failure("http_4xx");
}

export function transportFailure(error: unknown): ProviderResult {
    const name = error instanceof Error ? error.name : "";
    return failure(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
}

/** Dashboard link for the report; empty when the base URL is not configured. */
export function dashboardLink(reportId: string, base: string | undefined): string | null {
    if (!base) return null;
    try {
        const url = new URL(`/support/${reportId}`, base);
        return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.toString() : null;
    } catch {
        return null;
    }
}
