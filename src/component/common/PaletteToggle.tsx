"use client";

import { useEffect, useRef, useState } from "react";
import { listPalettes, type PaletteId } from "@/module/theme/paletteRegistry";
import { loadPalette, storePalette } from "@/module/theme/paletteStorage";
import { setPalette } from "@/module/theme/paletteRuntime.client";

/** Palette choice is independent of System/Light/Dark; One Dark remains fixed. */
export function PaletteToggle() {
    const [active, setActive] = useState<PaletteId | null>(null);
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setActive(loadPalette() ?? "utility");
    }, []);

    useEffect(() => {
        if (!open) return;
        const handleOutside = (event: MouseEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [open]);

    function select(id: PaletteId) {
        setPalette(id);
        storePalette(id);
        setActive(id);
        setOpen(false);
    }

    return <div ref={root} className="relative" onKeyDown={event => {
        if (event.key === "Escape" && open) {
            setOpen(false);
            trigger.current?.focus();
        }
    }}>
        <button
            ref={trigger}
            type="button"
            aria-label="Palettes"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={active === null}
            onClick={() => setOpen(value => !value)}
            className="h-10 rounded-lg border border-header-muted bg-transparent px-3 text-sm font-medium text-header-text hover:bg-nav-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60"
        >Palettes</button>
        {open && <div
            role="listbox"
            aria-label="Color palette"
            data-surface="palette-popover"
            className="absolute right-0 top-full z-50 mt-1 max-h-[min(75vh,30rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg"
        >
            <p className="px-2 py-1 text-xs text-[var(--text-muted)]">
                Select a palette for System, Light or Dark. One Dark always uses its own fixed colors.
            </p>
            {listPalettes().map(palette => <button
                key={palette.id}
                type="button"
                role="option"
                aria-selected={active === palette.id}
                onClick={() => select(palette.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${active === palette.id ? "bg-[var(--accent-soft)] font-semibold" : ""}`}
            >
                <span aria-hidden="true" className="flex shrink-0 gap-1">
                    {palette.swatch.map(color => <span key={color} className="h-4 w-4 rounded-full border border-[var(--border)]" style={{ backgroundColor: color }} />)}
                </span>
                {palette.label}
            </button>)}
        </div>}
    </div>;
}
