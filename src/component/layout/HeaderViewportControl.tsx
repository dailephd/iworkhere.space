"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface HeaderViewportControlProp {
    /** The single server-rendered header content; it is never cloned or remounted. */
    children: ReactNode;
}

const headerBaseClass = "border-b border-header-bg bg-header-bg text-header-text";
// No overflow clipping: the theme popover is absolutely positioned inside the header and must extend below it.
// The header is above the control so that popover also stays above the Hide navigation button.
const headerOverlayClass = "fixed inset-x-0 top-0 z-50 shadow-md";
const controlClass =
    "fixed z-40 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

export function HeaderViewportControl({ children }: HeaderViewportControlProp) {
    const headerId = useId();
    const pathname = usePathname();
    const footprintRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const controlRef = useRef<HTMLButtonElement>(null);
    const [headerOutside, setHeaderOutside] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [footprintHeight, setFootprintHeight] = useState(0);
    const [trackedPathname, setTrackedPathname] = useState(pathname);

    // Route changes close the overlay.
    if (trackedPathname !== pathname) {
        setTrackedPathname(pathname);
        setExpanded(false);
    }

    // The footprint wrapper keeps the header's layout space, so it reports the header's real position.
    useEffect(() => {
        const footprint = footprintRef.current;
        if (!footprint || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver((entryList) => {
            const latest = entryList[entryList.length - 1];
            if (!latest) return;
            setHeaderOutside(!latest.isIntersecting);
            // Returning to the in-flow header restores ordinary behavior.
            if (latest.isIntersecting) setExpanded(false);
        });
        observer.observe(footprint);
        return () => observer.disconnect();
    }, []);

    function closeOverlay(restoreFocus: boolean) {
        const focusInsideHeader = headerRef.current?.contains(document.activeElement) ?? false;
        setExpanded(false);
        if (restoreFocus && focusInsideHeader) controlRef.current?.focus();
    }

    useEffect(() => {
        if (!expanded) return;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            // Leave Escape to an open modal dialog or an open header popover such as the theme selector.
            if (document.querySelector("dialog[open]")) return;
            if (headerRef.current?.querySelector('[aria-expanded="true"]')) return;
            closeOverlay(true);
        }
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [expanded]);

    // While the header is a fixed overlay its footprint tracks the header's current height, so a resize cannot leave a stale placeholder.
    // The header, not the footprint, is observed here; the footprint is the stable target of the IntersectionObserver above.
    useEffect(() => {
        const header = headerRef.current;
        if (!expanded || !header || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => setFootprintHeight(header.getBoundingClientRect().height));
        observer.observe(header);
        return () => observer.disconnect();
    }, [expanded]);

    function toggle() {
        if (expanded) {
            closeOverlay(true);
            return;
        }
        setFootprintHeight(headerRef.current?.getBoundingClientRect().height ?? 0);
        setExpanded(true);
    }

    function closeOnNavigation(event: MouseEvent<HTMLElement>) {
        if (!expanded) return;
        const link = (event.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
        if (!link) return;
        // A same-route link produces no navigation, so focus would stay on a link that is now offscreen.
        // Real route transitions keep Next.js's own focus and scroll handling.
        const sameRoute = link.pathname === window.location.pathname && link.search === window.location.search;
        closeOverlay(sameRoute);
    }

    const showControl = headerOutside || expanded;

    return (
        <>
            <div ref={footprintRef} style={expanded ? { minHeight: footprintHeight } : undefined}>
                <header
                    ref={headerRef}
                    id={headerId}
                    data-header-state={expanded ? "overlay" : "flow"}
                    className={expanded ? `${headerBaseClass} ${headerOverlayClass}` : headerBaseClass}
                    onClick={closeOnNavigation}
                >
                    {children}
                </header>
            </div>
            {showControl ? (
                <button
                    ref={controlRef}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={headerId}
                    className={`${controlClass} left-1/2 -translate-x-1/2`}
                    style={{ top: expanded ? footprintHeight + 4 : 4 }}
                    onClick={toggle}
                >
                    {expanded ? "Hide navigation" : "Show navigation"}
                </button>
            ) : null}
        </>
    );
}
