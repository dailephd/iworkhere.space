import { PDFDocument } from "pdf-lib";
import { readPdfLibRequest, type PdfLibResponse } from "./pdfLib.workerType";
import { validatePdfPageCount } from "./pdfFile";
const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(response: PdfLibResponse, transfer?: Transferable[]): void };
let used = false;
scope.onmessage = async event => {
    if (used) return;
    used = true;
    const request = readPdfLibRequest(event.data);
    if (!request) return;
    try {
        const document = await PDFDocument.load(request.bytes, { updateMetadata: false, throwOnInvalidObject: true });
        if (validatePdfPageCount(document.getPageCount())) throw new Error("Unsupported PDF page count");
        const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
        scope.postMessage({ id: request.id, status: "success", bytes }, [bytes.buffer]);
    } catch { scope.postMessage({ id: request.id, status: "error", category: "processing" }); }
};
