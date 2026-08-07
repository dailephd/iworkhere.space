"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"

import ToolSearch from "@/component/common/ToolSearch"
import type { ToolSearchItem } from "@/component/common/ToolSearch"

export interface HomeClientProps {
    children?: ReactNode
    toolItem: ToolSearchItem[]
}

export default function HomeClient(props: HomeClientProps) {
    const { toolItem, children } = props
    const router = useRouter()

    function handleOpen(slug: string) {
        router.push(`/tool/${slug}`)
    }

    return (
        <div className="space-y-8">
            <ToolSearch item={toolItem} onOpen={handleOpen} />
            {children ? children : null}
        </div>
    )
}
