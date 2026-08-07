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
        <div className="min-h-dvh w-full bg-background text-text">
            <a className="skip-link" href="#main-content">
                Skip to main content
            </a>
            <div className="flex min-h-dvh w-full flex-col">
                <header className="z-10 border-b border-border bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                    <Header />
                </header>

                {headerBannerSlot ? (
                    <div className="border-b border-border bg-surface px-5 py-3 sm:px-8 lg:px-10">
                        {headerBannerSlot}
                    </div>
                ) : null}

                <div className="grid w-full flex-1 grid-cols-1 xl:grid-cols-[112px_minmax(0,1fr)_112px]">
                    <aside className="hidden min-w-0 border-r border-border bg-surface xl:block">
                        <div className="py-4">
                            {leftBannerSlot}
                        </div>
                    </aside>

                    <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[176px_minmax(0,1fr)]">
                        <aside className="hidden min-w-0 border-r border-border bg-surface lg:block">
                            <div className="p-3">
                                {navItem && navItem.length > 0 ? (
                                    <VerticalNav
                                        item={navItem}
                                        ariaLabel="Primary navigation"
                                    />
                                ) : null}
                            </div>
                        </aside>

                        <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">
                            <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                                <div className="mx-auto w-full max-w-[1280px]">
                                    {children}
                                </div>
                            </div>
                        </main>
                    </div>

                    <aside className="hidden min-w-0 border-l border-border bg-surface xl:block">
                        <div className="py-4">
                            {rightBannerSlot}
                        </div>
                    </aside>
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
