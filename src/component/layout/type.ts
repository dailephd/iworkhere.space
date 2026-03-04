import type { ReactNode } from "react"

export interface NavItem {
    id: string
    label: string
    href?: string
    hint?: string
    disabled?: boolean
    icon?: ReactNode
}
