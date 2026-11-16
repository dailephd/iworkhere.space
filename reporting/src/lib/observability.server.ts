import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { loadReporting, type ReportingReader } from "../../../dashboard/src/lib/reportingDatabase.server";
import { reportingRequest, type ReportingResponse } from "../../../dashboard/src/lib/reportingModel";
import { reportingQuery } from "../../../dashboard/src/lib/reportingQuery";
import { rangePlan } from "../../../dashboard/src/lib/range";
import { boundedBytes, ServiceUnavailable } from "./response";

// Module-wide immutable transport policy, never per-request mutable credentials.
// Applies only to this independently installed service's Neon driver instance.
neonConfig.fetchFunction = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const response = await fetch(input, { ...init, redirect: "error", cache: "no-store" });
    const bytes = await boundedBytes(response, 131072);
    return new Response(bytes, { status: response.status, headers: response.headers });
};
export function reportingReader(url: string, requestValue: unknown, now: Date): ReportingReader {
    const request = reportingRequest(requestValue), plan = reportingQuery(rangePlan(request.range, now));
    const approved = [plan.activity, plan.vital, plan.evidence];
    return {
        async transaction(queries, option) {
            // This adapter is private to B1 loadReporting; cannot accept caller SQL.
            if (queries.length !== 3 || !option.readOnly || option.isolationLevel !== "RepeatableRead" || option.statementTimeoutMs !== 15000 || option.maximumResultBytes !== 131072) throw new ServiceUnavailable("database");
            if (queries.some((query, index) => query.text !== approved[index].text || JSON.stringify(query.parameter) !== JSON.stringify(approved[index].parameter))) throw new ServiceUnavailable("database");
            const sql = neon(url, { fetchOptions: { signal: option.signal } });
            const result = await sql.transaction([
                sql.query("SELECT set_config('statement_timeout', $1, true) AS timeout", [String(option.statementTimeoutMs)]),
                ...queries.map(query => sql.query(query.text, query.parameter)),
            ], { readOnly: true, isolationLevel: "RepeatableRead", fetchOptions: { signal: option.signal } });
            if (!Array.isArray(result) || result.length !== 4) throw new ServiceUnavailable("invalid_result");
            // Result byte bound is enforced by streamed fetch before driver JSON decoding.
            return result.slice(1);
        },
    };
}
export async function observe(requestValue: unknown): Promise<ReportingResponse> {
    const request = reportingRequest(requestValue);
    const url = process.env.REPORTING_DATABASE_URL;
    if (!url) throw new ServiceUnavailable("configuration");
    try {
        const parsed = new URL(url);
        if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.username !== "observability_reporting") throw new ServiceUnavailable("configuration");
        // No monitoring collector in B2: B1 accurately describes missing evidence.
        const now = new Date();
        return await loadReporting(request, reportingReader(url, request, now), now, null);
    } catch { throw new ServiceUnavailable("database"); }
}
