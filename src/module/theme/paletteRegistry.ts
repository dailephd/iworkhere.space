export type PaletteId = "utility" | "mineral" | "oxblood" | "signal" | "cobalt" | "amber" | "original";

export interface PaletteEntry {
    id: PaletteId;
    label: string;
    swatch: readonly [string, string];
}

export const palette_definition_list: readonly PaletteEntry[] = [
    { id: "utility", label: "Utility (original)", swatch: ["#5b4bd8", "#2563eb"] },
    { id: "mineral", label: "Mineral Research", swatch: ["#0f716a", "#b8683f"] },
    { id: "oxblood", label: "Oxblood Atelier", swatch: ["#812c49", "#2d7168"] },
    { id: "signal", label: "Signal Green", swatch: ["#3e6d46", "#a66f40"] },
    { id: "cobalt", label: "Cobalt & Terracotta", swatch: ["#2751ac", "#c25b37"] },
    { id: "amber", label: "Amber & Graphite", swatch: ["#86592a", "#256a64"] },
    { id: "original", label: "Violet & Graphite", swatch: ["#087b91", "#6d3ee8"] },
];

export function listPalettes(): readonly PaletteEntry[] {
    return palette_definition_list;
}

export function isPaletteId(value: unknown): value is PaletteId {
    return palette_definition_list.some((palette) => palette.id === value);
}
