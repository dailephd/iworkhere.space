import { randomUUID } from "node:crypto";
import type { CollectionWindow, WindowResult } from "./reportingMonitoringWindow";
import { invocationCount, reconcileWindow } from "./reportingMonitoringWindow";

export interface CollectorDatabase {
    begin(run: string, window: CollectionWindow): Promise<void>;
    finish(run: string, window: CollectionWindow, value: WindowResult | null, reason?: string): Promise<void>;
}
export interface CollectorProvider {
    logs(window: CollectionWindow): Promise<string>;
    counts(window: CollectionWindow): Promise<unknown>;
}
/** No process-local checkpoint state survives a job. Every window begins in the
 * durable store; abandoned starts remain observable, retries use the same ID. */
export async function collectWindow(window: CollectionWindow, database: CollectorDatabase, provider: CollectorProvider,
    clock: () => Date = () => new Date()): Promise<"complete" | "partial" | "failed"> {
    const run=randomUUID();
    await database.begin(run,window);
    let result: WindowResult;
    try {
        const [logs,counter]=await Promise.allSettled([provider.logs(window),provider.counts(window)]);
        let counts:Map<string,number> | null=null;
        if(counter.status==="fulfilled") { try{counts=invocationCount(counter.value,window);}catch{/* Still retain valid log evidence. */} }
        const observedAt=clock().toISOString();
        try {
            result=reconcileWindow(window,observedAt,logs.status==="fulfilled"?logs.value:"",counts??new Map());
        } catch {
            if(counts===null) throw new Error("source_unavailable");
            // Reject the entire untrusted log batch, retaining only independently
            // validated counters. No malformed or contradictory record is stored.
            result=reconcileWindow(window,observedAt,"",counts);
            result.outcome="partial";
            result.reason="invalid_record";
        }
        if(logs.status!=="fulfilled" || counts===null) {
            result.outcome="partial";result.reason="source_unavailable";
            if(counts===null) { result.independentRequestCount=null;result.independentFailureCount=0;result.independentMaintenanceFailureCount=0; }
        }
    } catch(error) {
        const reason=error instanceof Error && error.message==="source_truncated" ? "source_truncated" : "source_unavailable";
        await database.finish(run,window,null,reason);
        return "failed";
    }
    // If delivery fails after commit, retry is idempotent, never a second vote
    // toward continuity. Contradictions remain rejected by the database owner.
    try { await database.finish(run,window,result); }
    catch {
        try { await database.finish(run,window,result); }
        catch { await database.finish(run,window,null,"delivery_failed"); return "failed"; }
    }
    return result.outcome;
}
