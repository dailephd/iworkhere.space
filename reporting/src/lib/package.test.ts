import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
it("isolates the service from public TypeScript/lint/Docker output", () => {
    expect(JSON.parse(readFileSync("../tsconfig.json", "utf8")).exclude).toContain("reporting");
    expect(readFileSync("../eslint.config.mjs", "utf8")).toContain('"reporting/**"');
    expect(readFileSync("../.dockerignore", "utf8").split(/\r?\n/)).toContain("reporting");
    expect(readFileSync("next.config.ts", "utf8")).toContain("outputFileTracingRoot");
});
it("uses no client modules, unsafe logger or private dashboard dependencies", () => {
    const root = path.resolve("src");
    function list(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? list(path.join(dir, item.name)) : [path.join(dir, item.name)]); }
    const production = list(root).filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.includes(path.sep + "test" + path.sep));
    for (const file of production) {
        const source = readFileSync(file, "utf8");
        expect(source).not.toMatch(/use client|NEXT_PUBLIC_|console\.|supportDatabase|supportQuery|DashboardView|from.*["'].*\/model["']/);
        expect(source).not.toMatch(/OBSERVABILITY_DASHBOARD_DATABASE_URL|SUPPORT_DASHBOARD_DATABASE_URL/);
    }
});
it("grants only explicit reporting columns and no dashboard reader reuse", () => {
    const role = readFileSync("../database/observability/reporting-role.sql", "utf8");
    expect(role).toContain("NOINHERIT NOBYPASSRLS"); expect(role).toContain("default_transaction_read_only = on"); expect(role).toContain("statement_timeout = '15s'");
    expect(role).not.toMatch(/GRANT SELECT ON ALL|GRANT.*error_diagnostic|GRANT.*support\./);
    for (const table of ["event", "daily_event", "daily_vital", "rollup_day"]) expect(role).toContain(`ON observability.${table} TO observability_reporting`);
    expect(role).toContain("pg_auth_members"); expect(role).toContain("has_column_privilege"); expect(role).toContain("has_function_privilege");
});
