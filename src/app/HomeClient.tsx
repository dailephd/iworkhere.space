"use client"

import { getToolCategoryLabel, type ToolCategory } from "@/module/tool/category"
import type { ReactNode } from "react"
import Link from "next/link"

import { SectionIsland } from "@/component/common/SectionIsland"
import ToolSearch from "@/component/common/ToolSearch"
import type { ToolSearchItem } from "@/component/common/ToolSearch"

export interface HomeClientProps {
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

    return (
        <div className="space-y-8">
            <ToolSearch item={toolItem} showResultsWhenEmpty={false} />
            <section aria-labelledby="home-categories-title" className="space-y-3">
                <h2 id="home-categories-title" className="text-sm font-semibold text-text-muted">Browse categories</h2>
                <div className="flex flex-wrap gap-2">
                    <Link href="/discover" className="rounded-full border border-card-border bg-card-bg px-3 py-2 text-sm text-text hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">All tools</Link>
                    {categoryItem.map((category) => <Link key={category} data-category={category} href={`/category/${encodeURIComponent(category)}`} className="rounded-full bg-[var(--category-soft)] px-3 py-2 text-sm capitalize text-[var(--category-color)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">{getToolCategoryLabel(category)}</Link>)}
                </div>
            </section>
            {sections.map(({ category, item }) => (
                <SectionIsland
                    key={category}
                    headingId={`home-category-${category}-title`}
                    heading={category === "converter" ? getToolCategoryLabel(category) : `${getToolCategoryLabel(category)} tools`}
                >
                    <ToolGrid item={item} />
                </SectionIsland>
            ))}
            {children ? children : null}
        </div>
    )
}

function ToolGrid({ item }: { item: ToolSearchItem[] }) {
    return <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {item.map((tool) => <li key={tool.slug}>
            <Link data-category={tool.category} href={`/tool/${tool.slug}`} className="catalog-card block h-full rounded-xl border border-card-border bg-card-bg p-4 hover:border-[var(--category-color)] hover:bg-[var(--category-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
                <h3 className="font-semibold text-text">{tool.name}</h3>
                <p className="mt-1 text-sm text-text-muted">{tool.description}</p>
            </Link>
        </li>)}
    </ul>
}
