# Module: SiteInformation

**Kind:** Module (typed, server-consumed content owner)

## Representative File

`src/module/content/siteInformation.ts` (tests: `siteInformation.test.ts`; consumer: `src/app/contact/page.tsx`)

## Purpose

The typed owner of the publisher identity and the Contact page copy. It is not a CMS, a company database or a profile store. Route components compose it; they do not hold prose. The `/about` page holds its own approved public copy directly in `src/app/about/page.tsx` and no longer consumes this module.

## Verified source facts

| Fact | Source |
| --- | --- |
| Publisher: dailephd LLC | Footer identity line `© 2026 iworkhere.space created by dailephd LLC` (`src/component/layout/Footer.tsx`) |
| Product: iworkhere.space | Same line, `SITE_URL` in `src/lib/seo.ts` |
| Contact channel and Report Issues | `docs/components/ContactForm.md`, `docs/modules/ContactEmail.md`, v0.4.2 reporting |

## Exported contract

`getSiteInformation(): SiteInformation` returns a fresh object with:

- `publisher`: `{ legalName, productName }`.
- `contact`: `{ purpose, reportDistinction }` paragraphs. It never contains an address.

The earlier About-specific fields (`purpose`, `toolCount`, `categoryCount`, `capability`, `maintenance`, `limitation`, `release`) were removed when the About page was replaced; release history remains in `CHANGELOG.md`.

## Must not contain

Personal biography, street address, phone number, team size, staff credentials, testimonials, customer counts, maintenance-frequency promises, certifications, response-time guarantees, the operator inbox, or claims about unreleased catalog versions. The tests reject these patterns and any `@` address.

## Boundaries

Pure data plus registry-derived counts. No React, no `server-only`, no I/O, no telemetry. Imports `@/module/tool/metadata` only.
