"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
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
                className="flex h-10 min-h-10 items-center justify-center rounded-[10px] border border-border bg-surface-alt px-4 text-sm font-medium text-text-secondary"
                aria-label="Theme picker"
                disabled
            >
                Themes
            </button>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <Button
                variant="secondary"
                onClick={() => setOpen((prev) => !prev)}
                className="h-10 min-h-10 px-4 text-text-secondary hover:text-text"
                aria-label="Open theme picker"
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                Themes
            </Button>

            {open && (
                <div
                    role="listbox"
                    aria-label="Theme"
                    className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-[14px] border border-border bg-elevated p-2 shadow-[var(--card-shadow)]"
                >
                    {themes.map((theme) => (
                        <button
                            key={theme.id}
                            role="option"
                            aria-selected={theme.id === activeTheme}
                            type="button"
                            onClick={() => handleSelect(theme.id)}
                            className={`min-h-11 w-full rounded-[10px] px-3 py-2 text-left text-sm transition-colors duration-180 hover:bg-surface-alt ${
                                theme.id === activeTheme
                                    ? "bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] font-semibold text-[var(--brand-primary)]"
                                    : "text-text"
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
