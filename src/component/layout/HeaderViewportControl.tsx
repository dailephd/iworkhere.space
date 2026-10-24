"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface HeaderViewportControlProp {
    /** The single server-rendered header content; it is never cloned or remounted. */
    children: ReactNode;
}

const HEIGHT_PROPERTY = "--header-height";
// Without JavaScript the header stays in ordinary document flow and remains fully readable.
const NO_SCRIPT_STYLE = "[data-site-header]{position:static!important}[data-header-footprint]{min-height:0!important}";

/**
 * Keeps the single header fixed to the top of the viewport and reserves its exact rendered height in document flow,
 * including when the navigation wraps on narrow screens. The same height is published for anchor scroll padding.
 */
export function HeaderViewportControl({ children }: HeaderViewportControlProp) {
    const footprintRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const footprint = footprintRef.current;
        const header = headerRef.current;
        if (!footprint || !header || typeof ResizeObserver === "undefined") return;
        const root = document.documentElement;
        function reserveHeaderHeight() {
            const height = header!.getBoundingClientRect().height;
            footprint!.style.minHeight = `${height}px`;
            root.style.setProperty(HEIGHT_PROPERTY, `${height}px`);
        }
        reserveHeaderHeight();
        const observer = new ResizeObserver(reserveHeaderHeight);
        observer.observe(header);
        return () => {
            observer.disconnect();
            root.style.removeProperty(HEIGHT_PROPERTY);
        };
    }, []);

    return (
        <>
            <noscript>
                <style>{NO_SCRIPT_STYLE}</style>
            </noscript>
            {/* The initial minimum height matches the single-row header, so the first paint has little to correct. */}
            <div ref={footprintRef} data-header-footprint className="min-h-16">
                <header
                    ref={headerRef}
                    data-site-header
                    className="fixed inset-x-0 top-0 z-50 border-b border-header-bg bg-header-bg text-header-text shadow-sm"
                >
                    {children}
                </header>
            </div>
        </>
    );
}
