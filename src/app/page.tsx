import HomeClient from "./HomeClient"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({ title: "Browser Tools for PDFs, Images and Text", description: "Browser tools for PDFs, images, text, unit conversion, calculation, time values and developer tasks. PDF and image processing runs locally in your browser.", canonicalPath: "/" })

import { getAllTool, getAvailableCategory } from "@/module/tool/metadata"
import { getToolCategoryLabel, type ToolCategory } from "@/module/tool/category"

interface HomeToolItem {
  slug: string
  name: string
  description: string
  category: string
  categoryLabel: string
  tag?: string[]
}

function toHomeToolItem(one: {
  slug: string
  name: string
  description: string
  category: ToolCategory
  tag?: string[]
}): HomeToolItem {
  return {
    slug: one.slug,
    name: one.name,
    description: one.description,
    category: one.category,
    categoryLabel: getToolCategoryLabel(one.category),
    tag: one.tag,
  }
}

/* Home is the individual utility catalog only: no task, guide or workflow cards. */
export default function HomePage() {
  const toolItem = getAllTool().map((one) => toHomeToolItem(one))
  const categoryItem = getAvailableCategory()

  return (
      <div className="home-page space-y-6">
        <section aria-labelledby="home-hero-title" data-home-hero className="home-hero space-y-1 rounded-xl px-5 py-4 sm:px-8 sm:py-5">
          <h1 id="home-hero-title" className="text-2xl font-semibold sm:text-3xl">
            Browser utilities for files, text and numbers
          </h1>
          <p className="text-base">
            Merge PDFs, resize images, count words and convert units; PDF and image files are processed in your browser and are not uploaded.
          </p>
        </section>

        <HomeClient toolItem={toolItem} categoryItem={categoryItem} />
      </div>
  )
}
