import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
interface CompressionRuntime { FS: { writeFile(path: string, bytes: Uint8Array): void; readFile(path: string): Uint8Array; unlink(path: string): void }; callMain(argument: string[]): number }
interface CompressionFactory { default(option: { locateFile(): string; print(): void; printErr(): void }): Promise<CompressionRuntime> }
it("real pinned QPDF produces recovery output with exit 3; it must never count as successful compression", async () => {
    const runId = `qpdf-warning-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const temporary = path.resolve(".my-dev-kit-workflow", runId), report = path.resolve("test-report", runId);
    await mkdir(temporary, { recursive: true }); await mkdir(report, { recursive: true });
    const modulePath = path.join(temporary, "qpdf.mjs"); await copyFile("public/vendor/qpdf/12.4.2/qpdf.js", modulePath);
    const factory = await import(/* @vite-ignore */ pathToFileURL(modulePath).href) as CompressionFactory;
    const runtime = await factory.default({ locateFile: () => path.resolve("public/vendor/qpdf/12.4.2/qpdf.wasm"), print() {}, printErr() {} });
    const input = await readFile("test/fixtures/pdf/damaged-xref.pdf"); runtime.FS.writeFile("/input.pdf", input);
    let status: number;
    try { status = runtime.callMain(["--object-streams=generate", "--recompress-flate", "--compression-level=9", "--deterministic-id", "/input.pdf", "/output.pdf"]); }
    catch (error) { if (error && typeof error === "object" && "status" in error && typeof error.status === "number") status = error.status; else throw error; }
    const output = runtime.FS.readFile("/output.pdf").slice();
    runtime.FS.unlink("/input.pdf"); runtime.FS.unlink("/output.pdf");
    expect(status).toBe(3); expect(output.length).toBeGreaterThan(0);
    expect(() => runtime.FS.readFile("/input.pdf")).toThrow(); expect(() => runtime.FS.readFile("/output.pdf")).toThrow();
    await writeFile(path.join(report, "warning-evidence.json"), JSON.stringify({ RUN_ID: runId, INPUT_BYTES: input.length, OUTPUT_BYTES: output.length, QPDF_EXIT_STATUS: status, WARNINGS: "RECOVERY_EXIT_3", ACCEPTED: false, MEMFS_CLEANUP: "PASS" }, null, 2));
}, 30_000);
