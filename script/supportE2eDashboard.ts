import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * Reads the reports created by the browser journey through the dashboard's actual support query
 * layer, as the SELECT-only role, against the same disposable database. Run with the
 * react-server condition so the dashboard's server-only guards resolve as they do in Next.
 */
const [outputPath, endpoint, readerUrl] = process.argv.slice(2);
if (!outputPath || !endpoint || !readerUrl) throw new Error("usage: supportE2eDashboard <output.json> <shim endpoint> <reader url>");

// Resolved at runtime only: the container image excludes dashboard/, and its build must not typecheck into it.
const dynamicImport = (specifier: string): Promise<any> => import(specifier); // eslint-disable-line @typescript-eslint/no-explicit-any
const dashboardNeon = "../dashboard/node_modules/@neondatabase/serverless/index.mjs";

async function main(): Promise<void> {
    const { neonConfig } = await dynamicImport(dashboardNeon);
    neonConfig.fetchEndpoint = endpoint;
    // The dashboard code may resolve either package build; configure the CommonJS one as well.
    createRequire(import.meta.url)("../dashboard/node_modules/@neondatabase/serverless").neonConfig.fetchEndpoint = endpoint;
    process.env.SUPPORT_DASHBOARD_DATABASE_URL = readerUrl;
    delete process.env.OBSERVABILITY_DASHBOARD_DATABASE_URL;
    const { loadSupportDetail, loadSupportList } = await dynamicImport("../dashboard/src/lib/supportDatabase.server");
    const { created, sentinels } = JSON.parse(readFileSync(outputPath, "utf8")) as { created: string[]; sentinels: string[] };
    if (created.length === 0) throw new Error("The browser journey created no reports");

    const seen = new Set<string>();
    for (let page = 1; page <= 40; page++) {
        const list = await loadSupportList(page);
        for (const row of list.report) seen.add(row.id);
        if (!list.hasNext) break;
    }
    const missing = created.filter(id => !seen.has(id));
    if (missing.length > 0) throw new Error(`Dashboard list lacks reports: ${missing.join(", ")}`);

    const first = await loadSupportList(1);
    if (first.health.undelivered_count < 0 || first.health.dead_count < 0) throw new Error("Dashboard health is invalid");

    let narrativeCount = 0;
    for (const id of created) {
        const detail = await loadSupportDetail(id);
        if (!detail) throw new Error(`Dashboard cannot read ${id}`);
        if (detail.job.length < 2) throw new Error(`Dashboard shows fewer than two delivery jobs for ${id}`);
        if (detail.report.description && sentinels.some(text => detail.report.description === text)) narrativeCount += 1;
        if (!detail.report.contact_consent && detail.report.contact_email) throw new Error(`Dashboard exposed contact details without consent for ${id}`);
    }
    if (narrativeCount === 0) throw new Error("Dashboard never returned a persisted narrative");

    // The role is SELECT-only: a write through the same endpoint must fail.
    const { neon } = await dynamicImport(dashboardNeon);
    const sql = neon(readerUrl);
    let writeBlocked = false;
    try { await sql.query("SELECT support.delete_report($1::text)", [created[0]]); } catch { writeBlocked = true; }
    if (!writeBlocked) throw new Error("The dashboard role could execute a support write function");
    process.stdout.write(`Dashboard support query layer read ${created.length} persisted reports (${narrativeCount} narratives) and write access was denied.\n`);
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
