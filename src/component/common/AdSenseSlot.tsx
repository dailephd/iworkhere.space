"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOT, adsenseEnabled, type AdPlacement } from "@/module/ad/config";
import { initializeAdSlot } from "@/module/ad/runtime.client";

export interface AdSenseSlotProps { placement: AdPlacement }
export function AdSenseSlot({ placement }: AdSenseSlotProps) {
    const element = useRef<HTMLModElement>(null);
    const enabled = adsenseEnabled();
    useEffect(() => {
        if (!enabled || !element.current) return;
        const slot = element.current;
        const initialize = () => initializeAdSlot(slot, placement);
        const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(initialize);
        observer?.observe(slot);
        initialize();
        return () => observer?.disconnect();
    }, [enabled, placement]);
    if (!enabled) return null;
    return (
        <div aria-label={`${placement === "header" ? "Top" : "Right"} advertisement`} className="min-w-0 text-center">
            <p className="mb-1 text-xs text-[var(--text-muted)]">Advertisement</p>
            <ins ref={element} className={`adsbygoogle block w-full ${placement === "header" ? "min-h-[100px] sm:min-h-[90px]" : ""}`}
                data-ad-client={ADSENSE_CLIENT} data-ad-slot={ADSENSE_SLOT[placement]}
                data-ad-format={placement === "header" ? "horizontal" : "vertical"}
                {...(placement === "header" ? { "data-full-width-responsive": "true" } : {})} />
        </div>
    );
}
