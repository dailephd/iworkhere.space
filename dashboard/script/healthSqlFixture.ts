import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitoringQuery, monitoringFromRow } from "../src/lib/reportingMonitoringQuery";
import type { Query } from "../src/lib/query";

export interface HealthFixtureDatabase {
    execute(text:string):Promise<void>;
    query(query:Query,reader:boolean):Promise<Record<string,unknown>[]>;
}
/** Only the existing disposable-container permission runner calls this fixture.
 * Never accepts a connection URL. Synthetic history is isolated test data. */
export async function verifyHealthFixture(db:HealthFixtureDatabase,directory:string):Promise<string[]> {
    const checks:string[]=[];
    await db.execute(readFileSync(path.join(directory,"003-operational-health.sql"),"utf8"));
    await db.execute(readFileSync(path.join(directory,"003-operational-health.sql"),"utf8"));
    await db.execute(readFileSync(path.join(directory,"dashboard-role.sql"),"utf8").replaceAll(':"database_name"','"postgres"'));
    await db.execute(readFileSync(path.join(directory,"health-role.sql"),"utf8").replaceAll(':"database_name"','"postgres"'));
    const now=new Date(), q=monitoringQuery(now);
    const fresh=monitoringFromRow((await db.query(q,true))[0],now);
    assert.equal(fresh.coverage,"unavailable");assert.equal(fresh.attempted,0);
    checks.push("empty metadata does not prove idle/healthy; migration idempotent");
    const before=await db.query({text:"SELECT (SELECT count(*) FROM observability.event) AS raw,(SELECT count(*) FROM observability.daily_event) AS daily,(SELECT count(*) FROM observability.daily_vital) AS vital",parameter:[]},false);
    const end=new Date(Math.floor(now.getTime()/300000)*300000-1200000),start=new Date(end.getTime()-300000);
    const run="10000000-0000-4000-8000-000000000001",id="20000000-0000-4000-8000-000000000001";
    const began=new Date(start.getTime()+1000).toISOString();
    const record={source:"observability-health",schemaVersion:1,operation:"ingestion",status:"attempt",attemptId:id,startedAt:began,timestamp:began,httpStatus:204};
    const records=[record,{...record,status:"success",timestamp:new Date(start.getTime()+2000).toISOString()}];
    const literal=(v:unknown)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
    await db.execute(`SET ROLE observability_health_collector; SELECT observability.begin_health_collection('${run}','${start.toISOString()}','${end.toISOString()}');
      SELECT observability.finish_health_collection('${run}','${start.toISOString()}','complete','none',1,repeat('a',64),${literal(records)},1);
      SELECT observability.finish_health_collection('${run}','${start.toISOString()}','complete','none',1,repeat('a',64),${literal(records)},1); RESET ROLE;`);
    assert.equal(Number((await db.query({text:"SELECT count(*) AS n FROM observability.health_operation",parameter:[]},false))[0].n),2);
    assert.equal(monitoringFromRow((await db.query(monitoringQuery(new Date()),true))[0],new Date()).coverage,"partial");
    checks.push("restricted collector stores idempotent immutable outcomes; one observation cannot establish coverage");
    async function denied(role:string,statement:string):Promise<void>{
        await db.execute(`SET ROLE ${role}; DO $test$ BEGIN BEGIN EXECUTE '${statement.replaceAll("'","''")}'; RAISE EXCEPTION 'Forbidden health statement succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $test$; RESET ROLE;`);
    }
    for(const role of ["observability_reporting","observability_dashboard"]) {
        await denied(role,"SELECT attempt_id FROM observability.health_operation");
        await denied(role,"DELETE FROM observability.health_collection");
        await denied(role,"SELECT observability.begin_health_collection('00000000-0000-4000-8000-000000000000',now()-interval '10 minutes',now()-interval '5 minutes')");
    }
    for(const statement of ["SELECT pathname FROM observability.event","SELECT message FROM observability.error_diagnostic","SELECT body FROM support.report","UPDATE observability.event SET pathname='/'","CREATE TABLE public.bad(id int)","SELECT * FROM observability.health_summary(now())"]) await denied("observability_health_collector",statement);
    checks.push("collector has no metric/diagnostic/support reads or DDL; reporting/dashboard cannot read IDs or write");
    await db.execute(`DO $test$ BEGIN
      BEGIN PERFORM observability.finish_health_collection('${run}','${start.toISOString()}','complete','none',2,repeat('b',64),'[]'); RAISE EXCEPTION 'conflict accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='conflict accepted' THEN RAISE; END IF; END;
      BEGIN PERFORM observability.begin_health_collection(gen_random_uuid(),now(),now()+interval '5 minutes'); RAISE EXCEPTION 'future accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='future accepted' THEN RAISE; END IF; END;
    END $test$;`);
    checks.push("contradictory checkpoints and future windows rejected");
    // Owner-only synthetic coverage, never generated by the production collector.
    await db.execute(`TRUNCATE observability.health_operation,observability.health_collection;
      UPDATE observability.health_epoch SET activated_at=now()-interval '2 days';
      INSERT INTO observability.health_collection(run_id,window_start,window_end,started_at,completed_at,outcome,reason,request_count,independent_request_count,fingerprint)
      SELECT gen_random_uuid(),w,w+interval '5 minutes',w+interval '10 minutes'+p*interval '6 minutes',w+interval '11 minutes'+p*interval '6 minutes','complete','none',0,0,repeat('c',64)
      FROM generate_series(timestamptz '${end.toISOString()}'-interval '24 hours',timestamptz '${end.toISOString()}'-interval '5 minutes',interval '5 minutes') w CROSS JOIN generate_series(0,1) p;`);
    const full=monitoringFromRow((await db.query(monitoringQuery(new Date()),true))[0],new Date());
    assert.equal(full.coverage,"complete");assert.equal(full.detail?.missingIntervalCount,0);
    assert.equal(full.observedAt,end.toISOString());
    assert.ok(!JSON.stringify(full).includes(id));
    checks.push("two independent matching observations span complete24h; health snapshot uses bounded older cutoff; no IDs exposed");
    await db.execute(`INSERT INTO observability.health_collection(run_id,window_start,window_end,started_at,completed_at,outcome,reason,request_count)
      VALUES(gen_random_uuid(),'${start.toISOString()}','${end.toISOString()}',now(),now(),'failed','source_unavailable',0);`);
    const gap=monitoringFromRow((await db.query(monitoringQuery(new Date()),true))[0],new Date());
    assert.equal(gap.coverage,"partial");assert.ok((gap.detail?.failedCollectionCount??0)>0);
    checks.push("provider/collector failure revokes earlier continuity; interior gap visible");
    const failedRecord=[{...record,httpStatus:503},{...record,httpStatus:503,status:"failure",timestamp:new Date(start.getTime()+2000).toISOString()}];
    await db.execute(`SELECT observability.begin_health_collection('${run}','${start.toISOString()}','${end.toISOString()}');
      SELECT observability.finish_health_collection('${run}','${start.toISOString()}','partial','source_unreconciled',1,repeat('d',64),${literal(failedRecord)});`);
    const failed=monitoringFromRow((await db.query(monitoringQuery(new Date()),true))[0],new Date());
    assert.equal(failed.failed,1);assert.equal(failed.coverage,"partial");
    checks.push("observed ingestion failures remain visible with partial source coverage");
    await db.execute(`SELECT observability.begin_health_collection('10000000-0000-4000-8000-000000000003','${start.toISOString()}','${end.toISOString()}');
      SELECT observability.finish_health_collection('10000000-0000-4000-8000-000000000003','${start.toISOString()}','partial','source_unavailable',0,repeat('e',64),'[]',2,2,0);`);
    const counterOnly=monitoringFromRow((await db.query(monitoringQuery(new Date()),true))[0],new Date());
    assert.equal(counterOnly.failed,2); assert.equal(counterOnly.coverage,"partial");
    await db.execute(`DO $test$ BEGIN
      BEGIN PERFORM observability.finish_health_collection('${run}','${start.toISOString()}','partial','source_unreconciled',1,repeat('d',64),${literal(failedRecord.map(r=>({...r,safe:{support:"private"}})))}); RAISE EXCEPTION 'private replay accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='private replay accepted' THEN RAISE; END IF; END;
    END $test$;`);
    checks.push("counter-only failures survive log outage; changed private replay rejected before storage");
    await db.execute(`INSERT INTO observability.health_operation(attempt_id,operation,status,started_at,recorded_at,request_status)
      VALUES(gen_random_uuid(),'ingestion','attempt',now()-interval '8 days',now()-interval '8 days',504);
      SELECT observability.begin_health_collection('10000000-0000-4000-8000-000000000002','${start.toISOString()}','${end.toISOString()}');
      SELECT observability.finish_health_collection('10000000-0000-4000-8000-000000000002','${start.toISOString()}','failed','source_unavailable',0,NULL,'[]');`);
    assert.equal(Number((await db.query({text:"SELECT count(*) AS n FROM observability.health_operation WHERE started_at<now()-interval '7 days'",parameter:[]},false))[0].n),0);
    assert.deepEqual(await db.query({text:"SELECT (SELECT count(*) FROM observability.event) AS raw,(SELECT count(*) FROM observability.daily_event) AS daily,(SELECT count(*) FROM observability.daily_vital) AS vital",parameter:[]},false),before);
    checks.push("seven-day operational retention leaves measurement history unchanged");
    return checks;
}
