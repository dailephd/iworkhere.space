"use client";

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
    readFooterState,
    subscribeFooterState,
    syncFooterStateFromStorage,
    writeFooterState,
    type FooterState,
} from "./footerPreference";

interface FooterViewportControlProp {
    /** The single server-rendered Footer; it is never cloned or remounted. */
    children: ReactNode;
}

const CLEARANCE_PROPERTY = "--footer-clearance";
const END_TOLERANCE = 2;
const ZOOMED_SCALE = 1.01;
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
// Without JavaScript the toggle cannot work, so the footer reverts to ordinary document flow and stays fully readable.
const NO_SCRIPT_STYLE = "[data-site-footer]{position:static!important}[data-footer-spacer],[data-footer-toggle]{display:none!important}";
const toggleClass =
    "mr-5 shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:mr-6 lg:mr-8";

function readServerState(): FooterState {
    return "expanded";
}

/** Publishes the footer's occupied height as the shell clearance; `applied` holds the last published height, or -1 before the first. */
function applyFooterClearance(footer: HTMLElement, applied: { current: number }) {
    const root = document.documentElement;
    const height = footer.getBoundingClientRect().height;
    if (height === applied.current) return;
    // The footer is fixed, so the document height has not changed yet: this reads where the reader was before the change.
    const atEnd = root.scrollTop + window.innerHeight >= root.scrollHeight - END_TOLERANCE;
    const adjusting = applied.current >= 0;
    applied.current = height;
    root.style.setProperty(CLEARANCE_PROPERTY, `${height}px`);
    // A reader parked at the end of the page stays at the end instead of ending up beneath a taller footer.
    if (adjusting && atEnd) window.scrollTo({ top: root.scrollHeight - window.innerHeight, behavior: "instant" });
}

export function FooterViewportControl({ children }: FooterViewportControlProp) {
    const contentId = useId();
    const footerRef = useRef<HTMLElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const appliedClearance = useRef(-1);
    const state = useSyncExternalStore(subscribeFooterState, readFooterState, readServerState);

    // Adopts the saved preference when the pre-paint script did not run.
    useEffect(() => {
        syncFooterStateFromStorage();
    }, []);

    // A toggle changes the footer's height in the same commit, so the clearance follows before the task ends. Waiting for the observer
    // would leave the footer and the spacer disagreeing until the next rendering step, which a script or a slow frame can observe.
    useLayoutEffect(() => {
        const footer = footerRef.current;
        if (footer) applyFooterClearance(footer, appliedClearance);
    }, [state]);

    // The shell's one clearance value follows the footer's actual occupied height, in either state and at any width.
    useEffect(() => {
        const footer = footerRef.current;
        if (!footer || typeof ResizeObserver === "undefined") return;
        const root = document.documentElement;
        const observer = new ResizeObserver(() => applyFooterClearance(footer, appliedClearance));
        observer.observe(footer);
        return () => {
            observer.disconnect();
            appliedClearance.current = -1;
            root.style.removeProperty(CLEARANCE_PROPERTY);
        };
    }, []);

    // A software keyboard shrinks only the visual viewport, so the footer follows that viewport's bottom edge and a focused field is kept above it.
    useEffect(() => {
        const footer = footerRef.current;
        const viewport = window.visualViewport;
        if (!footer || !viewport) return;
        function keepFieldAboveFooter() {
            const field = document.activeElement;
            if (!(field instanceof HTMLElement) || footer!.contains(field) || !field.matches(EDITABLE_SELECTOR)) return;
            const fieldBox = field.getBoundingClientRect();
            const overlap = fieldBox.bottom - footer!.getBoundingClientRect().top;
            const room = fieldBox.top - viewport!.offsetTop;
            if (overlap > 0 && room > 0) window.scrollBy({ top: Math.min(overlap, room), behavior: "instant" });
        }
        function follow() {
            // A pinch-zoomed page keeps the footer at the layout viewport; only an unzoomed, shortened viewport is a keyboard.
            const hidden = viewport!.scale > ZOOMED_SCALE ? 0 : Math.round(window.innerHeight - viewport!.offsetTop - viewport!.height);
            footer!.style.transform = hidden > 0 ? `translateY(${-hidden}px)` : "";
            keepFieldAboveFooter();
        }
        viewport.addEventListener("resize", follow);
        viewport.addEventListener("scroll", follow);
        document.addEventListener("focusin", keepFieldAboveFooter);
        follow();
        return () => {
            viewport.removeEventListener("resize", follow);
            viewport.removeEventListener("scroll", follow);
            document.removeEventListener("focusin", keepFieldAboveFooter);
            footer.style.transform = "";
        };
    }, []);

    function toggle() {
        if (state === "expanded") {
            // Collapsing hides the copyright and privacy link; keep focus on a control that stays visible.
            const hiding = contentRef.current?.querySelectorAll("[data-footer-detail]") ?? [];
            if ([...hiding].some((element) => element.contains(document.activeElement))) toggleRef.current?.focus();
            writeFooterState("collapsed");
            return;
        }
        writeFooterState("expanded");
    }

    const expanded = state === "expanded";

    return (
        <>
            <noscript>
                <style>{NO_SCRIPT_STYLE}</style>
            </noscript>
            <div aria-hidden="true" data-footer-spacer className="h-[var(--footer-clearance)]" />
            <footer
                ref={footerRef}
                data-site-footer
                className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-footer-bg py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
                <div className="flex flex-wrap items-center justify-between gap-y-1">
                    <div ref={contentRef} id={contentId} data-footer-content className="min-w-0 flex-1 basis-64">
                        {children}
                    </div>
                    <button
                        ref={toggleRef}
                        type="button"
                        data-footer-toggle
                        aria-expanded={expanded}
                        aria-controls={contentId}
                        className={toggleClass}
                        onClick={toggle}
                    >
                        <span data-footer-when="expanded" hidden={!expanded}>Hide footer</span>
                        <span data-footer-when="collapsed" hidden={expanded}>Show footer</span>
                    </button>
                </div>
            </footer>
        </>
    );
}
