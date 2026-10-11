import { isPaletteId, type PaletteId } from "./paletteRegistry";

/** Original utility colors are represented by no data-palette attribute. */
export function setPalette(id: PaletteId): void {
    if (id === "utility") document.documentElement.removeAttribute("data-palette");
    else document.documentElement.setAttribute("data-palette", id);
}

export function getPaletteFromDom(): PaletteId {
    const current = document.documentElement.getAttribute("data-palette");
    if (isPaletteId(current) && current !== "utility") return current;
    document.documentElement.removeAttribute("data-palette");
    return "utility";
}
