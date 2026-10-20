import "server-only";
import { neon } from "@neondatabase/serverless";
import { DashboardUnavailable } from "./database.server";
import { healthRowFrom, jobRowFrom, listRowFrom, reportRowFrom, type SupportDetailData, type SupportListData } from "./supportModel";
import { supportDetailQuery, supportHealthQuery, supportJobQuery, supportListQuery, SUPPORT_PAGE_SIZE, SUPPORT_REPORT_ID } from "./supportQuery";

/** Support reads use their own SELECT-only credential; the observability dashboard credential is never read here. */
function database() {
    const url = process.env.SUPPORT_DASHBOARD_DATABASE_URL;
    if (!url) throw new DashboardUnavailable("configuration");
    return neon(url, { fetchOptions: { signal: AbortSignal.timeout(15_000) } });
}

const READ_ONLY = { readOnly: true, isolationLevel: "RepeatableRead" } as const;

export async function loadSupportList(page: number): Promise<SupportListData> {
    const sql = database();
    try {
        const list = supportListQuery(page);
        const health = supportHealthQuery();
        const result = await sql.transaction([list, health].map(query => sql.query(query.text, query.parameter)), READ_ONLY);
        const rows = result[0] as Record<string, unknown>[];
        return {
            report: rows.slice(0, SUPPORT_PAGE_SIZE).map(listRowFrom),
            hasNext: rows.length > SUPPORT_PAGE_SIZE,
            health: healthRowFrom((result[1] as Record<string, unknown>[])[0]),
        };
    } catch {
        throw new DashboardUnavailable("database");
    }
}

/** Returns null for an unknown report; a malformed id never reaches the database. */
export async function loadSupportDetail(id: string): Promise<SupportDetailData | null> {
    if (!SUPPORT_REPORT_ID.test(id)) return null;
    const sql = database();
    try {
        const report = supportDetailQuery(id);
        const job = supportJobQuery(id);
        const result = await sql.transaction([report, job].map(query => sql.query(query.text, query.parameter)), READ_ONLY);
        const rows = result[0] as Record<string, unknown>[];
        if (rows.length === 0) return null;
        return { report: reportRowFrom(rows[0]), job: (result[1] as Record<string, unknown>[]).map(jobRowFrom) };
    } catch {
        throw new DashboardUnavailable("database");
    }
}
