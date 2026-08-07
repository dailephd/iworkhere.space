"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { loadTheme } from "@/module/theme/themeStorage";
import { setTheme } from "@/module/theme/themeRuntime.client";

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Applies the persisted theme on the client after mount.
 *
 * Renders children immediately — no theme-conditional markup — to avoid
 * hydration mismatches. The inline script in layout.tsx handles pre-paint
 * FOUC prevention; this component handles the React lifecycle side.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
    useEffect(() => {
        const stored = loadTheme();
        if (stored !== null) {
            setTheme(stored);
        }
    }, []);

    return <>{children}</>;
}
