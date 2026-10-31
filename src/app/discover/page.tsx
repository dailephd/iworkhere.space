import Link from "next/link"
import { buildPageMetadata } from "@/lib/seo"
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata"
import { getToolCategoryDefinition, getToolCategoryLabel } from "@/module/tool/category"
import DiscoverClient from "./DiscoverClient"
import type { ToolSearchItem } from "@/component/common/ToolSearch"

const categoryLabel = getAvailableCategory().map((category) => getToolCategoryLabel(category))

export const metadata = buildPageMetadata({
    title: "All Tools",
    description: `Search all ${getAllTool().length} browser tools by name, description, category or tag, or browse by category: ${categoryLabel.slice(0, -1).join(", ")} and ${categoryLabel[categoryLabel.length - 1]}.`,
    canonicalPath: "/discover",
})

export default function DiscoverPage() {
    const allTool = getAllTool()
    const categoryItem = getAvailableCategory().map((category) => ({
        id: category,
        label: getToolCategoryLabel(category),
        description: getToolCategoryDefinition(category).description,
    }))

    const item: ToolSearchItem[] = allTool.map((one) => ({
        slug: one.slug,
        name: one.name,
        description: one.description,
        category: one.category,
        categoryLabel: getToolCategoryLabel(one.category),
        tag: one.tag,
    }))

    return (
        <div className="space-y-8">
            <section className="space-y-2">
                <h1 className="text-2xl font-semibold text-[var(--text)]">
                    All tools
                </h1>
                <p className="text-[var(--text-muted)]">
                    Search by tool name or task, for example resize image or merge PDF, or browse by category below.
                </p>
            </section>

            <DiscoverClient item={item} />

            <section aria-labelledby="discover-category-title" className="ds-board">
            <div className="ds-section space-y-3">
                <h2 id="discover-category-title">Browse by category</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryItem.map((category) => (
                        <li key={category.id} className="min-w-0">
                            <Link href={`/category/${category.id}`} data-category={category.id} aria-labelledby={`discover-category-${category.id}-name`} className="ds-card home-card block h-full rounded-xl border p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
                                <h3 id={`discover-category-${category.id}-name`}>{category.label}</h3>
                                <p className="mt-1">{category.description}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
            </section>
        </div>
    )
}
