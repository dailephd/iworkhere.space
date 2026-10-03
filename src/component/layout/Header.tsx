import Link from "next/link";
import { ThemeToggle } from "@/component/common/ThemeToggle";
import { VerticalNav } from "./VerticalNav";
import type { NavItem } from "./type";

export function Header({ navItem }: { navItem: NavItem[] }) {
    return (
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
            <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-header-text hover:text-header-muted">
                iworkhere.space
            </Link>
            <div className="order-3 w-full lg:order-2 lg:min-w-0 lg:flex-1">
                <VerticalNav item={navItem} ariaLabel="Primary navigation" />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-4 lg:order-3">
                <Link href="/discover" className="rounded-md px-2 py-2 text-sm font-medium text-header-muted hover:bg-nav-hover-bg hover:text-header-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
                    Search tools
                </Link>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
}
