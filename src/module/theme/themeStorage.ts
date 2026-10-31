import { storage } from "@/lib/storage";
import { DEFAULT_APPEARANCE, type ThemeId, isThemeId, isPaletteId, isColorMode, type PaletteId, type AppearancePreference } from "./themeRegistry";

export const THEME_STORAGE_KEY = "theme";
export const PALETTE_STORAGE_KEY = "palette";

export function storeTheme(themeId: ThemeId): void {
    storage.set(THEME_STORAGE_KEY, themeId);
}

export function loadTheme(): ThemeId | null {
    const value = storage.get<string>(THEME_STORAGE_KEY);
    if (isThemeId(value)) return value;
    storage.remove(THEME_STORAGE_KEY);
    return null;
}

export function loadPalette(): PaletteId | null {
    const value = storage.get<unknown>(PALETTE_STORAGE_KEY);
    if (isPaletteId(value)) return value;
    storage.remove(PALETTE_STORAGE_KEY);
    return null;
}
export function loadAppearance(): AppearancePreference {
    const theme = loadTheme();
    const palette = loadPalette();
    // The retained ordinary mode is stored beside palette "onedark". Only legacy bytes (theme "onedark", or no usable mode) fall back to dark.
    if (palette === "onedark") return { palette: "onedark", mode: isColorMode(theme) ? theme : "dark" };
    if (theme === "onedark") return { palette: "onedark", mode: "dark" };
    return { palette: palette ?? DEFAULT_APPEARANCE.palette, mode: theme ?? DEFAULT_APPEARANCE.mode };
}
export function storeAppearance(preference: AppearancePreference): void {
    storage.set(PALETTE_STORAGE_KEY, preference.palette);
    storeTheme(preference.mode);
}
