import { expect, it } from "vitest";
import { reportingDatabaseEvidence } from "./reportingModel";
import { reportingFixture } from "../test/reportingFixture";
it("validates the reusable audit projection before it can be serialized", () => {
    const result = reportingDatabaseEvidence(reportingFixture().evidence);
    expect(result.recentEventCount).toBe(100);
    expect(Object.keys(result)).toHaveLength(8);
});
it.each([{ harmless: { nested: ["private support"] } }, { last_raw_received: "postgresql://private" }, { last_rollup_day: "/secret/path" }, { missing_completed_days: "-1" }, { recent_event_count: "9007199254740992" }])("rejects unexpected evidence %j at the reusable boundary", value => {
    const [row] = reportingFixture().evidence as Record<string, unknown>[];
    expect(() => reportingDatabaseEvidence([{ ...row, ...value }])).toThrow();
});
