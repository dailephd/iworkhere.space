# Changelog

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

This entry describes the release-prepared source. Production deployment remains
a separate integration step.

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
