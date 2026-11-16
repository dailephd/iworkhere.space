# Private aggregate MCP reporting service

Track B B2 is implemented and tested. B3 has created the separate Vercel project
`iworkhere-reporting` and provisioned the restricted production Neon reader.
OAuth configuration and operator enrollment remain unavailable; the deployed
endpoint fails closed and is not connected to ChatGPT. This package is a
separate deployment unit from the public app and `dashboard.iworkhere.space`.
Keep the dashboard's Vercel Authentication on **All Deployments** unchanged.

## Production activation status (2026-11-16)

The intended resource is `https://iworkhere-reporting.vercel.app/mcp`.
`REPORTING_DATABASE_URL` is a sensitive, production-only variable in that project.
The existing observability database is reused; no database was created. Effective
reader privileges and all seven B1 report ranges were verified through a private
operator process. These reads do not establish authenticated MCP or ChatGPT access.

The existing Neon Auth configuration has no OAuth-provider plugin enabled. No
approved issuer, introspection client or enrolled operator subject is established.
An account owner must identify an authorized provider and grant configuration
access. Before activation, verify its exact issuer, resource audience, PKCE,
registration, signing algorithm, RFC7662 claims and revocation behavior against
the resource-server contract below. Neon Auth's documented EdDSA access tokens
are not currently supported by this service's RS256/ES256 allowlist; selecting
that provider requires a reviewed and tested compatibility change, plus hosted
login and consent pages. Do not enable it merely because the schema exists.

Complete provider configuration and store its secrets through Vercel, explicitly
enroll the operator, then redeploy and run live OAuth/MCP acceptance. The operator
must complete ChatGPT connection installation and interactive OAuth consent.
Until then, missing configuration returns 503 without private data. Live reports
remain `INSUFFICIENT_EVIDENCE` where independent monitoring coverage is missing.

## Ownership and contracts

`/oauth/authorize` hosts Stytch Test email-code login and the official Connected
Apps IdentityProvider consent component. Configure the Test public SDK token as
`NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` and enable the Frontend SDK for the exact origin
in the Stytch Test dashboard. Missing/non-Test public tokens render an unavailable
page. SDK session refresh must complete before consent is shown. OAuth query
handling, code issuance and redirects remain owned by Stytch's component.
This browser session never authorizes MCP access; the existing server token,
introspection, audience, scope and subject checks remain mandatory. No Test
identity is enrolled automatically. Keep production reporting OAuth settings
unset until separately authorized. Initial tests must use isolated staging.

The supplied project discovery URL currently returns
`authorization_endpoint_not_configured_for_project`. Configure the application
Authorization URL only after the page's SDK token/origin and login method are
enabled. Configure `reporting:read` in Connected Apps permissions using protected
account settings. Verify the returned issuer and full metadata before setting
resource-server variables; no issuer is inferred from project IDs or domains.

The `/mcp` Node route composes `src/lib/mcp.server.ts`. Official
`@modelcontextprotocol/server@2.4.0` owns Streamable HTTP, initialization,
2025 compatibility and 2026 per-request negotiation, discovery and invocation.
Fresh server instances serve requests; no session or event store must survive
between serverless invocations. Streaming subscriptions are disabled. Responses
may be JSON or request-scoped SSE. GET/DELETE receive the SDK's stateless 405.

The only tool is `observability_report`, with exact input
`{ "schemaVersion": 1, "range": "30d" }`. Ranges: `24h`, `7d`, `30d`, `90d`,
`180d`, `1y`, `all`. Rolling 24h is not yesterday. UTC receipt-time counts are
events, never unique users. B1's range/query/model/health/strict validation under
`../dashboard/src/lib/` are imported directly, never copied. Null Other identities
and unavailable measurements, source/percentile limitations and omitted rankings
retain B1 semantics. No support or raw diagnostic records are queried or returned.

`observability.server.ts` accepts only the exact three B1 query plans and their
parameters. A fourth, fixed transaction-local statement sets a 15s SQL timeout.
Neon 1.1.0 executes a read-only RepeatableRead transaction with B1's 15s abort
and streamed 128 KiB upstream bound before driver JSON decoding. Missing or broad
dashboard credentials fail closed. Only `REPORTING_DATABASE_URL` with username
`observability_reporting` is accepted; actual privileges still need independent
operator review. No production schema/grants are applied by the service.

DTO projection/validation occurs before MCP serialization: 24 KiB UTF-8 DTO,
64 KiB complete wire response, no truncation. Protocol errors retain SDK status,
code and correlation ID, with fixed safe text and only bounded version-negotiation
data. This error policy is not a substitute for B1's positive DTO schema.
No request, token, input, raw driver exception or diagnostic is logged.

Health uses B1 only. B2 provides no independent ingestion/cron/runtime-log collector.
Missing evidence yields INSUFFICIENT_EVIDENCE; actual proven rollup gaps remain
unhealthy. A recent timestamp or local fixture cannot prove production health.

## OAuth resource-server configuration

Copy `.env.example` to a private `.env.local` for isolated local setup. All settings
are server-only; there are no NEXT_PUBLIC secrets or browser-cookie authorization.
Production requires HTTPS endpoints and fails closed for absent configuration.
Only non-production loopback HTTP is accepted for local test issuers.

- `REPORTING_RESOURCE_URL`: exact canonical HTTPS endpoint ending `/mcp`.
- `REPORTING_OAUTH_ISSUER`: exact issuer identifier, including any trailing slash.
- `REPORTING_OAUTH_JWKS_URL`: operator-trusted signing-key endpoint. Token-controlled
  jku/x5u endpoints are never used. RS256/ES256 signed `at+jwt` access tokens only.
- `REPORTING_OAUTH_INTROSPECTION_URL`: provider RFC7662 endpoint. Every request
  verifies JWT signature, issuer, audience equal to the resource, exp, nbf and
  required claims, then checks uncached active introspection with matching subject,
  issuer, audience and valid expiration. Scopes are the intersection of signed and
  current provider scopes. No positive token/key authorization cache.
- `REPORTING_INTROSPECTION_CLIENT_ID` / `_SECRET`: resource-server credentials for
  RFC7662 client_secret_basic endpoint authentication. These are not a user OAuth
  client-credentials grant. Redirects are rejected, provider reads have a shared
  5s deadline and 32 KiB bounds. Provider outage denies access.
- `REPORTING_ALLOWED_SUBJECTS`: nonempty JSON array of immutable, explicitly
  enrolled provider subject IDs. No public signup or arbitrary valid token grants
  analytics access. Changing this enrollment requires server-managed configuration.

Required scope: `reporting:read`. Missing/invalid tokens receive 401 with SDK
WWW-Authenticate discovery challenge; missing scope receives 403 insufficient_scope;
unenrolled subjects receive 403 access_denied. JWT validation never trusts decoded
claims before signature verification. Introspection must reflect disabled users,
revoked sessions/tokens and current scope/enrollment policy; providers that cannot
supply that behavior need a separately reviewed adapter, not a cached-active fallback.
Key rotation and retired keys are observed by fetching trusted JWKS per request.

`GET /.well-known/oauth-protected-resource` publishes resource, issuer, scope and
header bearer method only. Private configuration is never exposed. There is no
custom authorization server, authorization-code exchange, registration endpoint,
static API-key fallback, cookie session or SSO bypass. The eventual established
provider must offer OAuth authorization code + S256 PKCE, resource audience binding,
RFC8414/OIDC discovery and compatible CIMD, DCR or predefined client registration.
Prefer CIMD per current OpenAI guidance; configure only supported methods. Copy the
exact callback shown by ChatGPT when linking later; do not assume a legacy callback.
An actual provider and real linking must be provisioned and tested separately.

## Local validation

Requires Node 24. From the repository root:

```powershell
npm --prefix reporting ci
npm --prefix reporting run verify
npm --prefix reporting run dev
```

The service binds loopback port 3002 for development. `npm run verify` inside this
package runs typecheck, lint, fixture tests (including a real local HTTP MCP exchange
against a fake JWKS/introspection issuer) and a production build without credentials.
Unique reports are under `test-report/<RUN_ID>/`; CI uploads the full directory.
Tests use dependency composition only in test modules; production routes always use
real token validation and database adapters. No runtime fixture flag or test bypass.
The build deliberately uses Next's supported Webpack path: Turbopack's expanded
monorepo root picked up the unrelated public instrumentation during validation.
Webpack keeps application ownership local while compiling explicit external B1 imports.

## Deployment prerequisites (not performed)

Create a new Vercel project with Root Directory `reporting`, Node 24 and build
command `npm run build`. Include source files outside Root Directory so the explicit
B1 imports can be compiled/traced; `outputFileTracingRoot` covers the repository.
Install from this package's own lockfile. No root or dashboard install is required.
The reporting endpoint and public discovery must be network reachable without the
existing dashboard SSO intercepting requests; private data remains protected by
application OAuth and enrollment. Previews must have no production credentials.

Before any live connection: operator-review and apply
`../database/observability/reporting-role.sql` in isolated development first;
inspect effective grants/PUBLIC privileges/memberships/ownership; provision the
separate reader and server-only OAuth secrets; configure provider PKCE/resource and
registration; verify revocation and operator enrollment; perform staged protocol,
privacy and least-privilege acceptance. The template intentionally rejects an existing
role and unsafe inherited PUBLIC privileges instead of silently changing shared grants.
No migrations or role startup provisioning. Do not reuse dashboard reader credentials.

Only after separate deployment authorization should a staged endpoint be created and
linked in ChatGPT. Revoking provider authorization, removing the enrolled subject or
reporting secret disables access. No measurement data or dashboard SSO changes are
needed. Root Docker context and public TypeScript/lint exclude this deployment unit.

## Verified specifications

- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/build/mcp-server
- https://modelcontextprotocol.io/specification/2026-07-28
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://github.com/modelcontextprotocol/typescript-sdk (v2.4.0 package types inspected)

## Hosted integration gates

Reporting CI additionally runs the built production runtime with all private
configuration absent, scans client/server bundles, and uses a disposable pinned
PostgreSQL container for actual role grants and all seven B1 query/DTO checks.
`npm run test:runtime` uses only loopback and no credentials.
`npm run test:permissions` requires the CI-owned disposable container ID in
REPORTING_TEST_POSTGRES_CONTAINER; it accepts no connection URL and must never
be pointed at production. Reports remain unique under test-report/.
