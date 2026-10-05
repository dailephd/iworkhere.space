import { openPdfDocument, measurePdfPage, renderPdfPage, type PdfDocumentHandle } from "./pdfRuntime.client";
import { MAX_PDF_PAGES } from "./pdfFile";
import { PdfToImageError, validPdfToImageOption, validPdfToImagePage, type PdfToImageOption, type PdfToImageOutput } from "./pdfToImage";

export async function convertPdfToImages(bytes: Uint8Array, page: readonly number[], option: PdfToImageOption, signal: AbortSignal): Promise<PdfToImageOutput[]> {
    signal.throwIfAborted();
    if (!validPdfToImageOption(option) || !validPdfToImagePage(page, MAX_PDF_PAGES)) throw new PdfToImageError("option");
    const operation = openPdfDocument(bytes);
    const cancel = () => operation.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    let handle: PdfDocumentHandle | undefined;
    const output: PdfToImageOutput[] = [];
    try {
        handle = await operation.promise;
        signal.throwIfAborted();
        if (!validPdfToImagePage(page, handle.inspection.pageCount)) throw new PdfToImageError("option");
        const scale = option.dpi / 72;
        const dimension = [];
        for (const pageNumber of page) dimension.push(await measurePdfPage(handle, pageNumber, scale, signal));
        signal.throwIfAborted();
        for (let index = 0; index < page.length; index++) {
            signal.throwIfAborted();
            const canvas = document.createElement("canvas");
            try {
                await renderPdfPage(handle, page[index], canvas, scale, signal, option.format === "jpeg" ? "#ffffff" : undefined);
                signal.throwIfAborted();
                let blob: Blob | null;
                try {
                    blob = await new Promise<Blob | null>(resolve => {
                        if (option.format === "jpeg") canvas.toBlob(resolve, "image/jpeg", option.quality);
                        else canvas.toBlob(resolve, "image/png");
                    });
                } catch { throw new PdfToImageError("encoding"); }
                signal.throwIfAborted();
                if (!blob || blob.size === 0) throw new PdfToImageError("encoding");
                if (blob.type !== `image/${option.format}`) throw new PdfToImageError("verification");
                let bitmap: ImageBitmap;
                try { bitmap = await createImageBitmap(blob); }
                catch { throw new PdfToImageError("verification"); }
                try {
                    signal.throwIfAborted();
                    if (bitmap.width !== dimension[index].width || bitmap.height !== dimension[index].height) throw new PdfToImageError("verification");
                } finally { bitmap.close(); }
                output.push({ pageNumber: page[index], format: option.format, ...dimension[index], blob });
            } finally { canvas.width = 0; canvas.height = 0; }
        }
        return output;
    } catch (error) {
        output.length = 0;
        if (signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
        throw error;
    } finally { signal.removeEventListener("abort", cancel); await handle?.close(); }
}
