# Changelog

## Unreleased — post-v0.4 UI and category updates

- PR #28 added the privacy page, eligibility-gated AdSense placements, tool
  guides, Slugify accessibility improvements and Le branding after the v0.4.0
  release. Advertising remains subject to external activation requirements.
- Added the public `/privacy` route after v0.4.0, bringing the current
  registry-derived sitemap from 27 to 28 canonical URLs.
- Grouped the homepage into populated registry categories, retaining one card
  for each of the 18 tools and a direct All tools link.
- Made Calculator keyboard `=` run the expression, matching Enter and the
  on-screen equals button.
- Added six palettes to the existing appearance system while retaining Light,
  Dark, System, fixed-dark One Dark, and Violet & Graphite / System as default.
- Replaced public Everyday with `converter`, titled Converters. Length and
  Weight remain there; QR Code Generator moves to Developer.
- Preserved all tool URLs and added a permanent redirect from
  `/category/everyday` to `/category/converter`.
- Migrated category color tokens while preserving values across all palettes.
- Recorded converter expansion as proposed v0.7.0/v0.8.0 planning only, pending
  planner approval; frozen v0.5.0/v0.6.0 scope is unchanged.

The historical v0.4 decision below is preserved. This entry is unreleased and
does not assign a release version to the migration.

## v0.4.0 — Core Text, Data & Sharing Utilities — 2026-10-08

This release completes the canonical developer category and adds three
browser-local utilities. The registry contains 18 tools across seven populated
categories and produced 27 canonical sitemap URLs at release. The privacy route
and converter-category migration are post-release changes.

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
