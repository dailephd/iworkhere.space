import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as pdf from "./pdfFile";
describe("PDF source contract", () => {
    it("owns the frozen limits", () => {
        expect([pdf.MAX_SINGLE_PDF_BYTES, pdf.MAX_PDF_PAGES, pdf.MAX_INPUT_PDFS, pdf.MAX_AGGREGATE_PDF_BYTES, pdf.MAX_AGGREGATE_PAGES, pdf.MAX_IMAGES, pdf.MAX_AGGREGATE_IMAGE_BYTES, pdf.MAX_OUTPUT_IMAGES_PER_OPERATION, pdf.MAX_SPLIT_OUTPUT_GROUPS, pdf.MAX_RENDER_SIDE, pdf.MAX_RENDER_AREA]).toEqual([10485760, 100, 10, 26214400, 100, 20, 26214400, 20, 20, 4096, 16000000]);
    });
    it("rejects empty and oversize before parsing", () => {
        for (const size of [0, -1, NaN, Infinity, 0.5]) expect(pdf.validatePdfSize(size)).toBe("empty");
        expect(pdf.validatePdfSize(10485760)).toBeNull(); expect(pdf.validatePdfSize(10485761)).toBe("source-limit");
        expect(pdf.validatePdfBytes(new Uint8Array())).toBe("empty");
    });
    it("checks bounded bytes rather than metadata", () => {
        expect(pdf.validatePdfBytes(readFileSync("test/fixtures/pdf/text-vector.pdf"))).toBeNull();
        expect(pdf.validatePdfBytes(readFileSync("test/fixtures/pdf/false-signature.pdf"))).toBe("signature");
        expect(pdf.hasPdfHeader(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
        expect(pdf.hasPdfHeader(new TextEncoder().encode("%PDF-1.7fake"))).toBe(false);
        expect(pdf.hasPdfHeader(new TextEncoder().encode("x".repeat(1024) + "%PDF-1.7\n"))).toBe(false);
    });
    it("bounds pages, geometry and render allocation separately", () => {
        expect(pdf.validatePdfPageCount(100)).toBeNull(); expect(pdf.validatePdfPageCount(101)).toBe("page-limit");
        expect(pdf.validatePdfPageCount(0)).toBe("malformed");
        expect(pdf.validatePdfGeometry({ width: 9000, height: 9000, rotation: 90 })).toBeNull();
        for (const rotation of [-90, 45, 360, NaN]) expect(pdf.validatePdfGeometry({ width: 1, height: 1, rotation })).toBe("geometry");
        expect(pdf.validatePdfGeometry({ width: 0, height: Infinity, rotation: 0 })).toBe("geometry");
        expect(pdf.validatePdfRender(4096, 3906)).toBeNull(); expect(pdf.validatePdfRender(4096, 4096)).toBe("render-limit");
        expect(pdf.validatePdfRender(4097, 1)).toBe("render-limit"); expect(pdf.validatePdfRender(0, 1)).toBe("render-limit");
    });
    it("maps errors to bounded messages", () => {
        expect(pdf.classifyPdfFailure({ name: "PasswordException", message: "secret" })).toBe("encrypted");
        for (const name of ["InvalidPDFException", "FormatError"]) expect(pdf.classifyPdfFailure({ name })).toBe("malformed");
        expect(pdf.classifyPdfFailure(new Error("secret"))).toBe("runtime");
        expect(new pdf.PdfFileError("malformed").message).not.toContain("secret");
        expect(pdf.classifyPdfFailure(new pdf.PdfFileError("page-limit"))).toBe("page-limit");
    });
    it("formats local presentation", () => {
        expect(pdf.pdfFileBasename("../private/report.pdf")).toBe("report"); expect(pdf.pdfFileBasename("\0.pdf")).toBe(".pdf");
        expect(pdf.pdfFileBasename("")).toBe("document"); expect(pdf.pdfFileBasename("x".repeat(140))).toHaveLength(120);
        expect([pdf.formatPdfBytes(1), pdf.formatPdfBytes(1024), pdf.formatPdfBytes(1048576)]).toEqual(["1 B", "1.0 KiB", "1.0 MiB"]);
    });
});
