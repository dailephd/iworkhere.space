"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"

export interface ToolSearchItem {
    slug: string
    name: string
    description: string
    category: string
    tag?: string[]
}

export interface ToolSearchProps {
    item: ToolSearchItem[]
    onOpen: (slug: string) => void
    emptyLabel?: ReactNode
}

function norm(s: string): string {
    return s.trim().toLowerCase()
}

export default function ToolSearch(props: ToolSearchProps) {
    const { item, onOpen, emptyLabel } = props
    const [query, setQuery] = useState("")

    const viewItem = useMemo(() => {
        const q = norm(query)
        if (!q) return item

        return item.filter((one) => {
            const hay = `${one.name} ${one.description} ${one.category}`
            return norm(hay).includes(q)
        })
    }, [item, query])

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
                    placeholder="Search tool"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                />
            </div>

            {viewItem.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                    {emptyLabel ?? "No match."}
                </div>
            ) : (
                <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    {viewItem.map((one) => (
                        <li key={one.slug} className="p-3">
                            <button
                                type="button"
                                onClick={() => onOpen(one.slug)}
                                className="w-full text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
                                    <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--text-muted)]">
                                        {one.category}
                                    </div>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
