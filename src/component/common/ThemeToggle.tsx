"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_APPEARANCE, isColorMode, listColorModes, listPalettes } from "@/module/theme/themeRegistry";
import { useAppearance } from "./ThemeProvider";

export function ThemeToggle() {
    const { preference, ready, selectPalette, selectMode } = useAppearance();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const id = useId();
    function close(returnFocus = false) {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    }
    useEffect(() => {
        if (!open) return;
        panelRef.current?.querySelector<HTMLInputElement>('input[name="' + id + '-palette"]:checked')?.focus();
        const outside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener("mousedown", outside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [open, id]);
    return <div ref={containerRef} className="relative" onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close();
    }}>
        <button ref={triggerRef} type="button" disabled={!ready} onClick={() => setOpen(value => !value)}
            className="h-10 rounded-lg border border-header-muted bg-transparent px-3 text-sm font-medium text-header-text hover:bg-nav-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label="Themes" aria-expanded={open} aria-haspopup="dialog" aria-controls={`${id}-appearance`}>
            Themes
        </button>
        {open && <div ref={panelRef} id={`${id}-appearance`} role="dialog" aria-label="Appearance settings"
            data-surface="theme-popover"
            className="material-glass absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-md">
            <fieldset className="space-y-1">
                <legend className="mb-2 text-sm font-semibold">Palette</legend>
                {listPalettes().map(palette => <label key={palette.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-[var(--accent-soft)]">
                    <input type="radio" name={`${id}-palette`} value={palette.id} checked={preference.palette === palette.id}
                        aria-describedby={palette.id === DEFAULT_APPEARANCE.palette ? `${id}-default` : undefined}
                        onChange={() => selectPalette(palette.id)} className="accent-[var(--accent)]" />
                    <span aria-hidden="true" data-palette-swatch={palette.id} data-swatch={palette.id}
                        className="palette-swatch flex h-6 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--input-border)]">
                        <span data-swatch-part="hero" className="flex-1 bg-[var(--swatch-hero)]" />
                        <span data-swatch-part="section" className="flex-1 bg-[var(--swatch-section)]" />
                        <span data-swatch-part="action" className="flex-1 bg-[var(--swatch-action)]" />
                    </span>
                    <span className="min-w-0">{palette.label}</span>
                    {palette.id === DEFAULT_APPEARANCE.palette && <span id={`${id}-default`} aria-hidden="true" className="rounded-full border border-[var(--input-border)] px-2 text-xs text-[var(--text-muted)]">Default</span>}
                </label>)}
            </fieldset>
            <fieldset className="mt-4 space-y-1" disabled={preference.palette === "onedark"}
                aria-describedby={preference.palette === "onedark" ? `${id}-fixed` : undefined}>
                <legend className="mb-2 text-sm font-semibold">Color mode</legend>
                {preference.palette === "onedark" && <p id={`${id}-fixed`} className="text-sm text-[var(--text-muted)]">One Dark uses a fixed dark appearance; color mode does not apply.</p>}
                {listColorModes().map(mode => <label key={mode.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm">
                    <input type="radio" name={`${id}-mode`} value={mode.id} checked={preference.mode === mode.id}
                        disabled={preference.palette === "onedark"}
                        onChange={() => { if (isColorMode(mode.id)) selectMode(mode.id); }} className="accent-[var(--accent)]" />
                    {mode.label}
                </label>)}
            </fieldset>
            <button type="button" onClick={() => close(true)} className="mt-4 min-h-10 rounded-lg border border-[var(--input-border)] bg-[var(--secondary-action-bg)] px-3 text-sm font-medium">Close</button>
        </div>}
    </div>;
}
