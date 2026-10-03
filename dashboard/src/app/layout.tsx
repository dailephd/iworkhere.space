import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./global.css";

export const metadata: Metadata = {
    title: "iworkhere.space Observability",
    robots: { index: false, follow: false, noarchive: true },
};
export default function RootLayout({ children }: { children: ReactNode }) {
    return <html lang="en"><body><a className="skip" href="#main">Skip to dashboard</a>{children}</body></html>;
}
