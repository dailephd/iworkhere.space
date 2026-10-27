# Component: TaskGuidePage

**Kind:** Component

## Representative File

`src/component/content/TaskGuidePage.tsx`

Members: `src/component/content/TaskGuidePage.tsx` [implementation], `src/component/content/TaskGuidePage.test.tsx` [tests].

## Purpose

Presentation-only Server Component for one task-guide detail page (v0.4.4 Batch 5). It renders display-ready content
and nothing else: it does not import the tool registry, `taskGuide.ts` or the value-example owner, does not process or
fetch files, does not download anything automatically, keeps no state and emits no telemetry. The route
`src/app/guide/[slug]/page.tsx` resolves tool names, addresses and sample facts and passes them in.

## Props

`TaskGuideLink { title; href; summary }`, `TaskGuideStepView { heading; explanation; toolLink? }`,
`TaskGuideExampleView { toolLink; task; outcome; limitation; sourceLink[]; outputLink[] }` and `TaskGuidePageProp`
(title, description, startingMaterial, expectedOutcome, reviewedOn, step, example, verification, limitation,
relatedToolLink) are exported from the component file. `TaskGuideLink` is also the type-only prop item of
`ToolPageTemplate.taskGuideLink`.

## Markup

One `article` with one `h1`; a labelled definition list (start with, you end with, content checked as a `time`
element); a sentence stating that each tool works separately and a downloaded file is selected again by hand; `h2`
sections Steps (ordered list, `h3` per step, "Open <tool>" link only where the step names a tool), Worked examples
(a section per example with a tool link, the measured task and outcome, the first limitation, and source and result
file links), How to check the result yourself, Limits to know, and Tools used in this guide. Sample links are plain
same-origin anchors with the `download` attribute and an accessible name that states role, type, file name, page
count or pixel size where recorded, and byte size. No image is rendered, so nothing is fetched on load. Colors, borders
and focus outlines use existing tokens (`panel-border`, `panel-bg`, `secondary-action-*`, `focus-ring`).

## Constraints

No ad slot, form control, script or dialog; the guide routes sit outside `AdSenseEligiblePage`. The page is complete
without hydration. Long file names wrap (`break-words`) so the 390 px layout does not scroll horizontally.
