import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const reportDir = path.resolve("test-report", "container", runId);
const imageName = `iworkhere-space:container-test-${runId}`;
const containerName = `iworkhere-container-test-${runId}`;
const summary: Record<string, unknown> = {
  CONTAINER_RUN_ID: runId,
  startingSha: "unavailable",
  dockerClientVersion: null,
  dockerServerVersion: null,
  imageId: null,
  imageSizeBytes: null,
  runtimeHealthcheck: null,
  runtimeConfiguredUser: null,
  runtimeUid: null,
  healthResult: "NOT_RUN",
  dynamicHostPort: null,
  httpSmokeResult: "NOT_RUN",
  containerE2eRunId: null,
  containerE2eResult: "NOT_RUN",
  heicRuntimeResult: "NOT_RUN",
  serviceWorkerResult: "NOT_RUN",
  shutdownResult: "NOT_RUN",
  forcedSigkillRequired: null,
  containerLogsResult: "NOT_RUN",
  containerExitCode: null,
  OOMKilled: null,
  cleanupResult: "PENDING",
};

async function runContainerSmoke(): Promise<void> {
  summary.startingSha = await command("git", ["rev-parse", "HEAD"]).then((result) => result.stdout.trim()).catch(() => "unavailable");

await mkdir(reportDir, { recursive: true });
await writeFile(path.join(reportDir, "docker-build.log"), "Docker build not started.\n", "utf8");
await writeFile(path.join(reportDir, "container.log"), "Container not started.\n", "utf8");
await writeFile(path.join(reportDir, "image-inspect.json"), "null\n", "utf8");
await writeFile(path.join(reportDir, "container-inspect.json"), "null\n", "utf8");

let imageCreated = false;
let containerCreated = false;
let failed = false;
let cleanupFailed = false;

async function command(executable: string, args: string[], env?: NodeJS.ProcessEnv): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: process.cwd(), env: env ?? process.env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function runChecked(executable: string, args: string[]): Promise<CommandResult> {
  const result = await command(executable, args);
  if (result.code !== 0) throw new Error(`${executable} ${args.join(" ")} failed (${result.code}): ${result.stderr}`);
  return result;
}

async function writeSummary(): Promise<void> {
  await writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function getDockerHealth(): Promise<string> {
  const result = await runChecked("docker", ["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}", containerName]);
  return result.stdout.trim();
}

async function waitForDockerHealth(): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const health = await getDockerHealth();
    if (health === "healthy") return health;
    if (health === "unhealthy" || health === "missing") throw new Error(`Docker health state is ${health}.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Docker health did not become healthy within 60 seconds.");
}

async function waitForHealth(url: string): Promise<number> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok && (await response.json() as { status?: string }).status === "ok") return Date.now();
    } catch { /* Poll until the bounded startup deadline. */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Container did not return healthy /api/health within 60 seconds.");
}

try {
  const clientVersion = await runChecked("docker", ["--version"]);
  summary.dockerClientVersion = clientVersion.stdout.trim();
  const dockerVersion = await runChecked("docker", ["version", "--format", "{{json .}}"]);
  const versions = JSON.parse(dockerVersion.stdout) as { Client?: { Version?: string }; Server?: { Version?: string } };
  summary.dockerClientVersion = versions.Client?.Version ?? null;
  summary.dockerServerVersion = versions.Server?.Version ?? null;

  await runChecked("docker", ["compose", "config"]);
  const build = await command("docker", ["build", "--pull", "--build-arg", "NEXT_PUBLIC_ADSENSE_ENABLED=false", "--build-arg", "NEXT_PUBLIC_OBSERVABILITY_ENABLED=false", "--build-arg", "NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=false", "--tag", imageName, "--file", "Dockerfile", "."]);
  await writeFile(path.join(reportDir, "docker-build.log"), `${build.stdout}\n${build.stderr}`, "utf8");
  if (build.code !== 0) throw new Error(`Docker build failed (${build.code}).`);
  imageCreated = true;

  const imageInspect = await runChecked("docker", ["image", "inspect", imageName]);
  await writeFile(path.join(reportDir, "image-inspect.json"), imageInspect.stdout, "utf8");
  const image = (JSON.parse(imageInspect.stdout) as Array<{ Id: string; Size: number; Config: { User?: string; Env?: string[]; Cmd?: string[]; Healthcheck?: unknown }; Architecture: string; Os: string }>)[0];
  summary.imageId = image.Id;
  summary.imageSizeBytes = image.Size;
  summary.runtimeConfiguredUser = image.Config.User;
  summary.runtimeHealthcheck = image.Config.Healthcheck ?? null;
  summary.runtimeArchitecture = image.Architecture;
  summary.runtimeOs = image.Os;
  if (!image.Config.Cmd?.includes("server.js") || !image.Config.Env?.includes("NODE_ENV=production") || !image.Config.User || !image.Config.Healthcheck) throw new Error("Runtime image command, environment, user, or healthcheck is missing.");

  const started = await runChecked("docker", ["run", "--detach", "--name", containerName, "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--publish", "127.0.0.1::3000", imageName]);
  containerCreated = true;
  const initialInspect = await runChecked("docker", ["inspect", containerName]);
  await writeFile(path.join(reportDir, "container-inspect.json"), initialInspect.stdout, "utf8");
  const runningContainer = (JSON.parse(initialInspect.stdout) as Array<{ HostConfig: { ReadonlyRootfs: boolean; CapDrop?: string[]; SecurityOpt?: string[] } }>)[0];
  if (!runningContainer.HostConfig.ReadonlyRootfs || !runningContainer.HostConfig.CapDrop?.includes("ALL") || !runningContainer.HostConfig.SecurityOpt?.some((option) => option.includes("no-new-privileges"))) throw new Error("Requested container hardening flags are not active.");
  const hostBinding = await runChecked("docker", ["port", containerName, "3000/tcp"]);
  const hostPort = Number(hostBinding.stdout.trim().split(":").at(-1));
  if (!Number.isInteger(hostPort) || hostPort <= 0) throw new Error(`Could not resolve dynamic host port: ${hostBinding.stdout}`);
  summary.dynamicHostPort = hostPort;
  const baseUrl = `http://127.0.0.1:${hostPort}`;
  const healthStart = Date.now();
  await waitForHealth(`${baseUrl}/api/health`);
  summary.httpReadinessDurationMs = Date.now() - healthStart;
  summary.healthResult = await waitForDockerHealth();
  summary.healthDurationMs = Date.now() - healthStart;

  const uid = await runChecked("docker", ["exec", containerName, "node", "-p", "process.getuid()"]);
  const runtimeUid = Number(uid.stdout.trim());
  summary.runtimeUid = runtimeUid;
  if (!Number.isInteger(runtimeUid) || runtimeUid <= 0) throw new Error("Runtime process is root or its UID could not be proven.");

  const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
  if (!sitemap.ok) throw new Error("Container sitemap is unavailable.");
  const publicRoutes = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
  if (publicRoutes.length !== 23 || new Set(publicRoutes).size !== publicRoutes.length) throw new Error("Container public route inventory mismatch.");
  const routes = [...publicRoutes, "/sitemap.xml", "/api/health", "/ads.txt", "/sw.js", "/manifest.webmanifest", "/vendor/pdfjs/6.4.299/pdf.worker.mjs", "/vendor/pdfjs/6.4.299/standard_fonts/LiberationSans-Regular.ttf", "/vendor/qpdf/12.4.2/qpdf.js", "/vendor/qpdf/12.4.2/qpdf.wasm", "/licenses/heic-to-LICENSE.txt", "/licenses/libheif-COPYING.txt"];
  const routeResults: Record<string, number> = {};
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    routeResults[route] = response.status;
    if (!response.ok) throw new Error(`HTTP smoke ${route} returned ${response.status}.`);
    if (route.endsWith("qpdf.wasm") && !response.headers.get("content-type")?.includes("application/wasm")) throw new Error("QPDF WASM MIME mismatch.");
    if (/\.(?:mjs|js)$/.test(route) && !response.headers.get("content-type")?.match(/(?:application|text)\/javascript/)) throw new Error("Worker/runtime JavaScript MIME mismatch.");
    if (route === "/ads.txt") {
      if (await response.text() !== "google.com, pub-7976885058339852, DIRECT, f08c47fec0942fa0\n" || !response.headers.get("content-type")?.includes("text/plain")) throw new Error("ads.txt body or content type mismatch.");
      summary.adsTxtResult = "PASS";
    }
  }
  summary.httpSmokeResult = routeResults;
  summary.serviceWorkerResult = routeResults["/sw.js"] === 200 ? "PASS" : "FAIL";
  summary.heicRuntimeResult = routeResults["/tool/heic-converter"] === 200 && routeResults["/licenses/heic-to-LICENSE.txt"] === 200 && routeResults["/licenses/libheif-COPYING.txt"] === 200 ? "ROUTE_PASS_E2E_PENDING" : "FAIL";

  const runtimePaths = await runChecked("docker", ["exec", containerName, "node", "-e", "const fs=require('node:fs'); const absent=['/app/src','/app/test','/app/docs','/app/.git','/app/.github','/app/test-report','/app/.my-dev-kit-context','/app/.my-dev-kit-workflow','/app/.my-dev-kit-orchestrator','/app/.frontend-observer','/app/.env','/app/.env.local','/app/.env.production','/app/.env.production.local','/app/.env.development','/app/.env.test','/app/node_modules/@playwright/test','/app/node_modules/playwright','/app/node_modules/playwright-core']; const missing=['/app/THIRD_PARTY_NOTICES.md','/app/public/licenses/heic-to-LICENSE.txt','/app/public/licenses/libheif-COPYING.txt']; const present=absent.filter(fs.existsSync); const absentRequired=missing.filter(path=>!fs.existsSync(path)); if(present.length||absentRequired.length){console.error(JSON.stringify({unexpected:present,missing:absentRequired}));process.exit(1)}"]);
  void runtimePaths;

  const e2eRunId = `${runId}-browser`;
  summary.containerE2eRunId = e2eRunId;
  const e2eEnv = { ...process.env, E2E_BASE_URL: baseUrl, E2E_RUN_ID: e2eRunId };
  const npmExecPath = process.env.npm_execpath;
  const e2e = npmExecPath
    ? await command(process.execPath, [npmExecPath, "run", "test:e2e"], e2eEnv)
    : await command("npm", ["run", "test:e2e"], e2eEnv);
  await writeFile(path.join(reportDir, "container-e2e.log"), `${e2e.stdout}\n${e2e.stderr}`, "utf8");
  summary.containerE2eResult = e2e.code === 0 ? "PASS" : `FAIL(${e2e.code})`;
  summary.heicRuntimeResult = e2e.code === 0 ? "PASS (inherited HEIC E2E suite)" : summary.heicRuntimeResult;
  if (e2e.code !== 0) throw new Error(`Container E2E failed (${e2e.code}).`);

  const stoppedAt = Date.now();
  await runChecked("docker", ["stop", "--time", "10", containerName]);
  summary.shutdownDurationMs = Date.now() - stoppedAt;
  const finalInspect = await runChecked("docker", ["inspect", containerName]);
  await writeFile(path.join(reportDir, "container-inspect.json"), finalInspect.stdout, "utf8");
  const finalState = (JSON.parse(finalInspect.stdout) as Array<{ State: { ExitCode: number; OOMKilled: boolean } }>)[0].State;
  summary.containerExitCode = finalState.ExitCode;
  summary.OOMKilled = finalState.OOMKilled;
  summary.forcedSigkillRequired = finalState.ExitCode === 137;
  summary.shutdownResult = finalState.OOMKilled || finalState.ExitCode === 137 ? "FAIL" : "PASS";
  if (finalState.OOMKilled) throw new Error("Container was OOM-killed.");
  if (finalState.ExitCode === 137) throw new Error("Container required forced SIGKILL after docker stop.");
} catch (error) {
  failed = true;
  summary.error = error instanceof Error ? error.message : String(error);
  if (summary.dockerServerVersion === null) summary.blocker = "BLOCKED_CONTAINER_RUNTIME_UNAVAILABLE";
  process.stderr.write(`Container validation blocked/failed. Report: ${reportDir}\n${summary.error}\n`);
} finally {
  if (containerCreated) {
    const beforeStop = await command("docker", ["inspect", containerName]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    if (beforeStop.code === 0) {
      const state = (JSON.parse(beforeStop.stdout) as Array<{ State: { Running: boolean } }>)[0].State;
      if (state.Running) {
        const stopStart = Date.now();
        const stopped = await command("docker", ["stop", "--time", "10", containerName]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
        summary.shutdownDurationMs ??= Date.now() - stopStart;
        if (stopped.code !== 0) cleanupFailed = true;
      }
    }
    const finalStateResult = await command("docker", ["inspect", containerName]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    if (finalStateResult.code === 0) {
      await writeFile(path.join(reportDir, "container-inspect.json"), finalStateResult.stdout, "utf8");
      const finalState = (JSON.parse(finalStateResult.stdout) as Array<{ State: { ExitCode: number; OOMKilled: boolean } }>)[0].State;
      summary.containerExitCode ??= finalState.ExitCode;
      summary.OOMKilled ??= finalState.OOMKilled;
      summary.forcedSigkillRequired ??= finalState.ExitCode === 137;
      if (summary.shutdownResult === "NOT_RUN") summary.shutdownResult = finalState.OOMKilled || finalState.ExitCode === 137 ? "FAIL" : "PASS";
    }
    const logs = await command("docker", ["logs", containerName]).catch((error) => ({ code: 1, stdout: "", stderr: String(error) }));
    const containerLogs = `${logs.stdout}\n${logs.stderr}`;
    await writeFile(path.join(reportDir, "container.log"), containerLogs, "utf8");
    const logProblem = /unhandled exception|uncaught exception|EACCES|permission denied|missing (?:static|worker) asset/i.test(containerLogs);
    summary.containerLogsResult = logProblem ? "FAIL" : "PASS";
    if (logProblem) failed = true;
    const removed = await command("docker", ["rm", "--force", containerName]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    cleanupFailed ||= removed.code !== 0;
  }
  if (imageCreated) {
    const removed = await command("docker", ["image", "rm", imageName]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    cleanupFailed ||= removed.code !== 0;
  }
  summary.cleanupResult = cleanupFailed ? "FAIL" : "PASS";
  await writeSummary();
}

process.stdout.write(`CONTAINER_RUN_ID: ${runId}\nContainer report: ${reportDir}\n`);
if (failed) process.exitCode = 1;
}

void runContainerSmoke();
