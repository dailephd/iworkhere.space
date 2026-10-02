"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import Link from "next/link"

export interface ToolSearchItem {
    slug: string
    name: string
    description: string
    category: string
    tag?: string[]
}

export interface ToolSearchProps {
    item: ToolSearchItem[]
    emptyLabel?: ReactNode
    showResultsWhenEmpty?: boolean
    showTagFilters?: boolean
}

function norm(s: string): string {
    return s.trim().toLowerCase()
}

export default function ToolSearch(props: ToolSearchProps) {
    const { item, emptyLabel, showResultsWhenEmpty = true, showTagFilters = false } = props
    const [query, setQuery] = useState("")
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const allTags = useMemo(() => Array.from(new Set(item.flatMap((one) => one.tag ?? []))).sort(), [item])

    const viewItem = useMemo(() => {
        const q = norm(query)
        return item.filter((one) => {
            const hay = `${one.name} ${one.description} ${one.category} ${(one.tag ?? []).join(" ")}`
            return (!q || norm(hay).includes(q)) && (!selectedTag || one.tag?.includes(selectedTag))
        })
    }, [item, query, selectedTag])
    const showResults = showResultsWhenEmpty || query.trim().length > 0 || selectedTag !== null

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <label className="text-sm text-[var(--text-muted)]" htmlFor="tool-search">
                    Search
                </label>
                <input
                    id="tool-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    type="search"
                    placeholder="Search tools by name, description, category or tag"
                    className="w-full rounded-xl border border-search-border bg-search-bg px-3 py-2 text-[var(--text)] placeholder:text-text-muted outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                />
            </div>

            {showTagFilters && allTags.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filter by tag">
                <button type="button" onClick={() => setSelectedTag(null)} aria-pressed={selectedTag === null} className="rounded-full bg-surface-alt px-3 py-1.5 text-xs text-text">All tags</button>
                {allTags.map((tag) => <button type="button" key={tag} onClick={() => setSelectedTag(tag)} aria-pressed={selectedTag === tag} className="rounded-full bg-surface-alt px-3 py-1.5 text-xs text-text">#{tag}</button>)}
            </div>}

            {showResults && (viewItem.length === 0 ? (
                <div className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-[var(--text-muted)]">
                    {emptyLabel ?? "No match."}
                </div>
            ) : (
                <ul className="divide-y divide-card-border rounded-xl border border-card-border bg-card-bg">
                    {viewItem.map((one) => (
                        <li key={one.slug} className="p-3">
                            <Link
                                data-category={one.category}
                                href={`/tool/${one.slug}`}
                                className="block rounded-md text-left hover:bg-[var(--category-soft)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-base font-semibold text-[var(--text)]">
                                            {one.name}
                                        </div>
                                        <div className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                                            {one.description}
                                        </div>
                                    </div>
                                    <div className="shrink-0 rounded-xl border border-[var(--category-color)] bg-[var(--category-soft)] px-2 py-1 text-xs text-[var(--category-color)]">
                                        {one.category}
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            ))}
        </div>
    )
}
