import type { Metadata } from "next";
import AppShell from "@/component/layout/AppShell"
import { AdBannerHorizontal } from "@/component/layout/AdBannerHorizontal"
import { AdBannerVertical } from "@/component/layout/AdBannerVertical"
import { ServiceWorkerRegister } from "@/component/layout/ServiceWorkerRegister"
import { ThemeProvider } from "@/component/common/ThemeProvider"
import { defaultNavItem } from "./navData"
import "./global.css";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "iworkhere.space — Utility Tool Platform",
  description: "Simple, fast utility tool for text, document, math, and everyday task.",
};

// Applies the stored theme before first paint to prevent flash of unstyled content.
// "system" (or no stored value) means no data-theme attribute — CSS handles it via prefers-color-scheme.
const THEME_INIT_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem("theme"));var v=["light","dark","onedark","vscode-modern","dracula","amethyst-haze","mercury-fog"];if(v.indexOf(t)!==-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({
                                       children,
                                   }: {
    children: ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="antialiased">
        <ThemeProvider>
            <AppShell
                navItem={defaultNavItem}
                headerBannerSlot={
                    <AdBannerHorizontal label="Header advertising placeholder" isPlaceholder />
                }
                footerBannerSlot={
                    <AdBannerHorizontal label="Footer advertising placeholder" isPlaceholder />
                }
                leftBannerSlot={
                    <AdBannerVertical label="Left advertising placeholder" isPlaceholder />
                }
                rightBannerSlot={
                    <AdBannerVertical label="Right advertising placeholder" isPlaceholder />
                }
            >
                {children}
            </AppShell>
            <ServiceWorkerRegister />
        </ThemeProvider>
        </body>
        </html>
    )
}
