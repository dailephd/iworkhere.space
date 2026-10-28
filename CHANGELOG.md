# Changelog

## v0.4.4 — Site Quality & Search Recovery — 2026-10-28

- Restored descriptive browser titles, corrected calculator, converter and time arithmetic, added a Vercel preview advertising guard, a rewritten service worker (network-first HTML, allowlisted static cache), four more verified file examples (nine in total), the `/guide` hub with four task guides, and 35 canonical sitemap URLs.
- Added browser boundary tests for the Merge PDF file, size and page limits, the Split PDF 20-group limit, and a decode of downloaded HEIC output. An over-30-megapixel HEIC remains unit-tested only.
- Verified local builds, the full default-off browser suite, preview-denied and stubbed-enabled advertising modes, and the production-container gate. Updated Next.js to 16.4.3 and resolved production and development dependency advisories; both npm audits reported zero vulnerabilities. All eight required GitHub Actions workflows and nine jobs passed on the release-preparation source. GitHub Release and Vercel Production deployment identities are verified separately.
- Corrected CalculatorTool query synchronization with a guarded render-time state adjustment and added regression coverage for external query changes, optional setters, query-field preservation, expression evaluation and result-state retention.

## v0.4.3 — Utility Value, Trust & Discoverability — 2026-10-21

- Added a task-first homepage, improved Discover navigation, and distinct task
  guidance across the seven populated categories while retaining all 18
  utilities and search.
- Added five original, verified worked examples for existing PDF and image
  tools, with measured source/output facts, reproduction steps and limitations.
- Added publisher About and Contact Us pages, plus the direct Resend contact
  integration. Source code does not configure external Resend or Vercel
  settings. Production was configured independently and operationally verified
  on 2026-10-21: the contact API returned HTTP 200, delivery to the configured
  inbox was confirmed from the verified `contact@iworkhere.space` sender, and
  the Production Firewall rate limit was verified enabled.
- Added Resend 6.16.0 for direct contact email.
- Added the expanded footer action order Contact Us, conditional Report Issues,
  and Privacy Policy, with privacy disclosure and accessibility improvements.
- Added `/about` and `/contact` to the canonical public sitemap, bringing it to
  30 URLs. Production deployment and Contact delivery were verified separately
  from source integration. Report Issues and advertising remain default-off;
  no AdSense acceptance or activation is claimed.
- Added regression coverage for the new content, routes, contact behavior,
  privacy, accessibility, and existing advertising and footer contracts.

## v0.4.2 — User Reporting & Retractable Site Chrome — 2026-10-20

Published as the numbered GitHub Release on 2026-10-20. GitHub release
publication does not establish the identity or health of the Vercel production
deployment.

- Added anonymous problem reports and suggestions through an accessible dialog,
  with selectable report context and optional contact details with explicit
  follow-up consent. The reporting interface is available only in builds with
  `NEXT_PUBLIC_SUPPORT_ENABLED=true`, which remains disabled by default.
- Added a dedicated support API with strict validation and abuse controls,
  durable support database storage, and an idempotent transactional delivery
  outbox with bounded retries, dead-letter handling and visible delivery
  status.
- Added private GitHub issue and Resend notification adapters, plus protected,
  read-only support dashboard views. These integrations are code capabilities;
  no external provider or production credential is claimed as provisioned.
- Added a retractable header/navigation control and a fixed, retractable footer
  with a persisted preference and report access in both states.
- Improved content clearance, visual viewport and safe-area behavior, and
  keyboard and assistive-technology access across the header, footer and dialog.
- Added integrated browser, database, provider-adapter and regression coverage
  while preserving the existing utility catalog and browser-local utility
  functionality.


## v0.4.1 — UI and Converter updates — 2026-10-11

Published as the numbered GitHub Release on 2026-10-11. PR #32 merged to
`master` at `90a718458e6fd2e3e80eb190cd7d55748bd1f6bb`, which is the
annotated `v0.4.1` tag target. Release publication does not establish the
identity or health of the latest Vercel production deployment.

- Included the post-v0.4.0 privacy page, eligibility-gated AdSense placements,
  tool guides, Slugify accessibility improvements and Le branding. Advertising
  remains subject to external activation requirements.
- The public `/privacy` route brings the registry-derived sitemap from the 27
  URLs in v0.4.0 to 28 canonical URLs.
- Grouped the homepage into accessible, responsive populated registry
  categories, retaining one card for each of the 18 tools and a direct All
  tools link. Geometry regression coverage checks 153 card pairs and 21
  section pairs at desktop and mobile sizes.
- Made Calculator keyboard `=` run the expression, matching Enter and the
  on-screen equals button.
- Added Mineral Research, Oxblood Atelier, Signal Green, Cobalt & Terracotta,
  Amber & Graphite, and Violet & Graphite to the existing appearance system.
  All six support Light, Dark and System modes; fixed-dark One Dark remains,
  and Violet & Graphite / System is the default.
- Replaced public Everyday with `converter`, titled Converters. Length and
  Weight remain there; QR Code Generator moves to Developer.
- Preserved all tool URLs and added a permanent redirect from
  `/category/everyday` to `/category/converter`.
- Migrated category color tokens while preserving values across all palettes.
- Converter expansion remains an unapproved v0.7.0/v0.8.0 proposal; frozen
  v0.5.0/v0.6.0 scope is unchanged.

The historical v0.4.0 decision below is preserved.

## v0.4.0 — Core Text, Data & Sharing Utilities — 2026-10-08

This release completes the canonical developer category and adds three
browser-local utilities. The registry contains 18 tools across seven populated
categories and produced 27 canonical sitemap URLs at release. The privacy route
and converter-category migration were introduced afterward in v0.4.1 source.

### Catalog and categories
- Added the canonical `developer` category with a single runtime category-definition owner; canonical order is document, text, math, everyday, time, image, developer.
- Corrected the related-tools heading so it names the related tools' own category (the JSON Formatter now shows "Related text tools"), with a neutral "Related tools" for mixed sets.

### JSON
- Added the JSON Formatter / Validator: strict RFC 8259 validation, lexical-preserving format and minify, stable positioned errors, a 1 MiB UTF-8 input limit and a pretty-output size guard (Minify stays available). Processing is browser-local.

### Text
- Added the Word / Character Counter: Unicode word, grapheme-cluster character, non-whitespace character and line counts, with a 1 MiB UTF-8 limit. Counts update live without per-keystroke telemetry.

### QR
- Added the QR Code Generator: browser-local generation, fixed error-correction level M, a 2048 UTF-8 byte limit, a fixed 512 × 512 black-on-white PNG preview and download. The encoder loads lazily and creates PNG output synchronously for reliable preview and download.

### Dependencies
- Added exact-pinned production dependency `uqr` 0.1.3 (MIT) and exact-pinned test-only decoder `jsqr` 1.4.0 (Apache-2.0); notices and the retained `uqr` license are recorded.

## v0.3.1 — Vercel Web Analytics — 2026-10-06

### Analytics
- Added automatic Vercel Web Analytics page views for initial loads and client navigation in the public application.
- Added app-owned `beforeSend` redaction for query strings and URL fragments.
- Kept Vercel custom events disabled; existing application observability, Web Vitals, Neon persistence and diagnostics remain authoritative.

### Deployment
- Added explicit Production-only `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED` activation.
- Local, Preview, CI and container behavior remains disabled by default.

v0.3.1 is released and publicly deployed. Production Web Analytics is enabled
for the public project with Production-only activation; live page-view receipt
and query/hash redaction were verified during launch.

## v0.3.0 — PDF & Document Essentials — 2026-10-06

### Documents
- Added browser-local PDF to JPG/PNG, Images to PDF, Merge PDF, Split PDF, and
  Compress PDF tools with document-category discovery.
- Added bounded PDF resource limits and lazy PDF.js/QPDF runtime loading.
- Compression uses lossless structural optimization; it does not promise a
  smaller output.

### Runtime
- Kept document processing in the browser and loaded heavy PDF runtimes only
  when an operation requires them.

v0.3.0 was released and publicly deployed; this note records the shipped
release content.

## v0.2.0 - 2026-10-02

### Image tools
- Added Image Resizer and Image Compressor.
- Added JPG / PNG / WebP conversion and HEIC to JPG / PNG conversion.

### Interface
- Added compact navigation, discovery/search, homepage tool islands, and four themes.

### Runtime
- Updated to Next.js 16.3.8 and hardened the Docker production runtime.
- Added browser and container validation for production behavior.

### Advertising
- Added production-gated AdSense support, disabled unless external readiness is configured.

### Observability
- Added typed metrics and Web Vitals collection with an opt-in Neon persistence architecture.
- Added a separate observability dashboard designed for read-only database access and Vercel Authentication protection.
