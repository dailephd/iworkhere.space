import { storage } from "@/lib/storage";
import { type ThemeId, isThemeId } from "./themeRegistry";

const STORAGE_KEY = "theme";

export function storeTheme(themeId: ThemeId): void {
    storage.set(STORAGE_KEY, themeId);
}

export function loadTheme(): ThemeId | null {
    const value = storage.get<string>(STORAGE_KEY);
    if (isThemeId(value)) return value;
    storage.remove(STORAGE_KEY);
    return null;
}
