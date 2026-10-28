import type { NavItem } from "@/component/layout/type"

export const defaultNavItem: NavItem[] = [
    {
        id: "home",
        label: "Home",
        href: "/",
    },
    {
        id: "discover",
        label: "All tools",
        href: "/discover",
    },
    {
        id: "guide",
        label: "Guides",
        href: "/guide",
    },
]

/** About closes the primary navigation, after the registry-derived category links. */
export const aboutNavItem: NavItem = {
    id: "about",
    label: "About",
    href: "/about",
}
