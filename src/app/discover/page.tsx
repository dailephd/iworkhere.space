import Link from "next/link"
import { buildPageMetadata } from "@/lib/seo"
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata"
import { getToolCategoryDefinition, getToolCategoryLabel } from "@/module/tool/category"
import DiscoverClient from "./DiscoverClient"
import type { ToolSearchItem } from "@/component/common/ToolSearch"

const categoryLabel = getAvailableCategory().map((category) => getToolCategoryLabel(category))

export const metadata = buildPageMetadata({
    title: "Discover Tool",
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
        tag: one.tag,
    }))

    return (
        <div className="space-y-8">
            <section className="space-y-2">
                <h1 className="text-2xl font-semibold text-[var(--text)]">
                    Discover Tool
                </h1>
                <p className="text-[var(--text-muted)]">
                    Search for a utility directly, or browse by category when you know the kind of task. The list below shows all {allTool.length} tools in one list, not grouped by category. Searching matches a tool&apos;s name, description, category and tags, for example merge, compress, resize or convert.
                </p>
            </section>

            <section aria-labelledby="discover-category-title" className="space-y-3">
                <h2 id="discover-category-title" className="text-xl font-semibold text-[var(--text)]">Browse by category</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryItem.map((category) => (
                        <li key={category.id} className="min-w-0 space-y-1 rounded-xl border border-card-border bg-card-bg p-4">
                            <Link href={`/category/${category.id}`} className="font-semibold text-text underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">{category.label}</Link>
                            <p className="text-sm text-text-muted">{category.description}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <DiscoverClient item={item} />
        </div>
    )
}
