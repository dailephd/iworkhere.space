import Link from "next/link";
import { ThemeToggle } from "@/component/common/ThemeToggle";
import { HeaderSearch } from "./HeaderSearch";
import { VerticalNav } from "./VerticalNav";
import type { NavItem } from "./type";
import { LeMark } from "@/component/brand/LeMark";

export interface HeaderProp {
    navItem: NavItem[];
    categoryNavItem?: NavItem[];
}

/*
 * One persistent row at every width: brand, navigation (a Menu button below 1024 px), Search and Themes.
 * The row never wraps, so the fixed header keeps a stable height that HeaderViewportControl measures.
 */
export function Header({ navItem, categoryNavItem = [] }: HeaderProp) {
    return (
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:gap-4 lg:px-8">
            <Link href="/" className="inline-flex min-h-11 min-w-0 shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-header-text hover:text-header-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
                <LeMark size={34} variant="light" className="brand-mark-light" aria-hidden="true" focusable="false" />
                <LeMark size={34} variant="dark" className="brand-mark-dark" aria-hidden="true" focusable="false" />
                <span className="max-[384px]:sr-only">iworkhere.space</span>
            </Link>
            <div className="ml-auto flex min-w-0 items-center gap-2 lg:ml-0 lg:flex-1 lg:gap-4">
                <VerticalNav item={navItem} categoryItem={categoryNavItem} ariaLabel="Primary navigation" />
                <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
                    <HeaderSearch />
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
}
