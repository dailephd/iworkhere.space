import type { Metadata } from "next"
import { getAllTool } from "@/module/tool/metadata"
import DiscoverClient from "./DiscoverClient"
import type { ToolSearchItem } from "@/component/common/ToolSearch"

export const metadata: Metadata = {
    title: "Discover Tool — iworkhere.space",
    description: "Browse and search all available utility tool.",
}

export default function DiscoverPage() {
    const allTool = getAllTool()

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
                    Browse all available utility tool by category.
                </p>
            </section>

            <DiscoverClient item={item} />
        </div>
    )
}
