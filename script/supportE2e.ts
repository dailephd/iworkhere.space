import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { startNeonShim, type NeonShim } from "../test/e2e/support/neonHttpShim";
import { PROVIDER_SECRET, startProviderDouble, type ProviderDouble } from "../test/e2e/support/providerDouble";

/**
 * Production-equivalent verification of the user-reporting path: a support-enabled production build,
 * a disposable PostgreSQL behind least-privilege roles, isolated provider substitutes, the browser
 * journey, then the dashboard's real query layer. Provider substitutes prove deterministic behavior
 * only; they are not evidence of live GitHub, Resend or Turnstile delivery.
 */
const runId = `support-e2e-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const reportDir = path.resolve("test-report", runId);
const container = `iworkhere-support-e2e-${runId.toLowerCase()}`;
const postgresImage = process.env.SUPPORT_POSTGRES_IMAGE?.trim() || "postgres:17";
mkdirSync(reportDir, { recursive: true });
const log: string[] = [];
let created = false;

function run(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; input?: string; label: string }): string {
    const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, shell: false, input: options.input, env: options.env ?? process.env, timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
    log.push(`$ ${options.label}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.status !== 0) throw new Error(`${options.label} failed (exit ${result.status}); see ${path.join(reportDir, "run.log")}`);
    return result.stdout;
}
const npm = (args: string[], env: NodeJS.ProcessEnv, label: string) =>
    process.platform === "win32" ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], { env, label }) : run("npm", args, { env, label });
const psql = (script: string) => run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: script, label: "psql" });
function execute(command: string, args: string[], env: NodeJS.ProcessEnv, inherit: boolean): Promise<{ status: number | null; stdout: string; stderr: string }> {
    return new Promise(resolve => {
        const child = spawn(command, args, { env, windowsHide: true, shell: false, stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"] });
        let stdout = ""; let stderr = "";
        child.stdout?.on("data", chunk => { stdout += chunk; });
        child.stderr?.on("data", chunk => { stderr += chunk; });
        child.on("close", status => resolve({ status, stdout, stderr }));
    });
}
function staticAssets(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) return staticAssets(full);
        return /\.(js|css|html|json|txt)$/.test(entry.name) ? [full] : [];
    });
}
function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => address && typeof address !== "string" ? resolve(address.port) : reject(new Error("no port"))); });
    });
}

async function main(): Promise<void> {
    process.stdout.write(`SUPPORT_E2E_RUN_ID: ${runId}\nReport: ${reportDir}\n`);
    let shim: NeonShim | undefined;
    let providers: ProviderDouble | undefined;
    let server: ChildProcess | undefined;
    let serverOutput = "";
    try {
        run("docker", ["run", "--detach", "--name", container, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", postgresImage], { label: "docker run postgres" });
        created = true;
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt++) {
            ready = spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { windowsHide: true, shell: false }).status === 0;
            if (!ready) await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!ready) throw new Error("Disposable Postgres did not become ready.");
        const supportDir = path.resolve("database/support");
        for (const name of readdirSync(supportDir).filter(file => /^\d{3}-[a-z0-9-]+\.sql$/.test(file)).sort()) psql(readFileSync(path.join(supportDir, name), "utf8"));
        psql(`\\set database_name postgres\n${readFileSync(path.join(supportDir, "roles.sql"), "utf8")}`);

        shim = await startNeonShim({ container });
        providers = await startProviderDouble();
        const appPort = await freePort();
        const base = `http://127.0.0.1:${appPort}`;
        const cronSecret = `e2e-cron-${randomBytes(6).toString("hex")}`;
        const database = (role: string) => `postgresql://${role}:disposable@127.0.0.1:${shim!.port}/postgres`;

        const publicFlag = { NEXT_PUBLIC_SUPPORT_ENABLED: "true", NEXT_PUBLIC_SUPPORT_TURNSTILE_SITE_KEY: "e2e-site-key", NEXT_PUBLIC_OBSERVABILITY_ENABLED: "true", NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" };
        if (process.env.SUPPORT_E2E_SKIP_BUILD !== "true") {
            process.stdout.write("Building the support-enabled production application...\n");
            npm(["run", "build"], { ...process.env, ...publicFlag }, "npm run build (support enabled)");
        }

        // Server-only names, SQL function names, provider hosts and secret values must not ship to the browser.
        const forbidden = ["SUPPORT_TURNSTILE_SECRET", "SUPPORT_GITHUB_TOKEN", "SUPPORT_RESEND_API_KEY", "SUPPORT_DATABASE_URL", "SUPPORT_WORKER_DATABASE_URL", "SUPPORT_DASHBOARD_DATABASE_URL", "CRON_SECRET", "support.submit_report", "claim_jobs", "support-operation", "api.github.com", "api.resend.com", "@neondatabase", ...Object.values(PROVIDER_SECRET).filter(value => value !== PROVIDER_SECRET.validChallenge)];
        const leaked = staticAssets(path.resolve(".next/static")).flatMap(file => { const text = readFileSync(file, "utf8"); return forbidden.filter(term => text.includes(term)).map(term => `${path.relative(".next/static", file)}: ${term}`); });
        if (leaked.length > 0) throw new Error(`Browser bundle exposes server-only material:\n${leaked.join("\n")}`);
        log.push(`browser bundle scan: ${forbidden.length} server-only terms absent from .next/static`);

        const serverEnv: NodeJS.ProcessEnv = {
            ...process.env, ...publicFlag, NODE_ENV: "production",
            OBSERVABILITY_PERSISTENCE_ENABLED: "false", OBSERVABILITY_DATABASE_URL: "", OBSERVABILITY_DASHBOARD_DATABASE_URL: "",
            SUPPORT_DATABASE_HTTP_ENDPOINT: shim.endpoint,
            SUPPORT_DATABASE_URL: database("support_writer"), SUPPORT_WORKER_DATABASE_URL: database("support_worker"),
            SUPPORT_TURNSTILE_SECRET: PROVIDER_SECRET.turnstile, SUPPORT_TURNSTILE_VERIFY_URL: `${providers.origin}/turnstile`,
            SUPPORT_GITHUB_TOKEN: PROVIDER_SECRET.github, SUPPORT_GITHUB_REPOSITORY: "owner/private-support", SUPPORT_GITHUB_API_URL: `${providers.origin}/github`,
            SUPPORT_RESEND_API_KEY: PROVIDER_SECRET.resend, SUPPORT_RESEND_API_URL: `${providers.origin}/resend`,
            SUPPORT_EMAIL_FROM: "Support <support@e2e.test>", SUPPORT_OPERATOR_EMAIL: "ops@e2e.test", SUPPORT_DASHBOARD_BASE_URL: "https://dashboard.e2e.test",
            CRON_SECRET: cronSecret, SUPPORT_RETENTION_ENABLED: "",
        };
        server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], { env: serverEnv, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
        server.stdout?.on("data", chunk => { serverOutput += chunk; });
        server.stderr?.on("data", chunk => { serverOutput += chunk; });
        let up = false;
        for (let attempt = 0; attempt < 90 && !up; attempt++) {
            up = await fetch(`${base}/api/health`).then(response => response.ok, () => false);
            if (!up) await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!up) throw new Error("The support-enabled application did not become ready.");

        const output = path.join(reportDir, "journey.json");
        // Asynchronous children keep this process's event loop alive: the database shim and the provider
        // substitutes live here and must keep answering while the browser journey runs.
        const playwrightArgs = ["node_modules/@playwright/test/cli.js", "test", "support-report.spec.ts", ...(process.env.SUPPORT_E2E_GREP ? ["-g", process.env.SUPPORT_E2E_GREP] : []), ...(process.env.SUPPORT_E2E_PROJECT ? ["--project", process.env.SUPPORT_E2E_PROJECT] : [])];
        const playwright = await execute(process.execPath, playwrightArgs, {
            ...process.env, E2E_BASE_URL: base, E2E_SUPPORT_RUN: "true", SUPPORT_E2E_CONTAINER: container, SUPPORT_E2E_PROVIDER_ORIGIN: providers.origin, SUPPORT_E2E_CRON_SECRET: cronSecret, SUPPORT_E2E_OUTPUT: output,
        }, true);
        if (playwright.status !== 0) throw new Error("The support browser journey failed.");

        // Outside Next the "server-only" guard package is absent; an empty stand-in is scoped to this one child process.
        const stubDirectory = path.join(reportDir, "stub");
        mkdirSync(path.join(stubDirectory, "server-only"), { recursive: true });
        writeFileSync(path.join(stubDirectory, "server-only", "index.js"), "");
        const dashboard = await execute(process.execPath, ["--conditions=react-server", "--import", "tsx", "script/supportE2eDashboard.ts", output, shim.endpoint, database("support_dashboard")], { ...process.env, NODE_PATH: stubDirectory }, false);
        log.push(`$ dashboard support query layer\n${dashboard.stdout}\n${dashboard.stderr}`);
        process.stdout.write(dashboard.stdout);
        if (dashboard.status !== 0) throw new Error(`Dashboard support query layer verification failed: ${dashboard.stderr.trim()}`);
        writeFileSync(path.join(reportDir, "summary.json"), JSON.stringify({ runId, passed: true, container, image: postgresImage, appPort, providers: "isolated substitutes (not live delivery)", database: "disposable PostgreSQL" }, null, 2));
        process.stdout.write("Support end-to-end journey passed against disposable storage and isolated provider substitutes.\n");
    } finally {
        server?.kill();
        await shim?.close();
        await providers?.close();
        if (created) spawnSync("docker", ["rm", "--force", container], { windowsHide: true, shell: false });
        writeFileSync(path.join(reportDir, "run.log"), log.join("\n"));
        writeFileSync(path.join(reportDir, "server.log"), serverOutput);
    }
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
