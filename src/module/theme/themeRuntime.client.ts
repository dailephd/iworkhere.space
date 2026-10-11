import { DEFAULT_APPEARANCE, isColorMode, isPaletteId, listPalettes, listThemes, type AppearancePreference, type ThemeId } from "./themeRegistry";
import { PALETTE_STORAGE_KEY, THEME_STORAGE_KEY } from "./themeStorage";

/** Browser-only DOM application; preference state stays in ThemeProvider. */
export function applyAppearance(preference: AppearancePreference, prefersDark: boolean): "light" | "dark" {
    const legacy = preference.palette === "onedark";
    const effective = legacy || (preference.mode === "system" ? prefersDark : preference.mode === "dark") ? "dark" : "light";
    const root = document.documentElement;
    root.dataset.palette = preference.palette;
    root.dataset.themePreference = legacy ? "dark" : preference.mode;
    root.dataset.theme = legacy ? "onedark" : effective;
    root.classList.toggle("dark", effective === "dark");
    return effective;
}

/** Retained compatibility API for the previous four theme choices. */
export function setTheme(themeId: ThemeId): void {
    const palette = document.documentElement.dataset.palette;
    applyAppearance({
        palette: themeId === "onedark" ? "onedark" : isPaletteId(palette) && palette !== "onedark" ? palette : DEFAULT_APPEARANCE.palette,
        mode: themeId === "onedark" ? "dark" : themeId,
    }, window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
}

export function getThemeFromDom(): ThemeId {
    const root = document.documentElement;
    if (root.dataset.theme === "onedark") return "onedark";
    if (root.dataset.theme === "light" || root.dataset.theme === "dark") {
        return isColorMode(root.dataset.themePreference) ? root.dataset.themePreference : root.dataset.theme;
    }
    applyAppearance(DEFAULT_APPEARANCE, window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    return "system";
}

// The existing pre-paint storage exception mirrors the JSON adapter before React
// can run. Normal interactive reads/writes always use themeStorage/lib/storage.
export const THEME_INIT_SCRIPT = `(function(){
var root=document.documentElement;
function read(key,allowed,fallback){try{var value=JSON.parse(localStorage.getItem(key));if(allowed.indexOf(value)!==-1)return value;localStorage.removeItem(key)}catch(e){try{localStorage.removeItem(key)}catch(e){}}return fallback}
var mode=read(${JSON.stringify(THEME_STORAGE_KEY)},${JSON.stringify(listThemes().map(theme => theme.id))},"system");
var palette=read(${JSON.stringify(PALETTE_STORAGE_KEY)},${JSON.stringify(listPalettes().map(palette => palette.id))},${JSON.stringify(DEFAULT_APPEARANCE.palette)});
var legacy=mode==="onedark"||palette==="onedark";
if(legacy){palette="onedark";mode="dark"}
var dark=legacy||(mode==="system"?window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches:mode==="dark");
root.setAttribute("data-palette",palette);root.setAttribute("data-theme-preference",mode);
root.setAttribute("data-theme",legacy?"onedark":dark?"dark":"light");root.classList.toggle("dark",!!dark);
})()`;
