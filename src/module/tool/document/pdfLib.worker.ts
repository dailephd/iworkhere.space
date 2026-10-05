import { PDFDocument } from "pdf-lib";
import { readPdfLibRequest, type PdfLibResponse } from "./pdfLib.workerType";
import { MAX_AGGREGATE_PAGES, validatePdfBytes, validatePdfPageCount } from "./pdfFile";
import { validateImageFileDimension } from "../image/imageFile";
const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(response: PdfLibResponse, transfer?: Transferable[]): void };
let used = false;
async function load(bytes: Uint8Array): Promise<PDFDocument> {
    if (validatePdfBytes(bytes)) throw new Error("Unsupported PDF source");
    const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    if (document.isEncrypted || validatePdfPageCount(document.getPageCount())) throw new Error("Unsupported PDF source");
    return document;
}
async function save(document: PDFDocument): Promise<Uint8Array> {
    return document.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
}
scope.onmessage = async event => {
    if (used) return;
    used = true;
    const request = readPdfLibRequest(event.data);
    if (!request) {
        const id = event.data?.id;
        if (Number.isSafeInteger(id) && id > 0) scope.postMessage({ id, status: "error", category: "protocol" });
        return;
    }
    try {
        if (request.operation === "images-to-pdf") {
            const output = await PDFDocument.create();
            for (const source of request.image) {
                const image = source.format === "jpeg" ? await output.embedJpg(source.bytes) : await output.embedPng(source.bytes);
                if (validateImageFileDimension(image) || image.width !== source.width || image.height !== source.height) throw new Error("Unsupported image dimensions");
                const page = output.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            }
            const bytes = await save(output);
            scope.postMessage({ id: request.id, status: "success", bytes }, [bytes.buffer]);
            return;
        }
        if (request.operation === "merge") {
            const output = await PDFDocument.create();
            let pageCount = 0;
            for (const input of request.input) {
                const source = await load(input);
                pageCount += source.getPageCount();
                if (pageCount > MAX_AGGREGATE_PAGES) throw new Error("Unsupported page count");
                for (const page of await output.copyPages(source, source.getPageIndices())) output.addPage(page);
            }
            const bytes = await save(output);
            scope.postMessage({ id: request.id, status: "success", bytes }, [bytes.buffer]);
            return;
        }
        const source = await load(request.bytes);
        if (request.operation === "split") {
            const output: Uint8Array[] = [];
            for (const group of request.group) {
                if (group.some(page => page > source.getPageCount())) throw new Error("Unsupported page selection");
                const document = await PDFDocument.create();
                for (const page of await document.copyPages(source, group.map(page => page - 1))) document.addPage(page);
                output.push(await save(document));
            }
            scope.postMessage({ id: request.id, status: "success", output }, output.map(bytes => bytes.buffer));
            return;
        }
        const bytes = await save(source);
        scope.postMessage({ id: request.id, status: "success", bytes }, [bytes.buffer]);
    } catch { scope.postMessage({ id: request.id, status: "error", category: "processing" }); }
};
