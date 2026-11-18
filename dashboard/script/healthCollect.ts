import { neon } from "@neondatabase/serverless";
import { collectWindow, type CollectorDatabase } from "../src/lib/reportingCollector";
import { collectionWindow } from "../src/lib/reportingMonitoringWindow";
import { vercelMonitoringProvider, vercelMonitoringRead } from "../src/lib/reportingVercelSource";

async function main(): Promise<void> {
    const url=process.env.OBSERVABILITY_HEALTH_COLLECTOR_DATABASE_URL, token=process.env.VERCEL_TOKEN;
    if(!url || new URL(url).username!=="observability_health_collector") throw new Error("configuration");
    const sql=neon(url,{fetchOptions:{signal:AbortSignal.timeout(120000)}});
    const database:CollectorDatabase={
        async begin(run,window){await sql.query("SELECT observability.begin_health_collection($1::uuid,$2::timestamptz,$3::timestamptz)",[run,window.start,window.end]);},
        async finish(run,window,value,reason){await sql.query("SELECT observability.finish_health_collection($1::uuid,$2::timestamptz,$3,$4,$5::integer,$6,$7::jsonb,$8::integer,$9::integer,$10::integer)",
            [run,window.start,value?.outcome??"failed",value?.reason??reason??"source_unavailable",value?.requestCount??0,value?.fingerprint??null,JSON.stringify(value?.records??[]),value?.independentRequestCount??null,value?.independentFailureCount??0,value?.independentMaintenanceFailureCount??0]);},
    };
    const source=vercelMonitoringRead(token??"",result=>process.stdout.write(JSON.stringify(result)+"\n"));
    // A project metadata read diagnoses credential validity, not monitoring
    // coverage. Sources must still pass their own independent validation.
    try { await source.verifyProject(); } catch { /* Fixed provider outcome already emitted; actual source reads still run. */ }
    let failed=false;
    for(const window of collectionWindow(new Date())) {
        try {
            const outcome=await collectWindow(window,database,vercelMonitoringProvider(source.read));
            process.stdout.write(JSON.stringify({source:"observability-health-collector",windowStart:window.start,windowEnd:window.end,outcome})+"\n");
            if(outcome!=="complete") failed=true;
        } catch { failed=true; process.stdout.write(JSON.stringify({source:"observability-health-collector",windowStart:window.start,windowEnd:window.end,outcome:"database_unavailable"})+"\n"); }
    }
    if(failed) process.exitCode=1;
}
main().catch(()=>{process.stderr.write("Operational evidence collection unavailable; details omitted.\n");process.exitCode=1;});
