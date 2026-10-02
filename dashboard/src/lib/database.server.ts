import "server-only";
import { neon } from "@neondatabase/serverless";
import type { DashboardData } from "./model";
import { dashboardQuery } from "./query";
import type { RangePlan } from "./range";

export class DashboardUnavailable extends Error {
    constructor(public readonly category: "configuration" | "database") {
        super(category === "configuration" ? "Dashboard database configuration is required." : "Dashboard data is temporarily unavailable.");
    }
}

export async function loadDashboard(plan: RangePlan): Promise<DashboardData> {
    const url = process.env.OBSERVABILITY_DASHBOARD_DATABASE_URL;
    if (!url) throw new DashboardUnavailable("configuration");
    try {
        const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(15_000) } });
        const query = dashboardQuery(plan);
        const result = await sql.transaction([query.activity, query.vital, query.failure, query.freshness].map(q => sql.query(q.text, q.parameter)), {
            readOnly: true,
            isolationLevel: "RepeatableRead",
        });
        return {
            activity: result[0] as DashboardData["activity"],
            vital: result[1] as DashboardData["vital"],
            failure: result[2] as DashboardData["failure"],
            freshness: result[3][0] as DashboardData["freshness"],
        };
    } catch {
        throw new DashboardUnavailable("database");
    }
}
