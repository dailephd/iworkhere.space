# Post-v0.4.0 converter category migration plan

This migration is implemented in the current v0.4.1 source; this document
preserves its bounded implementation plan and historical category decision.

This is a new migration after v0.4.0, not a rewrite of its category decision.
No new tool is implemented. v0.5.0 and v0.6.0 scopes remain frozen.

Release-preparation status (2026-10-28): this migration remains implemented as
recorded above. The v0.4.4 candidate preserves it without expanding converter
scope; v0.5.0 and v0.6.0 remain planned, and v0.4.4 is not published or
production-deployed.

## Bounded owner plan

1. Keep the migration isolated from the original v0.4.0 release record and preserve all existing tool URLs and slugs.
2. Extend src/module/tool/category.ts (existing canonical category owner) with converter identity/title and one label query. Keep registry.ts authoritative for tool membership: Length/Weight in converter, QR in developer. Keep internal everyday source directories and all slugs intact.
3. Use the existing metadata breadcrumb query and existing homepage/layout consumers for the label. Existing category route composes a permanent redirect for the historical URL; existing SEO/sitemap owners derive the new canonical category without another registry.
4. Rename category CSS tokens/selectors in global.css/theme.css, preserving every value. Update DESIGN.md first. Do not change palette reference tokens, provider or geometry.
5. Update regression tests for population, labels, QR membership, redirect, SEO/sitemap, category color bindings and desktop/mobile navigation. Retain the inherited homepage grouping and Calculator keyboard logic.
6. Validate route, sitemap, category ownership, navigation, styling, keyboard behavior, responsive geometry and Observer contracts. Keep historical baselines intact; record candidate-specific evidence separately.
