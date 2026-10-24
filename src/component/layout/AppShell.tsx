import { type ReactNode } from "react"
import { Footer } from "./Footer"
import { Header } from "./Header"
import { HeaderViewportControl } from "./HeaderViewportControl"
import type { NavItem } from "./type"

export interface AppShellProps {
    children: ReactNode
    navItem?: NavItem[]
    headerBannerSlot?: ReactNode
    footerBannerSlot?: ReactNode
    leftBannerSlot?: ReactNode
    rightBannerSlot?: ReactNode
    /** Presentation slot rendered inside the footer; AppShell does not interpret it. */
    footerActionSlot?: ReactNode
}

export default function AppShell({
    children,
    navItem,
    headerBannerSlot,
    footerBannerSlot,
    leftBannerSlot,
    rightBannerSlot,
    footerActionSlot,
}: AppShellProps) {
    const desktopGridColumns = leftBannerSlot
        ? rightBannerSlot
            ? "lg:grid-cols-[112px_minmax(0,1fr)] xl:grid-cols-[112px_minmax(0,1fr)_176px]"
            : "lg:grid-cols-[112px_minmax(0,1fr)]"
        : rightBannerSlot
            ? "xl:grid-cols-[minmax(0,1fr)_176px]"
            : "lg:grid-cols-[minmax(0,1fr)]"

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-text">
            <a
                href="#main-content"
                className="sr-only z-[60] rounded-md bg-surface px-4 py-2 text-text focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
            >
                Skip to main content
            </a>
            <HeaderViewportControl>
                <Header navItem={navItem ?? []} />
            </HeaderViewportControl>

            {headerBannerSlot ? (
                <div className="border-b border-border bg-surface-alt px-5 py-2 sm:px-6">
                    {headerBannerSlot}
                </div>
            ) : null}

            <div className={`grid min-w-0 flex-1 grid-cols-1 ${desktopGridColumns}`}>
                {leftBannerSlot ? (
                    <aside className="hidden border-r border-border px-2 py-4 lg:block" aria-label="Left advertising area">
                        {leftBannerSlot}
                    </aside>
                ) : null}
                <main id="main-content" className="min-w-0 px-5 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-[1280px]">{children}</div>
                </main>
                {rightBannerSlot ? (
                    <aside className="hidden border-l border-border bg-surface-alt py-4 xl:block" aria-label="Right advertising area">
                        {rightBannerSlot}
                    </aside>
                ) : null}
            </div>

            {footerBannerSlot ? (
                <div className="border-t border-border bg-surface-alt px-5 py-3 sm:px-6">
                    {footerBannerSlot}
                </div>
            ) : null}
            <footer data-site-footer className="border-t border-border bg-footer-bg py-3">
                <Footer action={footerActionSlot} />
            </footer>
        </div>
    )
}
