import { expect, it } from "vitest";
import { RANGE, rangePlan } from "./range";
import { reportingQuery } from "./reportingQuery";
const now = new Date("2026-01-01T00:05:00.000Z"), cutoff = "2025-12-31T23:50:00.000Z";
it.each(RANGE)("keeps %s analytics SQL and bounds unchanged when health uses an older UTC day", range => {
    const plan = rangePlan(range, now), current = reportingQuery(plan), delayed = reportingQuery(plan, cutoff);
    expect(delayed.activity).toEqual(current.activity);
    expect(delayed.vital).toEqual(current.vital);
    expect(delayed.evidence.text).toBe(current.evidence.text);
    expect(delayed.evidence.parameter).toContain(cutoff);
    expect(JSON.stringify(delayed.evidence.parameter)).not.toContain(plan.end);
});
it.each(["2026-01-01T00:05:01.000Z", "2025-12-31T23:34:59.000Z", "private SQL"])("rejects unbounded health clocks", value => {
    expect(() => reportingQuery(rangePlan("24h", now), value)).toThrow();
});
