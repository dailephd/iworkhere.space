"use client";

import { usePathname, useRouter } from "next/navigation";

/** The existing labelled search input (ToolSearch). This control reuses it; it is not a second search system. */
export const SEARCH_INPUT_ID = "tool-search";
const SEARCH_PATH = "/discover";

/**
 * Header Search utility. On /discover it focuses the input in place; elsewhere it navigates to /discover#tool-search,
 * where ToolSearch moves focus to the input once mounted. It is a button, not a second primary /discover link.
 */
export function HeaderSearch() {
    const pathname = usePathname();
    const router = useRouter();

    function openSearch() {
        if (pathname === SEARCH_PATH) {
            document.getElementById(SEARCH_INPUT_ID)?.focus();
            return;
        }
        router.push(`${SEARCH_PATH}#${SEARCH_INPUT_ID}`);
    }

    return (
        <button
            type="button"
            onClick={openSearch}
            aria-label="Search tools"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-header-muted bg-transparent px-2 text-sm font-medium text-header-text hover:bg-nav-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] lg:px-3"
        >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" />
            </svg>
            <span aria-hidden="true" className="hidden lg:inline">Search</span>
        </button>
    );
}
