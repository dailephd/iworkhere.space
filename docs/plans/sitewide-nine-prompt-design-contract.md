# Sitewide nine-prompt redesign - planned design and architecture contract

Status: PLANNED. Nothing in this document is implemented. Every behavior, route, module, component, type and test named below as planned is a future target, not a current fact. Current-state facts appear only in sections that are explicitly labelled as verified candidate evidence.

Document date: 2026-10-29.
Document type: milestone planning contract, materialized by coding-agent Prompt 1 of 9 from the Global Planner's approved specification.
Not: a roadmap replacement, a release plan, a current-state design description, or a list of implemented features.

## 1. Purpose, authority and boundaries

This document freezes the planner-approved sitewide redesign so that Prompts 2 through 9 can be executed one at a time against a single maintained contract. It was produced after a read-only verification of the actual uncommitted local candidate. It records where the candidate already supplies the owners the plan needs, and where the plan asks for something that does not exist yet.

Source-of-truth ranking used to write this document:

- First, the planner-frozen contract and current approved product requirements govern desired future behavior.
- Second, the actual candidate HEAD plus its uncommitted changes govern current application, source and test facts.
- Third, the candidate's AGENTS.md, CLAUDE.md and existing canonical documents govern compatible structural restrictions. No manifest.txt exists in the candidate.
- Fourth, the completed local audit (46 registered issues) is historical observation and evidence. Its path references are not proof that uncommitted files are unchanged.
- Fifth, GitHub master is only historical or public precedent. It is never substituted for this dirty candidate.

Relationship to the roadmap: this milestone is the approved sitewide nine-prompt redesign. It is not assigned a new semantic release version. The frozen v0.5.0 (Developer and Text Utility Suite) and v0.6.0 (Time and Everyday Calculators) catalogs, the proposed converter waves, and every other roadmap entry are untouched. This document implies no release, tag, deployment, publication or AdSense action.

Documentation-first obligations (repository rules, restated because Prompt 1 may not edit these files):

- Style and design-system changes require docs/DESIGN.md to be updated before code. Prompts 2, 3 and 4 must each update docs/DESIGN.md first. The first update must record that this contract supersedes, for the redesign only, the approved Colorfield homepage order (which kept featured tasks and workflow-guide cards below the catalog) and its "no site-wide header change" restriction.
- Architecture changes require docs/architecture.md to be updated before code. Prompts 2 and 5 must update it first (header and navigation; the new workflow module).
- New abstractions require AGENTS.md and CLAUDE.md to be updated. This applies to the workflow module, PageHeader, ContentPanel, UtilityCard, ToolSurface, StageStepper and the tool finder.
- Project status in docs/project-status.md is updated only to describe verified reality after each prompt.
- Prompt 1 edited none of these files.

## 2. Verified baseline identity (candidate evidence)

All facts in this section were read from the actual candidate on 2026-10-29.

Candidate root (the only active candidate): the worktree .my-dev-kit-workflow/worktrees/homepage-colorfield-refresh under the canonical host checkout iworkhere.space.
Branch: feature/homepage-colorfield-refresh.
Expected audit-time HEAD: 8dcb15c4ad2c44bfacce09e8744bedf57c32cae1.
Actual HEAD: 8dcb15c4ad2c44bfacce09e8744bedf57c32cae1. This matches.
Root package: iworkhere.space version 0.4.4.
Remote: origin at the project's GitHub repository (fetch and push).
Recent history, newest first: docs(index) link approved homepage Colorfield design; docs(status) record approved Colorfield design as pending; docs(home) record pending Colorfield presentation contract; docs(design) approve Colorfield homepage direction and acceptance; then the merged v0.4.4 release lineage (origin/master at f9b6723).
manifest.txt: not present. docs/ecosystem/TOOL_ECOSYSTEM_REFERENCE.txt and docs/ecosystem/WORKFLOW_PROMPT_ASSEMBLY_RULES.txt: not present.
Collision check before writing: this document and the Prompt 1 report did not exist; the destination directories are ordinary directories (no link or reparse redirection).

Uncommitted state at the start of Prompt 1 matches the audit handoff exactly: 25 modified tracked paths and 2 untracked paths.

Modified tracked paths (25):

- AGENTS.md
- docs/DESIGN.md
- docs/components/HomeClient.md
- docs/project-status.md
- src/app/HomeClient.test.tsx
- src/app/HomeClient.tsx
- src/app/category/[category]/page.test.ts
- src/app/category/[category]/page.tsx
- src/app/discover/page.test.tsx
- src/app/discover/page.tsx
- src/app/global.css
- src/app/guide/page.tsx
- src/app/layout.test.tsx
- src/app/layout.tsx
- src/app/page.test.tsx
- src/app/page.tsx
- src/component/common/ToolSearch.tsx
- src/component/content/TaskGuidePage.tsx
- src/component/tool/ToolExamplePanel.tsx
- src/component/tool/ToolPageTemplate.tsx
- src/style/theme.css
- test/e2e/palette.spec.ts
- test/e2e/task-guides.spec.ts
- test/e2e/theme-pilot.spec.ts
- test/e2e/v0.4.3-discovery.spec.ts

Untracked paths (2):

- src/app/HomeToolIcon.tsx (SHA-256 C5E0E4AD32B070AEAD7BC96F0113AB16D06BB13E5F77D1A284A9596621911339)
- src/app/designRole.test.tsx (SHA-256 E4234B3C8B7F8C35654326078185B02A65CCF2691EC08FC9BF60B335FE3B0856)

Deterministic fingerprints of the candidate before this document was created:

- Diff fingerprint: SHA-256 of the UTF-8 text of "git diff HEAD" (output lines joined with a line feed), 25 files changed, 713 insertions, 143 deletions: b151e83b0a6de6974cbad2f1b888007ebe6aa3c2146bb6caf66ecf7e8b6137a9.
- Untracked-content fingerprint: SHA-256 of the sorted "path:filehash" lines of the two untracked files: cf12bcf4f339f91568ecdf2bd57ae9cb2b37a1f208d3d653c365a57b4db0093d.
- Prompt 1's own outputs (this document and the local report) are the only additions; the local report path is ignored by Git, and this document is the sole new trackable path.

Interpretation: the candidate is the Colorfield homepage refresh (typography, unified card language, palette-coherent dark homepage roles, HomeToolIcon). It contains no workflow module, no workflows route, no tool finder, no HeaderSearch, no PageHeader, ContentPanel, UtilityCard, ToolSurface or StageStepper. All of those planned paths were confirmed absent.

Index and retrieval provenance:

- Tool: @dailephd/my-dev-kit, the latest published version resolved at execution start was 1.13.0, pinned and installed into the project-local prefix .my-dev-kit-workflow/tools/sitewide-p01/mdk-1.13.0 with scripts disabled. Cache and temp were project-local (.my-dev-kit-workflow/npm-cache and .my-dev-kit-workflow/tmp).
- Index: the mutable current index .my-dev-kit-context/indexes/iworkhere-space-v0.4.4-current. Its manifest identified the correct project root and TypeScript, with source roots src and test (broader than the src-only example in the prompt, but a subset of the repository and required to locate nearest tests). It was refreshed incrementally with the same two roots. A second index folder named with a dot in the project name was left untouched.
- Three focused searches were run (navigation and header; image and PDF processing; search, theme, category and routes), then lookup, depth-1 slice and bounded source by symbol, line range or exact-string retrieval. Where a whole short file was returned, it was because the requested line range covered the entire file (each under the 160-line cap); no unbounded file read of production or test source was used.

## 3. Current versus planned separation

Current candidate facts that the plan builds on (verified):

- The registry holds exactly 18 tools in seven populated categories. Category order from the single category owner is document, text, math, converter, time, image, developer. Titles from that owner are PDF Tools, Text Tools, Math Tools, Converters, Time Tools, Image Tools, Developer Tools.
- The header is one fixed semantic header with a measured footprint and a header-height variable, wrapping its navigation. It currently contains a "Search tools" link to /discover in addition to the "All tools" navigation item.
- The sitemap derives 35 canonical URLs; both its unit test and the container route inventory script assert exactly 35.
- Home currently renders a catalog plus the five featured task cards and four workflow-guide cards from the candidate's changes.
- The four manual guide pages exist at /guide/<slug> with the same four slugs the plan will use as workflow slugs.
- All processing is browser-local. No server upload exists for any tool.

Everything in sections 5 through 12 is PLANNED. None of it is a description of what the site does today.

## 4. Route and navigation graph (planned)

Primary navigation, in this exact order and with these exact destinations:

- Home -> /
- All tools -> /discover
- Workflows -> /workflows
- Guides -> /guide

(Amended 2026-10-31 by the product owner: About -> /about is a footer link, not a primary header link. The header has four primary links plus the Categories menu.)

Secondary Categories (Browse tools) menu: the seven existing canonical category IDs in the established definition order: document, text, math, converter, time, image, developer. Each links to /category/<id>. Labels must come from the category owner's definition title for that ID (getToolCategoryDefinition(id).title), never from capitalizing the raw ID. Do not merge, rename or remove route slugs.

Verified conflict that Prompt 2 must fix: the current label helper (getToolCategoryLabel in src/module/tool/category.ts) returns the definition title only for converter and otherwise capitalizes the raw ID, which is why "Document" and "Image" currently appear instead of "PDF Tools" and "Image Tools". The navigation labels, Home chips, discover list and breadcrumbs consume that helper. The change belongs to the category owner and its tests, not to a new list elsewhere.

Search is a utility control, not a primary item. No second link labelled "Search tools" pointing to /discover may exist; the header's present "Search tools" link is therefore replaced by the utility Search control.

Header interaction contract (planned):

- At 1024 CSS px and wider: one stable persistent row with brand, the five primary items, the category disclosure, Search and Themes. No wrapping onto an orphan navigation row.
- At 390 x 844 CSS px: the collapsed persistent header is at most 72 px tall (target 64 to 72), replacing the currently measured 228 px. Brand plus Menu, Search and Themes remain usable with targets of at least 44 x 44 px (any exception must be justified and documented).
- One expandable mobile menu contains all five primary links and all seven category destinations, directly visible once opened. Reaching a destination takes at most two actions: open the menu, activate the destination.
- Opening the menu does not increase the persistent 72 px footprint. The menu is an overlay or disclosure that may scroll independently.
- Required behavior: Escape closes the menu; outside dismissal when applicable; focus returns to the trigger; aria-expanded and aria-controls are correct; keyboard traversal works.
- No horizontal overflow at 360, 390, 768, 1024 and 1440 CSS px.
- Preserve one semantic header, HeaderViewportControl's measured footprint, the scroll-padding behavior and the skip link. Do not reinstate retractable footer navigation.
- Search: a utility button that navigates to /discover#tool-search and focuses the labelled search input (the input in ToolSearch already has the id tool-search, so the fragment targets the input itself). On /discover it focuses that input in place. Plain /discover must not steal focus. The search algorithm and results are corrected in Prompt 8, not before.
- Themes: reuse the existing ThemeToggle and ThemeProvider. No new theme state or remount.

Tests that currently pin the old header shape and therefore must be updated in Prompt 2 (verified in the candidate; the planner prompt named only the first):

- test/e2e/fixed-header.spec.ts (wrapping-at-width checks, the "Search tools" link, the resize-follows-wrapped-header check)
- test/e2e/responsive-shell.spec.ts (the "Search tools" link assertion)
- test/e2e/brand-assets.spec.ts (the "Search tools" link assertion)
- src/component/layout/VerticalNav.test.tsx, src/component/layout/HeaderViewportControl.test.tsx, src/component/layout/AppShell.test.tsx and src/app/layout.test.tsx (nearest unit owners; extend, do not delete)

Home composition (planned):

- Hero: a concise statement of what the browser-local utilities do. One heading and at most one brief supporting sentence. No slogan plus caveat stack. Note: the currently approved Colorfield H1 and support sentence must be reconciled in docs/DESIGN.md first.
- Then, in order: accessible search, category navigation (chips), and a responsive catalog of exactly 18 unique tools grouped by the seven existing categories. Per-category membership in the registry today: document 5, text 3, math 1, converter 2, time 1, image 4, developer 2.
- One consistent whole-card-link type: category identity or icon, the real tool name, a concise input-to-output description, and the real /tool/<slug> destination. "Exactly 18" is a structural and test assertion, not visitor copy; the previously approved rule against showing totals or per-category counts on Home remains in force.
- Remove the Home-only "Start with a common task" five cards and the "Practical file workflows" four cards. No alternative task, guide, workflow or recommendation cards on Home. valueExamples, guides and real tool code are preserved elsewhere.
- Single-tool categories (math, time) use a compact layout, never a nearly empty full-width row.
- At 390 x 844 at least one actionable tool card is visible without scrolling; search and category links are preserved.
- No false duplicate result-and-catalog display while search is active (that correction belongs to Prompt 8).

Workflow routes (planned, all new):

- /workflows (landing and list)
- /workflows/prepare-image-for-upload
- /workflows/heic-photos-to-pdf
- /workflows/assemble-pdf-packet
- /workflows/pdf-pages-for-slides
- src/app/workflows/[slug]/page.tsx returns notFound for unknown slugs.
- Each workflow collects all files and required parameters first, then runs after ONE Process action, executes its stages internally and verifies the final downloadable output(s). No manual intermediate download, re-upload, page-driving or second Process. Browser-local only: no backend, cloud upload, account or persistent file storage.
- The landing and detail pages must distinguish operational from not-yet-implemented workflows. No fake Process button and no falsely successful placeholder. Prompts 2 to 4 may show an informational Workflows landing with accurate "coming soon" status only if a later prompt explicitly authorizes it; working detail routes arrive in Prompts 5 and 6.

Guides (planned):

- /guide remains an interactive, deterministic "Which tool or workflow should I use?" navigator. It is not an education hub and not a manual chain of buttons.
- The four existing /guide/[slug] URLs remain alive and honest until the corresponding automated workflow is verified. Redirects follow the repository's existing permanentRedirect precedent in the category route (app route owner, Next permanentRedirect). Only Prompt 7 may add them, only for verified-operational workflows, with correct canonical and sitemap handling.
- No generative AI and no new catalog identity registry. Choices link to real tool IDs resolved from tool metadata or to operational workflow slugs.

## 5. Ownership graph

Layer rules (unchanged): src/app is routing and composition; src/module is domain logic, tools and registries (UI allowed only where this contract explicitly delegates it); src/component is reusable UI with no knowledge of tools, slugs or routing; src/lib is generic helpers with no module imports.

Existing authoritative nodes to reuse (each confirmed present in the candidate):

- Site navigation composition: src/app/layout.tsx, src/app/navData.ts. Layout builds the navigation list from defaultNavItem, the populated categories (aboutNavItem was removed on 2026-10-31; About is a footer link).
- Persistent header: src/component/layout/Header.tsx, VerticalNav.tsx, HeaderViewportControl.tsx, AppShell.tsx.
- Home: src/app/page.tsx, src/app/HomeClient.tsx (and the candidate's HomeToolIcon.tsx).
- Discovery and search: src/app/discover/page.tsx, DiscoverClient.tsx, src/component/common/ToolSearch.tsx.
- Category routing and identity: src/app/category/[category]/page.tsx, src/module/tool/category.ts.
- Tool identity: src/module/tool/registry.ts, metadata.ts, type.ts. Only these own tool IDs, names, canonical URLs, categories and metadata. ToolId and ToolSlug are plain string types (not unions), so every ID reference must be validated by test through metadata.
- Tool pages: src/app/tool/[slug]/page.tsx, src/component/tool/ToolPageTemplate.tsx and the 18 per-tool UI owners under src/module/tool.
- Current guide identity and content: src/app/guide/page.tsx, src/app/guide/[slug]/page.tsx, src/module/content/taskGuide.ts, src/component/content/TaskGuidePage.tsx.
- Theme and tokens: src/style/theme.css, src/app/global.css, src/module/theme/themeRegistry.ts, ThemeProvider, ThemeToggle and theme storage.
- SEO: src/lib/seo.ts (buildPageMetadata, canonicalUrl, buildBrowserTitle) and src/app/sitemap.ts.

Planned new paths (none exist; none may be created before the named prompt):

- src/app/workflows/page.tsx and src/app/workflows/[slug]/page.tsx: Server Component route composition and SEO only.
- src/module/workflow/type.ts: only workflow request, stage, result and failure contracts.
- src/module/workflow/registry.ts: only the four workflow definitions, stage descriptions, operating status, capabilities and canonical workflow paths. It must not duplicate ToolDefinition.
- src/module/workflow/runner.client.ts: browser-only orchestration with AbortSignal-based progression, verification, result and cleanup.
- src/module/workflow/adapters.client.ts: thin orchestration adapters importing existing image and PDF primitives. No new image or PDF algorithm and no independent worker framework.
- src/module/workflow/WorkflowClient.tsx: the domain-aware client form (upfront inputs, one Process action, result ownership). Private helper files may live in this directory without adding another structural directory. Precedent for module-level client UI exists (the support coordinator under src/module/support), and the exception to the "UI only inside tool components" sentence must be recorded in architecture.md and the agent guidance before code.
- src/component/workflow/StageStepper.tsx: generic accessible stage and progress visualization, no workflow-slug decisions and no file processing.
- src/component/common/PageHeader.tsx, ContentPanel.tsx, UtilityCard.tsx: reusable non-domain page structure and whole-card link anatomy.
- src/component/tool/ToolSurface.tsx: reusable themed input, panel, action, preview and result primitives. Per-tool UI continues to own processing, state, events and field semantics.
- src/module/content/toolFinder.ts: the authored deterministic decision graph referencing existing ToolId and WorkflowSlug only.
- src/module/content/ToolFinderClient.tsx: accessible guide interaction state and navigation; may delegate purely visual choices to existing src/component/content/.
- src/component/layout/HeaderSearch.tsx: the focused search-navigation client control.

Edges:

- Server route -> existing metadata and registry -> domain client UI.
- Domain client UI -> workflow runner -> thin adapters -> existing browser-local processing and worker operations -> in-memory Blob, File and Uint8Array -> verifier -> final outputs.
- Guide client -> authored decision graph -> existing tool metadata or operational workflow registry -> direct route.
- Generic components receive display props only and never import module registries. src/lib never imports src/module. src/app never owns processing logic.

Not authorized: any additional top-level module, parallel theme provider, alternate tool registry, generated route framework, new server API, database table, cloud processor, storage store, or universal PDF processing engine.

Overlap to manage: the existing TaskGuideSlug union in src/module/content/taskGuide.ts and the planned WorkflowSlug union are the same four strings. They must stay separate types with separate owners; the task-guide step lists are manual guidance and must never be presented as runnable stages.

## 6. Candidate witnesses, grounded gaps and risks

Canonical precedent witnesses confirmed in the dirty candidate (all by bounded retrieval):

- Tool and category identity: registry.ts holds 18 definitions with the IDs merge-pdf, split-pdf, images-to-pdf, pdf-to-image, compress-pdf, slugify, calculator, length-converter, html-text-extractor, weight-converter, time-arithmetic, image-resizer, image-compressor, image-converter, heic-converter, json-formatter, word-character-counter, qr-code-generator. Every tool ID named in the guide graph (section 9) exists. metadata.ts provides getAllTool, getToolByIdList, getAvailableCategory and related queries. category.ts exports ToolCategory (derived), isToolCategory, getToolCategoryDefinition and getToolCategoryLabel.
- Image primitives (src/module/tool/image): imageFile.ts holds MAX_SOURCE_BYTES 26,214,400 and MAX_PIXEL_AREA 30,000,000, ImageFileFormat jpeg|png|webp, IMAGE_FILE_ENCODING (mime, extension, label), signature detection and validators. imageConverter.client.ts convertImage, imageResizer.client.ts resizeImage and imageCompressor.client.ts compressImage each take a File and return a Blob. The HEIC path exposes startHeicOperation(request) returning a cancellable operation with a promise; requests are inspect or convert with target jpeg or png; a worker-only decoder import is enforced.
- PDF primitives (src/module/tool/document): pdfFile.ts constants are MAX_SINGLE_PDF_BYTES 10 MiB, MAX_PDF_PAGES 100, MAX_INPUT_PDFS 10, MAX_AGGREGATE_PDF_BYTES 25 MiB, MAX_AGGREGATE_PAGES 100, MAX_IMAGES 20, MAX_AGGREGATE_IMAGE_BYTES 25 MiB, MAX_OUTPUT_IMAGES_PER_OPERATION 20, MAX_SPLIT_OUTPUT_GROUPS 20, MAX_RENDER_SIDE 4096 and MAX_RENDER_AREA 16,000,000. These equal the limits in section 7. pdfFile.client.ts inspectPdfFile, pdfRuntime.client.ts openPdfDocument, measurePdfPage and renderPdfPage (PDF.js), pdfLib.client.ts startMergePdfOperation, startSplitPdfOperation, startImagesToPdfOperation and startPdfLibOperation (each with a timeout parameter defaulting to 30,000 ms and a cancel method), compressPdf.client.ts compressPdf(bytes, signal) returning smaller or no-reduction, pdfLibVerification.client.ts verifyPdfLibOutput(bytes, expected geometry, signal), imagesToPdf.client.ts inspectImagesToPdfFile, pageSelection.ts and orderedFile.ts.
- PDF to image: convertPdfToImages(bytes, pages, option, signal) takes a native AbortSignal, renders at scale dpi/72 in the requested page order, flattens JPEG on white, and verifies each blob's MIME and decoded dimensions. Allowed option values are PNG or JPEG, DPI 72, 150 or 300, and JPEG quality 0.50 to 1.00.
- Worker protocol: pdfLib.workerType.ts defines the request union foundation, merge, split and images-to-pdf, and the response readers hardcode that operation set. Only pdfLib.worker.ts imports pdf-lib in production source.
- Failure and validation shapes: PdfFileFailure categories, HeicWorkerError categories, PdfLibFailure (initialization, processing, protocol, timeout, encrypted), PdfToImageFailure (option, encoding, verification), plus ImageFileError and PdfFileError classes.
- Local-only processing: no server upload exists in any current processing path.
- Redirect precedent: the category route calls permanentRedirect for the historical everyday category.
- Search anchor: the ToolSearch input already carries id tool-search.
- Theme: themeRegistry.ts defines PaletteId mineral, oxblood, signal, cobalt, amber, original, onedark and ThemeId system, light, dark, onedark; the role variables listed in section 10 and category variables (--category-<id> with -soft) for all seven categories exist in src/style/theme.css (five declaration blocks per role).
- Tests nearest to each owner: header and navigation (HeaderViewportControl.test.tsx, VerticalNav.test.tsx, AppShell.test.tsx, layout.test.tsx, fixed-header, responsive-shell, site-title-navigation and app-navigation specs); Home and discover (page.test.tsx, HomeClient.test.tsx, discover/page.test.tsx, v0.4.3-discovery spec); category (category.test.ts, category/[category]/page.test.ts, category-migration spec); registry and metadata (registry.test.ts, metadata.test.ts); tools (per-tool Tool tests and pure-logic tests under src/module/tool); theme (themeRegistry, themeStorage, themeRuntime, paletteToken tests; palette, theme and theme-pilot specs); guides (taskGuide.test.ts, TaskGuidePage.test.tsx, task-guides spec); sitemap (sitemap.test.ts and the container inventory script test). There is no ToolSearch unit test file and no Header unit test file today; they are not required for the plan but will be needed by Prompts 2 and 8 if those components change materially.

Grounded absences: no workflow module, route, registry, runner, adapter, stepper, tool finder, header search control, shared PageHeader, ContentPanel, UtilityCard or ToolSurface exists; no "assemble" operation exists in the pdf-lib worker; no sitemap entry exists for any workflows route.

Findings that later prompts must account for (none blocks this specification):

- The existing resize and compress client functions do not flatten transparency onto white when the output is JPEG; only the converter and the HEIC canvas do. The fixed stage order (convert before resize and compress) keeps a transparent source from reaching a JPEG encode without conversion, and Prompt 5 must test a PNG-with-alpha source targeted at JPEG.
- resizeImage encodes non-PNG output at a fixed 0.92; compressImage controls quality; PNG output has no quality control (compression of PNG output can only come from reducing dimensions). The 12-encode search must be built from these primitives.
- convertImage, resizeImage and compressImage accept File, not Blob. Adapters wrap intermediate Blobs in memory as File objects; no source change is authorized for this.
- The slides renderer's existing validator rejects duplicate page numbers and more than 20 pages per operation. The slides workflow reuses that validator, so duplicate or more-than-20 selections are rejected (not silently trimmed). The PDF packet, by contrast, explicitly allows repeated source pages, which is part of the new assemble operation.
- Existing worker operations default to a 30,000 ms timeout. A large assemble run may need a larger timeout argument, which the existing operation signatures already accept; timeouts map to a typed failure, never to a partial result.
- The existing runtime verifier checks page count, page geometry and rotation. It does not prove content identity of each page. Content-order proof for the packet comes from labelled fixtures verified in tests (as in the v0.4.4 precedent), not from a new runtime engine.
- The sitemap unit test and script/publicRouteInventory.ts both assert exactly 35 URLs. Adding any workflows URL to the sitemap requires updating both together and passing the container gate.

## 7. Workflow contract (planned)

Exact slugs: prepare-image-for-upload, heic-photos-to-pdf, assemble-pdf-packet, pdf-pages-for-slides. The workflow registry lists exactly these four. It is distinct from the tool registry and owns workflow-specific input labels, ordered stage IDs, operating status and descriptions only. Canonical tool names, IDs and URLs remain in the tool registry.

Public contract to reproduce in src/module/workflow/type.ts in Prompt 5 (type-shaped, planner-frozen; do not alter data flow, result semantics or locations without a planner revision):

    export type WorkflowSlug =
      | "prepare-image-for-upload"
      | "heic-photos-to-pdf"
      | "assemble-pdf-packet"
      | "pdf-pages-for-slides";

    export type WorkflowRequest =
      | { slug: "prepare-image-for-upload"; source: File;
          targetFormat: "jpeg" | "png" | "webp";
          maxWidth: number; maxHeight: number; maxBytes: number }
      | { slug: "heic-photos-to-pdf"; sourcesInPageOrder: readonly File[];
          intermediateFormat: "jpeg" | "png"; quality: number }
      | { slug: "assemble-pdf-packet";
          sources: readonly { id: string; kind: "pdf" | "jpeg" | "png"; file: File }[];
          pageOrder: readonly { sourceId: string; pageNumber: number }[];
          tryLosslessCompression: boolean }
      | { slug: "pdf-pages-for-slides"; source: File;
          pageNumbersInOutputOrder: readonly number[];
          format: "png" | "jpeg"; dpi: 72 | 150 | 300;
          jpegQuality: number; maxBytesPerImage?: number };

    export type WorkflowStageId =
      | "validate" | "inspect" | "convert" | "resize" | "compress"
      | "select-pages" | "assemble" | "render" | "verify" | "complete";
    export type WorkflowStageState =
      "pending" | "running" | "passed" | "skipped" | "failed" | "cancelled";
    export interface WorkflowProgress {
      stage: WorkflowStageId;
      state: WorkflowStageState;
      completed: number;
      total: number;
      description: string;
    }
    export interface WorkflowArtifact {
      name: string;
      mimeType: string;
      blob: Blob;
      sizeBytes: number;
      sourcePageNumber?: number;
      width?: number;
      height?: number;
    }
    export interface WorkflowCheck {
      name: string;
      expected: string | number;
      observed: string | number;
      passed: boolean;
    }
    export type WorkflowFailureCode =
      | "INVALID_INPUT" | "UNSUPPORTED_FORMAT" | "SOURCE_LIMIT"
      | "PAGE_LIMIT" | "RESOURCE_LIMIT" | "PROCESSING_FAILED"
      | "VERIFICATION_FAILED" | "UNMET_REQUIREMENT" | "CANCELLED";
    export interface WorkflowFailure {
      code: WorkflowFailureCode;
      stage: WorkflowStageId;
      message: string;
      sourceId?: string;
      unmetChecks?: readonly WorkflowCheck[];
    }
    export type WorkflowRunResult =
      | { ok: true; slug: WorkflowSlug;
          outputs: readonly WorkflowArtifact[]; checks: readonly WorkflowCheck[] }
      | { ok: false; slug: WorkflowSlug; failure: WorkflowFailure;
          outputs: readonly [] };
    export interface WorkflowRunOption {
      signal: AbortSignal;
      onProgress?: (progress: WorkflowProgress) => void;
    }
    export function runWorkflow(
      request: WorkflowRequest, option: WorkflowRunOption
    ): Promise<WorkflowRunResult>;

The runWorkflow line is a planned exported function signature (to live in the runner), not a declaration to copy into one file. The single runner owns cancellation and run lifecycle; the UI reacts to its typed progress and result; adapters call existing domain processors. Validation and verification happen inside the same run. A partial or invalid output is never returned as success. User files and intermediate buffers stay in memory; object URLs are revoked and owned worker operations terminated on completion or cancel as feasible. No input bytes reach telemetry, a server, persistence or an upload.

Fixed ordered stages by slug (conditional stages are shown as skipped, not hidden):

- prepare-image-for-upload: validate -> inspect -> convert if needed -> resize if larger than the requested bounds -> compress or re-encode if needed -> verify -> complete.
- heic-photos-to-pdf: validate -> inspect each -> convert each internally -> assemble ordered pages -> verify page count and format -> complete.
- assemble-pdf-packet: validate -> inspect all -> select pages and prepare image pages -> assemble in the exact requested order -> optional lossless compression -> verify the output -> complete.
- pdf-pages-for-slides: validate -> inspect the PDF -> select pages -> render ordered page images -> verify format, dimensions and optional byte bounds -> complete.

Frozen behavioral rules:

- The visitor clicks Process once after all inputs and options are set. One run may produce several final downloadable files. Changing inputs after a run invalidates the prior result but never the original source files.
- Order is preserved exactly as chosen in the upfront ordering controls. Duplicate source IDs and out-of-range page references are rejected. No manual intermediate file selection.
- Image preparation preserves aspect ratio, never upscales an image already smaller than the bounds, and strictly checks the actual encoded MIME, width, height and byte length. If no change is needed the source is preserved. The byte cap is a maximum, not an exact target. A bounded deterministic search of at most 12 encodes for one source, preferring larger dimensions and higher quality, may try the permissible format, quality and size candidates. If none satisfies every criterion the result is an UNMET_REQUIREMENT failure carrying the observed checks, with no fake downloadable success.
- HEIC photo order is the given array order, one page per photo. The decoder may reject unsupported HEIF. Any failed image aborts final PDF generation and identifies the failing source. No partial PDF is ever labelled complete.
- Packet pageOrder is a sequence of one-based source page indices. For image sources only pageNumber 1 is valid. Each requested occurrence yields one output page, so an explicit repeated source page is allowed. The existing pdf-lib worker performs real content-preserving page copying and image embedding; screenshot or raster substitution for PDF pages is forbidden. Optional structural compression keeps the verified uncompressed packet when the compressor reports no reduction and never claims savings. Output page count must equal pageOrder length. Document metadata, signatures, interactive forms and accessibility tags are not promised to survive.
- Slides produces one image per selected page in the requested order; PNG or JPEG; DPI 72, 150 or 300. An optional maxBytesPerImage is checked against each actual encoded blob and failure is an explicit UNMET_REQUIREMENT. The workflow never silently lowers the chosen DPI or omits pages.
- All failures use typed codes and actionable messages that distinguish unsupported input, source or page limits, worker/memory/timeout failure, cancellation, validation failure and unmet output constraint. File contents are never logged.
- Cancellation terminates owned worker operations when exposed, uses AbortSignal checkpoints where synchronous canvas work cannot be interrupted, and prevents a late response from replacing a cancelled run's UI. Memory cleanup and URL revocation are required.

Limits are reused by importing the existing owners, never re-declared in a second rules engine (candidate values verified in section 6):

- Image source at most 25 MiB and 30,000,000 pixels; JPEG, PNG and WebP; HEIC and HEIF conversion only through the existing HEIC worker.
- PDF input at most 10 MiB each and 100 pages; at most 10 PDFs; aggregate PDF sources at most 25 MiB; output at most 100 pages; PNG and JPEG images for image-to-PDF at most 20 images and 25 MiB aggregate.
- PDF page-image render at most 4,096 px per side and 16,000,000 pixels; at most 20 page images per operation; DPI 72, 150 or 300; JPEG quality 0.50 to 1.00.
- A mixed packet's collection limit may not exceed the existing 10 PDF, 20 image, 25 MiB combined and 100 output page boundaries. It rejects instead of relaxing any lower-level engine constraint. Current validation functions and constants are the authority for exact accepted formats and worker messages.

PDF assemble worker extension (ownership and evidence):

- Cross-source arbitrary page-order assembly requires one additive "assemble" operation in the existing pdf-lib worker and its protocol (pdfLib.worker.ts and pdfLib.workerType.ts, with its client start function in pdfLib.client.ts), rather than hundreds of intermediate one-page PDFs or a new engine.
- Candidate evidence supports this: merge copies all pages of each input in order; split copies an arbitrary ordered page group from exactly one source; images-to-pdf embeds images. No existing operation interleaves pages across several sources, so the gap is real and the planner's extension point is consistent with the candidate. No conflict was found.
- Source-contract risk: the response readers and the operation-name union in pdfLib.workerType.ts are closed lists, so the additive change must extend request, response and reader validation together with unit tests (pdfWorker.test.ts is the nearest owner), and must keep the single-importer rule for pdf-lib.

Planned open input-unit items (see section 14): the unit of the quality field for the HEIC workflow, and the meaning of "permissible formats" in the byte-cap search.

## 8. Test ownership (planned)

Existing tests extended in their current directories: fixed-header, responsive-shell and brand-assets specs (header contract, Prompt 2); category, registry, metadata, tool and theme tests and specs (Prompts 2 to 4 and 8); sitemap test and the container route inventory script plus its test (whichever prompt adds workflows URLs to the sitemap).

New files, each inside an existing parent directory:

- src/module/workflow/registry.test.ts and src/module/workflow/runner.test.ts (Prompts 5 and 6).
- src/module/content/toolFinder.test.ts (Prompt 7): reachability, terminal-target resolution, no loops or dangling links, inactive workflows never recommended as working.
- test/e2e/sitewide-navigation.spec.ts (Prompt 2).
- test/e2e/sitewide-tool-theme.spec.ts (Prompt 4): all 18 live tool UIs and theme states.
- test/e2e/sitewide-workflow.spec.ts (Prompts 5 and 6): real end-to-end results and failures.
- test/e2e/sitewide-guide.spec.ts (Prompt 7): interactive guide routes and redirects.
- test/e2e/sitewide-search.spec.ts (Prompt 8) plus existing search tests: keyboard, status, multiword queries.
- Existing Playwright and test configuration and npm run verify and npm run test:e2e (Prompt 9). Verified script names: typecheck, lint, test, build, verify, test:e2e, test:container. Do not invent scripts.

Tests keep the repository discipline: unit tests for new logic including edge and error paths, behavior over implementation, no skips, no suppressed type errors, unique test-report run IDs reported per run.

## 9. Guide decision graph and legacy URL migration (planned)

Data ownership: src/module/content/toolFinder.ts. A deterministic tree or DAG with stable node IDs; one question group at a time; terminal nodes target either an existing ToolId or an operational WorkflowSlug; one sentence of rationale; one Open link. Conceptual types (to be created in Prompt 7):

    export type GuideTarget =
      | { kind: "tool"; toolId: ToolId }
      | { kind: "workflow"; workflowSlug: WorkflowSlug };
    export interface GuideChoice { id: string; label: string; nextNodeId: string }
    export type GuideNode =
      | { id: string; kind: "question"; prompt: string; choice: readonly GuideChoice[] }
      | { id: string; kind: "recommendation"; target: GuideTarget; rationale: string };

The root choice covers Image, PDF, Text, Converters, Developer, Math and Time. A follow-up question appears only in branches with two or more distinct outcomes; Math and Time recommend directly.

Required authored intent -> recommendation edges:

- image / change format -> image-converter
- image / change dimensions -> image-resizer
- image / reduce bytes -> image-compressor
- image / convert HEIC -> heic-converter
- image / meet a format, dimension and byte rule -> prepare-image-for-upload (workflow, only when operational)
- image / HEIC photos into one PDF -> heic-photos-to-pdf (workflow, only when operational)
- PDF / join whole PDFs -> merge-pdf
- PDF / extract selected pages -> split-pdf
- PDF / PDF pages as images -> pdf-to-image
- PDF / images into a PDF -> images-to-pdf
- PDF / shrink a PDF without rasterizing -> compress-pdf
- PDF / interleave selected pages and images -> assemble-pdf-packet (workflow, only when operational)
- PDF / export pages for slides -> pdf-pages-for-slides (workflow, only when operational)
- text / URL slug -> slugify; text / HTML text -> html-text-extractor; text / count -> word-character-counter
- converter / length -> length-converter; converter / weight -> weight-converter
- developer / JSON -> json-formatter; developer / QR -> qr-code-generator
- math / arithmetic -> calculator; time / duration -> time-arithmetic

Validation required by test: every node and choice is reachable, every terminal target resolves through tool metadata or the operational workflow registry, no loops or dangling links, and an inactive workflow can never be recommended as working. Inactive workflow intents fall back to explanatory existing-tool guidance without claiming one-click automation. Never recommend or redirect to an unimplemented workflow page.

Interaction: accessible labelled choices (radio, card or button), keyboard choice, back and restart, an aria-live result announcement, a direct Open link, one concise rationale, no new server API. Selection cards are buttons or labels, never nested anchors.

Legacy manual-guide URL migration (a permanent redirect is added by Prompt 7 for a slug only after that workflow is implemented, tested, indexed with correct canonical and sitemap handling, and verified operational; until then the old URL stays alive and honest):

- /guide/prepare-image-for-upload -> /workflows/prepare-image-for-upload
- /guide/heic-photos-to-pdf -> /workflows/heic-photos-to-pdf
- /guide/assemble-pdf-packet -> /workflows/assemble-pdf-packet
- /guide/pdf-pages-for-slides -> /workflows/pdf-pages-for-slides

Never delete useful factual examples or limitations prematurely, and never redirect to a non-working route.

## 10. Design and theme contract (planned)

Typography: keep DM Sans, as already loaded by the root layout. No new font.

Appearances: six named palettes (original, mineral, oxblood, signal, cobalt, amber), each with Light, Dark and System modes, plus the fixed-dark One Dark. System resolves to Light or Dark, so there are 13 resolved visual appearances:

- original light, original dark
- mineral light, mineral dark
- oxblood light, oxblood dark
- signal light, signal dark
- cobalt light, cobalt dark
- amber light, amber dark
- One Dark (fixed dark)

Preserve the current ThemeProvider, pre-paint behavior, storage adapter, theme CSS owner, keyboard focus and the legacy One Dark storage identity. Do not add another provider, independent theme state, external style system, invented palette name, or per-tool hard-coded violet, teal or gray PANEL or SECONDARY constants.

Semantic roles are authoritative (the variables exist in the candidate theme stylesheet):

- canvas and body: --background, --text, --text-muted
- content section or panel: --panel-bg, --panel-border
- linked card: --card-bg, --card-border, --card-hover-bg
- editable control: --input-bg, --input-border
- preview: --preview-bg, --preview-border
- result or download container: --result-bg, --result-border
- primary action: --accent, --accent-hover, --contrast
- secondary action: --secondary-action-bg, --secondary-action-border
- feedback: --success, --warning, --danger, --danger-soft
- focus: --focus-ring
- category identity: --category-<canonical-id> with matching --category-<canonical-id>-soft, sourced only from the existing theme stylesheet
- header, search and footer: the existing --header-*, --nav-* (the candidate names these --nav-item-* and --nav-hover-bg), --search-* and --footer-bg

If a necessary role is missing, Prompt 3 may add it in src/style/theme.css and map it in src/app/global.css. Never add a second palette registry or locally defined per-tool color constants. Every control uses these roles: file pickers, lists, inputs, selects, sliders, primary and secondary actions, disabled, focus, hover, processing, preview, warnings, errors, results and downloads. Tool header, category accent, card and catalog color all refer to the same canonical category identity. Category identity is not an action color; error, warning and success are severity roles, not palette accents.

Material hierarchy: canvas -> content sections -> individual cards -> inner controls, previews and results. The hero derives from the current palette identity, not a fixed coral across all light themes. The five alternate light palettes must be visibly distinguishable without looking at the navigation pill. Dark category sections must be distinguishable and cards visibly elevated. One Dark stays expressive but internally coherent (accent, active navigation and focus related). Only One Dark may use restrained glass or neomorphic treatment; the other palettes stay solid and restrained. No gratuitous multicolor gradients or giant marketing art.

Accessibility acceptance: WCAG AA normal text at least 4.5:1, large text at least 3:1, non-text controls and boundaries at least 3:1 where applicable. Numeric contrast alone is not visual acceptance. Prompt 3 selects per-palette token values; Prompt 4 applies them to every one of the 18 interactive tool interiors; Prompt 9 verifies all 13 appearances. This document does not claim final values or visual acceptance. A themed wrapper alone fails Prompt 4.

Shared structural components (PageHeader, ContentPanel, UtilityCard, ToolSurface) are structural only. The guide has a distinct decision layout and workflows a distinct process and stepper layout, but both consume the same materials. Catalog and recommendation cards are whole-card links. Preserve clear focus, spacing and a readable prose measure of about 60 to 90 characters.

Withdrawn audit subclaims are not revived: cobalt dark's terracotta is not a defect; the Source PDFs category label is not a stray magenta; Merge PDF's disabled button is correctly disabled; the existing active navigation focus ring was visible.

## 11. Nine-prompt sequence, gates and reserved reports

Prompt 1 (this prompt): specification and candidate preflight only. No implementation.

- Prompt 2: navigation and header, catalog-only Home. Tests for the five primary links, seven category URLs, Search and Themes, menu keyboard and resize behavior, 18 distinct tool routes and the mobile first viewport; explicit update of the superseded header tests (section 4). Documentation-first: DESIGN.md, architecture.md and agent guidance.
- Prompt 3: per-palette semantic tokens and category identity. Tests for 13 resolved appearances, mode persistence, contrast and surface hierarchy; actual reference screenshots plus computed colors.
- Prompt 4: shared UI components and all 18 tool interiors. Real input, processing, result, error and download controls across tools at desktop and mobile in original light, original dark and One Dark, plus semantic color coverage across all 13 appearances.
- Prompt 5: workflow runner and the real prepare-image-for-upload workflow. Contract, fixture, resource, error, cancel, progress, constraint, one-click execution and verified-output browser tests. Candidate for FULL_STAGE_CONTEXT because it introduces a new subsystem; the next planner selects the execution mode against actual source evidence.
- Prompt 6: heic-photos-to-pdf, assemble-pdf-packet (including the additive worker operation) and pdf-pages-for-slides. Verify source order, page counts, MIME, dimensions, optional bounds, rejected sources, cancellation and single-run output.
- Prompt 7: tool and workflow decision graph and accessible UI; fallback before workflow activation; legacy guide redirects only after working implementations; canonical and sitemap preservation.
- Prompt 8: real search, content and hierarchy, remaining issue closure. Multi-term matching, keyboard route, live region, mobile presentation, preservation of original information.
- Prompt 9: integrated regression. Frozen contract versus current code, status of all 46 registered issues, the original 35 routes plus new working workflow and guide routes, all 18 tool success and error UIs, all 13 appearance states, 390, 768 and 1440 widths and landscape as applicable, inspected browser captures, canonical verification, documentation reconciliation and a source and path audit. Not release preparation, deployment or AdSense submission.

Dependency gates: each prompt starts from a reconfirmed candidate identity and passes its own tests before the next begins; Prompt 5 precedes Prompt 6; Prompt 7 follows operational workflows; Prompt 9 follows all.

Reserved report files (the later prompts must each explicitly authorize their own file; Prompt 1 writes only the first):

- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p01-report.txt (Prompt 1)
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p02-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p03-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p04-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p05-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p06-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p07-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p08-report.txt
- .my-dev-kit-workflow/tmp/sitewide-nine-prompt/p09-report.txt

Retain all report and evidence roots until a separate approved cleanup. Do not delete old indexes or audit evidence.

## 12. Audit register: primary owner and acceptance per issue

Every one of the 46 registered issues has exactly one primary correction owner. Adjacent prompts may run cross-cutting regression checks but may not claim or reassign a primary owner. Prompt 9 owns integrated proof that every assigned issue is resolved, with evidence by ID, but does not reassign ownership. No issue is closed, no workflow operational and no design visually accepted by Prompt 1.

Owner Prompt 2 (navigation and Home), 11 issues:

- AUD-001 [owner: Prompt 2] Acceptance: task and guide preview copy is no longer reused as Home cards; those cards are absent.
- AUD-002 [owner: Prompt 2] Acceptance: Home has a compact, catalog-only hierarchy with no full-width waste.
- AUD-003 [owner: Prompt 2] Acceptance: the persistent mobile header is at most 72 px at 390 x 844, and the old fixed-header test requirement is superseded.
- AUD-006 [owner: Prompt 2] Acceptance: Home shows 18 unique tool links and no duplicated featured tasks.
- AUD-008 [owner: Prompt 2] Acceptance: the hero is a concise factual statement, with no slogan-plus-caveats stack.
- AUD-015 [owner: Prompt 2] Acceptance: mobile Home is materially shorter and shows no repeated workflow icons.
- AUD-019 [owner: Prompt 2] Acceptance: catalog card heights and density are consistent without filler padding.
- AUD-021 [owner: Prompt 2] Acceptance: the unused Home task-card style is removed only with source proof that nothing references it.
- AUD-022 [owner: Prompt 2] Acceptance: actionable mobile navigation targets are at least 44 px, and the existing visible focus ring is preserved.
- AUD-027 [owner: Prompt 2] Acceptance: at least one actionable tool card is visible in the 390 x 844 first viewport.
- AUD-028 [owner: Prompt 2] Acceptance: there is no orphan tablet navigation row and no orphaned board layout at 768.

Owner Prompt 3 (palette and semantic role foundation), 9 issues:

- AUD-005 [owner: Prompt 3] Acceptance: all seven dark appearances show visible category-section and card differentiation.
- AUD-007 [owner: Prompt 3] Acceptance: there is no fixed light coral hero; hero and support surfaces take the active palette's identity.
- AUD-012 [owner: Prompt 3] Acceptance: theme swatches exist and One Dark and mode behavior is understandable.
- AUD-023 [owner: Prompt 3] Acceptance: one category identity color is used on Home, discover, category and tool pages.
- AUD-025 [owner: Prompt 3] Acceptance: the five alternate light palettes are visibly distinct, not merely distinct navigation pills.
- AUD-026 [owner: Prompt 3] Acceptance: One Dark accent, active and focus roles are cohesive and its mode controls are honest.
- AUD-040 [owner: Prompt 3] Acceptance: dark /discover normal text reaches at least 4.5:1 in all dark appearances.
- AUD-041 [owner: Prompt 3] Acceptance: text on guidance and summary tinted surfaces reaches at least 4.5:1.
- AUD-042 [owner: Prompt 3] Acceptance: PDF section labels reach at least 4.5:1, or genuinely qualify as large text at 3:1.

Owner Prompt 4 (cross-route visual consistency including the 18 tools), 6 issues:

- AUD-004 [owner: Prompt 4] Acceptance: page, card and panel anatomy is shared across the six major route families.
- AUD-013 [owner: Prompt 4] Acceptance: the tool header's category icon and color match the canonical catalog identity.
- AUD-031 [owner: Prompt 4] Acceptance: the first actionable category-page card is visible in the mobile first viewport.
- AUD-035 [owner: Prompt 4] Acceptance: every tool's real controls, actions and results are themed, and disabled looks disabled by state, not by an unrelated hue (a correctly disabled Merge PDF button is not a defect).
- AUD-038 [owner: Prompt 4] Acceptance: the converter form fields are balanced at 1440 px.
- AUD-039 [owner: Prompt 4] Acceptance: the quality-control disclosure on the image tools is consistent and truthful.

Owner Prompt 7 (guides), 2 issues:

- AUD-014 [owner: Prompt 7] Acceptance: /guide is an interactive navigational finder with coherent whole-choice card styling.
- AUD-032 [owner: Prompt 7] Acceptance: guide mobile label and value spacing is readable and the recommendation UI is clear.

Owner Prompt 8 (search, copy and remaining real defects), 18 issues:

- AUD-009 [owner: Prompt 8] Acceptance: How to use precedes the worked example on tool pages, and repeated limits are eliminated.
- AUD-010 [owner: Prompt 8] Acceptance: each category has one canonical label everywhere and there is no duplicate primary /discover link.
- AUD-011 [owner: Prompt 8] Acceptance: tool descriptions are concise input-to-output statements and the repeated privacy suffix is reduced.
- AUD-016 [owner: Prompt 8] Acceptance: the full search placeholder is legible at 360 px.
- AUD-017 [owner: Prompt 8] Acceptance: tool and category pages have proportionate, unique, useful content with no invented padding.
- AUD-018 [owner: Prompt 8] Acceptance: the heading hierarchy is distinct and prose measure is about 60 to 90 characters.
- AUD-020 [owner: Prompt 8] Acceptance: search announces results and empty states in a live region, and results are not duplicated against the catalog.
- AUD-024 [owner: Prompt 8] Acceptance: single-tool category prose is not duplicated across surfaces.
- AUD-029 [owner: Prompt 8] Acceptance: /discover shows canonical category labels and an intentional list order.
- AUD-030 [owner: Prompt 8] Acceptance: on mobile /discover search is in the first viewport and no sentence is clipped mid-way.
- AUD-033 [owner: Prompt 8] Acceptance: contact instructions match the footer actions that are actually visible.
- AUD-034 [owner: Prompt 8] Acceptance: the long privacy policy has in-page navigation.
- AUD-036 [owner: Prompt 8] Acceptance: UI strings are quoted in prose, the expected no-reduction state is calm, and an empty HTML extract gives feedback.
- AUD-037 [owner: Prompt 8] Acceptance: the Related tools heading is truthful and neutral.
- AUD-043 [owner: Prompt 8] Acceptance: the keyboard path from search to the first result takes at most 3 Tab presses, not 38.
- AUD-044 [owner: Prompt 8] Acceptance: a multi-term query such as "resize image" finds the actual matching tool or tools.
- AUD-045 [owner: Prompt 8] Acceptance: output status uses correct singular and plural wording.
- AUD-046 [owner: Prompt 8] Acceptance: the Time Arithmetic field error is associated with its field and announced.

Distribution check: 11 + 9 + 6 + 2 + 18 = 46. Prompts 5 and 6 own the four genuinely new workflows rather than registered issue IDs. Prompt 9 provides integrated proof only.

## 13. Explicit forbidden scope

- No extra tool, no new registry for tool identity, no change to the 18 original tool destinations or behavior contracts.
- No server API, service, database table, cloud processor, upload, account or persistent file storage; no new telemetry of user files, inputs, outputs, full URLs, queries or identity.
- No new semantic version, no change to the frozen v0.5.0 and v0.6.0 roadmap, no release, tag, merge, deployment or publication.
- No AdSense setting change, ad activation or Google submission; advertising and consent safeguards stay as they are, and automated tests never request or click live ads.
- No deletion of existing examples, valueExamples, tool guides or manual task guides before a compatible verified replacement exists.
- No parallel theme, palette or font system; no universal PDF engine; no new image or PDF algorithm outside the existing owners (other than the single additive assemble operation in the existing worker).
- No source, test, public, script, dashboard, database or package-file edit in Prompt 1.

## 14. Items that require planner revision rather than implementer improvisation

No blocker prevents materializing this contract: every planner-frozen node and edge was found compatible with the candidate. The following clarifications are required before the prompt that needs them; the implementer must stop and report instead of choosing:

- Quality units (needed before Prompt 5 creates the shared types): the workflow field "quality" for heic-photos-to-pdf has no stated unit. The existing HEIC contract uses an integer percent from 10 to 100 in steps of 5 (heicQuality), while the slides field uses a fraction from 0.50 to 1.00 (existing page-image option). Planner to confirm that the HEIC workflow adopts the existing HEIC percent contract and the slides workflow the existing fractional contract.
- Byte-cap search (needed before Prompt 5): "permissible formats" should be confirmed to mean that the visitor's chosen targetFormat is never silently changed, with only quality and size candidates varied (PNG can only be reduced by dimensions with the current primitives).
- Sitemap timing (needed before the first workflows route ships): confirm which prompt adds /workflows URLs to the sitemap, and that only operational workflow pages are listed. The sitemap test, the container inventory script and its test must change together.
- Runtime verification depth for the packet (needed before Prompt 6): confirm that runtime verification is page count plus per-page geometry and rotation with the existing verifier, and that per-page content identity is proven by labelled fixtures in tests rather than by a new runtime check.
- Documentation-first approval (needed before Prompt 2): confirm that updating docs/DESIGN.md, docs/architecture.md, AGENTS.md and CLAUDE.md as the first step of each affected prompt is authorized, since Prompt 1 may not touch them.
