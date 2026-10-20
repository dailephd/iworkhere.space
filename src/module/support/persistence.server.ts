import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NormalizedReport } from "./contract";
import { connectSupport, type SupportSql } from "./neon.server";

export type { SupportSql } from "./neon.server";

export type SubmitOutcome =
    | { kind: "created" | "replayed"; reportId: string; receivedAt: string }
    | { kind: "conflict" }
    | { kind: "rate_limited" };

export class SupportUnavailableError extends Error {
    constructor() { super("Support persistence is unavailable"); }
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DEFAULT_GLOBAL_LIMIT = 120;

/** Opaque, unguessable reference: "SR-" plus 80 random bits in Crockford base32. */
export function newReportId(bytes: Buffer = randomBytes(10)): string {
    let id = "";
    let buffer = 0;
    let held = 0;
    for (const byte of bytes) {
        buffer = (buffer << 8) | byte;
        held += 8;
        while (held >= 5) {
            held -= 5;
            id += CROCKFORD[(buffer >> held) & 31];
            buffer &= (1 << held) - 1;
        }
    }
    return `SR-${id}`;
}

/** Digest of normalized content; excludes the idempotency key and the challenge token. */
export function reportDigest(report: NormalizedReport): string {
    return createHash("sha256")
        .update(JSON.stringify([report.category, report.area, report.toolId, report.pathname, report.description, report.expected, report.observed, report.email, report.contactConsent]))
        .digest("hex");
}

export function intakeConfigured(): boolean {
    return Boolean(process.env.SUPPORT_DATABASE_URL);
}

export function defaultIntakeSql(): SupportSql {
    const url = process.env.SUPPORT_DATABASE_URL;
    if (!url) throw new SupportUnavailableError();
    return connectSupport(url, 10_000);
}

function globalLimit(): number {
    const configured = Number(process.env.SUPPORT_GLOBAL_LIMIT);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_GLOBAL_LIMIT;
}

export interface SubmitDependency {
    sql?: SupportSql;
    newId?: () => string;
    limit?: number;
}

/** One call to the atomic database function; providers are never involved. */
export async function submitReport(report: NormalizedReport, idempotencyKey: string, dependency: SubmitDependency = {}): Promise<SubmitOutcome> {
    let rows: Record<string, unknown>[];
    try {
        const sql = dependency.sql ?? defaultIntakeSql();
        rows = await sql.query(
            `SELECT outcome, report_id, received_at FROM support.submit_report($1::text, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text, $12::boolean, $13::integer)`,
            [(dependency.newId ?? newReportId)(), idempotencyKey, reportDigest(report), report.category, report.area, report.toolId, report.pathname,
                report.description, report.expected, report.observed, report.email, report.contactConsent, dependency.limit ?? globalLimit()],
        );
    } catch {
        throw new SupportUnavailableError();
    }
    const row = rows[0];
    if (!row) throw new SupportUnavailableError();
    if (row.outcome === "conflict") return { kind: "conflict" };
    if (row.outcome === "rate_limited") return { kind: "rate_limited" };
    if ((row.outcome === "created" || row.outcome === "replayed") && typeof row.report_id === "string" && /^SR-[0-9A-HJKMNP-TV-Z]{16}$/.test(row.report_id)) {
        const receivedAt = row.received_at instanceof Date ? row.received_at.toISOString() : typeof row.received_at === "string" ? new Date(row.received_at).toISOString() : null;
        if (receivedAt) return { kind: row.outcome, reportId: row.report_id, receivedAt };
    }
    throw new SupportUnavailableError();
}
