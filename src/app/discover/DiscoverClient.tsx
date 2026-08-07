"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ToolSearchItem } from "@/component/common/ToolSearch"
import { Input } from "@/component/common/Input"

export interface DiscoverClientProp {
    item: ToolSearchItem[]
}

function norm(s: string): string {
    return s.trim().toLowerCase()
}

export default function DiscoverClient(prop: DiscoverClientProp) {
    const { item } = prop
    const router = useRouter()
    const [query, setQuery] = useState("")
    const [selectedTag, setSelectedTag] = useState<string | null>(null)

    const allTags = useMemo(() => {
        const set = new Set<string>()
        for (const one of item) {
            if (one.tag) {
                for (const t of one.tag) {
                    set.add(t)
                }
            }
        }
        return Array.from(set).sort()
    }, [item])

    const filtered = useMemo(() => {
        const q = norm(query)
        return item.filter((one) => {
            const matchQuery = !q || norm(`${one.name} ${one.description} ${one.category}`).includes(q)
            const matchTag = !selectedTag || one.tag?.includes(selectedTag)
            return matchQuery && matchTag
        })
    }, [item, query, selectedTag])

    const grouped = useMemo(() => {
        const map = new Map<string, ToolSearchItem[]>()
        for (const one of filtered) {
            const list = map.get(one.category) ?? []
            list.push(one)
            map.set(one.category, list)
        }
        return map
    }, [filtered])

    function handleOpen(slug: string) {
        router.push(`/tool/${slug}`)
    }

    return (
        <div className="space-y-10">
            <div className="surface-card space-y-4 p-5 sm:p-6">
                <div>
                    <label className="field-label" htmlFor="discover-search">
                        Search
                    </label>
                    <Input
                        id="discover-search"
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tool by name, description, or category"
                    />
                </div>

                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedTag(null)}
                            aria-pressed={selectedTag === null}
                            className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-180 ${
                                selectedTag === null
                                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-contrast)]"
                                    : "border-border bg-surface-alt text-text-secondary hover:bg-elevated"
                            }`}
                        >
                            All
                        </button>
                        {allTags.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedTag(t)}
                                aria-pressed={selectedTag === t}
                                className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-180 ${
                                    selectedTag === t
                                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-contrast)]"
                                        : "border-border bg-surface-alt text-text-secondary hover:bg-elevated"
                                }`}
                            >
                                #{t}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {grouped.size === 0 ? (
                <div className="empty-state" role="status">
                    No match.
                </div>
            ) : (
                Array.from(grouped.entries()).map(([category, toolList]) => (
                    <section key={category} className="space-y-5">
                        <h2 className="section-title capitalize">
                            {category}
                        </h2>
                        <ul className="tool-grid">
                            {toolList.map((one) => (
                                <li key={one.slug} className="tool-card">
                                    <button
                                        type="button"
                                        onClick={() => handleOpen(one.slug)}
                                        className="tool-card-control"
                                    >
                                        <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="tool-card-title">
                                                {one.name}
                                            </div>
                                            {one.tag?.map((t) => (
                                                <span key={t} className="metadata-label">
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                            <div className="tool-card-summary line-clamp-2">
                                                {one.description}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))
            )}
        </div>
    )
}
