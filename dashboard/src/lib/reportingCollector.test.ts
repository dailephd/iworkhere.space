import { expect,it,vi } from "vitest";
import { collectWindow } from "./reportingCollector";
const window={start:"2026-11-17T12:00:00.000Z",end:"2026-11-17T12:05:00.000Z"};
const clock=()=>new Date("2026-11-17T12:20:00.000Z");
const metric={query:{metric:"vercel.function_invocation.count",aggregation:"count",startTime:window.start,endTime:window.end,filter:"(route:/api/metric OR route:/api/observability/maintenance) AND (environment:production)",groupBy:["requestPath","requestMethod","httpStatus"],granularity:{minutes:5}},summary:[],data:[]};
it("starts a durable checkpoint before independent observation",async()=>{
    const database={begin:vi.fn(async()=>{}),finish:vi.fn(async()=>{})},provider={logs:vi.fn(async()=>""),counts:vi.fn(async()=>metric)};
    expect(await collectWindow(window,database,provider,clock)).toBe("complete");
    expect(database.begin.mock.invocationCallOrder[0]).toBeLessThan(provider.logs.mock.invocationCallOrder[0]);
    expect(database.finish).toHaveBeenCalledWith(expect.any(String),window,expect.objectContaining({outcome:"complete"}));
});
it("records source outages instead of inventing zero traffic",async()=>{
    const database={begin:vi.fn(async()=>{}),finish:vi.fn(async()=>{})};
    expect(await collectWindow(window,database,{logs:async()=>{throw Error("private token SQL")},counts:async()=>metric},clock)).toBe("partial");
    expect(database.finish).toHaveBeenCalledWith(expect.any(String),window,expect.objectContaining({outcome:"partial",reason:"source_unavailable"}));
    expect(JSON.stringify(database.finish.mock.calls)).not.toMatch(/private|token|SQL/);
});
it("does not call the provider when the durable checkpoint cannot be created",async()=>{
    const provider={logs:vi.fn(async()=>""),counts:vi.fn(async()=>metric)};
    await expect(collectWindow(window,{begin:async()=>{throw Error("database")},finish:async()=>{}},provider,clock)).rejects.toThrow();
    expect(provider.logs).not.toHaveBeenCalled();
});
it("retries a failed delivery with identical run and immutable data",async()=>{
    const finish=vi.fn().mockRejectedValueOnce(Error("delivery" )).mockResolvedValue(undefined);
    await collectWindow(window,{begin:async()=>{},finish},{logs:async()=>"",counts:async()=>metric},clock);
    expect(finish.mock.calls[0]).toEqual(finish.mock.calls[1]);
});
it("retains independently observed HTTP failures during a log outage",async()=>{
    const finish=vi.fn(async()=>{});
    const counter={...metric,summary:[{requestPath:"/api/metric",requestMethod:"POST",httpStatus:"503",vercel_function_invocation_count_count:2}]};
    expect(await collectWindow(window,{begin:async()=>{},finish},{logs:async()=>{throw Error("provider outage")},counts:async()=>counter},clock)).toBe("partial");
    expect(finish).toHaveBeenCalledWith(expect.any(String),window,expect.objectContaining({independentFailureCount:2,independentRequestCount:2,records:[]}));
});
it("does not interpret an unavailable counter as independent zero traffic",async()=>{
    const finish=vi.fn(async()=>{});
    await collectWindow(window,{begin:async()=>{},finish},{logs:async()=>"",counts:async()=>{throw Error("pagination private")}},clock);
    expect(finish).toHaveBeenCalledWith(expect.any(String),window,expect.objectContaining({outcome:"partial",independentRequestCount:null}));
    expect(JSON.stringify(finish.mock.calls)).not.toContain("pagination");
});
it("rejects malformed private log batches while retaining independent failure evidence",async()=>{
    const finish=vi.fn(async()=>{});
    const counter={...metric,summary:[{requestPath:"/api/metric",requestMethod:"POST",httpStatus:"503",vercel_function_invocation_count_count:1}]};
    await collectWindow(window,{begin:async()=>{},finish},{logs:async()=>"private malformed body",counts:async()=>counter},clock);
    expect(finish).toHaveBeenCalledWith(expect.any(String),window,expect.objectContaining({outcome:"partial",reason:"invalid_record",independentFailureCount:1,records:[]}));
    expect(JSON.stringify(finish.mock.calls)).not.toContain("private malformed body");
});
it("records failed delivery after bounded retries without changing the original run",async()=>{
    const finish=vi.fn().mockRejectedValueOnce(Error("delivery")).mockRejectedValueOnce(Error("delivery")).mockResolvedValue(undefined);
    expect(await collectWindow(window,{begin:async()=>{},finish},{logs:async()=>"",counts:async()=>metric},clock)).toBe("failed");
    expect(finish.mock.calls[0]).toEqual(finish.mock.calls[1]);
    expect(finish.mock.calls[2]).toEqual([finish.mock.calls[0][0],window,null,"delivery_failed"]);
});
