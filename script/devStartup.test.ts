import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();
const packageScripts = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8")).scripts as Record<string, string>;
const environmentCheck = readFileSync(join(projectRoot, "scripts/Check-DevEnv.ps1"), "utf-8");
const devStartup = readFileSync(join(projectRoot, "scripts/Start-Dev.ps1"), "utf-8");

describe("development startup contract", () => {
  test("dev checks the environment before starting the host wrapper", () => {
    expect(packageScripts.dev).toContain("npm run dev:check && powershell");
    expect(packageScripts.dev).toContain("scripts/Start-Dev.ps1");
    expect(packageScripts.dev).not.toMatch(/docker/i);
  });

  test("dev:web owns the raw Next.js development command", () => {
    expect(packageScripts["dev:web"]).toBe("next dev");
  });

  test("dev:check invokes the environment validation script", () => {
    expect(packageScripts["dev:check"]).toContain("scripts/Check-DevEnv.ps1");
  });

  test("environment validation requires Node and npm commands", () => {
    expect(environmentCheck).toMatch(/Get-Command\s+\$commandName/);
    expect(environmentCheck).toContain("@('node', 'npm')");
  });

  test("environment validation enforces Node 24 and required repository paths", () => {
    expect(environmentCheck).toMatch(/\[int\]\$Matches\['major'\]\s+-ne\s+24/);
    expect(environmentCheck).toContain("'package.json'");
    expect(environmentCheck).toContain("'src\\app'");
    expect(environmentCheck).toContain("'docs\\ROADMAP.md'");
    expect(environmentCheck).toContain("'docs\\project-status.md'");
  });

  test("every repository path the environment check requires exists and the obsolete doc paths are gone", () => {
    const block = environmentCheck.match(/\$requiredPaths\s*=\s*@\(([\s\S]*?)\)/)?.[1] ?? "";
    const requiredPaths = [...block.matchAll(/'([^']+)'/g)].map(match => match[1]);
    expect(requiredPaths.length).toBeGreaterThanOrEqual(4);
    for (const requiredPath of requiredPaths) {
      expect(existsSync(join(projectRoot, ...requiredPath.split("\\"))), requiredPath).toBe(true);
    }
    expect(environmentCheck).not.toContain("'doc\\");
  });

  test("startup resolves port 3000 and only stops Node owners", () => {
    expect(devStartup).toMatch(/Get-NetTCPConnection\s+-State\s+Listen\s+-LocalPort\s+3000/);
    expect(devStartup.match(/\$listeners\s*=\s*@\(Get-PortListeners\)/g)).toHaveLength(2);
    expect(devStartup).toMatch(/\$\_\.ProcessName\s*-ne\s*'node'/);
    expect(devStartup).toMatch(/Stop-Process\s+-Id\s+\$owner\.Id\s+-Force/);
    const nonNodeFailure = devStartup.match(/if\s*\(\$null\s+-ne\s+\$nonNodeOwner\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(nonNodeFailure).toContain("throw");
    expect(nonNodeFailure).not.toContain("Stop-Process");
  });

  test("startup message distinguishes the optional Docker preview", () => {
    expect(devStartup).toContain("Starting Next.js dev server for iworkhere.space on http://localhost:3000 ...");
    expect(devStartup).toContain("Docker production preview is optional: npm run dev:docker");
  });

  test("startup launches dev:web in the current console and returns its exit code", () => {
    expect(devStartup).toContain("& npm.cmd run dev:web");
    expect(devStartup).toContain('Dev server exited with code $devExitCode.');
    expect(devStartup).toMatch(/exit\s+\$devExitCode/);
  });
});
