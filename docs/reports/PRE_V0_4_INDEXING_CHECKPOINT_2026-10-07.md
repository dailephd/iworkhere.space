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

## Canonical-host verification — 2026-10-07 (final)

Verified from master `1bcee32b86c1b13bd70de3a07cef7c41bd0a8922`, package
version `0.3.1`.

### First verification attempt (preserved)

An earlier verification run found `www.iworkhere.space` had no DNS record and
was not attached to the Vercel project (resolver: could not resolve host). The
apex behaved correctly. That run stopped with `BLOCKED_VERCEL_DOMAIN_CONFIGURATION`
because the fix required Namecheap DNS and Vercel domain configuration by the
owner. No application source was involved.

### Owner configuration and re-verification

The owner then added the `www` DNS record at Namecheap and attached
`www.iworkhere.space` to the Vercel project with a redirect to the apex. This
agent run made no Vercel, DNS or application-source change.

DNS (public resolver):

- `iworkhere.space` A → `216.198.79.1`;
- `www.iworkhere.space` CNAME → a `vercel-dns-017.com` target resolving to
  Vercel addresses (`216.198.79.65`, `64.29.17.65`).

Vercel (CLI 62.2.0, user `dailephd`, team `dailephds-projects`): project
`iworkhere-space` lists both `iworkhere.space` and `www.iworkhere.space`. The
domain registrar nameservers remain Namecheap (third party); the CLI's
nameserver-mismatch marker is expected for the DNS-record setup and is not a
defect. HTTPS completes with valid certificates on both hosts (curl performed
no certificate bypass).

Redirect matrix (curl, each hop recorded):

| Start URL | Hops | Chain | Final |
|---|---|---|---|
| `http://iworkhere.space/` | 1 | 308 → `https://iworkhere.space/` → 200 | apex |
| `https://iworkhere.space/` | 0 | 200 | apex |
| `http://www.iworkhere.space/` | 2 | 308 → `https://www.iworkhere.space/` → 308 → `https://iworkhere.space/` → 200 | apex |
| `https://www.iworkhere.space/` | 1 | 308 → `https://iworkhere.space/` → 200 | apex |
| `http://iworkhere.space/discover` | 1 | 308 → `https://iworkhere.space/discover` → 200 | apex |
| `https://iworkhere.space/discover` | 0 | 200 | apex |
| `http://www.iworkhere.space/discover` | 2 | 308 → `https://www…/discover` → 308 → `https://iworkhere.space/discover` → 200 | apex |
| `https://www.iworkhere.space/discover` | 1 | 308 → `https://iworkhere.space/discover` → 200 | apex |
| `https://iworkhere.space/discover/` | 1 | 308 → `/discover` → 200 | apex |
| `https://iworkhere.space/tool/slugify/` | 1 | 308 → `/tool/slugify` → 200 | apex |
| `https://iworkhere.space/category/text/` | 1 | 308 → `/category/text` → 200 | apex |

Paths are preserved, no loops, and no `vercel.app` hostname is traversed. The
two-hop `http://www` chain is the accepted deterministic HTTP→HTTPS→apex form.

### Sitemap, robots and canonical audit

The live `https://iworkhere.space/sitemap.xml` (200, no redirect) was parsed,
not copied from a list. It contains 23 URLs: home, Discover, 15 tools and 6
populated categories. Every URL is HTTPS, host exactly `iworkhere.space`, free of
query/fragment/`www`/`vercel.app`, returns a direct 200, has no `noindex`
(meta or header), and carries a self-referencing canonical (the root's canonical
is the equivalent slashless origin form). `https://iworkhere.space/robots.txt`
returns 200, allows all crawling, and declares exactly
`https://iworkhere.space/sitemap.xml`.

## Current verdict

CANONICAL_SITEMAP_URLS: PASS

REDIRECT_NOTICE: INTENTIONAL_FOR_KNOWN_VARIANTS

APPLICATION_SOURCE_REPAIR: NOT_REQUIRED

WWW_TO_APEX_DEPLOYMENT_VERIFICATION: PASS

PRE_V0_4_INDEXING_CHECKPOINT: COMPLETE

GOOGLE_INDEXING_MONITORING: CONTINUES_IN_PARALLEL — the 2026-10-07 sitemap
re-download and canonical recrawl are asynchronous; indexing, rankings and
traffic are not claimed. Do not repeatedly resubmit or request indexing.

BING_WEBMASTER_SUBMISSION: OPERATIONAL_FOLLOW_UP (not a v0.4 blocker)

V0_4_IMPLEMENTATION: NOT_STARTED
