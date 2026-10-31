"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { searchToolItem } from "./toolSearchMatch"

export interface ToolSearchItem {
    slug: string
    name: string
    description: string
    category: string
    /** Canonical category title shown on the result badge; never the raw category id. */
    categoryLabel: string
    tag?: string[]
}

export interface ToolSearchProps {
    item: ToolSearchItem[]
    emptyLabel?: ReactNode
    showResultsWhenEmpty?: boolean
    showTagFilters?: boolean
    /** Rendered in place of the results while the query and tag filter are both empty (Home catalog). */
    idleContent?: ReactNode
}

function statusText(count: number): string {
    if (count === 0) return "No tools found. Try a different name or task."
    return count === 1 ? "1 tool found" : `${count} tools found`
}

export default function ToolSearch(props: ToolSearchProps) {
    const { item, emptyLabel, showResultsWhenEmpty = true, showTagFilters = false, idleContent } = props
    const [query, setQuery] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const allTags = useMemo(() => Array.from(new Set(item.flatMap((one) => one.tag ?? []))).sort(), [item])

    const viewItem = useMemo(() => searchToolItem(item, query, selectedTag), [item, query, selectedTag])
    // Header Search navigates to #tool-search; focus the input on arrival. A visit without the fragment never takes focus.
    useEffect(() => {
        const focusFromHash = () => {
            if (window.location.hash === "#tool-search") inputRef.current?.focus()
        }
        focusFromHash()
        window.addEventListener("hashchange", focusFromHash)
        return () => window.removeEventListener("hashchange", focusFromHash)
    }, [])
    const isActive = query.trim().length > 0 || selectedTag !== null
    const showResults = showResultsWhenEmpty || isActive
    const showIdleContent = !isActive && !showResultsWhenEmpty

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1">
                    <label className="block text-sm text-[var(--text-muted)]" htmlFor="tool-search">
                        Search
                    </label>
                    <input
                        id="tool-search"
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        type="search"
                        placeholder="Search tools or tasks"
                        className="w-full rounded-xl border border-search-border bg-search-bg px-3 py-2 text-[var(--text)] placeholder:text-text-muted outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    />
                </div>

                {showTagFilters && allTags.length > 0 && (
                    <div className="space-y-1">
                        <label className="block text-sm text-[var(--text-muted)]" htmlFor="tool-tag-filter">
                            Filter by tag
                        </label>
                        <select
                            id="tool-tag-filter"
                            value={selectedTag ?? ""}
                            onChange={(e) => setSelectedTag(e.target.value === "" ? null : e.target.value)}
                            className="w-full rounded-xl border border-search-border bg-search-bg px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-48"
                        >
                            <option value="">All tags</option>
                            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <p role="status" aria-live="polite" aria-atomic="true" className={showResults ? "min-h-5 text-sm text-[var(--text-muted)]" : "sr-only"}>
                {showResults ? statusText(viewItem.length) : ""}
            </p>

            {showIdleContent && idleContent}

            {showResults && (viewItem.length === 0 ? (
                emptyLabel ? (
                    <div className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-[var(--text-muted)]">
                        {emptyLabel}
                    </div>
                ) : null
            ) : (
                <ul className="ds-results divide-y divide-card-border rounded-xl border border-card-border bg-card-bg">
                    {viewItem.map((one) => (
                        <li key={one.slug} className="p-3">
                            <Link
                                data-category={one.category}
                                href={`/tool/${one.slug}`}
                                className="block rounded-md text-left hover:bg-[var(--category-soft)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                    <div className="min-w-0 flex-1 basis-56">
                                        <div className="break-words text-base font-semibold text-[var(--text)]">
                                            {one.name}
                                        </div>
                                        <div className="mt-1 break-words text-sm text-[var(--text-muted)]">
                                            {one.description}
                                        </div>
                                    </div>
                                    <div className="shrink-0 rounded-xl border border-[var(--category-color)] bg-[var(--category-soft)] px-2 py-1 text-xs text-[var(--category-color)]">
                                        {one.categoryLabel}
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
