# Observability database

One Neon Postgres database serves the public writer and independent read-only
dashboard. Nothing in this directory provisions resources or embeds credentials.

`001-schema.sql` is the idempotent migration. It creates only objects in the
`observability` schema, revokes PUBLIC schema/table/sequence/function access,
and never runs automatically at application startup. Run it explicitly:

```powershell
# Set OBSERVABILITY_DATABASE_URL securely in this process first.
npm run observability:migrate
```

The runner uses Neon parameterized queries in one transaction. Statement-break
comments separate commands without splitting PL/pgSQL bodies. Missing
configuration or connection/privilege failures exit nonzero with safe messages;
the connection string and SQL diagnostics are never printed. Use a development
database first. No production migration was run during implementation.

## Tables and semantics

| Object | Purpose / retention |
| --- | --- |
| `event` | Explicit safe columns only; raw retention is exactly 90 days |
| `daily_event` | Exact non-vital counts by UTC day, kind, path, tool, event, failure, viewport and safe referrer host; indefinite |
| `daily_vital` | Samples and Postgres percentile_cont p50/p75/p95 by UTC day, path, metric and viewport; indefinite |
| `rollup_day` | Successfully completed UTC day and completion timestamp; indefinite |

Missing optional daily grouping values become empty strings. The daily primary
key includes every count dimension, including safe `referrer_host`, so long-range
referrer breakdowns survive raw pruning. `device_class` is one of mobile/tablet/
desktop/unknown. Metric names are LCP/INP/CLS/FCP/TTFB/FID. No hourly table exists.

Raw `occurred_at` and `received_at` both default to database `now()` on the server
insertion, and must be equal. Client timestamps are validated but not stored.
No message, stack, JSON metadata, identity, session, IP, file, image dimensions,
user input, output, URL query/hash or raw referrer URL exists in the schema.

The raw table has the primary-key index and five planned indexes: occurred_at;
(kind, occurred_at); (tool_id, occurred_at); (pathname, occurred_at);
(metric_name, occurred_at). Daily tables and rollup_day use their primary keys.

## Transactional maintenance

`observability.maintain()` acquires a transaction advisory lock, discovers
complete UTC days present in raw events, rolls up uncompleted days, and recomputes
the last three complete days as a safety window. Day replacement deletes the
prior daily rows, inserts fresh counts and percentiles, then upserts rollup_day.
All changes, completion markers and pruning run in the single calling SQL
transaction; any failure rolls them back. Concurrent maintenance serializes.
Old completed days cannot be reconstructed from partially pruned raw samples:
`rollup_complete_day` leaves their retained aggregates intact.

Only then does `prune_raw()` delete events older than `now() - interval '90 days'`
whose UTC day has a rollup_day marker. Unrolled raw days are never eligible.
Rerunning maintenance replaces counts rather than adding to them. Today stays
raw. Client backdating cannot create a late event. The recent-day recomputation
protects against a receipt/insertion transaction crossing a UTC day boundary.

Maintenance runs on the public project's secret-protected route once daily.
Cron timing is approximate. During a missed/pending rollup, long-range counts
reflect completed daily history plus today's raw data; the dashboard explicitly
shows freshness and this limitation. Recent raw queries remain exact.

## Read-only dashboard role

`dashboard-role.sql` is a separate operator-reviewed grant template. It is NOT
run by the migration command. Run it as the Neon administrator in this dedicated
database, supplying `database_name` to psql (or substitute the quoted database
identifier in the Neon SQL editor). Do not paste a password into source control.
Create/reset the role's password securely in Neon after applying grants.

The role `observability_dashboard` is not the database/schema/table owner and
must have no other role memberships or grants. It has CONNECT, schema USAGE,
and table SELECT only. No sequence access, maintenance-function execution,
schema CREATE, INSERT, UPDATE, DELETE, CREATE/DROP/ALTER ownership, or database
CREATE is permitted. The template revokes default PUBLIC TEMPORARY/CREATE in
the dedicated database to prevent inherited write privileges; review that
database-wide restriction before applying it. PostgreSQL 17's public schema
must also retain its default restriction against PUBLIC CREATE. Verify inherited
permissions if connecting to an existing database with customized defaults.
Future table SELECT defaults must be applied by the actual migration owner.

Give only this role's connection secret to the dashboard. The dashboard also
uses read-only repeatable-read transactions, but those do not replace SQL grants.

## Disposable database validation

```powershell
npm run test:observability-db
```

The script creates one uniquely named Postgres 17 Docker container, uses psql
inside it, applies the schema twice, and verifies real SQL counts, percentiles,
idempotence, late-day replacement, old-unrolled retention, rolled-old deletion,
current-day exclusion, historical aggregate preservation, all seven actual
dashboard query plans and read-only grants. It has no host port and uses no Neon
secret. Hidden child processes are used. Cleanup removes only its own container
in finally. Unique reports live at `test-report/observability-db-<RUN_ID>/`.
