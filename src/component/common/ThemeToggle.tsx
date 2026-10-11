"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isColorMode, listColorModes, listPalettes } from "@/module/theme/themeRegistry";
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
                        onChange={() => selectPalette(palette.id)} className="accent-[var(--accent)]" />
                    {palette.label}
                </label>)}
            </fieldset>
            <fieldset className="mt-4 space-y-1" disabled={preference.palette === "onedark"}>
                <legend className="mb-2 text-sm font-semibold">Color mode</legend>
                {listColorModes().map(mode => <label key={mode.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm">
                    <input type="radio" name={`${id}-mode`} value={mode.id} checked={preference.mode === mode.id}
                        onChange={() => { if (isColorMode(mode.id)) selectMode(mode.id); }} className="accent-[var(--accent)]" />
                    {mode.label}
                </label>)}
            </fieldset>
            <button type="button" onClick={() => close(true)} className="mt-4 min-h-10 rounded-lg border border-[var(--input-border)] bg-[var(--secondary-action-bg)] px-3 text-sm font-medium">Close</button>
        </div>}
    </div>;
}
