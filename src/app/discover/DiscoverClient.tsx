"use client"

import ToolSearch, { type ToolSearchItem } from "@/component/common/ToolSearch"

export interface DiscoverClientProp {
    item: ToolSearchItem[]
}

export default function DiscoverClient({ item }: DiscoverClientProp) {
    return <ToolSearch item={item} showTagFilters />
}
