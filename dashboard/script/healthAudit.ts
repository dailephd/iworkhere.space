import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { rangePlan } from "../src/lib/range";
import { reportingQuery } from "../src/lib/reportingQuery";
import { reportingDatabaseEvidence } from "../src/lib/reportingModel";
import { assessReportingHealth, type DatabaseEvidence } from "../src/lib/reportingHealth";
import { collectReportingMonitoring } from "../src/lib/reportingMonitoring";
import { healthOperationMessages } from "../src/lib/reportingMonitoringSource";

// Operator-only command. Existing authenticated CLI and protected env execution,
// never a platform token copied into the reporting application's environment.
async function main(): Promise<void> {
    const now = new Date(), observedAt = now.toISOString();
    const runId = `observability-health-${observedAt.replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
    const directory = path.resolve("test-report", runId); mkdirSync(directory, { recursive: true });
    let evidence: DatabaseEvidence | null = null;
    const url = process.env.OBSERVABILITY_DATABASE_URL;
    if (url) {
        try {
            const query = reportingQuery(rangePlan("24h", now)).evidence;
            const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
            const rows = await sql.transaction([
                sql.query("SELECT set_config('statement_timeout', $1, true)", ["15000"]),
                sql.query(query.text, query.parameter),
            ], { readOnly: true, isolationLevel: "RepeatableRead" });
            evidence = reportingDatabaseEvidence(rows[1]);
            assessReportingHealth(observedAt, evidence); // Validate before any serialization.
        } catch { evidence = null; }
    }
    let monitoring = collectReportingMonitoring(observedAt, null, []);
    try {
        const cli = process.env.VERCEL_CLI_PATH;
        // Require an explicit installed CLI path; never implicitly download tools.
        if (!cli) throw new Error("cli_missing");
        const from = new Date(now.getTime() - 3_600_000).toISOString();
        const output = spawnSync(process.execPath, [cli, "logs", "--project", "iworkhere-space", "--scope", "dailephds-projects", "--environment", "production", "--since", from, "--until", observedAt, "--limit", "1000", "--json"], {
            encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024,
        });
        if (output.status !== 0 || output.error) throw new Error("logs_unavailable");
        monitoring = collectReportingMonitoring(observedAt, { from, until: observedAt, instrumentedFrom: observedAt, complete: false }, healthOperationMessages(output.stdout));
    } catch { /* No provider output, command stderr or credentials are persisted. */ }
    const result = { runId, scope: "operator_readonly_audit_not_mcp_runtime", productionWrites: false, health: assessReportingHealth(observedAt, evidence, monitoring) };
    writeFileSync(path.join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n");
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!evidence) process.exitCode = 1;
}
main().catch(() => { process.stderr.write("Health audit unavailable; details omitted.\n"); process.exitCode = 1; });
