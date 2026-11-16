import "server-only";
import type { Query } from "./query";
import { array, invalid, ReportingUnavailable } from "./reportingContract";
import { reportingModel, reportingRequest, type ReportingResponse } from "./reportingModel";
import type { MonitoringEvidence } from "./reportingHealth";
import { reportingQuery } from "./reportingQuery";
import { rangePlan } from "./range";

export interface ReportingReadOption {
    readOnly: true;
    isolationLevel: "RepeatableRead";
    statementTimeoutMs: 15000;
    maximumResultBytes: 131072;
    signal: AbortSignal;
}
/** Trusted server adapter only. Must honor cancellation, server-side statement
 * timeout and intermediate byte bound, and return all three results atomically.
 * B2 supplies a separate least-privilege connection; never the dashboard reader. */
export interface ReportingReader {
    transaction(query: readonly Query[], option: ReportingReadOption): Promise<unknown>;
}
export async function loadReporting(requestValue: unknown, reader: ReportingReader, now: Date, monitoring: MonitoringEvidence | null = null): Promise<ReportingResponse> {
    const request = reportingRequest(requestValue);
    const plan = rangePlan(request.range, now), query = reportingQuery(plan);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new ReportingUnavailable("timeout")); }, 15_000);
        });
        const result = await Promise.race([reader.transaction([query.activity, query.vital, query.evidence], {
            readOnly: true, isolationLevel: "RepeatableRead", statementTimeoutMs: 15000, maximumResultBytes: 131072, signal: controller.signal,
        }), timeout]);
        // Validate tuple without serializing arbitrary error/driver objects.
        const tuple = array(result, 3); if (tuple.length !== 3) return invalid();
        return reportingModel(request, { activity: tuple[0], vital: tuple[1], evidence: tuple[2] }, now, monitoring);
    } catch (error) {
        if (error instanceof ReportingUnavailable) throw error;
        throw new ReportingUnavailable("database");
    } finally { clearTimeout(timer); controller.abort(); }
}
