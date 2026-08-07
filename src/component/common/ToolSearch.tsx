"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { Input } from "./Input"

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
        <div className="space-y-6">
            <div className="surface-card p-5 sm:p-6">
                <label className="field-label" htmlFor="tool-search">
                    Search
                </label>
                <Input
                    id="tool-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tool"
                />
            </div>

            {viewItem.length === 0 ? (
                <div className="empty-state" role="status">
                    {emptyLabel ?? "No match."}
                </div>
            ) : (
                <ul className="tool-grid">
                    {viewItem.map((one) => (
                        <li key={one.slug} className="tool-card">
                            <button
                                type="button"
                                onClick={() => onOpen(one.slug)}
                                className="tool-card-control"
                            >
                                <div className="flex w-full items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-2">
                                        <div className="tool-card-title">
                                            {one.name}
                                        </div>
                                        <div className="tool-card-summary line-clamp-2">
                                            {one.description}
                                        </div>
                                    </div>
                                    <div className="metadata-label shrink-0 capitalize">
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
