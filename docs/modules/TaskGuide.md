# Module: TaskGuide

> **Status (Prompt 7, 2026-10-31): superseded, data retained.** The four authored manual guides no longer have a canonical route. `/guide/<slug>` for these four slugs now returns an HTTP 308 permanent redirect to the working `/workflows/<slug>` (`src/app/guide/[slug]/page.tsx`); `/guide` is the interactive finder owned by `src/module/content/toolFinder.ts`. `taskGuide.ts` and `TaskGuidePage` remain as historical implementation and as the relation that decides which tool and category pages link to a workflow. Statements below about guide routes, sitemap entries and Home sections describe v0.4.4 Batch 5, not the current candidate.

**Kind:** Module

## Representative File

`src/module/content/taskGuide.ts`

Members: `src/module/content/taskGuide.ts` [implementation], `src/module/content/taskGuide.test.ts` [contract tests].

## Purpose

The bounded content-domain owner of exactly four authored multi-tool task guides (v0.4.4 Batch 5). It is not a
tool registry, a content management system, a Markdown engine or a blog. It holds prose and ToolId references only.
Tool identity, names, categories and canonical paths stay in `src/module/tool/registry.ts`, `category.ts` and
`metadata.ts`. Measured sample facts stay in `src/module/tool/valueExamples.ts`. Single-tool instructions stay in
`src/module/tool/guide.ts`.

## Public contract

```ts
export type TaskGuideSlug = "assemble-pdf-packet" | "prepare-image-for-upload" | "heic-photos-to-pdf" | "pdf-pages-for-slides";
export interface TaskGuideStep { heading: string; explanation: string; toolId?: ToolId }
export interface TaskGuide {
  slug: TaskGuideSlug; title: string; description: string; startingMaterial: string; expectedOutcome: string;
  step: TaskGuideStep[]; exampleToolId: ToolId[]; verification: string[]; limitation: string[];
  relatedToolId: ToolId[]; reviewedOn: string;
}
export function getAllTaskGuide(): TaskGuide[];
export function getTaskGuide(slug: string): TaskGuide | undefined;
export function getTaskGuideForTool(toolId: ToolId): TaskGuide[];
```

- Records are returned in publication order: assemble-pdf-packet, prepare-image-for-upload, heic-photos-to-pdf,
  pdf-pages-for-slides.
- Every query returns a `structuredClone` copy, so a caller cannot change the shared site content.
- `getTaskGuide` is an exact match; any other slug returns `undefined`.
- `getTaskGuideForTool` returns the guides in which the tool is a step, an example or a related tool, in publication
  order, and nothing for unrelated tools. Nine tools participate: split-pdf, images-to-pdf, merge-pdf, compress-pdf,
  image-converter, image-resizer, image-compressor, heic-converter, pdf-to-image.
- The module imports only the `ToolId` type. It has no JSX, network, browser state or file access, and stores no tool
  name, tool URL or category. Prose therefore describes actions and outcomes without naming a tool; the server routes
  resolve names and addresses through `getToolByIdList`.
- `reviewedOn` (YYYY-MM-DD) is the date the content was checked against the working tools (2026-10-27, reproduced by
  `test/e2e/task-guides.spec.ts`). It is displayed as "Content checked", is not an update timer, and changes only after
  the content is re-checked.
- `exampleToolId` entries must exist in `valueExamples.ts`; the guide detail route projects each example's task,
  outcome, first limitation and source/result file links from that owner. The examples are separate measured runs of
  single steps and are never presented as one combined, committed output.

## Consumers

| Consumer | Use |
| --- | --- |
| `src/app/guide/page.tsx` | Hub: all four records, tools resolved from step ToolIds. |
| `src/app/guide/[slug]/page.tsx` | Detail: one record, step/example/related tools and metadata. Unknown slug: `notFound()`. |
| `src/app/page.tsx` | Compact server-rendered workflow section (title and expected outcome). |
| `src/app/category/[category]/page.tsx` | Guide list for `document` (assemble-pdf-packet, pdf-pages-for-slides) and `image` (prepare-image-for-upload, heic-photos-to-pdf) only. |
| `src/app/tool/[slug]/page.tsx` | `getTaskGuideForTool` resolved into `taskGuideLink` for `ToolPageTemplate`. |
| `src/app/sitemap.ts` | `/guide` and the four `/guide/<slug>` URLs (35 canonical URLs in total). |

Guide data is never passed to `HomeClient` or any other Client Component.

## Editorial rules

Each guide gives original multi-step prose, a starting material, an expected outcome, independent verification
steps, realistic recovery and limits drawn from the working tools. No invented measurements, success rates or savings.
The prepare-image-for-upload rule (JPEG, at most 800 × 600 px, at most 100,000 bytes) is explicitly illustrative and is
not attributed to a real upload form. No guide suggests removing a signature or redacting content.

## Tests

`src/module/content/taskGuide.test.ts` checks the exact slugs, titles and order, distinct non-empty fields, real
review dates, registry resolution and uniqueness of every ToolId, existing value examples, absence of duplicated
registry facts, query behavior, copy isolation, route metadata, `notFound` and the example projection. Browser
reproduction of all four workflows is in `test/e2e/task-guides.spec.ts`.
