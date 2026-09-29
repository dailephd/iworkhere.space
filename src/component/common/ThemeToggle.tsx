"use client";

import { useEffect, useRef, useState } from "react";
import { listThemes, type ThemeId } from "@/module/theme/themeRegistry";
import { setTheme } from "@/module/theme/themeRuntime.client";
import { loadTheme, storeTheme } from "@/module/theme/themeStorage";

function PaletteIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
    );
}

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
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)]"
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
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
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
                    className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md"
                >
                    {themes.map((theme) => (
                        <button
                            key={theme.id}
                            role="option"
                            aria-selected={theme.id === activeTheme}
                            type="button"
                            onClick={() => handleSelect(theme.id)}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-alt)] ${
                                theme.id === activeTheme
                                    ? "font-medium text-[var(--accent)]"
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
