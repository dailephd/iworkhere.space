import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const runId = `support-db-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const reportDir = path.resolve("test-report", runId);
const container = `iworkhere-support-${runId.toLowerCase()}`;
const postgresImage = process.env.SUPPORT_POSTGRES_IMAGE?.trim() || "postgres:17";
mkdirSync(reportDir, { recursive: true });
const log: string[] = [];
let created = false;
let passed = false;
let assertionCount = 0;

function docker(args: string[], input?: string): string {
    const result = spawnSync("docker", args, { windowsHide: true, shell: false, encoding: "utf8", input, timeout: 120_000 });
    log.push(`docker ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.status !== 0) throw new Error(`Disposable Postgres command failed: ${(result.stderr ?? "").trim().split("\n").slice(-3).join(" | ")}`);
    return result.stdout;
}
function sql(source: string): string {
    return docker(["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-P", "pager=off", "-At"], source);
}
function value(query: string): string {
    return sql(query).trim();
}
function assertSql(condition: string, label: string): void {
    assertionCount += 1;
    sql(`DO $$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION '${label}'; END IF; END $$;`);
}
function expectError(statement: string, sqlstate: string, label: string): void {
    assertionCount += 1;
    sql(`DO $$ BEGIN BEGIN ${statement}; RAISE EXCEPTION '${label} accepted'; EXCEPTION WHEN SQLSTATE '${sqlstate}' THEN NULL; END; END $$;`);
}
function parallel(statements: string[]): Promise<string[]> {
    return Promise.all(statements.map(statement => new Promise<string>((resolve, reject) => {
        const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { windowsHide: true, shell: false });
        let out = ""; let err = "";
        child.stdout.on("data", chunk => { out += chunk; });
        child.stderr.on("data", chunk => { err += chunk; });
        child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(`parallel psql failed: ${err.trim()}`)));
        child.stdin.end(statement);
    })));
}

const digest = (n: number) => n.toString(16).padStart(64, "0");
const reportId = (n: number) => `SR-${n.toString().padStart(16, "0")}`;
const key = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
function submit(n: number, options: { digestN?: number; consent?: boolean; email?: string | null; limit?: number } = {}): string {
    const email = options.email === undefined ? "NULL" : options.email === null ? "NULL" : `'${options.email}'`;
    return `SELECT outcome || '|' || coalesce(report_id, '') FROM support.submit_report('${reportId(n)}', '${key(n)}', '${digest(options.digestN ?? n)}', 'tool_failure', 'tool', 'merge-pdf', '/tool/merge-pdf', 'description ${n}', NULL, NULL, ${email}, ${options.consent ?? false}, ${options.limit ?? 1000});`;
}

async function smoke(): Promise<void> {
    process.stdout.write(`SUPPORT_DB_RUN_ID: ${runId}\nReport: ${reportDir}\n`);
    try {
        docker(["run", "--detach", "--name", container, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", postgresImage]);
        created = true;
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            const result = spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { windowsHide: true, shell: false, encoding: "utf8" });
            if (result.status === 0) { ready = true; break; }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!ready) throw new Error("Disposable Postgres did not become ready.");
        // The observability schema and role are provisioned first to prove the two domains stay independent.
        const observabilityDir = path.resolve("database/observability");
        for (const name of readdirSync(observabilityDir).filter(n => /^\d{3}-[a-z0-9-]+\.sql$/.test(n)).sort()) sql(readFileSync(path.join(observabilityDir, name), "utf8"));
        sql(`\\set database_name postgres\n${readFileSync(path.join(observabilityDir, "dashboard-role.sql"), "utf8")}`);
        const supportDir = path.resolve("database/support");
        const migrations = readdirSync(supportDir).filter(n => /^\d{3}-[a-z0-9-]+\.sql$/.test(n)).sort();
        for (let pass = 0; pass < 2; pass++) for (const name of migrations) sql(readFileSync(path.join(supportDir, name), "utf8"));
        sql(`\\set database_name postgres\n${readFileSync(path.join(supportDir, "roles.sql"), "utf8")}`);
        sql(`\\set database_name postgres\n${readFileSync(path.join(supportDir, "roles.sql"), "utf8")}`);

        // Atomic intake, idempotent replay and conflict.
        assertSql(`(SELECT outcome FROM support.submit_report('${reportId(1)}', '${key(1)}', '${digest(1)}', 'tool_failure', 'tool', 'merge-pdf', '/tool/merge-pdf', 'description 1', NULL, NULL, NULL, false, 1000)) = 'created'`, "first submission not created");
        assertSql(`(SELECT count(*) FROM support.report) = 1 AND (SELECT count(*) FROM support.outbox_job WHERE report_id = '${reportId(1)}') = 2`, "report without exactly two jobs");
        assertSql(`(SELECT array_agg(kind ORDER BY kind) FROM support.outbox_job) = ARRAY['github_issue','operator_email']`, "wrong default job kinds");
        assertSql(`(SELECT outcome || report_id FROM support.submit_report('SR-ZZZZZZZZZZZZZZZZ', '${key(1)}', '${digest(1)}', 'tool_failure', 'tool', 'merge-pdf', '/tool/merge-pdf', 'description 1', NULL, NULL, NULL, false, 1000)) = 'replayed${reportId(1)}'`, "replay did not return original receipt");
        assertSql(`(SELECT outcome FROM support.submit_report('SR-ZZZZZZZZZZZZZZZZ', '${key(1)}', '${digest(99)}', 'tool_failure', 'tool', 'merge-pdf', '/tool/merge-pdf', 'different', NULL, NULL, NULL, false, 1000)) = 'conflict'`, "different payload with same key not a conflict");
        assertSql(`(SELECT count(*) FROM support.report) = 1 AND (SELECT count(*) FROM support.outbox_job) = 2`, "replay or conflict inserted rows");
        // Consent and email: email is stored only with consent and only then creates a receipt job.
        sql(submit(2, { consent: false, email: "visitor@example.com" }));
        assertSql(`(SELECT contact_email IS NULL AND NOT contact_consent FROM support.report WHERE id = '${reportId(2)}') AND (SELECT count(*) FROM support.outbox_job WHERE report_id = '${reportId(2)}') = 2`, "email stored or receipt queued without consent");
        sql(submit(3, { consent: true, email: "visitor@example.com" }));
        assertSql(`(SELECT contact_email = 'visitor@example.com' FROM support.report WHERE id = '${reportId(3)}') AND (SELECT count(*) FROM support.outbox_job WHERE report_id = '${reportId(3)}' AND kind = 'contact_receipt') = 1`, "consented receipt job missing");

        // Database constraints protect against any writer.
        const row = (overrides: Record<string, string>) => {
            const columns: Record<string, string> = { id: `'${reportId(500)}'`, idempotency_key: `'${key(500)}'`, payload_digest: `'${digest(500)}'`, schema_version: "1", category: "'other'", area: "'site-wide'", pathname: "'/'", description: "'ok'", contact_consent: "false", ...overrides };
            return `INSERT INTO support.report (${Object.keys(columns).join(",")}) VALUES (${Object.values(columns).join(",")})`;
        };
        expectError(row({ category: "'spam'" }), "23514", "invalid category");
        expectError(row({ pathname: "'/tool/x?secret=1'" }), "23514", "query pathname");
        expectError(row({ pathname: "'//evil'" }), "23514", "protocol-relative pathname");
        expectError(row({ description: "repeat('x', 2001)" }), "23514", "oversize description");
        expectError(row({ id: "'SR-bad'" }), "23514", "malformed id");
        expectError(row({ contact_consent: "true" }), "23514", "consent without email");
        expectError(row({ contact_email: "'a@b.co'", contact_consent: "false" }), "23514", "email without consent");
        expectError(row({ area: "'tool'" }), "23514", "tool area without tool id");
        expectError(row({ tracker_issue_url: "'http://example.com/x'" }), "23514", "non-github tracker url");
        expectError(`INSERT INTO support.outbox_job (report_id, kind) VALUES ('${reportId(1)}', 'github_issue')`, "23505", "duplicate job per kind");

        // A failed transaction leaves no report: a trigger fails the outbox insert.
        sql(`CREATE FUNCTION support.fixture_fail_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture outbox failure'; END; $$;
            CREATE TRIGGER fixture_outbox_failure BEFORE INSERT ON support.outbox_job FOR EACH ROW EXECUTE FUNCTION support.fixture_fail_job();
            DO $$ BEGIN
                BEGIN PERFORM support.submit_report('${reportId(40)}', '${key(40)}', '${digest(40)}', 'other', 'site-wide', NULL, '/', 'rollback me', NULL, NULL, NULL, false, 1000);
                    RAISE EXCEPTION 'failing submission unexpectedly succeeded';
                EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'fixture outbox failure' THEN RAISE; END IF; END;
            END $$;
            DROP TRIGGER fixture_outbox_failure ON support.outbox_job; DROP FUNCTION support.fixture_fail_job();`);
        assertSql(`NOT EXISTS (SELECT 1 FROM support.report WHERE id = '${reportId(40)}' OR idempotency_key = '${key(40)}')`, "failed transaction left a report");

        // Global ceiling returns rate_limited without inserting, while replays still succeed.
        assertSql(`(SELECT outcome FROM support.submit_report('${reportId(50)}', '${key(50)}', '${digest(50)}', 'other', 'site-wide', NULL, '/', 'limited', NULL, NULL, NULL, false, (SELECT count(*)::int FROM support.report))) = 'rate_limited'`, "ceiling not enforced");
        assertSql(`NOT EXISTS (SELECT 1 FROM support.report WHERE id = '${reportId(50)}')`, "rate-limited submission inserted");
        assertSql(`(SELECT outcome FROM support.submit_report('x', '${key(1)}', '${digest(1)}', 'other', 'site-wide', NULL, '/', 'x', NULL, NULL, NULL, false, 0)) = 'replayed'`, "replay blocked by ceiling");

        // Concurrent duplicates: one report and one job per kind, every caller sees the same id.
        const concurrentOutcomes = await parallel(Array.from({ length: 8 }, () => submit(60)));
        const outcomeSet = concurrentOutcomes.map(outcome => outcome.split("|")[0]);
        if (outcomeSet.filter(o => o === "created").length !== 1 || outcomeSet.filter(o => o === "replayed").length !== 7) throw new Error(`Concurrent duplicate outcomes wrong: ${outcomeSet.join(",")}`);
        assertSql(`(SELECT count(*) FROM support.report WHERE idempotency_key = '${key(60)}') = 1 AND (SELECT count(*) FROM support.outbox_job WHERE report_id = '${reportId(60)}') = 2`, "concurrent duplicates created extra rows");
        const distinct = await parallel(Array.from({ length: 6 }, (_, i) => submit(70 + i)));
        if (new Set(distinct.map(o => o.split("|")[1])).size !== 6) throw new Error("Different concurrent submissions shared a report id");

        // Queue: claim, concurrency, payload, completion, retry/backoff, dead letter, lease recovery.
        sql("TRUNCATE support.report CASCADE");
        for (let n = 80; n <= 85; n++) sql(submit(n));
        const claims = await parallel([
            "SELECT job_id FROM support.claim_jobs(6);",
            "SELECT job_id FROM support.claim_jobs(6);",
        ]);
        const claimed = claims.map(output => output.split("\n").filter(Boolean));
        if (claimed[0].length !== 6 || claimed[1].length !== 6 || new Set(claimed.flat()).size !== 12) throw new Error("Concurrent claims overlapped or lost jobs");
        assertSql("(SELECT count(*) FROM support.outbox_job WHERE status = 'leased' AND attempt_count = 1 AND lease_until > now()) = 12", "claim did not lease all jobs");
        assertSql("(SELECT count(*) FROM support.claim_jobs(10)) = 0", "leased jobs were claimable");
        const lease = (report: number, kind: string) => value(`SELECT id || ' ' || lease_token FROM support.outbox_job WHERE report_id = '${reportId(report)}' AND kind = '${kind}'`).split(" ");
        const [githubJob, githubToken] = lease(80, "github_issue");
        assertSql(`(SELECT count(*) FROM support.job_payload('${githubJob}', gen_random_uuid())) = 0`, "stale token read a payload");
        assertSql(`(SELECT report_id = '${reportId(80)}' AND kind = 'github_issue' AND category = 'tool_failure' AND tool_id = 'merge-pdf' AND contact_email IS NULL FROM support.job_payload('${githubJob}', '${githubToken}'))`, "github payload wrong");
        assertSql(`support.complete_job('${githubJob}', '${githubToken}', 'issue:7', 7, 'https://github.com/owner/private-support/issues/7')`, "completion rejected");
        assertSql(`NOT support.complete_job('${githubJob}', '${githubToken}')`, "completion repeated");
        assertSql(`(SELECT tracker_issue_number = 7 AND tracker_issue_url LIKE '%/issues/7' FROM support.report WHERE id = '${reportId(80)}')`, "tracker not recorded");
        const [emailJob, emailToken] = lease(80, "operator_email");
        assertSql(`support.fail_job('${emailJob}', '${emailToken}', 'timeout') = 'pending'`, "retryable failure not pending");
        assertSql(`(SELECT status = 'pending' AND failure_code = 'timeout' AND round(extract(epoch FROM next_attempt_at - now()) / 60) = 2 AND lease_token IS NULL FROM support.outbox_job WHERE id = '${emailJob}')`, "first backoff wrong");
        assertSql(`(SELECT status = 'delivered' FROM support.outbox_job WHERE id = '${githubJob}')`, "provider failure affected sibling job");
        // Backoff 2, 4, 8, 16, 30 minutes and dead letter after the sixth attempt.
        const delays = [2, 4, 8, 16, 30];
        for (let attempt = 2; attempt <= 6; attempt++) {
            sql(`UPDATE support.outbox_job SET next_attempt_at = now() WHERE id = '${emailJob}'`);
            assertSql(`(SELECT count(*) FROM support.claim_jobs(1) WHERE job_id = '${emailJob}' AND attempt_count = ${attempt}) = 1`, `claim ${attempt} failed`);
            const token = value(`SELECT lease_token FROM support.outbox_job WHERE id = '${emailJob}'`);
            if (attempt < 6) {
                assertSql(`support.fail_job('${emailJob}', '${token}', 'http_5xx') = 'pending'`, `attempt ${attempt} not retried`);
                assertSql(`round(extract(epoch FROM (SELECT next_attempt_at FROM support.outbox_job WHERE id = '${emailJob}') - now()) / 60) = ${delays[attempt - 1]}`, `backoff ${attempt} wrong`);
            } else {
                assertSql(`support.fail_job('${emailJob}', '${token}', 'http_5xx') = 'dead'`, "sixth failure not dead");
            }
        }
        assertSql(`(SELECT status = 'dead' AND attempt_count = 6 AND failure_code = 'http_5xx' FROM support.outbox_job WHERE id = '${emailJob}')`, "dead letter state wrong");
        assertSql(`(SELECT count(*) FROM support.claim_jobs(10) WHERE job_id = '${emailJob}') = 0`, "dead job claimed");
        // Non-retryable failure goes straight to dead.
        const [directJob, directToken] = lease(81, "github_issue");
        assertSql(`support.fail_job('${directJob}', '${directToken}', 'auth', false) = 'dead'`, "non-retryable not dead");
        // Expired lease is recoverable; an expired sixth attempt becomes dead.
        const [expiredJob] = lease(82, "github_issue");
        sql(`UPDATE support.outbox_job SET lease_until = now() - interval '1 minute' WHERE id = '${expiredJob}'`);
        assertSql(`(SELECT count(*) FROM support.claim_jobs(10) WHERE job_id = '${expiredJob}' AND attempt_count = 2) = 1`, "expired lease not recovered");
        sql(`UPDATE support.outbox_job SET attempt_count = 6, lease_until = now() - interval '1 minute' WHERE id = '${expiredJob}'`);
        sql("SELECT count(*) FROM support.claim_jobs(10)");
        assertSql(`(SELECT status = 'dead' AND failure_code = 'lease_expired' FROM support.outbox_job WHERE id = '${expiredJob}')`, "expired sixth attempt not dead");
        // Contact receipt releases the address only to its lease holder and records correspondence.
        sql(submit(90, { consent: true, email: "reader@example.com" }));
        sql("SELECT count(*) FROM support.claim_jobs(50)");
        const [receiptJob, receiptToken] = lease(90, "contact_receipt");
        const [operatorJob, operatorToken] = lease(90, "operator_email");
        assertSql(`(SELECT contact_email = 'reader@example.com' FROM support.job_payload('${receiptJob}', '${receiptToken}'))`, "receipt payload lacks recipient");
        assertSql(`(SELECT contact_email IS NULL FROM support.job_payload('${operatorJob}', '${operatorToken}'))`, "operator payload leaked the contact address");
        assertSql(`support.complete_job('${receiptJob}', '${receiptToken}', 'email:abc')`, "receipt completion rejected");
        assertSql(`(SELECT last_correspondence_at IS NOT NULL FROM support.report WHERE id = '${reportId(90)}')`, "correspondence not recorded");

        // Dashboard views expose the contact address only for consented reports and compute health.
        assertSql(`(SELECT contact_email = 'reader@example.com' FROM support.dashboard_report WHERE id = '${reportId(90)}') AND (SELECT contact_email IS NULL FROM support.dashboard_report WHERE id = '${reportId(80)}')`, "dashboard contact projection wrong");
        assertSql("(SELECT dead_count >= 3 AND oldest_pending_at IS NOT NULL AND failing_count >= 1 FROM support.dashboard_health)", "dashboard health wrong");

        // Retention: narrative after 180 days, contact after 90 days without correspondence, authorized deletion.
        sql(submit(91, { consent: true, email: "old@example.com" })); sql(submit(92)); sql(submit(93, { consent: true, email: "recent@example.com" })); sql(submit(94, { consent: true, email: "talked@example.com" }));
        sql(`UPDATE support.report SET received_at = now() - interval '181 days' WHERE id = '${reportId(91)}';
            UPDATE support.report SET received_at = now() - interval '179 days' WHERE id = '${reportId(92)}';
            UPDATE support.report SET received_at = now() - interval '89 days' WHERE id = '${reportId(93)}';
            UPDATE support.report SET received_at = now() - interval '200 days', last_correspondence_at = now() - interval '10 days' WHERE id = '${reportId(94)}';`);
        assertSql("(SELECT narrative_purged = 2 AND contact_purged = 1 FROM support.purge_expired())", "purge counts wrong");
        assertSql(`(SELECT description IS NULL AND contact_email IS NULL AND narrative_purged_at IS NOT NULL AND contact_purged_at IS NOT NULL FROM support.report WHERE id = '${reportId(91)}')`, "181-day report not purged");
        assertSql(`(SELECT description IS NOT NULL AND narrative_purged_at IS NULL FROM support.report WHERE id = '${reportId(92)}')`, "179-day narrative purged");
        assertSql(`(SELECT contact_email = 'recent@example.com' FROM support.report WHERE id = '${reportId(93)}')`, "89-day contact purged");
        assertSql(`(SELECT description IS NULL AND contact_email = 'talked@example.com' FROM support.report WHERE id = '${reportId(94)}')`, "recent correspondence did not retain contact");
        assertSql(`(SELECT status = 'dead' AND failure_code = 'contact_purged' FROM support.outbox_job WHERE report_id = '${reportId(91)}' AND kind = 'contact_receipt')`, "receipt job survived contact purge");
        assertSql("(SELECT narrative_purged = 0 AND contact_purged = 0 FROM support.purge_expired())", "purge not idempotent");
        assertSql(`support.delete_report('${reportId(92)}') AND NOT support.delete_report('${reportId(92)}')`, "authorized deletion wrong");
        assertSql(`NOT EXISTS (SELECT 1 FROM support.report WHERE id = '${reportId(92)}') AND NOT EXISTS (SELECT 1 FROM support.outbox_job WHERE report_id = '${reportId(92)}')`, "deletion left rows");

        // Least privilege between support roles and against the observability domain.
        const submitSignature = "support.submit_report(text, uuid, text, text, text, text, text, text, text, text, text, boolean, integer, interval)";
        assertSql("has_database_privilege('support_dashboard', 'postgres', 'CONNECT') AND NOT has_database_privilege('support_dashboard', 'postgres', 'CREATE,TEMPORARY')", "support database permissions wrong");
        assertSql("has_schema_privilege('support_dashboard', 'support', 'USAGE') AND NOT has_schema_privilege('support_dashboard', 'support', 'CREATE')", "dashboard schema permissions wrong");
        assertSql("has_table_privilege('support_dashboard', 'support.dashboard_report', 'SELECT') AND has_table_privilege('support_dashboard', 'support.dashboard_job', 'SELECT') AND has_table_privilege('support_dashboard', 'support.dashboard_health', 'SELECT')", "dashboard cannot read views");
        assertSql("NOT has_table_privilege('support_dashboard', 'support.report', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AND NOT has_table_privilege('support_dashboard', 'support.outbox_job', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')", "dashboard reaches tables");
        assertSql("NOT has_table_privilege('support_dashboard', 'support.dashboard_report', 'INSERT,UPDATE,DELETE,TRUNCATE')", "dashboard can write views");
        assertSql(`NOT has_function_privilege('support_dashboard', '${submitSignature}', 'EXECUTE') AND NOT has_function_privilege('support_dashboard', 'support.claim_jobs(integer, interval)', 'EXECUTE') AND NOT has_function_privilege('support_dashboard', 'support.purge_expired(timestamptz, integer, integer)', 'EXECUTE') AND NOT has_function_privilege('support_dashboard', 'support.delete_report(text)', 'EXECUTE')`, "dashboard can execute support functions");
        assertSql(`has_function_privilege('support_writer', '${submitSignature}', 'EXECUTE') AND NOT has_function_privilege('support_writer', 'support.claim_jobs(integer, interval)', 'EXECUTE') AND NOT has_function_privilege('support_writer', 'support.job_payload(uuid, uuid)', 'EXECUTE') AND NOT has_function_privilege('support_writer', 'support.purge_expired(timestamptz, integer, integer)', 'EXECUTE') AND NOT has_function_privilege('support_writer', 'support.delete_report(text)', 'EXECUTE')`, "writer privileges wrong");
        assertSql("NOT has_table_privilege('support_writer', 'support.report', 'SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('support_writer', 'support.dashboard_report', 'SELECT')", "writer reads support data");
        assertSql(`has_function_privilege('support_worker', 'support.claim_jobs(integer, interval)', 'EXECUTE') AND has_function_privilege('support_worker', 'support.job_payload(uuid, uuid)', 'EXECUTE') AND has_function_privilege('support_worker', 'support.complete_job(uuid, uuid, text, integer, text)', 'EXECUTE') AND has_function_privilege('support_worker', 'support.fail_job(uuid, uuid, text, boolean, integer)', 'EXECUTE') AND NOT has_function_privilege('support_worker', '${submitSignature}', 'EXECUTE')`, "worker privileges wrong");
        assertSql("NOT has_table_privilege('support_worker', 'support.report', 'SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('support_worker', 'support.outbox_job', 'SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('support_worker', 'support.dashboard_report', 'SELECT')", "worker reaches tables");
        assertSql("NOT has_schema_privilege('observability_dashboard', 'support', 'USAGE') AND NOT has_table_privilege('observability_dashboard', 'support.dashboard_report', 'SELECT')", "observability dashboard reaches support");
        assertSql("NOT has_schema_privilege('support_writer', 'observability', 'USAGE') AND NOT has_schema_privilege('support_worker', 'observability', 'USAGE') AND NOT has_schema_privilege('support_dashboard', 'observability', 'USAGE')", "support roles reach observability");
        sql(`SET ROLE support_dashboard; SELECT count(*) FROM support.dashboard_report; SELECT count(*) FROM support.dashboard_job; SELECT * FROM support.dashboard_health;
            DO $$ BEGIN
                BEGIN INSERT INTO support.report (id) VALUES ('x'); RAISE EXCEPTION 'dashboard insert succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN PERFORM count(*) FROM support.report; RAISE EXCEPTION 'dashboard read the report table'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN PERFORM * FROM support.claim_jobs(1); RAISE EXCEPTION 'dashboard claimed jobs'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN DELETE FROM support.dashboard_report; RAISE EXCEPTION 'dashboard deleted through a view'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
            END $$; RESET ROLE;`);
        sql(`SET ROLE support_writer;
            SELECT outcome FROM support.submit_report('${reportId(95)}', '${key(95)}', '${digest(95)}', 'other', 'site-wide', NULL, '/', 'via writer role', NULL, NULL, NULL, false, 1000);
            DO $$ BEGIN
                BEGIN PERFORM count(*) FROM support.report; RAISE EXCEPTION 'writer read reports'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN PERFORM * FROM support.claim_jobs(1); RAISE EXCEPTION 'writer claimed jobs'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN PERFORM * FROM support.dashboard_report; RAISE EXCEPTION 'writer read the dashboard view'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
            END $$; RESET ROLE;`);
        sql(`SET ROLE support_worker; SELECT count(*) FROM support.claim_jobs(1);
            DO $$ BEGIN
                BEGIN PERFORM count(*) FROM support.outbox_job; RAISE EXCEPTION 'worker read jobs'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
                BEGIN PERFORM * FROM support.submit_report('x', gen_random_uuid(), repeat('a', 64), 'other', 'site-wide', NULL, '/', 'x', NULL, NULL, NULL, false, 1); RAISE EXCEPTION 'worker submitted a report'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
            END $$; RESET ROLE;`);
        sql(`SET ROLE observability_dashboard;
            DO $$ BEGIN
                BEGIN PERFORM count(*) FROM support.dashboard_report; RAISE EXCEPTION 'observability dashboard read support'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
            END $$; RESET ROLE;`);
        // Execute the actual dashboard support query plans against PostgreSQL as the SELECT-only role.
        const planResult = spawnSync(process.execPath, ["--import", "tsx", "dashboard/script/supportQuerySmokePlan.ts"], { windowsHide: true, shell: false, encoding: "utf8" });
        if (planResult.status !== 0) throw new Error("Isolated dashboard support query-plan generation failed.");
        const planList: Array<[string, { text: string; parameter: string[] }]> = JSON.parse(planResult.stdout);
        for (const [name, query] of planList) {
            const types = query.parameter.map(() => "text").join(",");
            const parameter = query.parameter.map(item => `'${item.replaceAll("'", "''")}'`).join(",");
            sql(`SET ROLE support_dashboard; PREPARE smoke_${name} ${types ? `(${types})` : ""} AS ${query.text}; EXECUTE smoke_${name}${parameter ? `(${parameter})` : ""}; RESET ROLE;`);
            assertionCount += 1;
        }
        assertSql(`(SELECT count(*) FROM support.dashboard_report WHERE id = '${reportId(80)}') = 1 AND (SELECT count(*) FROM support.dashboard_job WHERE report_id = '${reportId(80)}') = 2`, "dashboard views do not expose the seeded report and jobs");
        passed = true;
    } finally {
        if (created) docker(["rm", "--force", container]);
        writeFileSync(path.join(reportDir, "postgres.log"), log.join("\n"));
        writeFileSync(path.join(reportDir, "summary.json"), JSON.stringify({ runId, passed, container, image: postgresImage, assertionCount, cleaned: created }, null, 2));
    }
}
smoke().then(() => process.stdout.write(`Disposable Postgres support schema smoke passed (${assertionCount} assertions).\n`)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
