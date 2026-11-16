import { fixtureRepository } from "./fixtureRepository";
import { rangePlan, type Range } from "../lib/range";
import type { ReportingData } from "../lib/reportingModel";
export const reportingNow = new Date("2026-10-01T12:00:00.000Z");
export function reportingFixture(range: Range = "24h"): ReportingData {
    const source = fixtureRepository(rangePlan(range, reportingNow));
    const groups = new Map<string, { section: string; identity: string | null; opens: number; executions: number; errors: number; navigation: number }>();
    function group(section: string, identity: string | null) {
        const key = section + ":" + identity;
        let row = groups.get(key);
        if (!row) { row = { section, identity, opens: 0, executions: 0, errors: 0, navigation: 0 }; groups.set(key, row); }
        return row;
    }
    const total = group("total", null);
    for (const row of source.activity) {
        const amount = Number(row.count), target = [total];
        if (row.tool_id) target.push(group("tool", row.tool_id));
        for (const item of target) {
            if (row.event_name === "tool_opened") item.opens += amount;
            if (row.event_name === "tool_executed") item.executions += amount;
            if (row.kind === "client-error") item.errors += amount;
        }
        if (row.kind === "navigation") { total.navigation += amount; group("route", row.pathname).navigation += amount; }
        if (row.kind === "client-error") group("error", row.failure_category).errors += amount;
    }
    return { activity: [...groups.values()], vital: source.vital, evidence: [{ observed_at: reportingNow.toISOString(), retained_from: "2026-07-04T00:00:00.000Z", recent_event_count: "100", missing_completed_days: "0", mismatched_completed_days: "0", pending_grace_days: "0", last_raw_received: source.freshness.last_raw_received, last_rollup_day: source.freshness.last_rollup_day }] };
}
