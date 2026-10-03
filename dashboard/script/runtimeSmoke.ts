import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "@playwright/test";

const runId = `dashboard-runtime-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const report = path.resolve("test-report", runId);
mkdirSync(report, { recursive: true });

async function smoke(): Promise<void> {
    const portServer = createServer();
    await new Promise<void>(resolve => portServer.listen(0, "127.0.0.1", resolve));
    const address = portServer.address();
    if (!address || typeof address === "string") throw new Error("Failed to reserve runtime port");
    const port = address.port;
    await new Promise<void>(resolve => portServer.close(() => resolve()));
    const env: NodeJS.ProcessEnv = { ...process.env, OBSERVABILITY_DASHBOARD_DATABASE_URL: "", NEXT_TELEMETRY_DISABLED: "1" };
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { output += chunk.toString(); });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
        const url = `http://127.0.0.1:${port}/`;
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            try { await fetch(url); ready = true; break; } catch { /* Only this local server. */ }
            if (child.exitCode !== null) throw new Error("Dashboard runtime exited before ready");
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!ready) throw new Error("Dashboard runtime did not become ready");
        const response = await fetch(url);
        if (response.status !== 500) throw new Error(`Unconfigured dashboard must return 500, received ${response.status}`);
        if (response.headers.get("x-robots-tag") !== "noindex, nofollow, noarchive") throw new Error("Missing crawler response header");
        const html = await response.text();
        if (!html.includes('name="robots" content="noindex, nofollow, noarchive"')) throw new Error("Missing crawler metadata");
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.goto(url);
        await page.getByRole("heading", { name: "Dashboard unavailable" }).waitFor();
        if (await page.getByRole("heading", { name: "Overview", exact: true }).count()) throw new Error("Unconfigured dashboard rendered metrics");
        await page.screenshot({ path: path.join(report, "missing-configuration.png"), fullPage: true });
        writeFileSync(path.join(report, "summary.json"), JSON.stringify({ runId, passed: true, status: response.status, productionDatabaseUsed: false }, null, 2));
    } finally {
        await browser?.close();
        child.kill();
        await closed;
        writeFileSync(path.join(report, "server.log"), output);
    }
    process.stdout.write(`DASHBOARD_RUNTIME_RUN_ID: ${runId}\nReport: ${report}\n`);
}
smoke().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
