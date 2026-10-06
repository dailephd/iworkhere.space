import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface QpdfArtifact { jsBytes: number; wasmBytes: number; jsSha256: string; wasmSha256: string }
interface QpdfLock { builderDigest: string; qpdfTag: string; qpdfCommit: string; outputs: QpdfArtifact[] }
async function main(): Promise<void> {
const root = process.cwd();
const lock = JSON.parse(await readFile(path.join(root, "script/qpdf/source-lock.json"), "utf8")) as QpdfLock;
const runId = `durable-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const runRoot = path.join(root, ".my-dev-kit-workflow/v0.3.0-batch1", runId);
await mkdir(path.join(runRoot, "work"), { recursive: true });
await mkdir(path.join(runRoot, "output"), { recursive: true });
await mkdir(path.join(runRoot, "tmp"), { recursive: true });

async function command(executable: string, argument: string[], logName: string): Promise<string> {
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(executable, argument, { windowsHide: true, env: { ...process.env, TEMP: path.join(runRoot, "tmp"), TMP: path.join(runRoot, "tmp") } });
        let stdout = "", stderr = "";
        child.stdout.on("data", data => { stdout += data.toString(); });
        child.stderr.on("data", data => { stderr += data.toString(); });
        child.on("error", reject);
        child.on("close", code => resolve({ code: code ?? 1, stdout, stderr }));
    });
    await writeFile(path.join(runRoot, logName), result.stdout + result.stderr);
    if (result.code !== 0) throw new Error(`QPDF build command failed; see ${path.join(runRoot, logName)}`);
    return result.stdout.trim();
}
process.stdout.write(`QPDF_BUILD_RUN: ${runId}\nEVIDENCE: ${runRoot}\n`);
const source = path.join(runRoot, "source");
await command("git", ["clone", "--depth", "1", "--branch", lock.qpdfTag, "https://github.com/qpdf/qpdf.git", source], "source-clone.log");
const commit = await command("git", ["-C", source, "rev-parse", "HEAD"], "source-commit.log");
const tag = await command("git", ["-C", source, "rev-parse", `${lock.qpdfTag}^{}`], "source-tag.log");
const status = await command("git", ["-C", source, "status", "--short", "--untracked-files=all"], "source-status.log");
if (commit !== lock.qpdfCommit || tag !== lock.qpdfCommit || status) throw new Error("QPDF source identity mismatch");
await command("docker", ["run", "--rm", "--name", `iworkhere-qpdf-${runId.toLowerCase()}`,
    "--mount", `type=bind,source=${source},target=/source,readonly`,
    "--mount", `type=bind,source=${path.join(root, "script/qpdf/build.sh")},target=/recipe.sh,readonly`,
    "--mount", `type=bind,source=${path.join(runRoot, "work")},target=/work`,
    "--mount", `type=bind,source=${path.join(runRoot, "output")},target=/output`,
    `emscripten/emsdk@${lock.builderDigest}`, "bash", "/recipe.sh"], "build.log");
const artifact = lock.outputs[0];
for (const [name, bytes, hash] of [["qpdf.js", artifact.jsBytes, artifact.jsSha256], ["qpdf.wasm", artifact.wasmBytes, artifact.wasmSha256]] as const) {
    const data = await readFile(path.join(runRoot, "output", name));
    if (data.length !== bytes || createHash("sha256").update(data).digest("hex") !== hash) throw new Error(`Canonical ${name} mismatch`);
}
await writeFile(path.join(runRoot, "result.json"), JSON.stringify({ runId, commit, result: "PASS", artifact }, null, 2));
process.stdout.write("QPDF_CANONICAL_RECIPE: PASS\n");
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "QPDF build failed"}\n`); process.exitCode = 1; });
