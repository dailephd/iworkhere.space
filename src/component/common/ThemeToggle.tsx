"use client";

import { useEffect, useRef, useState } from "react";
import { listThemes, type ThemeId } from "@/module/theme/themeRegistry";
import { setTheme } from "@/module/theme/themeRuntime.client";
import { loadTheme, storeTheme } from "@/module/theme/themeStorage";

export function ThemeToggle() {
    // null = not yet mounted (server-side or first paint)
    const [activeTheme, setActiveTheme] = useState<ThemeId | null>(null);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Intentional: reads from localStorage (client-only) after mount.
        // SSR renders a stable placeholder; this update runs after hydration.
        const stored = loadTheme();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTheme(stored ?? "system");
    }, []);

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    function handleSelect(themeId: ThemeId) {
        setTheme(themeId);
        storeTheme(themeId);
        setActiveTheme(themeId);
        setOpen(false);
    }

    const themes = listThemes();

    if (activeTheme === null) {
        return (
            <button
                type="button"
                className="h-10 rounded-lg border border-header-muted bg-transparent px-3 text-sm font-medium text-header-text"
                aria-label="Themes"
                disabled
            />
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="h-10 rounded-lg border border-header-muted bg-transparent px-3 text-sm font-medium text-header-text hover:bg-nav-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                aria-label="Themes"
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                Themes
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-label="Theme"
                    data-surface="theme-popover"
                    className="material-glass absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md"
                >
                    {themes.map((theme) => (
                        <button
                            key={theme.id}
                            role="option"
                            aria-selected={theme.id === activeTheme}
                            type="button"
                            onClick={() => handleSelect(theme.id)}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--accent-soft)] ${
                                theme.id === activeTheme
                                    ? "bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                                    : "text-[var(--text)]"
                            }`}
                        >
                            {theme.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
