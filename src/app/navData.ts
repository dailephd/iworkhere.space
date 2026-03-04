import type { NavItem } from "@/component/layout/type"

export const defaultNavItem: NavItem[] = [
    {
        id: "home",
        label: "Home",
        href: "/",
    },
    {
        id: "discover",
        label: "Discover",
        href: "/discover",
        hint: "Browse all tool",
    },
    {
        id: "about",
        label: "About",
        disabled: true,
    },
]
