import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface SmokeQuery { text: string; parameter: string[] }

const runId = `observability-db-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const reportDir = path.resolve("test-report", runId);
const container = `iworkhere-observability-${runId.toLowerCase()}`;
mkdirSync(reportDir, { recursive: true });
const log: string[] = [];
let created = false;
let passed = false;

function docker(args: string[], input?: string): string {
    const result = spawnSync("docker", args, { windowsHide: true, shell: false, encoding: "utf8", input, timeout: 120_000 });
    log.push(`docker ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.status !== 0) throw new Error("Disposable Postgres command failed; see report log.");
    return result.stdout;
}
function sql(source: string): string {
    return docker(["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-P", "pager=off"], source);
}
function assertSql(condition: string, label: string): void {
    sql(`DO $$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION '${label}'; END IF; END $$;`);
}

async function smoke(): Promise<void> {
    process.stdout.write(`OBSERVABILITY_DB_RUN_ID: ${runId}\nReport: ${reportDir}\n`);
    try {
        docker(["run", "--detach", "--name", container, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]);
        created = true;
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            const result = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], { windowsHide: true, shell: false, encoding: "utf8" });
            if (result.status === 0) { ready = true; break; }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!ready) throw new Error("Disposable Postgres did not become ready.");
        const schema = readFileSync(path.resolve("database/observability/001-schema.sql"), "utf8");
        sql(schema);
        sql(schema); // migration idempotence
        sql(`INSERT INTO observability.event (occurred_at, received_at, kind, pathname, navigation_type)
            SELECT t, t, 'navigation', '/', 'initial' FROM (SELECT (now() AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC' - interval '1 day' AS t) s;
            INSERT INTO observability.event (occurred_at, received_at, kind, pathname, tool_id, event_name)
            SELECT t, t, 'analytic-event', '/tool/image-resizer', 'image-resizer', 'tool_executed'
            FROM (SELECT (now() AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC' - interval '1 day' AS t) s, generate_series(1, 2);
            INSERT INTO observability.event (occurred_at, received_at, kind, pathname, metric_name, metric_value)
            SELECT t, t, 'web-vital', '/', 'LCP', v FROM
            (SELECT (now() AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC' - interval '1 day' AS t) s, unnest(ARRAY[10,20,30,40]) v;
            INSERT INTO observability.event (occurred_at, received_at, kind, pathname, failure_category, tool_id, device_class)
            SELECT t, t, 'client-error', '/tool/image-resizer', 'tool-render-error', 'image-resizer', 'mobile'
            FROM (SELECT (now() AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC' - interval '1 day' AS t) s;
            INSERT INTO observability.event (occurred_at, received_at, kind, pathname, navigation_type)
            SELECT t, t, 'navigation', '/old', 'initial' FROM (SELECT now() - interval '100 days' AS t) s;
            SELECT observability.prune_raw();`);
        assertSql("(SELECT count(*) FROM observability.event WHERE pathname = '/old') = 1", "unrolled old event deleted");
        sql("SELECT * FROM observability.maintain();");
        assertSql("(SELECT sum(count) FROM observability.daily_event) = 5", "incorrect counts");
        assertSql("(SELECT sample_count = 4 AND p50 = 25 AND p75 = 32.5 AND p95 = 38.5 FROM observability.daily_vital WHERE metric_name = 'LCP')", "incorrect percentiles");
        assertSql("NOT EXISTS (SELECT 1 FROM observability.event WHERE pathname = '/old')", "rolled old event retained");
        assertSql("(SELECT count(*) FROM observability.rollup_day) = 2", "completion tracking failed");
        sql("SELECT * FROM observability.maintain();");
        assertSql("(SELECT sum(count) FROM observability.daily_event) = 5", "rerun doubled counts");
        sql(`INSERT INTO observability.event (occurred_at, received_at, kind, pathname, navigation_type)
            SELECT t, t, 'navigation', '/', 'initial' FROM
            (SELECT (now() AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC' - interval '1 day' AS t) s;
            SELECT * FROM observability.maintain();`);
        assertSql("(SELECT sum(count) FROM observability.daily_event) = 6", "late recent receipt not recomputed");
        sql("SELECT * FROM observability.maintain();");
        assertSql("(SELECT sum(count) FROM observability.daily_event) = 6", "late rerun doubled counts");
        sql("SELECT observability.rollup_complete_day((now() AT TIME ZONE 'UTC')::date - 100);");
        assertSql("(SELECT count FROM observability.daily_event WHERE pathname = '/old') = 1", "pruned aggregate overwritten");
        sql(`INSERT INTO observability.event (kind, pathname, navigation_type) VALUES ('navigation', '/today', 'initial'); SELECT * FROM observability.maintain();`);
        assertSql("NOT EXISTS (SELECT 1 FROM observability.rollup_day WHERE day = (now() AT TIME ZONE 'UTC')::date)", "incomplete UTC day aggregated");
        assertSql("(SELECT count(*) FROM observability.event WHERE pathname = '/today') = 1", "current raw day deleted");
        // Execute the actual dashboard query plans against PostgreSQL, not a
        // mocked database. PREPARE keeps parameters separate from query text.
        const planResult = spawnSync(process.execPath, ["--import", "tsx", "dashboard/script/querySmokePlan.ts"], { windowsHide: true, shell: false, encoding: "utf8" });
        if (planResult.status !== 0) throw new Error("Isolated dashboard query-plan generation failed.");
        const planList: Array<{ range: string; query: Array<[string, SmokeQuery]> }> = JSON.parse(planResult.stdout);
        for (const plan of planList) {
            for (const [name, q] of plan.query) {
                const types = q.parameter.map(() => "text").join(",");
                const parameter = q.parameter.map(value => `'${value.replaceAll("'", "''")}'`).join(",");
                sql(`PREPARE smoke_${name} ${types ? `(${types})` : ""} AS ${q.text}; EXECUTE smoke_${name}${parameter ? `(${parameter})` : ""};`);
            }
        }
        const role = readFileSync(path.resolve("database/observability/dashboard-role.sql"), "utf8");
        sql(`\\set database_name postgres\n${role}`);
        assertSql("has_schema_privilege('observability_dashboard', 'observability', 'USAGE') AND NOT has_schema_privilege('observability_dashboard', 'observability', 'CREATE')", "dashboard schema permissions wrong");
        assertSql("has_table_privilege('observability_dashboard', 'observability.event', 'SELECT') AND NOT has_table_privilege('observability_dashboard', 'observability.event', 'INSERT,UPDATE,DELETE')", "dashboard table permissions wrong");
        assertSql("has_database_privilege('observability_dashboard', 'postgres', 'CONNECT') AND NOT has_database_privilege('observability_dashboard', 'postgres', 'CREATE,TEMPORARY')", "dashboard database permissions wrong");
        assertSql("NOT has_function_privilege('observability_dashboard', 'observability.maintain()', 'EXECUTE')", "dashboard can maintain");
        sql("SET ROLE observability_dashboard; SELECT count(*) FROM observability.daily_event; RESET ROLE;");
        // An injected SQL failure must roll back day replacement, completion
        // tracking AND pruning; no old event can disappear on a partial run.
        sql(`INSERT INTO observability.event (occurred_at, received_at, kind, pathname, metric_name, metric_value)
            SELECT t, t, 'web-vital', '/rollback', 'LCP', 100 FROM (SELECT now() - interval '110 days' AS t) s;
            CREATE FUNCTION observability.fixture_fail_vital() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollup failure'; END; $$;
            CREATE TRIGGER fixture_rollup_failure BEFORE INSERT ON observability.daily_vital FOR EACH ROW EXECUTE FUNCTION observability.fixture_fail_vital();
            DO $$ BEGIN
                BEGIN PERFORM observability.maintain(); RAISE EXCEPTION 'failed rollup unexpectedly succeeded';
                EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'fixture rollup failure' THEN RAISE; END IF; END;
            END $$;`);
        assertSql("(SELECT count(*) FROM observability.event WHERE pathname = '/rollback') = 1", "failed rollup pruned raw data");
        assertSql("NOT EXISTS (SELECT 1 FROM observability.rollup_day WHERE day = ((now() - interval '110 days') AT TIME ZONE 'UTC')::date)", "failed rollup marked complete");
        assertSql("(SELECT sum(count) FROM observability.daily_event) = 6", "failed rollup changed counts");
        sql("DROP TRIGGER fixture_rollup_failure ON observability.daily_vital; DROP FUNCTION observability.fixture_fail_vital();");
        sql(`DO $$ BEGIN
            BEGIN INSERT INTO observability.event (kind, pathname, navigation_type) VALUES ('navigation', '/?private', 'initial'); RAISE EXCEPTION 'unsafe path accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
            BEGIN INSERT INTO observability.event (kind, pathname, navigation_type, device_class) VALUES ('navigation', '/', 'initial', 'phone-model'); RAISE EXCEPTION 'unsafe device accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
            BEGIN PERFORM observability.rollup_complete_day((now() AT TIME ZONE 'UTC')::date); RAISE EXCEPTION 'current day accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Only complete UTC days can be rolled up' THEN RAISE; END IF; END;
            END $$;`);
        passed = true;
    } finally {
        if (created) docker(["rm", "--force", container]); // only this uniquely named container
        writeFileSync(path.join(reportDir, "postgres.log"), log.join("\n"));
        writeFileSync(path.join(reportDir, "summary.json"), JSON.stringify({ runId, passed, container, cleaned: created }, null, 2));
    }
    process.stdout.write("Disposable Postgres schema/rollup/retention smoke passed.\n");
}
smoke().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
