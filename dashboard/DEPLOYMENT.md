# Later deployment setup — two separate Vercel projects

This guide prepares external actions after implementation review and commit.
No database/project/domain, production secret or deployment was created by the
implementation task. Do not expose the dashboard until protection is verified.

## Neon — one shared observability database

In **Vercel Marketplace → Neon → create/connect Postgres resource**, create or
connect ONE observability database. Use the same database for public writes and
dashboard reads, not independent inconsistent databases.

Connect the writer credential to the existing public project. Use its
schema-owner credential in an explicitly configured operator environment and,
from the repository root, run `npm run observability:migrate` after code review.
This is not a startup hook.
Apply the separately reviewed
[`dashboard-role.sql`](../database/observability/dashboard-role.sql) template as
administrator, set its password securely in Neon, and verify that
`observability_dashboard` has only CONNECT, USAGE on observability and SELECT
on its tables. It must own no objects and have no write/DDL privileges or inherited
role memberships. See the database README for default PUBLIC privileges.

## Public project — existing application

| Setting | Value |
| --- | --- |
| Domain | `iworkhere.space` |
| Root Directory | Repository root |
| Access | Public, including production custom domain |

Configure production environment variables:

```text
NEXT_PUBLIC_OBSERVABILITY_ENABLED=true
OBSERVABILITY_PERSISTENCE_ENABLED=true
OBSERVABILITY_DATABASE_URL=<writer Secret>
CRON_SECRET=<strong Secret>
```

The database URL and cron secret are server-only secrets. Never prefix them
with NEXT_PUBLIC. Rebuild for the browser telemetry flag. Defaults, previews,
public E2E and container validation keep telemetry/persistence disabled and
must never write to production Neon.

The root `vercel.json` schedules `/api/observability/maintenance` once daily
with `15 2 * * *` (UTC). Vercel supplies `Authorization: Bearer <CRON_SECRET>`.
The endpoint returns 401 for missing/invalid authorization, 204 on success,
and a safe 503 on persistence/configuration failure. Cron can run later than
02:15 UTC; minute-level precision is unnecessary. Monitor safe operational logs
and the dashboard's completed-day freshness. Cron belongs ONLY to this public
project, never the protected dashboard project. Consider Vercel Firewall for
infrastructure abuse/rate limiting if required. Origin/Sec-Fetch checks are
browser defense in depth, not cryptographic authentication; no IP is collected
by application code.

## Dashboard project — second project from the SAME GitHub repository

Create the second Vercel project with:

```text
Project name: iworkhere-observability
Root Directory: dashboard
Framework: Next.js
Node: 24.x
Custom domain: dashboard.iworkhere.space
OBSERVABILITY_DASHBOARD_DATABASE_URL=<read-only Secret>
```

Use its independent package-lock. The root application never builds/serves this
app, and the public Docker image does not include it. No production database
configuration is needed at build time; it is required when pages are requested.
The dashboard can be installed and built from its root without the repository
root `node_modules`. It uses plain CSS and its own local PostCSS boundary; it
does not inherit the public application's Tailwind tooling.

Before treating the dashboard as private, configure exactly:

```text
Vercel Project: iworkhere-observability
→ Security
→ Deployment Protection
→ Vercel Authentication
→ All Deployments
```

**Mandatory:** enable All Deployments ONLY on `iworkhere-observability`,
not the public `iworkhere.space` project. Anonymous visitors must still reach
the public application's production domain. Verify unauthenticated requests to
the dashboard custom domain AND generated deployment URLs are intercepted by
Vercel Authentication. Standard Protection alone must not be treated as private
production protection. Verify intended operator access with a Vercel account.
The application itself has zero authentication dependencies/login/session code.

Then add/verify `dashboard.iworkhere.space` in the dashboard project's Domains
settings and apply only the DNS records Vercel specifies. No domain/DNS change
is part of the implementation. Deploy the two projects separately after review,
protect the dashboard, and verify the public site remains anonymously reachable.

## Local development

```powershell
cd dashboard
npm ci
npm run dev
```

Uses port 3001. Choose a dedicated development database and read-only connection.
Production protection is provided outside the app; local development has no
application login. Never assume local availability implies production privacy.

Official operator references: [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver),
[Vercel Deployment Protection](https://vercel.com/docs/deployment-protection),
[Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication),
[Vercel Cron security and timing](https://vercel.com/docs/cron-jobs/manage-cron-jobs).


## Diagnostic hotfix

Diagnostic rollout order: validate locally; commit/push isolated hotfix; apply additive 002 to existing Neon; reapply/verify read-only grants; deploy protected dashboard; deploy public hotfix; send exactly one synthetic diagnostic through /api/log; verify same UUID in runtime log/Neon/protected dashboard. Never deploy Delivery 2. dashboard.iworkhere.space remains intended custom domain; pending DNS can be recorded separately while protected generated URL proves diagnostics.

Git-integrated deployments supply Vercel Git system context. For an exact-SHA CLI upload, explicitly supply the non-secret candidate SHA with both `--env VERCEL_GIT_COMMIT_SHA=<tested-SHA>` and `--build-env VERCEL_GIT_COMMIT_SHA=<tested-SHA>`, plus source metadata. Metadata alone did not populate the runtime variable during this hotfix. Do not pin a stale commit at project scope. Verify the diagnostic's deployment.commitSha, not only the deployment API metadata. No server-only variable is exposed to browser code.

The 2026-10-03 rollout is complete. `dashboard.iworkhere.space` resolves to Vercel's unchanged required CNAME and serves the protected dashboard; anonymous access redirects to authentication. An operator automation-bypass credential remains in Vercel's secret manager for verification, with All Deployments authentication intact. The initial smoke found missing runtime Git context; the owner explicitly authorized one replacement after correction. See the durable hotfix report for both IDs and evidence.
