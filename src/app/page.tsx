import HomeClient from "./HomeClient"
import StatusPanel from "@/component/common/StatusPanel"

import { getAllTool, getAvailableCategory } from "@/module/tool/metadata"

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

  return (
      <div className="space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Practical tools for everyday work
          </h1>
          <p className="text-[var(--text-muted)]">
            Free browser based tools for images, text, documents and everyday tasks.
          </p>
        </section>

        <HomeClient toolItem={toolItem} categoryItem={categoryItem}>
          {process.env.NODE_ENV === "development" ? (
              <StatusPanel toolCount={toolItem.length} categoryCount={categoryItem.length} />
          ) : null}
        </HomeClient>
      </div>
  )
}
