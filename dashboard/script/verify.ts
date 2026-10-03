import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const runId = `dashboard-verify-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const report = path.resolve("test-report", runId);
mkdirSync(report, { recursive: true });
process.stdout.write(`DASHBOARD_VERIFY_RUN_ID: ${runId}\nReport: ${report}\n`);
for (const step of ["typecheck", "lint", "test", "build"]) {
    const executable = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", `npm run ${step}`] : ["run", step];
    const env: NodeJS.ProcessEnv = { ...process.env, VITEST_RUN_ID: runId, NEXT_TELEMETRY_DISABLED: "1" };
    delete env.OBSERVABILITY_DASHBOARD_DATABASE_URL;
    const result = spawnSync(executable, args, { shell: false, windowsHide: true, encoding: "utf8", env });
    writeFileSync(path.join(report, `${step}.log`), `${result.stdout}\n${result.stderr}`);
    process.stdout.write(`${step}: ${result.status === 0 ? "PASS" : "FAIL"}\n`);
    if (result.status !== 0) { process.exitCode = 1; break; }
}
