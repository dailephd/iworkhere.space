export type ThemeId = "system" | "light" | "dark" | "onedark";
export type ColorMode = Exclude<ThemeId, "onedark">;
export type PaletteId = "mineral" | "oxblood" | "signal" | "cobalt" | "amber" | "original" | "onedark";

export interface AppearancePreference {
    palette: PaletteId;
    mode: ColorMode;
}

interface PaletteEntry { id: PaletteId; label: string; }
export const DEFAULT_APPEARANCE: AppearancePreference = { palette: "original", mode: "system" };
const palette_definition_list: PaletteEntry[] = [
    { id: "mineral", label: "Mineral Research" },
    { id: "oxblood", label: "Oxblood Atelier" },
    { id: "signal", label: "Signal Green" },
    { id: "cobalt", label: "Cobalt & Terracotta" },
    { id: "amber", label: "Amber & Graphite" },
    { id: "original", label: "Violet & Graphite" },
    { id: "onedark", label: "One Dark" },
];

interface ThemeEntry {
    id: ThemeId;
    label: string;
    description?: string;
}

const theme_definition_list: ThemeEntry[] = [
    { id: "system", label: "System", description: "Follow light or dark system preference" },
    { id: "light", label: "Light", description: "Clean colorful light" },
    { id: "dark", label: "Dark", description: "Restrained slate dark" },
    { id: "onedark", label: "One Dark", description: "Purple developer dark" },
];

export function listThemes(): ThemeEntry[] {
    return theme_definition_list;
}

export function isThemeId(x: unknown): x is ThemeId {
    return theme_definition_list.some((theme) => theme.id === x);
}

export function listPalettes(): PaletteEntry[] { return palette_definition_list; }
export function isPaletteId(value: unknown): value is PaletteId {
    return palette_definition_list.some((palette) => palette.id === value);
}
export function isColorMode(value: unknown): value is ColorMode {
    return value === "light" || value === "dark" || value === "system";
}
export function listColorModes(): ThemeEntry[] {
    return theme_definition_list.filter((theme) => theme.id !== "onedark");
}
