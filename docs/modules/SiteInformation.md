# Module: SiteInformation

**Kind:** Module (typed, server-consumed content owner)

## Representative File

`src/module/content/siteInformation.ts` (tests: `siteInformation.test.ts`; consumers: `src/app/about/page.tsx`, `src/app/contact/page.tsx`)

## Purpose

The one typed owner of the publisher and trust-page copy introduced in v0.4.3 Batch 4. It is not a CMS, a company database or a profile store. Route components compose it; they do not hold prose.

## Verified source facts

| Fact | Source |
| --- | --- |
| Publisher: dailephd LLC | Footer identity line `© 2026 iworkhere.space created by dailephd LLC` (`src/component/layout/Footer.tsx`) |
| Product: iworkhere.space | Same line, `SITE_URL` in `src/lib/seo.ts` |
| Tool and category counts | Derived at call time from `getAllTool()` and `getAvailableCategory()` in `src/module/tool/metadata.ts`; never typed as a number |
| Browser-local processing | The released privacy policy (`src/app/privacy/page.tsx`) |
| Release history | Published headings of `CHANGELOG.md`, v0.3.0 and later; v0.4.3 is not listed until released |
| Contact channel and Report Issues | `docs/components/ContactForm.md`, `docs/modules/ContactEmail.md`, v0.4.2 reporting |

## Exported contract

`getSiteInformation(): SiteInformation` returns a fresh object with:

- `publisher`: `{ legalName, productName }`.
- `purpose`: one paragraph.
- `toolCount` and `categoryCount`: derived from the registry.
- `capability`: ordered `{ id, title, body }` entries for the documented tool groups.
- `maintenance`: statements about automated tests and validation that exist in the repository.
- `limitation`: honest constraints (not full editors, no guaranteed results, no guaranteed contact reply).
- `release`: ordered `{ version, date, title }` entries for published releases.
- `contact`: `{ purpose, reportDistinction }` paragraphs. It never contains an address.

## Must not contain

Personal biography, street address, phone number, team size, staff credentials, testimonials, customer counts, maintenance-frequency promises, certifications, response-time guarantees, the operator inbox, or claims about unreleased catalog versions. The tests reject these patterns and any `@` address.

## Boundaries

Pure data plus registry-derived counts. No React, no `server-only`, no I/O, no telemetry. Imports `@/module/tool/metadata` only.
