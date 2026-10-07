# Pre-v0.4 Indexing and Canonical-Host Checkpoint

Date: 2026-10-07

Repository: `dailephd/iworkhere.space`

Purpose: record the bounded indexing/canonicalization investigation that must be
completed before the v0.4.0 implementation plan is frozen. This is operational
SEO/deployment work, not a numbered product release and not v0.4 implementation.

## Trigger

Google Search Console reported a new non-indexing reason:

`Page with redirect`

The notice was investigated before changing application source.

## Current source contract

The application defines the canonical site origin as:

`https://iworkhere.space`

The existing SEO path owns canonical URLs, robots metadata and sitemap
generation. Tool and category routes are registry-driven. There is no
application-owned host redirect in `next.config.ts`.

## Search Console and live evidence

On 2026-10-07:

- the connected property is `sc-domain:iworkhere.space`;
- Search Console URL Inspection identifies the HTTP homepage variants as
  `Page with redirect`;
- historical inspection shows `https://www.iworkhere.space/` was submitted and
  indexed on 2026-09-29;
- the current source and launch documentation identify the HTTPS apex host as
  canonical;
- live checks confirm trailing-slash variants such as `/discover/`,
  `/tool/slugify/`, and `/category/text/` redirect with HTTP 308 to their
  non-trailing-slash canonical route;
- the live production sitemap contains 23 canonical URLs after the v0.3
  document-family expansion;
- all 23 current sitemap URLs returned HTTP 200 directly, did not redirect, were
  indexable, and exposed self-canonical HTTPS apex URLs;
- the current sitemap was re-submitted to Google Search Console on 2026-10-07
  and accepted for re-download with no immediate sitemap warning/error.

Sitemap submission queues a fetch. It does not guarantee crawling, index
inclusion, ranking or traffic.

## Interpretation

There is no current evidence that the Search Console redirect notice represents
a broken canonical application page.

The known redirect classes are intentional:

1. HTTP → HTTPS;
2. `www` → apex, when configured at the hosting/domain layer;
3. trailing-slash route variants → canonical non-trailing-slash routes.

These variants should not be made independently indexable merely to clear the
Search Console notice.

## Remaining pre-v0.4 configuration check

Verify the public Vercel custom-domain configuration against this contract:

- `iworkhere.space` is the canonical production domain;
- `www.iworkhere.space` is attached and permanently redirects to
  `iworkhere.space`;
- HTTP is upgraded to HTTPS;
- redirect chains are no longer than necessary.

If the Vercel/domain state differs, correct the deployment/domain configuration.
Do not add parallel Next.js middleware or `next.config.ts` host redirects when
Vercel already owns the behavior.

## Google follow-up

After the canonical-host configuration is verified:

- allow Google to re-download the 23-URL sitemap;
- monitor canonical apex URLs through Search Console;
- do not repeatedly request indexing solely to force a status change;
- treat indexing/ranking/traffic as later measurement evidence.

Escalate to a source repair only if a canonical production URL itself:

- redirects unexpectedly;
- is blocked by robots;
- carries `noindex`;
- fails to return 200;
- advertises a conflicting canonical;
- appears incorrectly in sitemap/internal navigation.

## Non-blocking SEO observations

The live on-page audit also found that several older lightweight tool/category
pages have short descriptions or limited explanatory copy and that structured
data is not currently present. These are separate SEO-content/product decisions.
They are not evidence that the redirect notice is a defect and must not be
silently folded into v0.4 scope.

## Boundary with v0.4.0

v0.4.0 remains the planned Core Text, Data & Sharing Utilities release.

Before its implementation plan is frozen:

1. complete the Vercel `www` → apex verification;
2. preserve the current canonical/sitemap contract;
3. perform fresh my-dev-kit retrieval against the current repository;
4. resolve the v0.4 developer-category decision;
5. freeze `docs/plans/v0.4.0-implementation-plan.md`.

Google recrawl and index inclusion continue in parallel and do not block v0.4
unless they reveal a real canonical production defect.

## Current verdict

CANONICAL_SITEMAP_URLS: PASS

REDIRECT_NOTICE: INTENTIONAL_FOR_KNOWN_VARIANTS

APPLICATION_SOURCE_REPAIR: NOT_CURRENTLY_REQUIRED

WWW_TO_APEX_DEPLOYMENT_VERIFICATION: PENDING

GOOGLE_SITEMAP_REDOWNLOAD: PENDING

V0_4_IMPLEMENTATION: NOT_STARTED
