import { randomBytes } from "node:crypto";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const runId = process.env.E2E_RUN_ID ?? `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
process.env.E2E_RUN_ID = runId;
const reportDir = path.resolve("test-report", "e2e", runId);
const externalBaseUrl = process.env.E2E_BASE_URL;

process.stdout.write(`E2E_RUN_ID: ${runId}\nE2E report: ${reportDir}\n`);

export default defineConfig({
    testDir: "./test/e2e",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    outputDir: path.join(reportDir, "artifacts"),
    reporter: [
        ["list"],
        ["json", { outputFile: path.join(reportDir, "results.json") }],
        ["junit", { outputFile: path.join(reportDir, "results.xml") }],
        ["html", { outputFolder: path.join(reportDir, "html"), open: "never" }],
    ],
    use: {
        baseURL: externalBaseUrl ?? "http://127.0.0.1:3100",
        browserName: "chromium",
        headless: true,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
    },
    projects: [
        { name: "desktop-chromium", use: { viewport: { width: 1280, height: 720 } } },
        { name: "mobile-chromium", use: { viewport: { width: 390, height: 844 } } },
    ],
    ...(externalBaseUrl ? {} : { webServer: {
        command: "npm run start -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: false,
        timeout: 60_000,
    } }),
});
