import { expect, it } from "vitest";
import { parsePageSelection } from "./pageSelection";
import { PdfFileError } from "./pdfFile";
import { pdfToImageFilename, pdfToImageErrorMessage, validPdfToImageOption, validPdfToImagePage, PdfToImageError } from "./pdfToImage";
it("retains parsed sequence and deduplication with the frozen 20-output cap", () => {
    expect(parsePageSelection("3,1,3", { pageCount: 100, maxOutputCount: 20 })).toEqual({ ok: true, page: [3, 1] });
    expect(parsePageSelection("1-20", { pageCount: 100, maxOutputCount: 20 }).ok).toBe(true);
    expect(parsePageSelection("1-21", { pageCount: 100, maxOutputCount: 20 })).toEqual({ ok: false, category: "output-limit" });
    for (const page of [[], [0], [101], [1, 1], [1.5], Array.from({ length: 21 }, (_, index) => index + 1)]) expect(validPdfToImagePage(page, 100)).toBe(false);
    expect(validPdfToImagePage([3, 1], 4)).toBe(true);
});
it.each([72, 150, 300] as const)("accepts %s DPI with JPEG min/default/max, ignores inactive PNG quality", dpi => {
    for (const quality of [.5, .85, 1]) expect(validPdfToImageOption({ format: "jpeg", dpi, quality })).toBe(true);
    for (const quality of [.49, 1.01, NaN, Infinity]) expect(validPdfToImageOption({ format: "jpeg", dpi, quality })).toBe(false);
    expect(validPdfToImageOption({ format: "png", dpi, quality: NaN })).toBe(true);
});
it("rejects unsupported format/DPI and names source pages rather than output ordinals", () => {
    expect(validPdfToImageOption({ format: "png", dpi: 96 as 72, quality: .85 })).toBe(false);
    expect(validPdfToImageOption({ format: "webp" as "png", dpi: 150, quality: .85 })).toBe(false);
    expect(pdfToImageFilename("../source.pdf", 3, "png")).toBe("source-page-003.png"); expect(pdfToImageFilename("a:?.pdf", 1, "jpeg")).toBe("a---page-001.jpg");
});
it("provides lower-DPI guidance and bounded source/processing errors", () => {
    expect(pdfToImageErrorMessage(new PdfFileError("render-limit"))).toContain("lower DPI");
    expect(pdfToImageErrorMessage(new PdfFileError("encrypted"))).toContain("Encrypted"); expect(pdfToImageErrorMessage(new PdfFileError("malformed"))).toContain("parsed safely");
    for (const category of ["option", "encoding", "verification"] as const) expect(pdfToImageErrorMessage(new PdfToImageError(category))).not.toContain("PdfToImageError");
    expect(pdfToImageErrorMessage(new Error("PRIVATE diagnostic"))).not.toContain("PRIVATE");
});
