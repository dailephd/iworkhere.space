import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { collectWindow, type CollectorDatabase } from "../src/lib/reportingCollector";
import { collectionWindow } from "../src/lib/reportingMonitoringWindow";

async function main(): Promise<void> {
    const url=process.env.OBSERVABILITY_HEALTH_COLLECTOR_DATABASE_URL, cli=process.env.VERCEL_CLI_PATH;
    if(!url || !cli || new URL(url).username!=="observability_health_collector") throw new Error("configuration");
    const sql=neon(url,{fetchOptions:{signal:AbortSignal.timeout(120000)}});
    const database:CollectorDatabase={
        async begin(run,window){await sql.query("SELECT observability.begin_health_collection($1::uuid,$2::timestamptz,$3::timestamptz)",[run,window.start,window.end]);},
        async finish(run,window,value,reason){await sql.query("SELECT observability.finish_health_collection($1::uuid,$2::timestamptz,$3,$4,$5::integer,$6,$7::jsonb,$8::integer,$9::integer,$10::integer)",
            [run,window.start,value?.outcome??"failed",value?.reason??reason??"source_unavailable",value?.requestCount??0,value?.fingerprint??null,JSON.stringify(value?.records??[]),value?.independentRequestCount??null,value?.independentFailureCount??0,value?.independentMaintenanceFailureCount??0]);},
    };
    function invoke(args:string[]):string {
        const result=spawnSync(process.execPath,[cli!,...args,"--scope","dailephds-projects"],{encoding:"utf8",windowsHide:true,timeout:45000,maxBuffer:8*1024*1024});
        if(result.status!==0 || result.error) throw new Error("source_unavailable");
        return result.stdout;
    }
    let failed=false;
    for(const window of collectionWindow(new Date())) {
        try {
            const outcome=await collectWindow(window,database,{
                async logs(w){return invoke(["logs","--project","iworkhere-space","--environment","production","--since",w.start,"--until",w.end,"--limit","1000","--json"]);},
                async counts(w){return JSON.parse(invoke(["metrics","vercel.function_invocation.count","--project","iworkhere-space","--prod","--since",w.start,"--until",w.end,"--granularity","5m","--aggregation","count","--group-by","requestPath","--group-by","requestMethod","--group-by","httpStatus","--limit","100","--filter",'route:"/api/metric" OR route:"/api/observability/maintenance"',"--json"]));},
            });
            process.stdout.write(JSON.stringify({source:"observability-health-collector",windowStart:window.start,windowEnd:window.end,outcome})+"\n");
            if(outcome!=="complete") failed=true;
        } catch { failed=true; process.stdout.write(JSON.stringify({source:"observability-health-collector",windowStart:window.start,windowEnd:window.end,outcome:"database_unavailable"})+"\n"); }
    }
    if(failed) process.exitCode=1;
}
main().catch(()=>{process.stderr.write("Operational evidence collection unavailable; details omitted.\n");process.exitCode=1;});
