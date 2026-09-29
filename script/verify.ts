import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export interface VerifyStep {
  name: string;
  command: string;
  args: string[];
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export const VERIFY_STEPS: VerifyStep[] = [
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "lint", command: "npm", args: ["run", "lint"] },
  { name: "test", command: "npm", args: ["run", "test"] },
  { name: "build", command: "npm", args: ["run", "build"] },
];

export function generateRunId(): string {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `${iso}-${randomBytes(4).toString("hex")}`;
}

export function buildReportPath(projectRoot: string, runId: string): string {
  return join(projectRoot, "test-report", runId);
}

export function buildCommandLogPath(projectRoot: string, runId: string): string {
  return join(buildReportPath(projectRoot, runId), "command");
}

export function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): CommandResult {
  const windowsNpm = process.platform === "win32" && command === "npm";
  const executable = windowsNpm ? (process.env.ComSpec ?? "cmd.exe") : command;
  const childArgs = windowsNpm ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args;
  const result = spawnSync(executable, childArgs, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf-8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function writeCommandLog(logPath: string, stepName: string, result: CommandResult): void {
  writeFileSync(
    logPath,
    [
      `=== ${stepName.toUpperCase()} ===`,
      `Exit code: ${result.exitCode}`,
      "",
      "--- STDOUT ---",
      result.stdout,
      "",
      "--- STDERR ---",
      result.stderr,
    ].join("\n"),
    "utf-8",
  );
}

function runVerification(): void {
  const projectRoot = process.cwd();
  const runId = generateRunId();
  const reportPath = buildReportPath(projectRoot, runId);
  const commandLogPath = buildCommandLogPath(projectRoot, runId);
  mkdirSync(commandLogPath, { recursive: true });

  process.stdout.write(`RUN_ID: ${runId}\n`);
  process.stdout.write(`Report: ${reportPath}\n`);
  process.stdout.write(`Command logs: ${commandLogPath}\n\n`);

  for (const step of VERIFY_STEPS) {
    process.stdout.write(`Running: ${step.name}...\n`);
    const env = { ...process.env };
    if (step.name === "test") {
      env.VITEST_RUN_ID = runId;
    }

    const result = runCommand(step.command, step.args, { cwd: projectRoot, env });
    const logPath = join(commandLogPath, `${step.name}.log`);
    writeCommandLog(logPath, step.name, result);

    if (result.exitCode !== 0) {
      process.stderr.write(`FAILED: ${step.name} (exit code ${result.exitCode})\n`);
      process.stderr.write(`Log: ${logPath}\nRUN_ID: ${runId}\n`);
      process.exit(result.exitCode);
    }

    process.stdout.write(`  ${step.name}: passed\n`);
  }

  process.stdout.write("\n=== VERIFY COMPLETE ===\n");
  process.stdout.write(`RUN_ID: ${runId}\n`);
  process.stdout.write(`Report: ${reportPath}\n`);
  process.stdout.write(`Results JSON: ${join(reportPath, "results.json")}\n`);
  process.stdout.write(`Results XML: ${join(reportPath, "results.xml")}\n`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("script/verify.ts")) {
  runVerification();
}
