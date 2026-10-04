import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, type Browser } from "@playwright/test";
import type { FoundationResult } from "../test/pdfFoundationClient";
interface WorkerCount { started: number; active: number; terminated: number; url: string[] }
interface FoundationWindow extends Window { foundationWorkers: WorkerCount }
async function main(): Promise<void> {
    const runId = `pdf-foundation-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
    const report = path.resolve("test-report", runId);
    const route = path.resolve("src/app/pdf-foundation-test");
    const image = `iworkhere-space:${runId.toLowerCase()}`;
    const container = `iworkhere-${runId.toLowerCase()}`;
    const containerMode = process.argv.includes("--container");
    await mkdir(report, { recursive: true });
    const evidence: Record<string, unknown> = { runId, mode: containerMode ? "standalone-container" : "production-next", result: "PENDING" };
    process.stdout.write(`PDF_FOUNDATION_RUN_ID: ${runId}\nReport: ${report}\n`);
    async function command(executable: string, argument: string[], log: string): Promise<string> {
        process.stdout.write(`Running ${log}\n`);
        const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
            const child = spawn(executable, argument, { windowsHide: true, env: { ...process.env, NEXT_PUBLIC_ADSENSE_ENABLED: "false", NEXT_PUBLIC_OBSERVABILITY_ENABLED: "false", OBSERVABILITY_PERSISTENCE_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" } });
            let stdout = "", stderr = "";
            child.stdout.on("data", data => { stdout += data.toString(); }); child.stderr.on("data", data => { stderr += data.toString(); });
            child.on("error", reject); child.on("close", code => resolve({ code: code ?? 1, stdout, stderr }));
        });
        await writeFile(path.join(report, log), result.stdout + result.stderr);
        if (result.code !== 0) throw new Error(`Foundation command failed: ${log}`);
        return result.stdout.trim();
    }
    let server: ChildProcess | undefined, browser: Browser | undefined, routeOwned = false, containerOwned = false, imageOwned = false;
    try {
        let existing = false; try { await access(route); existing = true; } catch { /* Expected absent test-only route. */ }
        if (existing) throw new Error("Refusing to overwrite an existing route");
        await mkdir(route); routeOwned = true;
        await writeFile(path.join(route, "page.tsx"), 'import PdfFoundationClient from "../../../test/pdfFoundationClient";\nexport default function Page() { return <PdfFoundationClient />; }\n');
        let base = "http://127.0.0.1:3192";
        if (containerMode) {
            await command("docker", ["build", "--tag", image, "."], "docker-build.log"); imageOwned = true;
            await command("docker", ["run", "--detach", "--name", container, "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--publish", "127.0.0.1::3000", image], "container-start.log"); containerOwned = true;
            const port = Number((await command("docker", ["port", container, "3000/tcp"], "container-port.log")).split(":").at(-1));
            assert(Number.isSafeInteger(port) && port > 0); base = `http://127.0.0.1:${port}`;
            const uid = Number(await command("docker", ["exec", container, "node", "-p", "process.getuid()"], "container-uid.log")); assert(uid > 0); evidence.runtimeUid = uid;
        } else {
            await command(process.execPath, ["node_modules/next/dist/bin/next", "build"], "harness-build.log");
            server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3192"], { windowsHide: true, stdio: "ignore", env: { ...process.env, OBSERVABILITY_PERSISTENCE_ENABLED: "false" } });
        }
        const deadline = Date.now() + 60000;
        let healthy = false;
        while (Date.now() < deadline) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break; } } catch { /* Bounded readiness polling. */ } await new Promise(resolve => setTimeout(resolve, 250)); }
        assert(healthy, "Standalone health failed"); evidence.health = "PASS";
        if (containerMode) {
            let health = "starting";
            const healthDeadline = Date.now() + 60000;
            while (Date.now() < healthDeadline) {
                health = await command("docker", ["inspect", "--format", "{{.State.Health.Status}}", container], "docker-health.log");
                if (health === "healthy") break;
                assert.equal(health, "starting", "Docker health check failed");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            assert.equal(health, "healthy"); evidence.dockerHealth = health;
        }
        const assetResponse: Record<string, string> = {};
        for (const root of ["pdfjs/6.4.299", "qpdf/12.4.2"]) {
            const manifest = JSON.parse(await readFile(`public/vendor/${root}/manifest.json`, "utf8")) as { asset: { path: string }[] };
            for (const asset of manifest.asset) {
                const url = `/vendor/${root}/${asset.path}`; const response = await fetch(base + url);
                assert.equal(response.status, 200, url); const mime = response.headers.get("content-type") ?? "";
                if (url.endsWith(".wasm")) assert(mime.includes("application/wasm"));
                if (url.endsWith(".js") || url.endsWith(".mjs")) assert(/javascript/.test(mime));
                assetResponse[url] = mime;
            }
        }
        evidence.assetResponse = assetResponse;
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        await context.addInitScript(() => {
            const count = { started: 0, active: 0, terminated: 0, url: [] as string[] };
            (window as unknown as FoundationWindow).foundationWorkers = count;
            const NativeWorker = window.Worker;
            window.Worker = class extends NativeWorker {
                private ended = false;
                constructor(url: string | URL, option?: WorkerOptions) { super(url, option); count.started++; count.active++; count.url.push(String(url)); }
                terminate() { if (!this.ended) { this.ended = true; count.active--; count.terminated++; } super.terminate(); }
            };
        });
        const page = await context.newPage(); const problems: string[] = [], requests: { path: string; method: string; type: string }[] = [];
        // Chromium's page request events omit importScripts/fetch inside workers.
        // Observe native worker targets before resuming them, without changing runtime code.
        const protocol = await context.newCDPSession(page);
        const workerResponse: Record<string, number> = {};
        const workerTarget: string[] = [];
        let protocolId = 0;
        protocol.on("Target.attachedToTarget", event => {
            if (event.targetInfo.type !== "worker") return;
            workerTarget.push(event.targetInfo.url);
            void (async () => {
                await protocol.send("Target.sendMessageToTarget", { sessionId: event.sessionId, message: JSON.stringify({ id: ++protocolId, method: "Network.enable" }) });
                await protocol.send("Target.sendMessageToTarget", { sessionId: event.sessionId, message: JSON.stringify({ id: ++protocolId, method: "Runtime.runIfWaitingForDebugger" }) });
            })().catch(() => { problems.push("Worker network observation failed"); });
        });
        protocol.on("Target.receivedMessageFromTarget", event => {
            const message = JSON.parse(event.message);
            if (message.method === "Network.requestWillBeSent") {
                const request = message.params.request; const url = new URL(request.url);
                if (url.origin !== base || request.method !== "GET") problems.push("Unexpected worker network request");
                requests.push({ path: url.pathname, method: request.method, type: "worker-internal" });
            }
            if (message.method === "Network.responseReceived") workerResponse[new URL(message.params.response.url).pathname] = message.params.response.status;
        });
        await protocol.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: false, filter: [{ type: "worker", exclude: false }, { exclude: true }] });
        page.on("pageerror", error => problems.push(error.message));
        page.on("console", message => { if (message.type() === "error" || message.type() === "warning") problems.push(message.text()); });
        context.on("request", request => { assert.equal(new URL(request.url()).origin, base, "Unexpected remote request"); assert.equal(request.method(), "GET", "File bytes must not be uploaded"); requests.push({ path: new URL(request.url()).pathname, method: request.method(), type: request.resourceType() }); });
        await page.goto(`${base}/pdf-foundation-test`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => !!window.pdfFoundation);
        async function run(name: string, kind: string): Promise<FoundationResult> {
            const input = [...await readFile(`test/fixtures/pdf/${name}`)];
            return await page.evaluate(async ({ input, kind }) => { if (!window.pdfFoundation) throw new Error("Harness unavailable"); return await window.pdfFoundation(input, kind); }, { input, kind });
        }
        const result: Record<string, FoundationResult> = {};
        for (const name of ["text-vector.pdf", "jpeg-heavy.pdf", "png-heavy.pdf", "mixed.pdf", "rotated.pdf", "mixed-dimensions.pdf", "ordering.pdf", "multipage.pdf", "already-optimized.pdf", "standard-fonts.pdf"]) {
            const inspected = await run(name, "inspect"); assert(!inspected.category, `${name}: ${inspected.category}`); assert(inspected.raster && inspected.nativeWidth && inspected.nativeHeight);
            result[name] = inspected;
        }
        for (const [name, category] of [["encrypted.pdf", "encrypted"], ["empty-password-encrypted.pdf", "encrypted"], ["truncated.pdf", "malformed"], ["invalid-body.pdf", "malformed"], ["false-signature.pdf", "signature"], ["page-limit.pdf", "page-limit"], ["large-page-box.pdf", "render-limit"]]) assert.equal((await run(name, "inspect")).category, category, name);
        evidence.damagedXref = await run("damaged-xref.pdf", "inspect");
        for (const kind of ["pdfLib", "qpdf"]) {
            for (const name of ["text-vector.pdf", "mixed.pdf", "rotated.pdf", "mixed-dimensions.pdf", "ordering.pdf"]) {
                const output = await run(name, kind); assert(!output.category, `${kind} ${name}: ${output.category}`);
                assert.deepEqual(output.page, result[name].page); assert.deepEqual(output.text, result[name].text); assert.equal(output.raster, result[name].raster);
                result[`${kind}:${name}`] = output;
            }
            assert.equal((await run("invalid-body.pdf", kind)).category, kind === "qpdf" ? "malformed" : "processing");
        }
        evidence.qpdfEncrypted = await run("encrypted.pdf", "qpdf");
        assert.equal((evidence.qpdfEncrypted as FoundationResult).category, "encrypted", "QPDF encrypted rejection");
        for (const kind of ["cancelPdf", "cancelLib", "cancelQpdf", "cancelRender"]) assert.equal((await run("text-vector.pdf", kind)).category, "cancelled");
        await page.waitForTimeout(100);
        const workers = await page.evaluate(() => (window as unknown as FoundationWindow).foundationWorkers);
        evidence.workers = workers; evidence.requests = requests; evidence.problems = problems; evidence.workerResponse = workerResponse; evidence.workerTarget = workerTarget;
        assert(workers.started > 20); assert.equal(workers.active, 0); assert.equal(workers.started, workers.terminated);
        assert(requests.some(item => item.path.endsWith("pdf.worker.mjs"))); assert(requests.some(item => item.path.endsWith("qpdf.wasm"))); assert(requests.some(item => item.path.includes("standard_fonts")));
        assert.equal(workerResponse["/vendor/qpdf/12.4.2/qpdf.wasm"], 200);
        assert.deepEqual(problems, []);
        evidence.workers = workers; evidence.requests = requests; evidence.fixture = result; evidence.privacy = "GET_ONLY_SAME_ORIGIN";
        await context.close();
        if (containerMode) {
            await command("docker", ["stop", "--time", "10", container], "container-stop.log");
            const state = JSON.parse(await command("docker", ["inspect", container], "container-inspect.json"))[0].State;
            assert(!state.OOMKilled && state.ExitCode !== 137); evidence.shutdown = "PASS";
        }
        evidence.result = "PASS";
    } catch (error) { evidence.result = "FAIL"; evidence.error = error instanceof Error ? error.message : "Foundation failed"; process.exitCode = 1; }
    finally {
        await browser?.close(); server?.kill();
        if (containerOwned) { try { await command("docker", ["stop", "--time", "10", container], "cleanup-stop.log"); await command("docker", ["rm", container], "cleanup-container.log"); } catch { process.exitCode = 1; evidence.cleanup = "FAIL"; } }
        if (imageOwned) { try { await command("docker", ["image", "rm", image], "cleanup-image.log"); } catch { process.exitCode = 1; evidence.cleanup = "FAIL"; } }
        if (routeOwned) { assert(route.startsWith(path.resolve("src/app") + path.sep)); await rm(route, { recursive: true }); }
        await writeFile(path.join(report, "summary.json"), `${JSON.stringify(evidence, null, 2)}\n`);
        process.stdout.write(`PDF_FOUNDATION: ${evidence.result}\n`);
    }
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Foundation failed"}\n`); process.exitCode = 1; });
