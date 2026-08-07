import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateRunId,
  buildReportPath,
  buildCommandLogPath,
  runCommand,
  writeCommandLog,
} from "./orchestrator";

// --- Test helpers ---

function createTmpDir(): string {
  const dir = join(tmpdir(), `orchestrator-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// --- generateRunId ---

describe("generateRunId", () => {
  test("matches format YYYY-MM-DDTHH-mm-ss-SSSZ-<8hex>", () => {
    const runId = generateRunId();
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}$/;
    expect(runId).toMatch(pattern);
  });

  test("produces different values on consecutive calls", () => {
    const id1 = generateRunId();
    const id2 = generateRunId();
    expect(id1).not.toBe(id2);
  });

  test("hex suffix is exactly 8 characters", () => {
    const runId = generateRunId();
    const lastDash = runId.lastIndexOf("-");
    const hexSuffix = runId.slice(lastDash + 1);
    expect(hexSuffix).toMatch(/^[0-9a-f]{8}$/);
  });

  test("starts with a valid date prefix", () => {
    const runId = generateRunId();
    const yearStr = runId.slice(0, 4);
    const year = parseInt(yearStr, 10);
    expect(year).toBeGreaterThanOrEqual(2020);
    expect(year).toBeLessThanOrEqual(2100);
  });
});

// --- buildReportPath ---

describe("buildReportPath", () => {
  test("returns path under test-report with runId", () => {
    const result = buildReportPath("/project", "run-123");
    expect(result).toBe(join("/project", "test-report", "run-123"));
  });

  test("works with actual runId format", () => {
    const runId = "2026-02-14T16-14-23-519Z-abcd1234";
    const result = buildReportPath("/root", runId);
    expect(result).toBe(join("/root", "test-report", runId));
  });
});

// --- buildCommandLogPath ---

describe("buildCommandLogPath", () => {
  test("returns command subdirectory under report path", () => {
    const result = buildCommandLogPath("/project", "run-123");
    expect(result).toBe(join("/project", "test-report", "run-123", "command"));
  });
});

// --- runCommand ---

describe("runCommand", () => {
  test("captures stdout from successful command", () => {
    const result = runCommand("node", ["--version"], { cwd: process.cwd() });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^v\d+/);
  });

  test("returns non-zero exit code on failure", () => {
    const tmpDir = createTmpDir();
    const scriptPath = join(tmpDir, "exit42.js");
    writeFileSync(scriptPath, "process.exit(42)", "utf-8");

    const result = runCommand("node", [scriptPath], { cwd: process.cwd() });
    expect(result.exitCode).toBe(42);

    rmSync(tmpDir, { recursive: true });
  });

  test("captures stderr from command", () => {
    const tmpDir = createTmpDir();
    const scriptPath = join(tmpDir, "stderr.js");
    writeFileSync(scriptPath, "process.stderr.write('warn-msg')", "utf-8");

    const result = runCommand("node", [scriptPath], { cwd: process.cwd() });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("warn-msg");

    rmSync(tmpDir, { recursive: true });
  });

  test("passes custom environment variables", () => {
    const tmpDir = createTmpDir();
    const scriptPath = join(tmpDir, "env.js");
    writeFileSync(scriptPath, "process.stdout.write(process.env.TEST_ORCH_VAR || '')", "utf-8");

    const env = { ...process.env, TEST_ORCH_VAR: "val123" };
    const result = runCommand("node", [scriptPath], { cwd: process.cwd(), env });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("val123");

    rmSync(tmpDir, { recursive: true });
  });

  test("passes input to stdin", () => {
    const tmpDir = createTmpDir();
    const scriptPath = join(tmpDir, "stdin.js");
    writeFileSync(
      scriptPath,
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(d))",
      "utf-8",
    );

    const result = runCommand("node", [scriptPath], {
      cwd: process.cwd(),
      input: "hello-stdin",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello-stdin");

    rmSync(tmpDir, { recursive: true });
  });
});

// --- writeCommandLog ---

describe("writeCommandLog", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("creates log file with step name header", () => {
    tmpDir = createTmpDir();
    const logPath = join(tmpDir, "typecheck.log");

    writeCommandLog(logPath, "typecheck", {
      exitCode: 0,
      stdout: "no errors",
      stderr: "",
    });

    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("=== TYPECHECK ===");
  });

  test("includes exit code in log", () => {
    tmpDir = createTmpDir();
    const logPath = join(tmpDir, "lint.log");

    writeCommandLog(logPath, "lint", {
      exitCode: 1,
      stdout: "",
      stderr: "lint error",
    });

    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("Exit code: 1");
  });

  test("includes stdout and stderr sections", () => {
    tmpDir = createTmpDir();
    const logPath = join(tmpDir, "build.log");

    writeCommandLog(logPath, "build", {
      exitCode: 0,
      stdout: "build-output-here",
      stderr: "build-warning-here",
    });

    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("--- STDOUT ---");
    expect(content).toContain("build-output-here");
    expect(content).toContain("--- STDERR ---");
    expect(content).toContain("build-warning-here");
  });

  test("propagates exit code correctly in log content", () => {
    tmpDir = createTmpDir();
    const logPath = join(tmpDir, "test.log");

    writeCommandLog(logPath, "test", {
      exitCode: 137,
      stdout: "",
      stderr: "killed",
    });

    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("Exit code: 137");
    expect(content).toContain("=== TEST ===");
  });
});
