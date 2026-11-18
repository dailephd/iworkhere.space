import "server-only";
import { neon } from "@neondatabase/serverless";
import { monitoringFromRow, monitoringQuery } from "../../../dashboard/src/lib/reportingMonitoringQuery";
import type { MonitoringEvidence } from "../../../dashboard/src/lib/reportingHealth";

/** Restricted connection, fixed aggregate-only function. Missing schema, grants,
 * collector, invalid summaries or timeouts degrade to absent evidence. */
export async function readMonitoring(url: string, now: Date): Promise<MonitoringEvidence | null> {
    try {
        const signal=AbortSignal.timeout(5000), sql=neon(url,{fetchOptions:{signal}}),query=monitoringQuery(now);
        const result=await sql.transaction([
            sql.query("SELECT set_config('statement_timeout',$1,true)",["5000"]),sql.query(query.text,query.parameter),
        ],{readOnly:true,isolationLevel:"RepeatableRead",fetchOptions:{signal}});
        if(!Array.isArray(result) || result.length!==2 || !Array.isArray(result[1]) || result[1].length!==1) return null;
        return monitoringFromRow(result[1][0],now);
    } catch { return null; }
}
