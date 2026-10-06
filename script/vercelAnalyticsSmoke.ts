import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { cp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, expect, type Browser } from "@playwright/test";
import { getConsoleFailure } from "../test/e2e/support/browserDiagnostic";

interface Traffic { endpoint: string; body: Record<string, unknown> }

/** Isolated production build; actual vendor runtime, locally fulfilled intake. No live views. */
async function main(): Promise<void> {
    const runId = `vercel-analytics-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
    const report = path.resolve("test-report", runId);
    const root = path.resolve(".my-dev-kit-workflow", runId);
    const env = { ...process.env, NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: "true", NEXT_PUBLIC_ADSENSE_ENABLED: "false", NEXT_PUBLIC_OBSERVABILITY_ENABLED: "false", OBSERVABILITY_PERSISTENCE_ENABLED: "false", OBSERVABILITY_DATABASE_URL: "", NEXT_TELEMETRY_DISABLED: "1" };
    const evidence: Record<string, unknown> = { runId, result: "PENDING", buildRoot: root, intake: "locally fulfilled; no production receipt claimed" };
    await mkdir(report, { recursive: true });
    await mkdir(root, { recursive: true });
    process.stdout.write(`ANALYTICS_RUN_ID: ${runId}\nReport: ${report}\n`);
    let server: ChildProcess | undefined;
    let browser: Browser | undefined;
    const diagnostics: string[] = [];
    const traffic: Traffic[] = [];
    try {
        for (const entry of ["src", "public", "test", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "THIRD_PARTY_NOTICES.md"]) {
            await cp(path.resolve(entry), path.join(root, entry), { recursive: true });
        }
        await symlink(path.resolve("node_modules"), path.join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
        const next = path.resolve("node_modules/next/dist/bin/next");
        const build = await new Promise<{ code: number; output: string }>((resolve, reject) => {
            // Webpack supports a linked dependency tree in this disposable copied project.
            const child = spawn(process.execPath, [next, "build", "--webpack"], { cwd: root, env, windowsHide: true });
            let output = "";
            child.stdout.on("data", data => { output += data.toString(); });
            child.stderr.on("data", data => { output += data.toString(); });
            child.once("error", reject);
            child.once("close", code => resolve({ code: code ?? 1, output }));
        });
        await writeFile(path.join(report, "build.log"), build.output);
        assert.equal(build.code, 0, "Analytics-enabled isolated production build failed");
        evidence.enabledBuild = "PASS";
        const runtimeUrl = "https://va.vercel-scripts.com/v1/script.js";
        const response = await fetch(runtimeUrl);
        assert(response.ok, "Official vendor runtime unavailable");
        const runtime = await response.text();
        assert(runtime.includes("beforeSend") && runtime.includes("sdkn"), "Unexpected vendor runtime contract");
        await writeFile(path.join(report, "vendor-runtime.txt"), runtime);
        evidence.runtime = { source: runtimeUrl, sha256: createHash("sha256").update(runtime).digest("hex"), fetchedAt: new Date().toISOString() };
        // Port zero delegates an available isolated port to Next; parse its startup URL.
        server = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", "0"], { cwd: root, env, windowsHide: true });
        let serverOutput = "";
        server.stdout?.on("data", data => { serverOutput += data.toString(); });
        server.stderr?.on("data", data => { serverOutput += data.toString(); });
        const base = await new Promise<string>((resolve, reject) => {
            const deadline = Date.now() + 60_000;
            const poll = setInterval(() => {
                const address = serverOutput.match(/http:\/\/127\.0\.0\.1:(\d+)/);
                if (address && address[1] !== "0") { clearInterval(poll); resolve(address[0]); }
                else if (server?.exitCode !== null && server?.exitCode !== undefined || Date.now() > deadline) { clearInterval(poll); reject(new Error(`Server startup failed: ${serverOutput}`)); }
            }, 100);
        });
        evidence.baseUrl = base;
        browser = await chromium.launch({ headless: true });
        for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport, serviceWorkers: "block", userAgent: "Mozilla/5.0 Chrome/146.0.0.0 Safari/537.36" });
            // The official intake runtime ignores automation; opt out in this test context only.
            // Keep this browser-only source literal free of tsx's Node-side function-name helpers.
            await context.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => false });");
            const page = await context.newPage();
            const views: Traffic[] = [];
            page.on("pageerror", error => diagnostics.push(error.message));
            page.on("console", message => { const failure = getConsoleFailure({ type: message.type(), text: message.text() }); if (failure) diagnostics.push(failure); });
            await context.route("**/*", async route => {
                const request = route.request();
                const isSdkScript = request.resourceType() === "script" && await page.evaluate(url => [...document.scripts].some(script => script.src === url && script.dataset.sdkn === "@vercel/analytics/next"), request.url());
                if (isSdkScript) { await route.fulfill({ contentType: "application/javascript", body: runtime }); return; }
                const raw = request.postData();
                if (raw) {
                    let body: Record<string, unknown> | undefined;
                    try { body = JSON.parse(raw); } catch { /* Non-analytics application request. */ }
                    if (body?.sdkn === "@vercel/analytics/next") {
                        const captured = { endpoint: request.url(), body };
                        traffic.push(captured); views.push(captured);
                        await route.fulfill({ status: 204 }); return;
                    }
                }
                // Unrecognized external requests cannot leave this isolated proof.
                if (new URL(request.url()).origin !== base) { await route.abort(); return; }
                await route.continue();
            });
            const marker = "V031_PRIVATE_QUERY_HASH";
            await page.goto(`${base}/?private=${marker}#${marker}`, { waitUntil: "networkidle" });
            await expect(page.locator('script[data-sdkn="@vercel/analytics/next"]')).toHaveCount(1);
            await expect.poll(() => views.length).toBe(1);
            assert.equal(new URL(String(views[0].body.o)).pathname, "/");
            await page.getByRole("main").getByRole("link", { name: /Image Resizer/ }).click();
            await expect(page.getByRole("heading", { level: 1, name: "Image Resizer", exact: true })).toBeVisible();
            await page.waitForLoadState("networkidle");
            await expect.poll(() => views.length).toBe(2);
            assert.equal(new URL(String(views[1].body.o)).pathname, "/tool/image-resizer");
            const filename = "V031_PRIVATE_FILENAME.jpg";
            await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: filename, mimeType: "image/jpeg", buffer: await readFile(path.resolve("test/fixtures/images/resizer-source.jpg")) });
            await page.getByLabel("Width", { exact: true }).fill("40");
            await page.getByRole("button", { name: "Resize image", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Resized image ready" })).toBeVisible();
            await page.waitForLoadState("networkidle");
            assert.equal(views.length, 2, "No custom/tool views or duplicate navigation sends");
            const serialized = JSON.stringify(views);
            assert(!serialized.includes(marker) && !serialized.includes(filename));
            for (const view of views) {
                const url = new URL(String(view.body.o));
                assert.equal(url.search, ""); assert.equal(url.hash, "");
                assert.equal(view.body.en, undefined, "No custom events");
                assert.equal(view.body.ed, undefined, "No custom payload");
                assert.equal(view.body.sdkv, "2.0.1");
            }
            await context.close();
        }
        assert.deepEqual(diagnostics, []);
        Object.assign(evidence, { result: "PASS", wrapperCount: 1, initialView: "PASS", clientNavigation: "PASS", queryRedaction: "PASS", hashRedaction: "PASS", fileInputPrivacy: "PASS", customEvents: "NONE", diagnostics: "PASS", viewportCount: 2, semanticPageViews: traffic.length });
    } catch (error) {
        evidence.result = "FAIL";
        evidence.error = error instanceof Error ? error.message : String(error);
        process.exitCode = 1;
    } finally {
        await browser?.close();
        if (server && server.exitCode === null) {
            const closed = new Promise<void>(resolve => server!.once("close", () => resolve()));
            server.kill(); await closed;
        }
        await writeFile(path.join(report, "summary.json"), JSON.stringify({ ...evidence, traffic, browserDiagnostics: diagnostics }, null, 2));
        process.stdout.write(`${evidence.result}\n`);
    }
}

void main();
