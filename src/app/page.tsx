import Link from "next/link"
import HomeClient from "./HomeClient"
import StatusPanel from "@/component/common/StatusPanel"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({ title: "Browser Tools for PDFs, Images and Text", description: "Browser tools for PDFs, images, text, unit conversion, calculation, time values and developer tasks. PDF and image processing runs locally in your browser.", canonicalPath: "/" })

import { getAllTool, getAvailableCategory, getToolByIdList } from "@/module/tool/metadata"
import { getFeaturedValueExample } from "@/module/tool/valueExamples"
import { getAllTaskGuide } from "@/module/content/taskGuide"

interface FeaturedTaskItem {
  slug: string
  name: string
  task: string
  outcome: string
  limitation: string
}

/*
 * Editorial task entry points, not a catalog and not a ranking. The five tasks come from the
 * value-example owner (its featured subset, not every example) and each tool is resolved through the registry,
 * so no tool facts live here.
 */
function getFeaturedTask(): FeaturedTaskItem[] {
  return getFeaturedValueExample().flatMap((example) => {
    const [tool] = getToolByIdList([example.toolId])
    if (!tool) return []
    return [{
      slug: tool.slug,
      name: tool.name,
      task: example.task,
      outcome: example.whyThisTool,
      limitation: example.limitation[0],
    }]
  })
}

interface HomeToolItem {
  slug: string
  name: string
  description: string
  category: string
  tag?: string[]
}

function toHomeToolItem(one: {
  slug: string
  name: string
  description: string
  category: string
  tag?: string[]
}): HomeToolItem {
  return {
    slug: one.slug,
    name: one.name,
    description: one.description,
    category: one.category,
    tag: one.tag,
  }
}

export default function HomePage() {
  const toolItem = getAllTool().map((one) => toHomeToolItem(one))
  const categoryItem = getAvailableCategory()
  const featuredTask = getFeaturedTask()
  const workflow = getAllTaskGuide().map((guide) => ({ slug: guide.slug, title: guide.title, outcome: guide.expectedOutcome }))

  return (
      <div className="space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Practical browser tools for PDFs, images, text and more
          </h1>
          <p className="text-[var(--text-muted)]">
            {toolItem.length} browser tools for PDFs, images, text, unit conversion, calculation, time values and JSON. Search by name or task, or browse by category below.
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            PDF and image files are processed in your browser and are not uploaded. Results depend on your file and browser, and each tool page lists its limits. Not every conversion is lossless, and not every file gets smaller.
          </p>
        </section>

        <section aria-labelledby="home-task-title" data-featured-task-section className="space-y-3">
          <h2 id="home-task-title" className="text-xl font-semibold text-[var(--text)]">Start with a common task</h2>
          <p className="text-sm text-[var(--text-muted)]">Five common jobs, each with a worked example on its tool page.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredTask.map((one) => (
              <li key={one.slug} data-featured-task={one.slug} className="min-w-0 space-y-2 rounded-xl border border-card-border bg-card-bg p-4">
                <h3 className="font-semibold text-text">
                  <Link href={`/tool/${one.slug}`} className="underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">{one.name}</Link>
                </h3>
                <p className="text-sm text-text">{one.task}</p>
                <p className="text-sm text-text-muted">{one.outcome}</p>
                <p className="text-sm text-text-muted">{one.limitation}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-workflow-title" data-workflow-section className="space-y-3">
          <h2 id="home-workflow-title" className="text-xl font-semibold text-[var(--text)]">Practical file workflows</h2>
          <p className="text-sm text-[var(--text-muted)]">Jobs that take more than one tool, with the result to expect and how to check it. Each tool runs separately, so you download and re-select files between steps.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {workflow.map((one) => (
              <li key={one.slug} data-workflow={one.slug} className="min-w-0 space-y-2 rounded-xl border border-card-border bg-card-bg p-4">
                <h3 className="font-semibold text-text">
                  <Link href={`/guide/${one.slug}`} className="underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">{one.title}</Link>
                </h3>
                <p className="text-sm text-text-muted">{one.outcome}</p>
              </li>
            ))}
          </ul>
        </section>

        <HomeClient toolItem={toolItem} categoryItem={categoryItem}>
          {process.env.NODE_ENV === "development" ? (
              <StatusPanel toolCount={toolItem.length} categoryCount={categoryItem.length} />
          ) : null}
        </HomeClient>
      </div>
  )
}
