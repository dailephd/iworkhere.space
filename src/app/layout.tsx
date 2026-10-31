import type { Metadata } from "next";
import { DM_Sans } from "next/font/google"
import AppShell from "@/component/layout/AppShell"
import { ServiceWorkerRegister } from "@/component/layout/ServiceWorkerRegister"
import { ThemeProvider } from "@/component/common/ThemeProvider"
import { defaultNavItem } from "./navData"
import { getToolCategoryLabel } from "@/module/tool/category"
import { getAvailableCategory } from "@/module/tool/metadata"
import type { NavItem } from "@/component/layout/type"
import "./global.css";
import {ReactNode} from "react";
import { ADSENSE_CLIENT } from "@/module/ad/config";
import { WebVitals } from "@/component/common/WebVitals";
import { VercelWebAnalytics } from "@/component/observability/VercelWebAnalytics";
import { buildPageMetadata, SITE_URL } from "@/lib/seo";
import { THEME_INIT_SCRIPT } from "@/module/theme/themeRuntime.client";
import { DEFAULT_APPEARANCE } from "@/module/theme/themeRegistry";
import { SupportCoordinator } from "@/module/support/SupportCoordinator";
import { contextSource } from "@/module/support/projection";

/* One self-hosted public interface typeface; theme.css maps --font-sans to this variable. */
const siteSans = DM_Sans({ subsets: ["latin"], variable: "--site-font-dm-sans", display: "swap" })

export const metadata: Metadata = {
  ...buildPageMetadata({ title: "Browser Tools for PDFs, Images and Text", description: "Browser tools for PDFs, images, text, unit conversion, calculation, time values and developer tasks.", canonicalPath: "/" }),
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(SITE_URL),
  other: { "google-adsense-account": ADSENSE_CLIENT },
};

export default function RootLayout({
                                       children,
                                   }: {
    children: ReactNode
}) {
    const categoryNavItem: NavItem[] = getAvailableCategory().map((category) => ({
        id: `category-${category}`,
        label: getToolCategoryLabel(category),
        href: `/category/${encodeURIComponent(category)}`,
    }))
    // Public enable flag defaults off; the registry projection is built only when reporting is enabled.
    const supportEnabled = process.env.NEXT_PUBLIC_SUPPORT_ENABLED === "true"
    return (
        <html lang="en" className={siteSans.variable} data-palette={DEFAULT_APPEARANCE.palette} data-theme="light" data-theme-preference={DEFAULT_APPEARANCE.mode} suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="antialiased">
        <ThemeProvider>
            <AppShell
                navItem={defaultNavItem}
                categoryNavItem={categoryNavItem}
                footerActionSlot={supportEnabled ? <SupportCoordinator source={contextSource()} siteKey={process.env.NEXT_PUBLIC_SUPPORT_TURNSTILE_SITE_KEY} /> : undefined}
            >
                {children}
            </AppShell>
            <ServiceWorkerRegister />
            <WebVitals />
            <VercelWebAnalytics />
        </ThemeProvider>
        </body>
        </html>
    )
}
