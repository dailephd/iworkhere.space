import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { randomBytes } from "node:crypto";

// --- Types ---

interface VerifyStep {
  name: string;
  command: string;
  arg: string[];
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// --- Constants ---

const GOVERNANCE_ROOT_FILE: string[] = [
  "CLAUDE.md",
  "package.json",
  "vitest.config.mts",
];

const GOVERNANCE_DOC_DIR = "doc";

const VERIFY_STEP: VerifyStep[] = [
  { name: "typecheck", command: "npm", arg: ["run", "typecheck"] },
  { name: "lint", command: "npm", arg: ["run", "lint"] },
  { name: "test", command: "npm", arg: ["run", "test"] },
  { name: "build", command: "npm", arg: ["run", "build"] },
];

const CLAUDE_COMMAND = process.env["CLAUDE_COMMAND"] ?? "claude";

// --- Exported utility functions ---

export function generateRunId(): string {
  const iso = new Date().toISOString();
  const formatted = iso.replace(/[:.]/g, "-");
  const hex = randomBytes(4).toString("hex");
  return `${formatted}-${hex}`;
}

export function buildReportPath(projectRoot: string, runId: string): string {
  return join(projectRoot, "test-report", runId);
}

export function buildCommandLogPath(projectRoot: string, runId: string): string {
  return join(buildReportPath(projectRoot, runId), "command");
}

export function runCommand(
    command: string,
    arg: string[],
    option: {
      cwd: string;
      env?: NodeJS.ProcessEnv;
      input?: string;
    },
): CommandResult {
  const result = spawnSync(command, arg, {
    cwd: option.cwd,
    stdio: option.input ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"],
    encoding: "utf-8",
    shell: true,
    env: option.env,
    input: option.input,
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function writeCommandLog(
    logPath: string,
    stepName: string,
    result: CommandResult,
): void {
  const logContent = [
    `=== ${stepName.toUpperCase()} ===`,
    `Exit code: ${result.exitCode}`,
    "",
    "--- STDOUT ---",
    result.stdout,
    "",
    "--- STDERR ---",
    result.stderr,
  ].join("\n");

  writeFileSync(logPath, logContent, "utf-8");
}

// --- Internal functions ---

function ensureFileExists(projectRoot: string, relativePath: string): void {
  const absolutePath = join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    process.stderr.write(`ERROR: Required governance file not found: ${relativePath}\n`);
    process.stderr.write(`Expected at: ${absolutePath}\n`);
    process.exit(1);
  }
}

function ensureDirExists(projectRoot: string, relativeDir: string): void {
  const absoluteDir = join(projectRoot, relativeDir);
  if (!existsSync(absoluteDir)) {
    process.stderr.write(`ERROR: Required governance directory not found: ${relativeDir}\n`);
    process.stderr.write(`Expected at: ${absoluteDir}\n`);
    process.exit(1);
  }
  const st = statSync(absoluteDir);
  if (!st.isDirectory()) {
    process.stderr.write(`ERROR: Governance path is not a directory: ${relativeDir}\n`);
    process.stderr.write(`Found file at: ${absoluteDir}\n`);
    process.exit(1);
  }
}

function listAllFileRelativePath(projectRoot: string, relativeDir: string): string[] {
  const absoluteDir = join(projectRoot, relativeDir);

  const walk = (dirAbs: string): string[] => {
    const entry = readdirSync(dirAbs, { withFileTypes: true });
    const item: string[] = [];

    for (const one of entry) {
      const oneAbs = join(dirAbs, one.name);

      if (one.isDirectory()) {
        item.push(...walk(oneAbs));
        continue;
      }

      if (one.isFile()) {
        item.push(relative(projectRoot, oneAbs).replace(/\\/g, "/"));
      }
    }

    return item;
  };

  const fileList = walk(absoluteDir);
  fileList.sort((a, b) => a.localeCompare(b));
  return fileList;
}

function readTextFileOrStub(projectRoot: string, relativePath: string): string {
  const absolutePath = join(projectRoot, relativePath);

  try {
    return readFileSync(absolutePath, "utf-8");
  } catch (err) {
    const size = (() => {
      try {
        return statSync(absolutePath).size;
      } catch {
        return -1;
      }
    })();

    const note = [
      "NOTE: This file could not be read as utf-8 text.",
      "It may be binary or encoded differently.",
      `Path: ${relativePath}`,
      size >= 0 ? `Size: ${size} bytes` : "Size: unknown",
      `Error: ${String(err)}`,
    ].join("\n");

    return note;
  }
}

export function buildGovernanceContext(projectRoot: string): string {
  for (const filePath of GOVERNANCE_ROOT_FILE) {
    ensureFileExists(projectRoot, filePath);
  }
  ensureDirExists(projectRoot, GOVERNANCE_DOC_DIR);

  const docFile = listAllFileRelativePath(projectRoot, GOVERNANCE_DOC_DIR);
  const governanceFile = [...GOVERNANCE_ROOT_FILE, ...docFile];

  const sectionList: string[] = [];

  for (const filePath of governanceFile) {
    const content = readTextFileOrStub(projectRoot, filePath);
    sectionList.push(`--- FILE: ${filePath} ---\n${content}\n--- END: ${filePath} ---`);
  }

  return `=== GOVERNANCE CONTEXT ===\n\n${sectionList.join("\n\n")}\n\n=== END GOVERNANCE CONTEXT ===`;
}

// --- Mode: context ---

function runContextMode(): void {
  const projectRoot = process.cwd();
  const context = buildGovernanceContext(projectRoot);
  process.stdout.write(context);
  process.stdout.write("\n");
}

// --- Mode: ask ---

function readStdin(): string {
  if (process.stdin.isTTY) {
    return "";
  }
  try {
    return readFileSync(0, "utf-8").trim();
  } catch {
    return "";
  }
}

function readRequestFromFile(projectRoot: string, filePathArg: string): string {
  const abs = resolve(projectRoot, filePathArg);
  if (!existsSync(abs)) {
    process.stderr.write(`ERROR: Prompt file not found: ${filePathArg}\n`);
    process.stderr.write(`Resolved path: ${abs}\n`);
    process.exit(1);
  }
  try {
    const content = readFileSync(abs, "utf-8");
    return content.trim();
  } catch (err) {
    process.stderr.write(`ERROR: Failed to read prompt file as utf-8: ${filePathArg}\n`);
    process.stderr.write(`Resolved path: ${abs}\n`);
    process.stderr.write(`Error: ${String(err)}\n`);
    process.exit(1);
  }
}

function parseAskArgs(argv: string[]): { promptFilePath?: string; requestWords: string[] } {
  const requestWords: string[] = [];
  let promptFilePath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === "--prompt-file" || a === "--promptFile" || a === "-f") {
      const next = argv[i + 1];
      if (!next) {
        process.stderr.write(`ERROR: Missing value after ${a}\n`);
        process.stderr.write("Usage: orchestrator.ts ask -f <path/to/prompt.txt>\n");
        process.exit(1);
      }
      promptFilePath = next;
      i += 1;
      continue;
    }

    requestWords.push(a);
  }

  return { promptFilePath, requestWords };
}

function buildFinalPrompt(governanceContext: string, request: string): string {
  return [
    governanceContext,
    "",
    "--- USER REQUEST ---",
    request,
    "--- END USER REQUEST ---",
    "",
    "--- INSTRUCTIONS ---",
    "You MUST follow the governance context above.",
    "Do NOT guess imports, export names, or type shapes.",
    "Do NOT write placeholder or partial implementations.",
    "Read existing files before writing code.",
    "All new logic must include tests.",
    "Run tests after implementation and ensure they pass.",
    "--- END INSTRUCTIONS ---",
  ].join("\n");
}

function runAskMode(rawArgs: string[]): void {
  const projectRoot = process.cwd();

  const parsed = parseAskArgs(rawArgs);

  let request = parsed.requestWords.join(" ").trim();

  if (parsed.promptFilePath) {
    request = readRequestFromFile(projectRoot, parsed.promptFilePath);
  } else if (!request) {
    request = readStdin();
  }

  if (!request) {
    process.stderr.write("ERROR: No request provided.\n");
    process.stderr.write("Usage:\n");
    process.stderr.write("  orchestrator.ts ask <request>\n");
    process.stderr.write("  echo 'request' | orchestrator.ts ask\n");
    process.stderr.write("  orchestrator.ts ask -f <path/to/prompt.txt>\n");
    process.stderr.write("  orchestrator.ts ask --prompt-file <path/to/prompt.txt>\n");
    process.exit(1);
  }

  const runId = generateRunId();
  const reportPath = buildReportPath(projectRoot, runId);
  mkdirSync(reportPath, { recursive: true });

  const governanceContext = buildGovernanceContext(projectRoot);
  const finalPrompt = buildFinalPrompt(governanceContext, request);

  const promptPath = join(reportPath, "prompt.txt");
  writeFileSync(promptPath, finalPrompt, "utf-8");

  process.stdout.write(`RUN_ID: ${runId}\n`);
  process.stdout.write(`Logs: ${reportPath}\n`);
  process.stdout.write(`Prompt saved: ${promptPath}\n`);
  if (parsed.promptFilePath) {
    process.stdout.write(`Prompt source: ${parsed.promptFilePath}\n`);
  }
  process.stdout.write(`Invoking: ${CLAUDE_COMMAND} -p\n`);

  const result = runCommand(CLAUDE_COMMAND, ["-p"], {
    cwd: projectRoot,
    input: finalPrompt,
  });

  const stdoutLog = join(reportPath, "claude-stdout.log");
  const stderrLog = join(reportPath, "claude-stderr.log");
  writeFileSync(stdoutLog, result.stdout, "utf-8");
  writeFileSync(stderrLog, result.stderr, "utf-8");

  if (result.exitCode !== 0) {
    process.stderr.write(`ERROR: Claude invocation failed with exit code ${result.exitCode}\n`);
    process.stderr.write(`Logs preserved at: ${reportPath}\n`);
    process.exit(result.exitCode);
  }

  process.stdout.write(result.stdout);
  process.stdout.write(`\nCompleted. RUN_ID: ${runId}\n`);
  process.stdout.write(`Logs: ${reportPath}\n`);
}

// --- Mode: verify ---

function runVerifyMode(): void {
  const projectRoot = process.cwd();
  const runId = generateRunId();
  const reportPath = buildReportPath(projectRoot, runId);
  const commandLogPath = buildCommandLogPath(projectRoot, runId);

  mkdirSync(commandLogPath, { recursive: true });

  process.stdout.write(`RUN_ID: ${runId}\n`);
  process.stdout.write(`Report: ${reportPath}\n\n`);

  for (const step of VERIFY_STEP) {
    process.stdout.write(`Running: ${step.name}...\n`);

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (step.name === "test") {
      env["VITEST_RUN_ID"] = runId;
    }

    const result = runCommand(step.command, step.arg, {
      cwd: projectRoot,
      env,
    });

    const logPath = join(commandLogPath, `${step.name}.log`);
    writeCommandLog(logPath, step.name, result);

    if (result.exitCode !== 0) {
      process.stderr.write(`FAILED: ${step.name} (exit code ${result.exitCode})\n`);
      process.stderr.write(`Log: ${logPath}\n`);
      process.stderr.write(`RUN_ID: ${runId}\n`);
      process.exit(result.exitCode);
    }

    process.stdout.write(`  ${step.name}: passed\n`);
  }

  const resultsJsonPath = join(reportPath, "results.json");
  const resultsXmlPath = join(reportPath, "results.xml");

  process.stdout.write("\n=== VERIFY COMPLETE ===\n");
  process.stdout.write(`RUN_ID: ${runId}\n`);
  process.stdout.write(`Results JSON: ${resultsJsonPath}\n`);
  process.stdout.write(`Results XML:  ${resultsXmlPath}\n`);
  process.stdout.write("Command logs:\n");
  for (const step of VERIFY_STEP) {
    process.stdout.write(`  ${step.name}: ${join(commandLogPath, `${step.name}.log`)}\n`);
  }
}

// --- Main ---

function main(): void {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (mode === "context") {
    runContextMode();
    return;
  }

  if (mode === "ask") {
    runAskMode(args.slice(1));
    return;
  }

  if (mode === "verify") {
    runVerifyMode();
    return;
  }

  process.stderr.write("Usage: orchestrator.ts <context|ask|verify> [request...]\n");
  process.stderr.write("\nModes:\n");
  process.stderr.write("  context   Print governance context to stdout\n");
  process.stderr.write("  ask       Run Claude Code with governance context\n");
  process.stderr.write("            Supports reading request from a file: ask -f <path>\n");
  process.stderr.write("  verify    Run CI steps and generate test reports\n");
  process.exit(1);
}

// Only run when executed directly (not when imported by tests)
const isDirectExecution = process.argv[1]?.replace(/\\/g, "/").includes("script/orchestrator");
if (isDirectExecution) {
  main();
}