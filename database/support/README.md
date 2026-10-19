# Support database

Status: implemented in the uncommitted v0.4.2 feature worktree (unreleased). Nothing here provisions resources, embeds credentials, runs automatically at
application startup, or has been applied to any production database.

`database/support/` owns the persistent store for anonymous user reports and their private delivery queue. It is independent of
`database/observability/`: no observability table, migration, role or function is read or changed, and the observability writer
and observability dashboard roles receive no support privilege. Support report text and contact details never enter
`/api/log`, `/api/metric`, Vercel Web Analytics, the diagnostic tables or any telemetry owner.

## Files

| File | Purpose |
| --- | --- |
| `001-schema.sql` | Idempotent schema `support`: tables `report` and `outbox_job`, the atomic and queue functions, and the dashboard views. Additive follow-ups use the next number (`002-…`). |
| `roles.sql` | Least-privilege role and grant template. Run with `psql -v database_name=<database> -f roles.sql` as the schema owner. Contains no passwords. |

Apply the schema explicitly, with a schema-owner credential that is not used by the application:

```powershell
# Set SUPPORT_MIGRATION_DATABASE_URL securely in this process first.
npm run support:migrate
```

The runner executes each numbered file in one Neon transaction, splitting on `-- statement-break` so PL/pgSQL bodies stay intact.
Missing configuration or connection/privilege failures exit nonzero with safe messages. Use a development database first.

## Roles and credentials (all server-only)

| Role | Environment variable | Privileges |
| --- | --- | --- |
| schema owner | `SUPPORT_MIGRATION_DATABASE_URL` | Runs migrations only; never deployed with the application. |
| `support_writer` | `SUPPORT_DATABASE_URL` | `EXECUTE support.submit_report(...)` only. Cannot read any support data. |
| `support_worker` | `SUPPORT_WORKER_DATABASE_URL` | `EXECUTE` the queue functions (`claim_jobs`, `job_payload`, `complete_job`, `fail_job`), `purge_expired` and `delete_report`. No table access. |
| `support_dashboard` | `SUPPORT_DASHBOARD_DATABASE_URL` | `SELECT` on the three `dashboard_*` views only. Cannot write, execute functions or read the tables. |

The functions are `SECURITY DEFINER` with a fixed `search_path`; `PUBLIC` has no schema usage and no function execute. After running
`roles.sql`, set each role password in Neon and store the connection strings as server-only environment variables. Never reuse
`OBSERVABILITY_DATABASE_URL` or `OBSERVABILITY_DASHBOARD_DATABASE_URL`, and never put a support credential in a `NEXT_PUBLIC_` variable.

## Submission and idempotency contract

`support.submit_report(...)` is one statement-level transaction. It returns `created`, `replayed`, `conflict` or `rate_limited`:

1. A report with the same `idempotency_key` returns the original receipt (`replayed`) when the SHA-256 payload digest matches and
   `conflict` when it does not. A unique constraint, not client convention, enforces this, including for concurrent duplicates.
2. A global, IP-free intake ceiling (default 120 reports per 10 minutes, `SUPPORT_GLOBAL_LIMIT`) returns `rate_limited` without inserting.
   Replays are never blocked by the ceiling. This is an application backstop, not per-client rate limiting; see Deployment.
3. Otherwise the report and its independent outbox jobs (`github_issue`, `operator_email`, and `contact_receipt` only when consent
   and an address are present) are inserted atomically. A failure rolls back both. Provider calls never happen inside the transaction.

Database constraints bound every field regardless of the writer: categories, pathname shape (no query, hash or `//`), 2,000/1,000/1,000
character text limits, 254-character email, report id format `SR-` + 16 Crockford base32 characters, and `contact_email IS NULL OR
contact_consent`. An email supplied without consent is discarded by the application and never stored.

## Delivery and retry semantics

`support_worker` drains the queue through `GET|POST /api/support/deliver` (Bearer `CRON_SECRET`):

- `claim_jobs` uses `FOR UPDATE SKIP LOCKED` and a 5-minute lease, so concurrent workers never process the same job and an
  abandoned lease is recovered by the next claim (a sixth expired attempt becomes `dead`).
- Failures use bounded exponential backoff of 2, 4, 8, 16 and then 30 minutes; the sixth failed attempt (or a non-retryable failure)
  becomes `dead`. Reports are never deleted because a provider fails.
- Statuses: `pending`, `leased`, `delivered`, `dead`. `failure_code` is a short safe code (`timeout`, `network`, `http_4xx`,
  `http_5xx`, `rate_limited`, `auth`, `not_private`, `misconfigured`, `unknown`, `payload_missing`, `lease_expired`,
  `contact_purged`). Provider response bodies are never stored.
- GitHub reconciliation: before creating, the worker lists the private repository's issues since the report time and looks for the
  opaque marker `<!-- support-report:SR-… -->`, so a retry after a timeout never opens a second issue. The adapter refuses a
  repository that is public or equals the public application repository.
- A `dead` job can be re-queued by an operator with schema-owner access: `UPDATE support.outbox_job SET status = 'pending',
  attempt_count = 0, next_attempt_at = now(), failure_code = NULL WHERE id = '<job>' AND status = 'dead'`.

## Privacy boundaries

The database is the only place the narrative and contact address are stored. The private GitHub issue contains the report id,
category, tool or area, route, receipt time and a dashboard link. The operator email contains the report id, category and link. The
contact receipt contains the id and generic text and goes only to the consenting contact. `job_payload` releases the contact
address only for a `contact_receipt` job to its current lease holder. Provider tokens, Turnstile tokens and request bodies are never
logged; failures log only `{ source: "support-operation", operation, code }`.

## Retention (production activation blocker)

Targets from the approved plan are narrative text removed 180 days after receipt and the contact address removed no later than 90 days
after the last correspondence (or receipt when none). `support.purge_expired()` implements this and is idempotent, and
`support.delete_report(id)` deletes one report and its jobs for authorized deletion. The worker calls `purge_expired` **only when
`SUPPORT_RETENTION_ENABLED=true`**, which defaults off. Do not enable it until the privacy/legal review has finalized the periods,
the disclosure wording on `/privacy` and a channel for deletion requests. Until then, retention is a pending approval, not an active purge.

## Operational diagnostics

The protected dashboard (`/support`) shows undelivered, retrying, failing and dead-lettered counts and the oldest pending age. From
a schema-owner session: `SELECT status, count(*), min(created_at) FROM support.outbox_job GROUP BY status;`.

## Verification

`npm run test:support-db` starts a uniquely named disposable PostgreSQL container, applies the observability and support
migrations twice, and asserts idempotency, atomic rollback, concurrency, claiming and recovery, backoff and dead-lettering,
retention, constraints, role privileges (including real `SET ROLE` write denial) and the dashboard's actual query plans. It writes
`test-report/support-db-<id>/` and never touches a real database.
