# UI, discovery, and measured growth plan

Research date: 2026-10-01.

Status (reconciled 2026-10-04): Delivery 1 is implemented and user-approved.
Delivery 2 image-family rollout and discovery foundation is implemented,
validated, merged, and publicly deployed. Delivery 3 technical launch is
complete; owner-authenticated Google Search Console and Bing Webmaster actions
remain pending. Measurement is future evidence collection.

## Purpose and scope

Make iworkhere.space noticeably easier and more pleasant to use, and give its existing tools a credible route to organic discovery. Start with the four implemented image tools rather than adding another catalog or commissioning a large content program.

This plan supplements [ROADMAP.md](../ROADMAP.md) and [DESIGN.md](../DESIGN.md). It is not the missing historical v0.2 implementation plan, does not assign a new version, and does not reorder the v0.3–v0.6 Priority A+B catalog. The user requested this planning update; a later bounded implementation prompt authorizes each delivery.

The desired outcome is more successful tool use and qualified repeat/search visits. A modern appearance, crawler access, or schema cannot guarantee high traffic or an AI recommendation.

## Evidence and limitations

Repository review used feature-branch commit `4dcdcd2c64bfbbcacbb37c069090fce8921f310e`. The header and left banners have already been removed. The right and footer banners remain, and the optional slot API remains available. There are ten registered tools, including four image tools. Product behavior, 25 MiB / 30 MP limits, eight themes, local processing, worker isolation, and release restrictions are inherited, not redesigned here.

The review used current GitHub source and documentation, not a fresh locally rendered application. A public-site fetch did not provide a usable page. No authenticated Search Console/Bing data, first-party traffic, keyword-volume export, field performance data, or current UI screenshots were available. Therefore the following are source-grounded observations and planning decisions, not a measured ranking diagnosis or a completed visual audit.

| Source observation | Implication for this plan |
| --- | --- |
| `Header.tsx` renders a search input without a form, handler, or results path. | Do not retain a decorative search field. Provide a real route to the existing search. |
| `ToolSearch.tsx` renders navigation results as buttons calling `onOpen`; its search text omits the optional tags. | Use real destination links and the existing search owner; do not build a second search engine. |
| `ToolPageTemplate.tsx` is only an unstyled heading, description, and tool container. | This shared owner is the highest-leverage presentation and explanatory-content extension point. |
| `ImageResizerTool.tsx` vertically stacks source panel, settings, errors, and result, with result previews capped at `max-h-64`. | A larger preview stage beside compact controls changes the working experience, not just border colors. |
| `DESIGN.md` specifies a permanent 176px desktop navigation rail and rejects giant typography, decorative gradients, and generic SaaS marketing pages. | Propose a compact top-navigation alternative while retaining the restrained visual language. Approval changes the layout contract, not the theme engine. |
| `src/app` and `public` contain no sitemap or robots implementation in the inspected listings. Existing SEO helpers already generate tool/category canonicals and Open Graph metadata. | Extend the existing SEO path with crawl discovery; do not replace functioning metadata. Missing robots.txt alone is not a crawl block. |
| The roadmap postpones richer discovery/SEO, and current status still points back to the Batch 6 report. | Record the new near-term presentation/discovery plan without rewriting completed technical history or future catalog scope. |

## What the current research changes

### Demand: start with a coherent image-tool group

Semrush's August 2026 estimates report 43.78 million visits to iLoveIMG and 6.78 million to TinyPNG. Its desktop journey estimates put Google organic and direct traffic prominently in iLoveIMG's acquisition, and direct traffic prominently in TinyPNG's. These are modeled third-party estimates, not audited analytics, keyword volumes, comparable acquisition guarantees, or forecasts for this project. They support demand for established image utilities and the importance of repeat use, while also indicating strong incumbents. [1][2]

The initial audience is people preparing images for websites, forms, documents, and sharing who value a straightforward browser workflow. The initial search-intent hypotheses are private image resizing, JPEG/WebP compression, PNG/WebP transparency-preserving conversion, and HEIC-to-JPEG/PNG conversion. Each is supported by existing functionality. Do not advertise target-file-size compression, bulk processing, metadata preservation, or formats the product does not implement.

Local image processing is a useful positioning point, but not a unique invention: Squoosh also processes images on the device. Compete on the complete combination of clarity, predictable limits, useful results, reliability, and easy discovery, not a claim that no other tool is private. [3]

### Design: use current working products, not a trend collage

Squoosh is a relevant reference for making image selection and inspection the central task. iLoveIMG is a reference for clear task naming and direct tool discovery. Linear's March 12, 2026 interface refresh is a current reference for consistent controls, quieter navigation, reduced icon treatment, and less separator noise. These examples inform specific decisions; none proves that copying its appearance will increase traffic. [3][4][5]

Reject glass effects, oversized promotional heroes, animation packages, novelty cursors, dashboard widgets, arbitrary bento layouts, and an icon on every label. The intended direction is a calm working surface, not a fashionable landing page wrapped around the same cramped tool.

### Search and AI visibility: consolidate rather than add a separate project

Google recommends ordinary crawlability, useful textual content, accurate structured data, and good page experience for both conventional and AI search. Its current AI guide says special AI text files such as llms.txt do not improve Google visibility, and does not prescribe an ideal page length or AI-specific writing format. Do not turn this into a large generative-engine-optimization program. [6][7]

OpenAI documents OAI-SearchBot as its search crawler and GPTBot as a separate training control. Search availability and training permissions are independent. Enabling search access does not guarantee citations, and mentions in model memory are not a controllable release outcome. [8]

## Planned visual direction

### A. Change the page structure, not just the styling

The candidate replaces the permanent left navigation rail with compact top navigation. Keep the real brand header and `Themes` control, reuse existing route/navigation data, and expose Home, All tools, and populated categories through ordinary links. On mobile, use a compact wrapping row; no new drawer, modal command palette, or global navigation state is required.

Replace the inactive header search field with a clear link to the working discovery/search surface. Home and Discover retain their functional search input. Avoid presenting two independent search boxes on the same page.

The proposed desktop image workspace has a compact source/settings column beside a substantially larger preview/result stage. Before selection, the stage explains the next action without fake controls. After selection, it shows the actual source; after processing, it shows the actual result, format/dimensions, byte evidence where relevant, and a prominent download. Keep the primary processing action by the settings, and make Reset secondary.

This changes both navigation allocation and task geometry. It is not the current sidebar layout with larger headings.

### B. Homepage is a tool launcher

Use a short introduction, one working search field, populated-category navigation, a curated four-image-tool group, and a compact grid of the remaining implemented tools. Cards are real links with a clear task name and one useful description. Do not label manually selected tools "popular" without usage evidence.

The first viewport should provide a useful route into a tool rather than a full-screen marketing hero. Do not promise that absolutely nothing leaves the browser: describe local image processing specifically, because normal page/asset requests and application observability are separate concerns.

### C. Tool presentation targets for the pilot

At desktop widths where space permits, target about 280–320px for settings and give the preview the remaining width. At narrower widths, stack in a logical reading/focus order. Keep the existing near-1280px content maximum rather than stretching form controls across an entire ultrawide display. Use a roughly 28–32px tool title, 16px body text, a consistent spacing rhythm, and comfortably sized controls. These are proposed design values, not measured current CSS or industry ranking factors.

Use existing semantic surface/text/border/accent tokens, system typography, restrained violet primary emphasis, and cyan focus. Preserve all eight themes. Images use contained aspect-ratio-aware presentation; do not crop a preview or stretch it merely to fill a card. Result metrics use actual measured values. Error text retains the accepted specific, contextual, safe, actionable wording.

The source/settings/result grouping may change inside existing tool owners. Do not create a generic image state, processing, result, or file-management framework. Keep the existing presentation-only ImageSourcePanel boundary unless a separately specified presentation change requires a narrow extension.

### D. Advertising and existing user decisions

Header and left banners remain absent. The last explicit user instruction retained the right and footer banners; this plan does not silently cancel that instruction. The initial pilot must account for them. An additional no-placeholder composition may be shown for comparison, but removing the remaining regions requires explicit visual-scope approval. Future ad-provider integration remains deferred.

### E. Visual approval before repetition

The first review covers the homepage and Image Resizer only, at 1440×900 and 390×844 in light and dark themes. Include empty, source-selected, successful-result, and one error state. Compare with actual pre-change captures of the same routes and states.

Approve the allocation of navigation, controls, preview, result, and remaining banners before copying the pattern to the other three image tools. Passing DOM tests or Observer contracts alone does not prove that the user likes the design. If the pilot is rejected, revise those two surfaces; do not restyle the whole site and then seek approval.

## Small delivery sequence

### Delivery 1 — Visual pilot and useful navigation

Scope: shared shell/header/navigation presentation, homepage/discovery card presentation, real crawlable links, and Image Resizer's working surface. Replace the inert header search with the real search entry point. Extend the existing ToolSearch and metadata owners, including tags only where they already exist and are passed truthfully. Do not add new tools, persistence, drag-and-drop, batch files, or a new search dependency.

Before production implementation, the planner freezes the approved pilot references, requested changes, protected behavior, and acceptance. Implementation uses current my-dev-kit bounded retrieval and the relevant frontend workflow. Observer captures geometry/visibility/relationships with a contract that allows the requested redesign rather than requiring old geometry to remain unchanged. Playwright owns file interaction, focus, keyboard navigation, and actual scrolling when content overflows. Do not require scroll-owner evidence from a non-scrollable baseline or add unsupported state/scroll fields to Observer project configuration.

Acceptance: obvious change in workspace allocation; working navigation by link, keyboard, and browser open-in-new-tab; no inert search; no unintended clipping or horizontal overflow; unique main/skip target; correct mobile stacking; Resizer behavior and privacy unchanged. The user reviews the rendered pilot before Delivery 2.

### Delivery 2 — Image-family rollout and search foundation

Apply the accepted visual grammar to Compressor, standard Converter, and HEIC Converter. Preserve their different processing/result semantics; do not unify state machines merely for visual consistency.

Add concise server-rendered help to the four image landing pages: the actual operation, short instructions, supported inputs/outputs, limits, privacy boundary, meaningful caveats, and related image-tool links. Include a small useful example or format comparison only where it helps the task. No word-count quota and no repetitive article below every control.

Keep existing slugs. Reuse the registry as the tool-identity authority. A small typed guide-data companion keyed by existing ToolId may own prose and related-tool IDs; it must not become a second registry or put long guide text in every client catalog payload. The server route and ToolPageTemplate render guide content. The metadata layer derives related links; `src/lib/seo.ts` remains a generic metadata helper, not a module-domain consumer.

Extend the existing SEO path with a registry-derived sitemap, robots policy, complete homepage/category/tool metadata, truthful breadcrumbs, and representative social preview metadata. Sitemap inclusion is for intended public pages with successful canonical destinations; omit private/API/input-state URLs and unpublished tool pages. Keep calculator/shareable query behavior while canonicalizing equivalent input variants to the stable tool URL. Do not block required scripts or styles from crawlers. Protect previews from indexing through hosting access controls and appropriate directives; robots.txt is not an access-control system.

Allow public discovery by Googlebot/Bingbot and OAI-SearchBot where hosting/WAF configuration permits. Do not silently change GPTBot training policy. Verify actual responses after an authorized deployment, not only source configuration.

Structured data must match visible content. WebApplication/SoftwareApplication semantics are not a promise of Google's app rich result: Google's eligibility has additional requirements, including a rating/review. Do not fabricate them. Do not build FAQ rich-result machinery; Google retired that feature in May 2026. A few useful visible questions may still help users. Organization/about/contact and a plain-language privacy explanation should use verified operator facts; do not invent an address, certification, contacts, reviews, or a private-repository link. [9][10]

Acceptance: all four workflows and inherited tests pass; page content and destination anchors exist in server-rendered HTML; metadata/canonicals/sitemap agree; private file details do not reach URLs, logs, analytics, or requests; HEIC stays worker-only and absent from unrelated/initial route loading; host and container behavior remain compatible.

### Delivery 3 — Authorized launch, measurement, and distribution

**Status: Technical launch complete (2026-10-04).** The public production
deployment is live at https://iworkhere.space. The public origin, robots policy,
17-URL sitemap, canonicals, server-rendered image guides, representative image
workflows, observability persistence, and protected dashboard were verified.
The HEIC production-license gate was approved before launch. No new numbered
version was created.

**Remaining operational follow-up:** once authenticated, submit or confirm the production sitemap in Google Search Console and Bing Webmaster Tools. Inspect the seven priority URLs and request indexing at most once where appropriate:

- https://iworkhere.space/
- https://iworkhere.space/discover
- https://iworkhere.space/category/image
- https://iworkhere.space/tool/image-resizer
- https://iworkhere.space/tool/image-compressor
- https://iworkhere.space/tool/image-converter
- https://iworkhere.space/tool/heic-converter

No console submission or URL request has been made; no request guarantees index inclusion or ranking. The suggested owned-site write-up/link remains optional separate distribution work and was not performed in this launch.

Review after enough public data is available. REVIEW WINDOW: 28 days after
public launch (2026-10-04; earliest review 2026-11-01). This window does not
guarantee enough traffic for a conclusion. Low traffic means insufficient
evidence, not proof that the design succeeded or failed. Do not run A/B tests
without enough traffic to interpret them.

## Measurement and traffic decisions

Use separate measures for discovery, usefulness, and AI visibility:

- Discovery: eligible/indexed pages, impressions, clicks, query intent, and landing page. Do not use average position alone as success.
- Usefulness: verified task completion and failure paths; aggregate completion metrics only after an approved privacy-safe collection design. Production observability and persistence are deployed and smoke-verified; the
launch smoke is not a representative task-completion or traffic baseline. No user images, filenames, input text, dimensions, or raw queries enter measurement.
- Performance: aim for good Core Web Vitals, including LCP around 2.5 seconds or better, INP around 200ms or better, and CLS around 0.1 or better. Distinguish reproducible lab checks from field measurements; do not report field PASS without field data. [11]
- AI visibility: track actual referral visits separately from citations. OpenAI documents ChatGPT referral tagging; Bing's AI Performance reports citations on supported Microsoft/partner surfaces, not all LLMs or guaranteed rankings. Use whichever official Google AI reporting is available to the verified property, and record that reporting surface rather than assuming a particular rollout. [8][12]

Only after the existing image group has useful public evidence should additional optimization work be selected. Preserve the planned PDF, text/developer, and everyday catalog sequence. Search evidence may inform a future explicit roadmap decision, but it does not silently promote later tools into this scope.

Target-size compression, safe output handoff between image tools, and bulk processing are potential retention improvements, not authorized features. Research their demand and resource/privacy requirements separately before scheduling. The first delivery adds no such capability.

## What is deliberately deferred

No full-site rewrite, framework migration, new design system package, animation/icon dependency, generic tool engine, CMS, large blog, hundreds of keyword pages, automatic translations, llms.txt project, AI-specific hidden content, MCP/app integration, automated IndexNow pipeline, new analytics vendor, accounts, payments, recently-used UI, or remaining-banner removal by assumption.

Basic crawlability is not deferred until the catalog reaches thirty tools. Conversely, growth infrastructure must not become a reason to delay a small visual improvement indefinitely.

## Preservation and verification

The existing registry, routes, ToolClientFrame, error boundary, storage/observability abstractions, theme IDs/key, file limits, HEIC dependency/version/lifecycle, Docker setup, and public/private boundaries remain intact. This plan update does not itself authorize a package bump, merge, deployment, or
external account mutation. Delivery 2 was separately authorized and launched;
Search Console and Bing actions still await owner authentication.

For future implementation, retain functional regressions and add semantic navigation, rendered-content, responsive geometry, and relevant metadata tests. Update affected component/module contracts before changing their behavior. Use one normal verify run and the applicable production E2E evidence against final source; do not duplicate heavy validation merely because multiple sections mention it. Re-run container validation when deployment/runtime assets or their delivery contract change.

## Research sources

All pages below were consulted on 2026-10-01. Traffic figures refer to August 2026 estimates, not October actuals. Current documentation may change and must be rechecked at implementation/release when it affects a contract.

1. [Semrush: iLoveIMG traffic estimates](https://www.semrush.com/website/iloveimg.com/overview/) — market context and estimated desktop acquisition, not a forecast.
2. [Semrush: TinyPNG traffic estimates](https://www.semrush.com/website/tinypng.com/overview/) — market context; modeled data limitations apply.
3. [Squoosh](https://squoosh.app/) — task-first image interaction and local-processing precedent.
4. [iLoveIMG resize tool](https://www.iloveimg.com/resize-image) — direct task entry, settings, and supported-operation presentation.
5. [Linear: A calmer interface for a product in motion, March 12, 2026](https://linear.app/now/behind-the-latest-design-refresh) — visual hierarchy and restraint, not a template to clone.
6. [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — eligibility, content, crawling, and reporting.
7. [Google: Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) — useful content, ordinary SEO, and unsupported AI-file/mention tactics.
8. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots) and [publisher FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq) — search versus training controls and referrals.
9. [Google: Software application structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app) — actual rich-result requirements.
10. [Google Search documentation updates](https://developers.google.com/search/updates) — FAQ rich-result retirement announced May 8, 2026, effective May 7.
11. [Google: Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) — performance measures; not a ranking guarantee.
12. [Bing: AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c) — supported citation reporting and limitations.
13. [Google: Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) — destination anchors with href, not script-only navigation.

## Current execution state and next action

Delivery 1 is implemented and user-approved. Delivery 2 is implemented,
validated, merged, and publicly deployed. Delivery 3 technical launch is
complete. The next operational action is owner-authenticated Google Search
Console and Bing Webmaster sitemap/priority-URL follow-up; then collect the
planned 28-day evidence window. This status does not claim ranking or traffic
gains. v0.3.0 PDF & Document Essentials remains the next numbered catalog
version, and this plan does not start that work.
