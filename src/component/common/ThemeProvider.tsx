"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { loadAppearance, storeAppearance } from "@/module/theme/themeStorage";
import { applyAppearance } from "@/module/theme/themeRuntime.client";
import { DEFAULT_APPEARANCE, type AppearancePreference, type ColorMode, type PaletteId } from "@/module/theme/themeRegistry";

interface ThemeProviderProps { children: ReactNode; }
interface AppearanceContextValue {
    preference: AppearancePreference;
    ready: boolean;
    selectPalette: (palette: PaletteId) => void;
    selectMode: (mode: ColorMode) => void;
}
const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [appearance, setAppearance] = useState({ preference: DEFAULT_APPEARANCE, ready: false });
    const { preference, ready } = appearance;
    useLayoutEffect(() => {
        const saved = loadAppearance();
        applyAppearance(saved, prefersDark());
        // Storage is unavailable during SSR; hydrate the stable fallback first.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAppearance({ preference: saved, ready: true });
    }, []);
    useEffect(() => {
        const media = window.matchMedia?.("(prefers-color-scheme: dark)");
        if (!media) return;
        const update = () => {
            if (preference.mode === "system" && preference.palette !== "onedark") applyAppearance(preference, media.matches);
        };
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, [preference]);

    function select(next: AppearancePreference) {
        applyAppearance(next, prefersDark());
        storeAppearance(next);
        setAppearance({ preference: next, ready: true });
    }
    return <AppearanceContext.Provider value={{
        preference, ready,
        selectPalette: palette => select({ palette, mode: palette === "onedark" ? "dark" : preference.mode }),
        selectMode: mode => select({ palette: preference.palette === "onedark" ? DEFAULT_APPEARANCE.palette : preference.palette, mode }),
    }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
    const value = useContext(AppearanceContext);
    if (!value) throw new Error("Appearance controls require ThemeProvider.");
    return value;
}
