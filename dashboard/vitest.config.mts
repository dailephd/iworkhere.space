import { randomBytes } from "node:crypto";
import path from "node:path";
import { defineConfig } from "vitest/config";

const runId = process.env.VITEST_RUN_ID ?? `dashboard-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const report = path.resolve("test-report", runId);
process.stdout.write(`DASHBOARD_TEST_RUN_ID: ${runId}\nReport: ${report}\n`);
export default defineConfig({
    resolve: { alias: { "server-only": path.resolve("node_modules/next/dist/compiled/server-only/empty.js") } },
    test: {
        environment: "node",
        include: ["src/**/*.test.{ts,tsx}"],
        reporters: ["default", "json", "junit"],
        outputFile: { json: path.join(report, "results.json"), junit: path.join(report, "results.xml") },
    },
});
