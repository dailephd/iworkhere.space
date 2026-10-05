"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { formatImageFileBytes } from "../image/imageFile";
import { ImageFileError } from "../image/imageFile.client";
import { inspectImagesToPdfFile } from "./imagesToPdf.client";
import { imagesToPdfAdditionError, type ImagesToPdfSource } from "./imagesToPdf";
import { addOrderedFile, moveOrderedFile, removeOrderedFile, type OrderedFileItem } from "./orderedFile";
import { startImagesToPdfOperation, type PdfLibOperation } from "./pdfLib.client";
import { verifyPdfLibOutput } from "./pdfLibVerification.client";

interface ImagesToPdfResult { url: string; filename: string; pageCount: number; size: number }
const PANEL = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";
const SECONDARY = "material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 disabled:opacity-50";

export function ImagesToPdfTool({ toolId }: ToolComponentProp) {
    const [item, setItem] = useState<OrderedFileItem<ImagesToPdfSource>[]>([]);
    const [result, setResult] = useState<ImagesToPdfResult | null>(null);
    const [selecting, setSelecting] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const generation = useRef(0);
    const nextId = useRef(0);
    const controller = useRef<AbortController | null>(null);
    const operation = useRef<PdfLibOperation | null>(null);
    const resultUrl = useRef<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const alert = useRef<HTMLParagraphElement>(null);
    const resultHeading = useRef<HTMLHeadingElement>(null);

    useEffect(() => () => {
        generation.current++;
        controller.current?.abort(); operation.current?.cancel();
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    }, []);
    useEffect(() => { if (error) alert.current?.focus(); }, [error]);
    useEffect(() => { if (result) resultHeading.current?.focus(); }, [result]);

    function invalidate() {
        generation.current++;
        controller.current?.abort(); controller.current = null;
        operation.current?.cancel(); operation.current = null;
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null;
        setResult(null); setError(""); setSelecting(false); setProcessing(false);
    }
    function reset() {
        invalidate(); setItem([]);
        if (fileInput.current) { fileInput.current.value = ""; fileInput.current.focus(); }
    }
    async function select(event: ChangeEvent<HTMLInputElement>) {
        const file = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (!file.length) return;
        invalidate();
        const limitError = imagesToPdfAdditionError(item.map(value => value.file), file);
        if (limitError) { setError(limitError); return; }
        const token = generation.current;
        const abort = new AbortController(); controller.current = abort;
        setSelecting(true);
        try {
            const addition: OrderedFileItem<ImagesToPdfSource>[] = [];
            for (const source of file) {
                const metadata = await inspectImagesToPdfFile(source, abort.signal);
                if (token !== generation.current) return;
                addition.push({ id: `images-pdf-source-${++nextId.current}`, file: source, metadata });
            }
            setItem(addOrderedFile(item, addition));
        } catch (failure) {
            if (token !== generation.current || abort.signal.aborted) return;
            setError(failure instanceof ImageFileError ? failure.message : "Image inspection failed. Choose another JPEG or PNG, or reload and try again.");
        } finally { if (token === generation.current) { setSelecting(false); controller.current = null; } }
    }
    function move(id: string, direction: "up" | "down") { invalidate(); setItem(moveOrderedFile(item, id, direction)); }
    function remove(id: string) { invalidate(); setItem(removeOrderedFile(item, id)); fileInput.current?.focus(); }
    async function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (item.length < 1 || selecting || processing || operation.current) return;
        invalidate();
        const token = generation.current;
        const abort = new AbortController(); controller.current = abort;
        setProcessing(true);
        let stage = "processing";
        try {
            const work = startImagesToPdfOperation(item.map(value => value.metadata)); operation.current = work;
            const bytes = await work.promise;
            if (token !== generation.current) return;
            operation.current = null; stage = "verification";
            const expected = item.map(value => ({ width: value.metadata.width, height: value.metadata.height, rotation: 0 }));
            await verifyPdfLibOutput(bytes, expected, abort.signal);
            if (token !== generation.current) return;
            const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
            const url = URL.createObjectURL(blob); resultUrl.current = url;
            setResult({ url, filename: "images-to-pdf.pdf", pageCount: expected.length, size: blob.size });
            trackEvent("tool_executed", { toolId, slug: "images-to-pdf" });
        } catch {
            if (token !== generation.current || abort.signal.aborted) return;
            setError(stage === "verification" ? "The created PDF could not be independently verified. No download was kept. Try different JPEG or PNG images." : "PDF creation could not complete within the browser runtime. Try fewer or smaller images, or reload and try again.");
        } finally { if (token === generation.current) { operation.current = null; controller.current = null; setProcessing(false); } }
    }
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-text-muted">Images are read locally and the PDF is created in your browser. Source images are not uploaded for conversion.</p>
        <section className={PANEL} aria-labelledby="images-pdf-source-title">
            <h2 id="images-pdf-source-title" className="font-semibold text-category-document">Source images</h2>
            <label htmlFor="images-pdf-source" className="block font-medium">Choose JPEG or PNG images</label>
            <input id="images-pdf-source" ref={fileInput} type="file" multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={select} className="block w-full min-w-0 rounded-lg border border-input-border bg-input-bg p-2" />
            <p className="text-sm text-text-muted">1–20 JPEG/PNG images; 25 MiB combined and at most 30 megapixels per image. You can add more images after choosing the first batch.</p>
            <ol aria-label="Image page order" className="space-y-3">{item.map((value, index) => <li key={value.id} className="min-w-0 space-y-2 rounded-lg border border-panel-border p-3">
                <p className="break-all">{index + 1}. {value.file.name}</p>
                <p className="text-sm text-text-muted">{value.metadata.format.toUpperCase()} · {value.metadata.width} × {value.metadata.height} · {formatImageFileBytes(value.file.size)}</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY} disabled={index === 0} aria-label={`Move up image ${index + 1}: ${value.file.name}`} onClick={() => move(value.id, "up")}>Move up</button>
                    <button type="button" className={SECONDARY} disabled={index === item.length - 1} aria-label={`Move down image ${index + 1}: ${value.file.name}`} onClick={() => move(value.id, "down")}>Move down</button>
                    <button type="button" className={SECONDARY} aria-label={`Remove image ${index + 1}: ${value.file.name}`} onClick={() => remove(value.id)}>Remove</button>
                </div>
            </li>)}</ol>
        </section>
        <form onSubmit={create} className={PANEL}>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={item.length < 1 || selecting || processing} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">Create PDF</button>
                <button type="button" className={SECONDARY} onClick={reset}>Reset</button>
            </div>
            <p className="text-sm text-text-muted">One image per page, without margins. Image pixel dimensions become PDF points. Metadata preservation is not promised.</p>
        </form>
        {(selecting || processing) && <p role="status">{selecting ? "Inspecting images…" : "Creating and verifying PDF…"}</p>}
        {error && <p ref={alert} tabIndex={-1} role="alert" className="break-words rounded-lg border border-error-border bg-error-bg p-3 text-error-text">{error}</p>}
        {result && <section aria-labelledby="images-pdf-result-title" className="min-w-0 space-y-3 rounded-xl border border-result-border bg-result-bg p-4">
            <h2 id="images-pdf-result-title" ref={resultHeading} tabIndex={-1} className="font-semibold">PDF ready</h2>
            <p role="status">{result.pageCount} pages · {formatImageFileBytes(result.size)}</p>
            <a href={result.url} download={result.filename} className="inline-block min-h-11 rounded-lg bg-accent px-4 py-2 text-[var(--contrast)]">Download PDF</a>
        </section>}
    </div>;
}
