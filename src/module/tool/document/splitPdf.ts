import { pdfFileBasename } from "./pdfFile";

export function splitPdfFilename(name: string, ordinal: number, page: readonly number[]): string {
    const segment: string[] = [];
    for (let index = 0; index < page.length; index++) {
        const start = page[index];
        let end = start;
        while (index + 1 < page.length && page[index + 1] === end + 1) end = page[++index];
        segment.push(start === end ? String(start) : `${start}-${end}`);
    }
    // Bound the basename, retaining the complete normalized selection (at most 100 pages).
    const readable = segment.join("_");
    const selection = readable.length <= 180 ? readable : `seq-${page.map(value => value.toString(36).padStart(2, "0")).join("")}`;
    const prefix = pdfFileBasename(name).replace(/[<>:"|?*]/g, "-").slice(0, Math.max(8, 220 - selection.length));
    return `${prefix}-split-${String(ordinal).padStart(2, "0")}-pages-${selection}.pdf`;
}
