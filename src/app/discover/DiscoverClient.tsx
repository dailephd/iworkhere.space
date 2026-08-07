"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ToolSearchItem } from "@/component/common/ToolSearch"

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
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm text-[var(--text-muted)]" htmlFor="discover-search">
                        Search
                    </label>
                    <input
                        id="discover-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tool by name, description, or category"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    />
                </div>

                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedTag(null)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                selectedTag === null
                                    ? "bg-[var(--text)] text-[var(--surface)]"
                                    : "bg-[var(--surface-alt)] text-[var(--text-muted)] hover:bg-[var(--border)]"
                            }`}
                        >
                            All
                        </button>
                        {allTags.map((t) => (
                            <button
                                key={t}
                                onClick={() => setSelectedTag(t)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    selectedTag === t
                                        ? "bg-[var(--text)] text-[var(--surface)]"
                                        : "bg-[var(--surface-alt)] text-[var(--text-muted)] hover:bg-[var(--border)]"
                                }`}
                            >
                                #{t}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {grouped.size === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                    No match.
                </div>
            ) : (
                Array.from(grouped.entries()).map(([category, toolList]) => (
                    <section key={category} className="space-y-3">
                        <h2 className="text-lg font-semibold capitalize text-[var(--text)]">
                            {category}
                        </h2>
                        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                            {toolList.map((one) => (
                                <li key={one.slug} className="p-3">
                                    <button
                                        type="button"
                                        onClick={() => handleOpen(one.slug)}
                                        className="w-full text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                        <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="truncate text-base font-semibold text-[var(--text)]">
                                                {one.name}
                                            </div>
                                            {one.tag?.map((t) => (
                                                <span key={t} className="rounded-md bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                            <div className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
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
