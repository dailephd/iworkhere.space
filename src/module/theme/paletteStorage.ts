import { storage } from "@/lib/storage";
import { isPaletteId, type PaletteId } from "./paletteRegistry";

const STORAGE_KEY = "palette";

export function storePalette(id: PaletteId): void {
    storage.set(STORAGE_KEY, id);
}

export function loadPalette(): PaletteId | null {
    const value = storage.get<string>(STORAGE_KEY);
    if (isPaletteId(value)) return value;
    storage.remove(STORAGE_KEY);
    return null;
}
