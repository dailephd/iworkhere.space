import type { Metadata } from "next";
import AppShell from "@/component/layout/AppShell"
import { ServiceWorkerRegister } from "@/component/layout/ServiceWorkerRegister"
import { ThemeProvider } from "@/component/common/ThemeProvider"
import { defaultNavItem } from "./navData"
import { getAvailableCategory } from "@/module/tool/metadata"
import type { NavItem } from "@/component/layout/type"
import "./global.css";
import {ReactNode} from "react";
import { ADSENSE_CLIENT, adsenseEnabled } from "@/module/ad/config";
import { AdSenseSlot } from "@/component/common/AdSenseSlot";
import { AdSenseScript } from "@/component/common/AdSenseScript";
import { WebVitals } from "@/component/common/WebVitals";
import { VercelWebAnalytics } from "@/component/observability/VercelWebAnalytics";
import { buildPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({ title: "Utility Tool Platform", description: "Browser tools for images, text, math, time and everyday tasks.", canonicalPath: "/" }),
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(SITE_URL),
  other: { "google-adsense-account": ADSENSE_CLIENT },
};

// Applies the stored theme before first paint to prevent flash of unstyled content.
// "system" (or no stored value) means no data-theme attribute — CSS handles it via prefers-color-scheme.
const THEME_INIT_SCRIPT = `(function(){var h=document.documentElement;h.removeAttribute("data-theme");try{var t=JSON.parse(localStorage.getItem("theme"));var v=["light","dark","onedark"];if(v.indexOf(t)!==-1)h.setAttribute("data-theme",t);else if(t!=="system")localStorage.removeItem("theme")}catch(e){try{localStorage.removeItem("theme")}catch(e){}}})()`;

export default function RootLayout({
                                       children,
                                   }: {
    children: ReactNode
}) {
    const navItem: NavItem[] = [
        ...defaultNavItem,
        ...getAvailableCategory().map((category) => ({
            id: `category-${category}`,
            label: category[0].toUpperCase() + category.slice(1),
            href: `/category/${encodeURIComponent(category)}`,
        })),
    ]
    return (
        <html lang="en" suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="antialiased">
        <ThemeProvider>
            <AppShell
                navItem={navItem}
                headerBannerSlot={adsenseEnabled() ? <AdSenseSlot placement="header" /> : undefined}
                rightBannerSlot={adsenseEnabled() ? <AdSenseSlot placement="right" /> : undefined}
            >
                {children}
            </AppShell>
            <ServiceWorkerRegister />
            <WebVitals />
            <VercelWebAnalytics />
            <AdSenseScript />
        </ThemeProvider>
        </body>
        </html>
    )
}
