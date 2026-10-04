import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { DashboardView } from "../src/component/DashboardView";
import { dashboardModel } from "../src/lib/model";
import { parseRange, rangePlan } from "../src/lib/range";
import { fixtureRepository } from "../src/test/fixtureRepository";

const runId = `dashboard-visual-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const report = path.resolve("test-report", runId);
mkdirSync(report, { recursive: true });
const css = readFileSync("src/app/global.css", "utf8");
const server = createServer((request, response) => {
    const range = parseRange(new URL(request.url ?? "/", "http://localhost").searchParams.get("range"));
    const plan = rangePlan(range, new Date("2026-10-01T12:00:00Z"));
    const html = renderToStaticMarkup(createElement(DashboardView, { model: dashboardModel(fixtureRepository(plan), plan), plan }));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow, noarchive" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard fixture smoke</title><style>${css}</style></head><body><p style="text-align:center">Isolated deterministic fixture · no production database</p>${html}</body></html>`);
});

async function smoke(): Promise<void> {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture server failed to bind");
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
        for (const range of ["24h", "90d", "1y", "all"]) {
            await page.goto(`http://127.0.0.1:${address.port}/?range=${range}`);
            await page.getByRole("heading", { name: "Observability", exact: true }).waitFor();
            for (const name of ["Stack", "Cause chain", "React component stack"]) await page.getByText(name, { exact: true }).click();
            if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("Desktop diagnostic document overflow");
            if (await page.locator("nav a[aria-current]").getAttribute("href") !== `?range=${range}`) throw new Error("Active range mismatch");
            await page.screenshot({ path: path.join(report, `desktop-${range}.png`), fullPage: true });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`http://127.0.0.1:${address.port}/?range=24h`);
        for (const name of ["Stack", "Cause chain", "React component stack"]) await page.getByText(name, { exact: true }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (overflow) throw new Error("Mobile dashboard has horizontal page overflow");
        await page.screenshot({ path: path.join(report, "mobile-24h.png"), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.emulateMedia({ colorScheme: "dark" });
        await page.screenshot({ path: path.join(report, "desktop-dark-24h.png"), fullPage: true });
        writeFileSync(path.join(report, "summary.json"), JSON.stringify({ runId, passed: true, adapter: "fixtureRepository", productionDatabaseUsed: false }, null, 2));
    } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
    process.stdout.write(`DASHBOARD_VISUAL_RUN_ID: ${runId}\nReport: ${report}\n`);
}
smoke().catch(error => { server.close(); process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
