export interface PageSelectionOption { pageCount?: number; maxOutputCount: number }
export interface PageSelectionSuccess { ok: true; page: number[] }
export interface PageSelectionError { ok: false; category: "empty" | "syntax" | "range" | "page-count" | "output-limit" | "option" }
export type PageSelectionResult = PageSelectionSuccess | PageSelectionError;

export function parsePageSelection(expression: string, option: PageSelectionOption): PageSelectionResult {
    if (!Number.isSafeInteger(option.maxOutputCount) || option.maxOutputCount <= 0 ||
        (option.pageCount !== undefined && (!Number.isSafeInteger(option.pageCount) || option.pageCount <= 0))) return { ok: false, category: "option" };
    const text = expression.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "");
    if (!text) return { ok: false, category: "empty" };
    const page: number[] = [];
    const seen = new Set<number>();
    for (const segment of text.split(",")) {
        const match = /^[\t\n\v\f\r ]*([0-9]+)[\t\n\v\f\r ]*(?:-[\t\n\v\f\r ]*([0-9]+)[\t\n\v\f\r ]*)?$/.exec(segment);
        if (!match) return { ok: false, category: "syntax" };
        const start = Number(match[1]), end = Number(match[2] ?? match[1]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start <= 0 || end < start) return { ok: false, category: "range" };
        if (option.pageCount !== undefined && end > option.pageCount) return { ok: false, category: "page-count" };
        // Any single range larger than the cap cannot fit even after deduplication.
        if (end - start + 1 > option.maxOutputCount) return { ok: false, category: "output-limit" };
        for (let value = start; value <= end; value++) {
            if (seen.has(value)) continue;
            if (page.length === option.maxOutputCount) return { ok: false, category: "output-limit" };
            seen.add(value); page.push(value);
        }
    }
    return { ok: true, page };
}
