/** Typed, versioned support-report contract shared by the browser, the API and the domain. */

export const SUPPORT_SCHEMA_VERSION = 1;

export const SUPPORT_LIMIT = {
    bodyBytes: 16 * 1024,
    description: 2000,
    expected: 1000,
    observed: 1000,
    email: 254,
    token: 2048,
    pathname: 256,
} as const;

export const REPORT_CATEGORY = [
    "incorrect_result",
    "tool_failure",
    "invalid_output",
    "interface_accessibility",
    "performance_compatibility",
    "content_link",
    "privacy_security",
    "suggestion",
    "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORY)[number];

export type ReportArea = "tool" | "site-wide" | "other";

/** Exact request body. `expected`/`observed` carry the improvement/use case for suggestions. */
export interface ReportRequest {
    schemaVersion: typeof SUPPORT_SCHEMA_VERSION;
    category: ReportCategory;
    area: ReportArea;
    toolId?: string;
    pathname: string;
    description: string;
    expected?: string;
    observed?: string;
    email?: string;
    contactConsent: boolean;
    idempotencyKey: string;
    turnstileToken: string;
}

/** Deterministically normalized report. This is the only shape that reaches persistence. */
export interface NormalizedReport {
    category: ReportCategory;
    area: ReportArea;
    toolId: string | null;
    pathname: string;
    description: string;
    expected: string | null;
    observed: string | null;
    /** Retained only when contact consent is given; otherwise always null. */
    email: string | null;
    contactConsent: boolean;
}

export type FieldErrorCode = "required" | "too_long" | "invalid" | "unknown_field";
export type FieldErrorMap = Record<string, FieldErrorCode>;

export type ParsedReport =
    | { ok: true; report: NormalizedReport; idempotencyKey: string; turnstileToken: string }
    | { ok: false; fieldError: FieldErrorMap };

export interface ReportReceipt {
    schemaVersion: typeof SUPPORT_SCHEMA_VERSION;
    reportId: string;
    receivedAt: string;
}

export type SupportErrorCode =
    | "invalid_request"
    | "forbidden_origin"
    | "payload_too_large"
    | "idempotency_conflict"
    | "rate_limited"
    | "challenge_failed"
    | "unavailable";

export interface SupportErrorBody {
    error: SupportErrorCode;
    fieldError?: FieldErrorMap;
}

/** Serializable tool projection supplied by the server layout; never a ToolDefinition. */
export interface SupportToolProjection {
    id: string;
    slug: string;
    name: string;
}
