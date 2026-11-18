import { expect,it } from "vitest";
import { collectionWindow,invocationCount,reconcileWindow } from "./reportingMonitoringWindow";
const window={start:"2026-11-17T12:00:00.000Z",end:"2026-11-17T12:05:00.000Z"},now="2026-11-17T12:20:00.000Z";
const attempt={source:"observability-health",schemaVersion:1,operation:"ingestion",status:"attempt",attemptId:"00000000-0000-4000-8000-000000000001",startedAt:"2026-11-17T12:01:00.000Z",timestamp:"2026-11-17T12:01:00.000Z"};
const success={...attempt,status:"success",timestamp:"2026-11-17T12:01:01.000Z"};
const row=()=>({id:"internal-request",projectId:"prj_OZIQho0P485NwArPlWTQuYfSQtNI",environment:"production",requestPath:"/api/metric",requestMethod:"POST",responseStatusCode:204,timestamp:Date.parse(attempt.startedAt),logs:[{message:JSON.stringify(attempt)},{message:JSON.stringify(success)}]});
const counts=()=>new Map([["/api/metric|POST|204",1]]);
it("reconciles independent request counts and immutable application records",()=>{
    const result=reconcileWindow(window,now,JSON.stringify(row()),counts());
    expect(result).toMatchObject({outcome:"complete",requestCount:1,records:[{...attempt,httpStatus:204},{...success,httpStatus:204}]});
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
});
it("distinguishes proven idle windows from absent/unreconciled evidence",()=>{
    expect(reconcileWindow(window,now,"",new Map()).outcome).toBe("complete");
    expect(reconcileWindow(window,now,"",counts()).outcome).toBe("partial");
    expect(reconcileWindow(window,now,JSON.stringify({...row(),logs:[]}),counts()).outcome).toBe("partial");
});
it("deduplicates exact provider delivery and rejects conflicting duplicates",()=>{
    expect(reconcileWindow(window,now,[row(),row()].map(x=>JSON.stringify(x)).join("\n"),counts()).requestCount).toBe(1);
    expect(()=>reconcileWindow(window,now,[row(),{...row(),responseStatusCode:503}].map(x=>JSON.stringify(x)).join("\n"),counts())).toThrow();
});
it("retains interrupted attempts without manufacturing a failure record",()=>{
    const r={...row(),responseStatusCode:504,logs:[{message:JSON.stringify(attempt)}]};
    expect(reconcileWindow(window,now,JSON.stringify(r),new Map([["/api/metric|POST|504",1]]))).toMatchObject({outcome:"complete",records:[{...attempt,httpStatus:504}]});
    expect(reconcileWindow(window,now,JSON.stringify({...r,responseStatusCode:204}),counts()).outcome).toBe("partial");
});
it("marks truncated responses incomplete",()=>expect(reconcileWindow(window,now,Array(1000).fill(JSON.stringify(row())).join("\n"),counts()).reason).toBe("source_truncated"));
it.each([200,302,400,401,403,429,501])("does not call unexpected ingestion HTTP%s responses verified idle traffic",status=>{
    expect(reconcileWindow(window,now,JSON.stringify({...row(),responseStatusCode:status,logs:[]}),new Map([[`/api/metric|POST|${status}`,1]])).outcome).toBe("partial");
});
it("rejects operation outcomes that contradict the independently observed response",()=>{
    expect(()=>reconcileWindow(window,now,JSON.stringify({...row(),responseStatusCode:503}),new Map([["/api/metric|POST|503",1]]))).toThrow();
});
it.each([{projectId:"other"},{environment:"preview"},{timestamp:"private"},{logs:[{message:JSON.stringify({...attempt,context:{support:"private"}})}]}])("rejects wrong scope, clocks and private values",value=>expect(()=>reconcileWindow(window,now,JSON.stringify({...row(),...value}),counts())).toThrow());
it("validates independent metric metadata and fixed dimensions",()=>{
    const query={metric:"vercel.function_invocation.count",aggregation:"count",startTime:window.start,endTime:window.end,filter:"(route:/api/metric OR route:/api/observability/maintenance) AND (environment:production)",groupBy:["requestPath","requestMethod","httpStatus"],granularity:{minutes:5}};
    const metric={query,summary:[{requestPath:"/api/metric",requestMethod:"POST",httpStatus:"204",vercel_function_invocation_count_count:1}],data:[]};
    expect(invocationCount(metric,window)).toEqual(counts());
    expect(()=>invocationCount({...metric,query:{...query,aggregation:"unique"}},window)).toThrow();
    expect(()=>invocationCount({...metric,summary:[{...metric.summary[0],private:"support"}]},window)).toThrow();
    expect(()=>invocationCount({...metric,summary:[{...metric.summary[0],vercel_function_invocation_count_count:Infinity}]},window)).toThrow();
});
it("uses only closed five-minute windows safely inside free source retention",()=>{
    const result=collectionWindow(new Date("2026-01-01T00:02:00.000Z"));
    expect(result).toHaveLength(3);expect(result[0].start).toBe("2025-12-31T23:40:00.000Z");expect(result[2].end).toBe("2025-12-31T23:55:00.000Z");
    expect(()=>reconcileWindow({...window,end:now},now,"",new Map())).toThrow();
});
