import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { reportingQuery } from "../../dashboard/src/lib/reportingQuery";
import { reportingModel } from "../../dashboard/src/lib/reportingModel";
import { rangePlan, RANGE } from "../../dashboard/src/lib/range";
import type { Query } from "../../dashboard/src/lib/query";

export interface PermissionFixtureDatabase {
    execute: (text: string) => Promise<void>;
    query: (query: Query, reader: boolean) => Promise<Record<string, unknown>[]>;
}
/** Isolated fixture only; CLI accepts a disposable container ID, never a DB URL. */
export async function verifyPermissionFixture(database: PermissionFixtureDatabase): Promise<string[]> {
    const root = path.resolve(__dirname, "../../database/observability");
    await database.execute(readFileSync(path.join(root, "001-schema.sql"), "utf8"));
    await database.execute(readFileSync(path.join(root, "002-diagnostic-error.sql"), "utf8"));
    // These changes apply solely to the disposable fixture, never production.
    await database.execute(`REVOKE CREATE,TEMP ON DATABASE postgres FROM PUBLIC;
        REVOKE CREATE ON SCHEMA public FROM PUBLIC;
        CREATE SCHEMA support; REVOKE ALL ON SCHEMA support FROM PUBLIC;
        CREATE TABLE support.report (body text); REVOKE ALL ON support.report FROM PUBLIC;`);
    await database.execute(readFileSync(path.join(root, "reporting-role.sql"), "utf8").replaceAll(':"database_name"', '"postgres"'));
    const identity = await database.query({ text: "SELECT current_user AS name", parameter: [] }, true);
    assert.equal(identity[0].name, "observability_reporting");
    const now = new Date(), today = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
    const points = [new Date(today.getTime() - 2 * 86400000 + 3600000), new Date(today.getTime() - 86400000 + 3600000), new Date((today.getTime() + now.getTime()) / 2)];
    const times = points.map(point => `timestamptz '${point.toISOString()}'`).join(",");
    await database.execute(`INSERT INTO observability.event (occurred_at, received_at, kind, pathname, navigation_type)
        SELECT t,t,'navigation','/','initial' FROM unnest(ARRAY[${times}]) t;
        INSERT INTO observability.event (occurred_at, received_at, kind, pathname, tool_id, event_name)
        SELECT t,t,'analytic-event','/tool/calculator','calculator', e FROM unnest(ARRAY[${times}]) t, unnest(ARRAY['tool_opened','tool_executed','tool_executed']) e;
        INSERT INTO observability.event (occurred_at, received_at, kind, pathname, failure_category)
        SELECT t,t,'client-error','/','window-error' FROM unnest(ARRAY[${times}]) t;
        INSERT INTO observability.event (occurred_at, received_at, kind, pathname, metric_name, metric_value)
        SELECT t,t,'web-vital','/','LCP',v FROM unnest(ARRAY[${times}]) t, unnest(ARRAY[10,20,30,40]) v;
        SELECT observability.rollup_complete_day('${points[0].toISOString().slice(0,10)}');
        SELECT observability.rollup_complete_day('${points[1].toISOString().slice(0,10)}');`);
    const check = ["role template and effective restricted identity"];
    for (const range of RANGE) {
        const plan = rangePlan(range, now), query = reportingQuery(plan);
        const activity = await database.query(query.activity, true), vital = await database.query(query.vital, true), evidence = await database.query(query.evidence, true);
        const result = reportingModel({ schemaVersion: 1, range }, { activity, vital, evidence }, now);
        const selected = points.filter(point => point.toISOString() >= plan.start && point.toISOString() < plan.end).length;
        assert.equal(result.navigationCount, selected); assert.equal(result.toolOpenCount, selected);
        assert.equal(result.toolExecutionCount, selected * 2); assert.equal(result.clientErrorCount, selected);
        assert.equal(result.vital[0].value, selected ? 32.5 : null);
        assert.equal(result.health.state, "INSUFFICIENT_EVIDENCE");
        check.push(`${range}: restricted READ ONLY aggregate totals/vital/DTO`);
    }
    const denied = ["SELECT message FROM observability.error_diagnostic", "SELECT body FROM support.report", "SELECT id FROM observability.event",
        "INSERT INTO observability.event (kind,pathname,navigation_type) VALUES ('navigation','/','initial')", "UPDATE observability.event SET pathname='/'", "DELETE FROM observability.event",
        "SELECT observability.maintain()", "CREATE TABLE public.forbidden (id int)"];
    for (const statement of denied) {
        const escaped = statement.replaceAll("'", "''");
        await database.execute(`SET ROLE observability_reporting; DO $$ BEGIN
            IF current_user <> 'observability_reporting' THEN RAISE EXCEPTION 'Wrong test identity'; END IF;
            BEGIN EXECUTE '${escaped}'; RAISE EXCEPTION 'Forbidden statement succeeded';
            EXCEPTION WHEN insufficient_privilege THEN NULL; END;
            END $$; RESET ROLE;`);
    }
    check.push("diagnostic/support/extra-column read, INSERT/UPDATE/DELETE, function and DDL denied");
    return check;
}
export function preparedFixtureQuery(query: Query, reader: boolean): string {
    const parameter = query.parameter.map(value => "'" + value.replaceAll("'", "''") + "'").join(",");
    const type = query.parameter.map(() => "text").join(",");
    return `${reader ? "SET ROLE observability_reporting;" : ""} BEGIN READ ONLY;
        PREPARE fixture ${type ? `(${type})` : ""} AS SELECT coalesce(json_agg(fixture_row), '[]'::json) AS result FROM (${query.text}) fixture_row;
        EXECUTE fixture${parameter ? `(${parameter})` : ""}; DEALLOCATE fixture; ROLLBACK;`;
}
async function main(): Promise<void> {
    const runId = `reporting-permission-${new Date().toISOString().replace(/[:.]/g,"-")}-${randomBytes(4).toString("hex")}`;
    const report = path.resolve("test-report", runId); mkdirSync(report, { recursive: true });
    process.stdout.write(`REPORTING_PERMISSION_RUN_ID: ${runId}\nReport: ${report}\n`);
    const container = process.env.REPORTING_TEST_POSTGRES_CONTAINER;
    if (!container || !/^[a-f0-9]{12,64}$/.test(container)) throw new Error("Disposable CI PostgreSQL container ID required");
    function sql(text: string): string { return execFileSync("docker", ["exec", "-i", container!, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], { input: text, encoding: "utf8", windowsHide: true, timeout: 30000 }); }
    try {
        const check = await verifyPermissionFixture({ execute: async text => { sql(text); }, query: async (query, reader) => JSON.parse(sql(preparedFixtureQuery(query, reader)).trim()) });
        writeFileSync(path.join(report,"results.json"), JSON.stringify({ runId, status: "PASS", check }, null, 2));
        process.stdout.write("Reporting permission fixture: PASS\n");
    } catch { writeFileSync(path.join(report,"results.json"), JSON.stringify({ runId, status: "FAIL" })); throw new Error("Reporting permission fixture failed"); }
}
if (process.argv.includes("--docker")) main().catch(() => { process.stderr.write("Reporting permission fixture failed.\n"); process.exitCode = 1; });
