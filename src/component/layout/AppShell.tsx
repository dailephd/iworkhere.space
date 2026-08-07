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
            <div className="grid h-full w-full grid-rows-[auto_auto_1fr_auto_auto]">
                <header className="z-10 border-b border-border bg-surface">
                    <Header />
                </header>

                {headerBannerSlot ? (
                    <div className="border-b border-border bg-surface-alt px-4 py-2 sm:px-6 lg:px-8">
                        {headerBannerSlot}
                    </div>
                ) : null}

                <div className="h-full min-h-0">
                    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[auto_1fr_auto]">
                        <aside className="hidden min-w-0 border-r border-border lg:block">
                            <div className="h-full overflow-y-auto p-4">
                                {leftBannerSlot}
                            </div>
                        </aside>

                        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[240px_1fr]">
                            <aside className="hidden min-w-0 border-r border-border bg-surface lg:block">
                                <div className="h-full overflow-hidden p-3">
                                    {navItem && navItem.length > 0 ? (
                                        <VerticalNav
                                            item={navItem}
                                            ariaLabel="Primary navigation"
                                        />
                                    ) : null}
                                </div>
                            </aside>

                            <main className="min-h-0 min-w-0">
                                <div className="MainScroll h-full min-h-0 p-4">
                                    {children}
                                </div>
                            </main>
                        </div>

                        <aside className="hidden min-w-0 border-l border-border lg:block">
                            <div className="h-full overflow-y-auto p-4">
                                {rightBannerSlot}
                            </div>
                        </aside>
                    </div>
                </div>

                {footerBannerSlot ? (
                    <div className="border-t border-border bg-surface-alt px-4 py-2 sm:px-6 lg:px-8">
                        {footerBannerSlot}
                    </div>
                ) : null}

                <footer className="z-10 border-t border-border bg-surface py-3">
                    <Footer />
                </footer>
            </div>
        </div>
    )
}