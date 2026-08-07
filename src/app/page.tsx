import HomeClient from "./HomeClient"
import StatusPanel from "@/component/common/StatusPanel"

import { tool_definition_list } from "@/module/tool/registry"

interface HomeToolItem {
  slug: string
  name: string
  description: string
  category: string
}

function toHomeToolItem(one: {
  slug: string
  name: string
  description: string
  category: string
}): HomeToolItem {
  return {
    slug: one.slug,
    name: one.name,
    description: one.description,
    category: one.category,
  }
}

export default function HomePage() {
  const toolItem = tool_definition_list.map((one) => toHomeToolItem(one))

  const categoryItem = Array.from(new Set(toolItem.map((one) => one.category))).filter(Boolean)

  return (
      <div className="page-stack">
        <section className="page-intro">
          <h1 className="page-title">
            Utility platform
          </h1>
          <p className="page-summary">
            Simple tools for text, document, and everyday tasks.
          </p>
        </section>

        <HomeClient toolItem={toolItem}>
          {process.env.NODE_ENV === "development" ? (
              <StatusPanel toolCount={toolItem.length} categoryCount={categoryItem.length} />
          ) : null}
        </HomeClient>
      </div>
  )
}
