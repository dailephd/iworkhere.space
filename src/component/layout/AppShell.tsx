// src/component/layout/AppShell.tsx

import type { ReactNode } from "react"

import { Footer } from "./Footer"
import { Header } from "./Header"
import type { NavItem } from "./type"
import { VerticalNav } from "./VerticalNav"

export interface AppShellProps {
    children: ReactNode

    navItem?: NavItem[]

    headerBannerSlot?: ReactNode
    footerBannerSlot?: ReactNode
    leftBannerSlot?: ReactNode
    rightBannerSlot?: ReactNode
}

export default function AppShell(props: AppShellProps) {
    const {
        children,
        navItem,
        headerBannerSlot,
        footerBannerSlot,
        leftBannerSlot,
        rightBannerSlot,
    } = props

    return (
        <div className="h-dvh min-h-svh w-full overflow-hidden bg-background text-text">
            <a className="skip-link" href="#main-content">
                Skip to main content
            </a>
            <div className="grid h-full w-full grid-rows-[auto_auto_1fr_auto_auto]">
                <header className="z-10 border-b border-border bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                    <Header />
                </header>

                {headerBannerSlot ? (
                    <div className="border-b border-border bg-surface px-5 py-3 sm:px-8 lg:px-10">
                        {headerBannerSlot}
                    </div>
                ) : null}

                <div className="h-full min-h-0">
                    <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[auto_1fr_auto]">
                        <aside className="hidden min-w-0 border-r border-border bg-surface xl:block">
                            <div className="h-full overflow-y-auto p-4">
                                {leftBannerSlot}
                            </div>
                        </aside>

                        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]">
                            <aside className="hidden min-w-0 border-r border-border bg-surface lg:block">
                                <div className="h-full overflow-hidden p-4">
                                    {navItem && navItem.length > 0 ? (
                                        <VerticalNav
                                            item={navItem}
                                            ariaLabel="Primary navigation"
                                        />
                                    ) : null}
                                </div>
                            </aside>

                            <main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 outline-none">
                                <div className="MainScroll h-full min-h-0 px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                                    <div className="mx-auto w-full max-w-[1280px]">
                                        {children}
                                    </div>
                                </div>
                            </main>
                        </div>

                        <aside className="hidden min-w-0 border-l border-border bg-surface xl:block">
                            <div className="h-full overflow-y-auto p-4">
                                {rightBannerSlot}
                            </div>
                        </aside>
                    </div>
                </div>

                {footerBannerSlot ? (
                    <div className="border-t border-border bg-surface px-5 py-3 sm:px-8 lg:px-10">
                        {footerBannerSlot}
                    </div>
                ) : null}

                <footer className="z-10 border-t border-border bg-surface py-4">
                    <Footer />
                </footer>
            </div>
        </div>
    )
}
