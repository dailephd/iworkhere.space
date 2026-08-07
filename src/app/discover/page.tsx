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
        <div className="page-stack">
            <section>
                <h1 className="page-title">
                    Discover Tool
                </h1>
                <p className="page-summary">
                    Browse all available utility tool by category.
                </p>
            </section>

            <DiscoverClient item={item} />
        </div>
    )
}
