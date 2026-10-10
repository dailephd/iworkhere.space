import type { ReactNode } from "react";
import { AdSenseScript } from "./AdSenseScript";
import { AdSenseSlot } from "./AdSenseSlot";
import { adsenseEnabled } from "@/module/ad/config";

interface AdSenseEligiblePageProp {
    children: ReactNode;
}

export function AdSenseEligiblePage({ children }: AdSenseEligiblePageProp) {
    if (!adsenseEnabled()) return children;

    return (
        <>
            <AdSenseScript />
            <div className="mb-6 border-y border-border bg-surface-alt px-5 py-2 sm:px-6">
                <AdSenseSlot placement="header" />
            </div>
            <div className="grid min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_176px]">
                <div className="min-w-0">{children}</div>
                <aside className="hidden min-w-0 border-l border-border bg-surface-alt py-4 xl:block" aria-label="Right advertising area">
                    <AdSenseSlot placement="right" />
                </aside>
            </div>
        </>
    );
}
