"use client"

import { getToolCategoryDefinition, getToolCategoryLabel, type ToolCategory } from "@/module/tool/category"
import type { ReactNode } from "react"
import Link from "next/link"

import { SectionIsland } from "@/component/common/SectionIsland"
import ToolSearch from "@/component/common/ToolSearch"
import type { ToolSearchItem } from "@/component/common/ToolSearch"
import { UtilityCard } from "@/component/common/UtilityCard"

export interface HomeClientProps {
    /** Optional server-rendered content (for example development-only diagnostics); rendered after the catalog. */
    children?: ReactNode
    toolItem: ToolSearchItem[]
    categoryItem: ToolCategory[]
}

export default function HomeClient(props: HomeClientProps) {
    const { toolItem, categoryItem, children } = props
    const sections = categoryItem.map((category) => ({
        category,
        item: toolItem.filter((tool) => tool.category === category),
    })).filter((section) => section.item.length > 0)

    // The category entries and the 18-card catalog show only while the search is blank; a query swaps them for one filtered list.
    const catalog = (
        <div className="space-y-6">
            <nav aria-labelledby="home-categories-title" className="space-y-2">
                <h2 id="home-categories-title" className="text-sm font-semibold text-text-muted">Browse categories</h2>
                <ul className="flex flex-wrap gap-2">
                    {categoryItem.map((category) => (
                        <li key={category}>
                            <Link data-category={category} href={`/category/${encodeURIComponent(category)}`} className="home-chip inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">{getToolCategoryLabel(category)}</Link>
                        </li>
                    ))}
                </ul>
            </nav>
            {/* The seven category boards stack in one column at every width; only the tool cards inside a board use responsive columns. */}
            <div className="flex flex-col gap-4">
                {sections.map(({ category, item }) => (
                    <div key={category} data-category={category} data-home-board={category} className="home-board min-w-0">
                        <SectionIsland
                            headingId={`home-category-${category}-title`}
                            heading={getToolCategoryLabel(category)}
                            description={getToolCategoryDefinition(category).description}
                        >
                            <ToolGrid item={item} categoryTitle={getToolCategoryLabel(category)} />
                        </SectionIsland>
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <ToolSearch item={toolItem} showResultsWhenEmpty={false} idleContent={catalog} />
            {children ? children : null}
        </div>
    )
}

function ToolGrid({ item, categoryTitle }: { item: ToolSearchItem[]; categoryTitle: string }) {
    return <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {item.map((tool) => <li key={tool.slug} className="min-w-0">
            <UtilityCard href={`/tool/${tool.slug}`} title={tool.name} description={tool.description} categoryId={tool.category} categoryTitle={categoryTitle} />
        </li>)}
    </ul>
}
