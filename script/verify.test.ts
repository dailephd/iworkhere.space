import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  VERIFY_STEPS,
  buildCommandLogPath,
  buildReportPath,
  generateRunId,
  runCommand,
  writeCommandLog,
} from "./verify";

function createTmpDir(): string {
  const dir = join(tmpdir(), `verify-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("project verification behavior", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("generates unique report-compatible run IDs", () => {
    const first = generateRunId();
    const second = generateRunId();
    expect(first).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}$/);
    expect(second).not.toBe(first);
  });

  test("keeps the four validation steps in order", () => {
    expect(VERIFY_STEPS.map((step) => step.name)).toEqual(["typecheck", "lint", "test", "build"]);
  });

  test("builds the shared report and command-log paths", () => {
    expect(buildReportPath("/project", "run-123")).toBe(join("/project", "test-report", "run-123"));
    expect(buildCommandLogPath("/project", "run-123")).toBe(
      join("/project", "test-report", "run-123", "command"),
    );
  });

  test("captures command output and environment values", () => {
    tempDir = createTmpDir();
    const scriptPath = join(tempDir, "command.js");
    writeFileSync(scriptPath, "process.stdout.write(process.env.VERIFY_TEST_VALUE || '')", "utf-8");
    const result = runCommand("node", [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, VERIFY_TEST_VALUE: "captured" },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("captured");
  });

  test("writes stdout, stderr, and exit code to a command log", () => {
    tempDir = createTmpDir();
    const logPath = join(tempDir, "lint.log");
    writeCommandLog(logPath, "lint", { exitCode: 1, stdout: "output", stderr: "error" });
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("=== LINT ===");
    expect(content).toContain("Exit code: 1");
    expect(content).toContain("output");
    expect(content).toContain("error");
  });
});
