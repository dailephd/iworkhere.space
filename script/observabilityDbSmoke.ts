import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

interface SmokeQuery { text: string; parameter: string[] }

const runId = `observability-db-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const reportDir = path.resolve("test-report", runId);
const container = `iworkhere-observability-${runId.toLowerCase()}`;
const postgresImage = process.env.OBSERVABILITY_POSTGRES_IMAGE?.trim() || "postgres:17";
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
        docker(["run", "--detach", "--name", container, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", postgresImage]);
        created = true;
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            const result = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], { windowsHide: true, shell: false, encoding: "utf8" });
            if (result.status === 0) { ready = true; break; }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!ready) throw new Error("Disposable Postgres did not become ready.");
        const migrationDir = path.resolve("database/observability");
        const migrations = readdirSync(migrationDir).filter(name => /^\d{3}-[a-z0-9-]+\.sql$/.test(name)).sort();
        for (let pass = 0; pass < 2; pass++) for (const name of migrations) sql(readFileSync(path.join(migrationDir, name), "utf8"));
        sql(`INSERT INTO observability.error_diagnostic
            (id, received_at, origin, severity, error_name, message, stack, cause, error_detail, component_stack, pathname, tool_id, boundary, failure_category, fingerprint, client_context, deployment_context)
            SELECT ('00000000-0000-4000-8000-00000000000' || ordinal)::uuid,
                timestamptz '2026-10-03 00:00:00+00' - age * interval '1 day',
                'client', 'error', 'TypeError', 'Resize worker initialization failed', 'TypeError: Resize worker initialization failed\n at resize (app.js:40:2)',
                '{"name":"RangeError","message":"nested worker cause"}'::jsonb,
                '{"name":"TypeError","message":"Resize worker initialization failed","errors":[{"name":"Error","message":"child failure"}]}'::jsonb,
                'at ResizeTool', '/tool/image-resizer', 'image-resizer', 'ToolErrorBoundary', 'tool-render-error', repeat('a', 64),
                '{"userAgent":"FixtureBrowser","online":false}'::jsonb, '{"commitSha":"fixture-commit","environment":"production"}'::jsonb
            FROM (VALUES (1,29), (2,30), (3,31)) fixture(ordinal, age);
            SELECT observability.prune_diagnostics(timestamptz '2026-10-03 00:00:00+00');`);
        assertSql("(SELECT count(*) FROM observability.error_diagnostic) = 2", "diagnostic cutoff count wrong");
        assertSql("EXISTS (SELECT 1 FROM observability.error_diagnostic WHERE id = '00000000-0000-4000-8000-000000000001')", "29-day diagnostic removed");
        assertSql("EXISTS (SELECT 1 FROM observability.error_diagnostic WHERE id = '00000000-0000-4000-8000-000000000002')", "exact 30-day boundary removed");
        assertSql("NOT EXISTS (SELECT 1 FROM observability.error_diagnostic WHERE id = '00000000-0000-4000-8000-000000000003')", "31-day diagnostic retained");
        assertSql("(SELECT bool_and(message = 'Resize worker initialization failed' AND stack LIKE '%app.js:40:2%' AND cause->>'message' = 'nested worker cause' AND error_detail->'errors'->0->>'message' = 'child failure') FROM observability.error_diagnostic)", "diagnostic fields lost");
        assertSql("(SELECT count(*) FROM pg_indexes WHERE schemaname = 'observability' AND tablename = 'error_diagnostic') = 5", "diagnostic indexes missing");
        sql(`SELECT observability.prune_diagnostics(timestamptz '2026-10-03 00:00:00+00');
            DO $$ BEGIN
                BEGIN INSERT INTO observability.error_diagnostic (id, origin, severity, error_name, message, error_detail, pathname, failure_category, fingerprint)
                    VALUES ('00000000-0000-4000-8000-000000000004', 'client', 'error', 'Error', repeat('x',4097), '{}', '/', 'unknown', repeat('a',64));
                    RAISE EXCEPTION 'oversized diagnostic accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
            END $$;`);
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
        assertSql("has_table_privilege('observability_dashboard', 'observability.error_diagnostic', 'SELECT') AND NOT has_table_privilege('observability_dashboard', 'observability.error_diagnostic', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')", "dashboard diagnostic grants wrong");
        assertSql("NOT has_function_privilege('observability_dashboard', 'observability.prune_diagnostics(timestamptz)', 'EXECUTE')", "dashboard can prune diagnostics");
        sql(`SET ROLE observability_dashboard; SELECT id, message, stack, cause FROM observability.error_diagnostic;
            DO $$ BEGIN
                BEGIN UPDATE observability.error_diagnostic SET message = 'unauthorized write'; RAISE EXCEPTION 'dashboard write succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN DELETE FROM observability.error_diagnostic; RAISE EXCEPTION 'dashboard delete succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
            END $$; RESET ROLE;`);
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
        writeFileSync(path.join(reportDir, "summary.json"), JSON.stringify({ runId, passed, container, image: postgresImage, cleaned: created }, null, 2));
    }
    process.stdout.write("Disposable Postgres schema/rollup/retention smoke passed.\n");
}
smoke().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
