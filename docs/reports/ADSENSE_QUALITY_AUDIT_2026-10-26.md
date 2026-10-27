# Website quality and AdSense readiness audit

Audit date: October 26, 2026 (America/Chicago).
Policy and planning refresh: October 27, 2026. The recorded live HTTP observations remain dated October 26.

Repository: `dailephd/iworkhere.space`.
Source snapshot: `59396b224157ad290e768c7f70998a9c947bda42` on `master`.
Application version at inspection: `0.4.3`.

## Purpose and conclusion

This audit supports the immediate [v0.4.4 implementation plan](../plans/v0.4.4-implementation-plan.md).
It evaluates the existing utility website against Google's publisher guidance and identifies concrete improvements to usefulness, discovery and reliability.
It does not determine Google's internal reason for the reported low-value-content rejection or guarantee approval, indexing, rankings or traffic.

The first two priorities are confirmed defects: every public page has the same browser title, and the calculator gives an incorrect result for ordinary signed multiplication.
The site already has substantial supporting material: 18 authored tool guides, seven category guides, trust pages and five reproducible file examples.
The immediate plan should preserve those assets, correct product behavior, and add evidence and task guidance where they help visitors complete work.

## Evidence and limits

- **Source observation:** a fact read from the inspected repository snapshot.
- **HTTP observation:** a fact from the root audit's browserless requests to the public site on the audit date.
- **Risk:** a source pattern that needs targeted reproduction or preventive correction; it is not a demonstrated production incident.
- **Recommendation:** planner judgment about a useful improvement, separate from a Google requirement.

Applicable repository guidance was read. No tracked root `manifest.txt` exists in this snapshot; an unmerged manifest proposal is not treated as current authority.
Initial bounded source retrieval used `rg` and relevant source ranges because no `my-dev-kit` executable was then available in `PATH`.
The root audit subsequently completed a fresh my-dev-kit 1.13.0 index and confirmed the relevant ownership relationships.
These retrieval steps do not establish complete dynamic dependency coverage or constitute execution of the application test suite.

No full browser acceptance suite, accessibility audit, real-user performance analysis or Google account review was completed by this audit.
Search Console queries, impressions, clicks, CTR and field Core Web Vitals were unavailable.
Consequently, keyword opportunities below are hypotheses, and no traffic improvement or measured performance defect is claimed.
The source commit and live HTTP responses are separate observations; public response content alone does not prove the deployment's source SHA.

## Google's relevant guidance

Google's [publisher policies](https://support.google.com/adsense/answer/10502938?hl=en) address low-value or absent publisher content, replicated content without added value, disruptive advertising, privacy disclosures and search spam.
Google's [site-readiness guidance](https://support.google.com/adsense/answer/7299563?hl=en) emphasizes original content relevant to visitors and navigation that helps people use the site.
These principles apply to the actual visitor experience, including whether a tool performs its stated task correctly.

Google's [helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) asks whether content provides useful, accurate, satisfying information and explicitly rejects the idea of a preferred word count.
This plan therefore specifies useful outcomes and verified examples rather than article counts, word quotas, an invented minimum traffic threshold or unrelated trending topics.
Search recommendations in this audit are not a claim that adding a particular page or metadata field satisfies AdSense review.

Google Search's helpful-content guidance expressly recognizes calculators and
online tools as main content when they fulfill a page's purpose. This does not
establish AdSense acceptance for these particular tools. The product
recommendation is to help visitors process their own files, inspect results
and download usable outputs; it does not depend on claiming that an assistant
can never perform similar work.

## Current inventory and HTTP findings

The source inventory contains 18 registered tools, all with authored guides, across seven populated categories.
The sitemap contains 30 URLs: five site pages, 18 tool pages and seven category pages.
The five site pages are Home, All tools, About, Contact Us and Privacy Policy.

The root audit observed the following on the public site:

- All 30 sitemap URLs returned HTTP 200.
- Each returned one HTML title, with the identical value `iworkhere`.
- Each returned one page-specific meta description and one correct self-canonical, allowing normal apex trailing-slash normalization.
- Each declared `index, follow` in its robots metadata.
- `/robots.txt`, `/sitemap.xml` and `/ads.txt` returned HTTP 200.
- `/no-such-page` returned HTTP 404; both robots tags prohibited indexing.
- Nine sampled real pages contained no AdSense script in initial HTML. This does not prove the absence of every runtime request or the state of remote advertising settings.

Sources: [registry](../../src/module/tool/registry.ts), [guides](../../src/module/tool/guide.ts), [categories](../../src/module/tool/category.ts), [sitemap](../../src/app/sitemap.ts), [robots](../../src/app/robots.ts), and [metadata helper](../../src/lib/seo.ts).

## Priority 1: Restore descriptive browser titles

**Classification: confirmed source and HTTP finding; user-assigned highest priority.**

`buildPageMetadata` returns the constant `BROWSER_TITLE = "iworkhere"` for every route even though it receives descriptive route metadata.
The descriptive wording survives only in Open Graph and Twitter titles.
The merge tool already has its own SEO title in the registry, so this is a shared-helper regression rather than eighteen missing route implementations.

Restore the route-specific HTML title and a consistent brand suffix, including the requested example `Merge PDF Files Online - iworkhere`.
Keep tool identity in the registry, keep category identity in its existing owner, and preserve descriptions, canonicals and preview indexing protections.
Do not insert the brand twice or copy the same keyword list into every title.

Existing tests intentionally enforce the uniform title and must change with the approved contract.
Acceptance must cover initial HTML, direct visits, client navigation, reload, all sitemap routes and a noindex 404 page.
The October 24 uniform-title decision must be explicitly superseded in current documentation rather than silently rewriting historical records.

Sources: [SEO helper](../../src/lib/seo.ts), [registry](../../src/module/tool/registry.ts), [tool route](../../src/app/tool/[slug]/page.tsx), [metadata tests](../../src/lib/seo.test.ts), [browser navigation tests](../../test/e2e/site-title-navigation.spec.ts), and [document-family tests](../../test/e2e/document-family.spec.ts).

## Priority 2: Correct numerical behavior

**Classification: confirmed calculator defect; additional source-observed numerical boundary risks.**

The calculator guide states that `2 * -3` produces `-3`; a guide-example test explicitly expects that result.
The parser rewrites unary minus as binary `0 -` without preserving the precedence needed after multiplication or division.
Describing an incorrect result accurately does not make the calculator useful for that expression.

Correct signed arithmetic in the existing calculator owner and update the guide and tests to mathematical expectations.
Retain the safe expression parser and the current arithmetic scope; no dynamic evaluation or broad calculator redesign is needed.

Required regression cases include:

- `2 * -3 = -6` and `2 / -2 = -1`.
- `1--2 = 3` and `-(2+3) = -5`.
- `2 * (-3) = -6`, with normal operator precedence preserved.
- Malformed expressions and unbalanced parentheses produce errors.
- Division by zero and nonfinite results remain errors.

Length and Weight Converter reject `NaN` input but lack finite-result checks after scaling.
A finite value such as `1e308` can overflow during conversion; an invalid numerical result should be an explicit error, not a displayed measurement.
Time Arithmetic checks integer hours but does not bound safe total-minute arithmetic or addition.
Specify and test supported finite/safe ranges without claiming arbitrary precision.
These converter and time findings were established from source, not a live browser reproduction during this audit.

Sources: [calculator](../../src/module/tool/math/CalculatorTool.tsx), [guide examples](../../src/module/tool/guideExample.test.tsx), [guides](../../src/module/tool/guide.ts), [length conversion](../../src/module/tool/everyday/LengthConverterTool.tsx), [weight conversion](../../src/module/tool/everyday/WeightConverterTool.tsx), and [time arithmetic](../../src/module/tool/time/timeArithmetic.ts).

## Priority 3: Prove all 18 tools complete their intended tasks

**Classification: release acceptance recommendation; not a finding that all tools are broken.**

Use the existing tool suites to exercise a meaningful successful operation for each registered tool, its result and its copy/download path where applicable.
Verify output content or semantics rather than only a success label, enabled button or HTTP 200 response.
Include the most relevant invalid-input case, replacement/reset behavior and a narrow-screen interaction for each family.

For PDFs, verify page order/count and the documented fidelity boundary; for images, verify dimensions, output format and actual byte outcomes.
For JSON, verify preservation of numeric tokens, escape spelling, duplicate names and member order.
For QR, decode an actual generated sample; for text, test the documented Unicode and line rules.
Keep real input/files/results out of analytics, diagnostics and shared URLs except the calculator's explicitly documented expression-sharing behavior.

Retain the existing worker, file-limit and cancellation contracts.
Report any remaining failure honestly and resolve it before claiming the candidate is ready for resubmission.
Do not aggregate historical test counts into a claim about the new candidate.

Sources: [testing guide](../TESTING.md), [tool guide tests](../../src/module/tool/guide.test.tsx), [guide-example tests](../../src/module/tool/guideExample.test.tsx), [document-family tests](../../test/e2e/document-family.spec.ts), and [tool content/accessibility tests](../../test/e2e/tool-content-accessibility.spec.ts).

## Priority 4: Preserve advertising eligibility and privacy boundaries

**Classification: existing protections to retain, with a preview-environment guard risk.**

Only valid tool templates compose the manual advertising frame. The tool error boundary wraps the complete frame and replaces a render failure with an ad-free fallback.
Home, discovery, categories, About, Contact, Privacy and unknown routes are excluded from manual advertising.
The publisher verification meta tag and `/ads.txt` exist without enabling live ad serving.

The enable helper currently requires the explicit flag and `NODE_ENV === "production"`; a preview build can also have that Node environment.
An explicit preview deny rule would protect the contract if a public flag were accidentally inherited by preview configuration.
No live preview advertising violation was demonstrated, and controlled tests must continue to use stubbed advertising endpoints.

Preserve clear labels, separation from action controls, ad-free error/informational pages, and the prohibition on test clicks or real ad requests.
Also review desktop/mobile advertising layouts against [Google's content-versus-advertising policy](https://support.google.com/publisherpolicies/answer/11169917): advertising and paid promotional material must not exceed actual publisher content. Whitespace, header/footer content and links to other site content do not increase that content allowance. This is a planned controlled-layout and pre-activation check, not an observed violation in the default-off site.
Before activation, verify account readiness, seller authorization, applicable consent configuration and remote Auto ads exclusions.
The [required privacy content](https://support.google.com/adsense/answer/1348695?hl=en) and [Google-certified CMP guidance](https://support.google.com/adsense/answer/13554116?hl=en) apply to the actual advertising setup; a privacy page alone does not collect consent.

Sources: [advertising policy](../ADVERTISING.md), [ad configuration](../../src/module/ad/config.ts), [eligible frame](../../src/component/common/AdSenseEligiblePage.tsx), [tool template](../../src/component/tool/ToolPageTemplate.tsx), [privacy page](../../src/app/privacy/page.tsx), and [eligibility tests](../../test/e2e/ads-eligibility.spec.ts).

## Priority 5: Expand original examples and practical explanations

**Classification: content recommendation building on existing work.**

All 18 tools already have authored guides. Five have richer worked examples with original downloadable source/result files and measured facts: Compress PDF, PDF to JPG/PNG, Images to PDF, Image Resizer and Image Converter.
Preserve these examples and their provenance, output verification and browser-specific qualifications.

Add four file demonstrations: Merge PDF, Split PDF, Image Compressor and HEIC Converter.
Demonstrate document/page ordering, explicit split groups, compression outcomes and HEIC conversion compatibility using original or appropriately licensed samples.
These additions bring the rich file-example coverage to nine tools; the other nine tools use appropriate verified inline examples rather than artificial file panels.
The existing HEIC test source is an attributed upstream MIT fixture. Reuse must retain its exact license and provenance, and must not describe that source image as original or project-owned; see the [fixture provenance](../../test/fixtures/images/README.md).
Compression guidance must show that smaller output is conditional, and sample output sizes must not become guarantees for every input or browser.

Add focused JSON, word-counter and QR examples showing behavior visitors can inspect or reproduce.
The JSON formatter's token preservation, the counter's grapheme/line semantics and an independently decoded QR are more useful than generic repeated descriptions.
Existing compact numerical/text examples can remain compact where that answers the task completely.

The current example panel is presentation-only. Any new sample-loading interaction needs its own explicit contract and must not silently turn that component into a tool-state coordinator.
Verify every published measurement against actual fixture bytes or executed results, and ensure instructions match current control labels.

Sources: [example data](../../src/module/tool/valueExamples.ts), [example panel](../../src/component/tool/ToolExamplePanel.tsx), [example verification](../../src/module/tool/valueExamples.test.ts), and [example browser tests](../../test/e2e/tool-value-examples.spec.ts).

## Priority 6: Add four complete task guides

**Classification: proposed additions; not implemented at the audited snapshot.**

Four specific task guides can demonstrate useful combinations of the existing tools without creating a general-purpose blog.
Each should have a distinct task, an authored demonstration with documented sample provenance, explicit sequence, result checks and relevant limits, with links to the working tools.

- **Prepare a PDF packet:** select/split needed pages, merge documents in a chosen order, and optionally try structural compression. Explain that compression may not reduce size and that digital-signature validity is not guaranteed after processing.
- **Prepare an image for an upload form:** distinguish pixel dimensions, accepted format and byte limits. Demonstrate resize/compress/convert decisions; do not promise a target-size control, guaranteed byte cap, cropping or exact visual preservation that the current tools do not provide.
- **Turn HEIC photos into a PDF:** convert each accepted HEIC source to JPEG/PNG, then combine those files with Images to PDF. Make the manual download/select handoff explicit; there is no direct HEIC input or automatic multi-tool pipeline.
- **Prepare PDF pages for slides** at `/guide/pdf-pages-for-slides`: export selected PDF pages as PNG/JPG, then resize an image for a slide. Explain selection/order, supported DPI, format, dimensions and legibility checks. The extra resizing stage and slide-specific decisions must add value beyond the PDF-to-image tool instructions.

The PDF-pages-for-slides task is the most likely to duplicate existing material; its sample, resizing stage and slide-specific selection/format decisions are acceptance requirements.
Keep these guides useful without promising unsupported tools, automatic file transfer or a search ranking benefit.

## Priority 7: Connect tasks to existing discovery

**Classification: navigation recommendation; existing internal linking is present.**

Home already introduces five common jobs; All tools exposes the catalog; category pages provide selection guidance; tool pages provide breadcrumbs and related tools.
Extend those owners with relevant task-guide links and reciprocal links from guides to tools.
Keep tool identity and routes registry-owned and derive related-tool names through the existing metadata layer.

Avoid duplicate landing pages for spelling variants or near-identical keywords.
Do not advertise unsupported intents such as exact target-size compression, Office conversion, PDF password removal or full PDF editing.
Use actual Search Console evidence when available to refine copy and priorities; no query-volume claim is made here.

Sources: [home](../../src/app/page.tsx), [discovery](../../src/app/discover/page.tsx), [category guidance](../../src/module/tool/category.ts), [tool template](../../src/component/tool/ToolPageTemplate.tsx), and [metadata queries](../../src/module/tool/metadata.ts).

## Priority 8: Verify crawlability, freshness, mobile use and performance

**Classification: positive crawl findings plus a service-worker risk and unmeasured performance scope.**

Sitemap, robots, self-canonicals and server-visible content already exist and were observed in live HTTP responses.
Keep new pages consistent with those owners and exclude unknown, unfinished and operational routes from the sitemap.
The old October 3 audit's missing-sitemap, missing-robots and ten-tool findings are historical and must not be reused as present facts.

The service worker uses a fixed `app-shell-v1` cache. Full navigation is network-first, but other GET requests enter a broad cache-first branch except `/api/` requests.
There is no explicit distinction for Next.js RSC/prefetch responses or unversioned public metadata and no same-origin restriction in that branch.
This is a freshness/cache-scope risk; the audit did not reproduce stale production titles or establish a field-performance defect.

Define bounded cache classes and prove that returning browsers receive updated titles/content after a release, including client navigation and reload.
Preserve offline HEIC/PDF worker behavior and do not delete caches belonging to unrelated applications.
Verify narrow-screen controls, keyboard use, focus, readable layout, download accessibility and loading costs of the expanded content.
Report lab measurements as lab measurements; do not substitute them for unavailable real-user Core Web Vitals.

Sources: [service worker](../../public/sw.js), [registration](../../src/component/layout/ServiceWorkerRegister.tsx), [worker tests](../../test/e2e/service-worker.spec.ts), [loading tests](../../test/e2e/browser-loading.spec.ts), and [historical audit](seo-discoverability-audit.txt).

## Priority 9: Verify the deployed candidate before requesting review

**Classification: operational acceptance; not completed by this documentation update.**

Complete the implementation plan and required candidate-specific validation, then verify the deployed source identity separately from a GitHub merge or release tag.
Recheck all public routes, descriptive titles, canonical/indexing metadata, sample assets, important tool outcomes, mobile navigation and trust-page links on that deployment.
Confirm applicable AdSense account conditions and report any remaining blocker without inventing evidence.

Request review only after the intended improvements are publicly available and the separate account action is authorized.
Serving ads is a different action from site verification or requesting review; retain default-off serving until its own readiness conditions are satisfied.
Record a traffic baseline when account data becomes available, but do not invent a minimum visit count or postpone a technically ready review for an arbitrary measurement period.

## Documentation and preservation requirements

Keep the frozen v0.5.0 and v0.6.0 catalog scopes and existing version histories intact.
Place all nine new priorities in the immediate v0.4.4 plan, with dependent batches inside that release rather than separate releases for individual tests or audit steps.
Keep the October 3 audit and earlier plans as dated history; link this audit as current evidence.
Update current metadata, architecture, advertising, testing and status documentation where implementation changes their contracts.
Do not represent this audit or the planning commit as implementation, passing browser tests, public deployment, AdSense approval or measured traffic growth.
