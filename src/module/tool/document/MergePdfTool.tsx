"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { formatPdfBytes, PdfFileError } from "./pdfFile";
import { inspectPdfFile, type PdfFileInspection } from "./pdfFile.client";
import { addOrderedFile, moveOrderedFile, removeOrderedFile, type OrderedFileItem } from "./orderedFile";
import { mergePdfAdditionError, mergePdfFilename, mergePdfPageError } from "./mergePdf";
import { startMergePdfOperation, type PdfLibOperation } from "./pdfLib.client";
import { verifyPdfLibOutput } from "./pdfLibVerification.client";

interface MergePdfResult { url: string; filename: string; pageCount: number; size: number }
const PANEL = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";
const SECONDARY = "material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 disabled:opacity-50";

export function MergePdfTool({ toolId }: ToolComponentProp) {
    const [item, setItem] = useState<OrderedFileItem<PdfFileInspection>[]>([]);
    const [result, setResult] = useState<MergePdfResult | null>(null);
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
        const limitError = mergePdfAdditionError(item.map(value => value.file), file);
        if (limitError) { setError(limitError); return; }
        const token = generation.current;
        const abort = new AbortController(); controller.current = abort;
        setSelecting(true);
        try {
            const addition: OrderedFileItem<PdfFileInspection>[] = [];
            for (const source of file) {
                const metadata = await inspectPdfFile(source, abort.signal);
                if (token !== generation.current) return;
                addition.push({ id: `merge-source-${++nextId.current}`, file: source, metadata });
            }
            const pageError = mergePdfPageError([...item, ...addition].map(value => value.metadata.inspection.pageCount));
            if (pageError) { setError(pageError); return; }
            setItem(addOrderedFile(item, addition));
        } catch (failure) {
            if (token !== generation.current || abort.signal.aborted) return;
            setError(failure instanceof PdfFileError ? failure.message : "PDF inspection failed. Choose another PDF or reload and try again.");
        } finally { if (token === generation.current) { setSelecting(false); controller.current = null; } }
    }
    function move(id: string, direction: "up" | "down") { invalidate(); setItem(moveOrderedFile(item, id, direction)); }
    function remove(id: string) { invalidate(); setItem(removeOrderedFile(item, id)); fileInput.current?.focus(); }
    async function merge(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (item.length < 2 || selecting || processing || operation.current) return;
        invalidate();
        const token = generation.current;
        const abort = new AbortController(); controller.current = abort;
        setProcessing(true);
        let stage = "processing";
        try {
            const work = startMergePdfOperation(item.map(value => value.metadata.bytes)); operation.current = work;
            const bytes = await work.promise;
            if (token !== generation.current) return;
            operation.current = null; stage = "verification";
            const expected = item.flatMap(value => value.metadata.inspection.page);
            await verifyPdfLibOutput(bytes, expected, abort.signal);
            if (token !== generation.current) return;
            const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
            const url = URL.createObjectURL(blob); resultUrl.current = url;
            setResult({ url, filename: mergePdfFilename(item[0].file.name), pageCount: expected.length, size: blob.size });
            trackEvent("tool_executed", { toolId, slug: "merge-pdf" });
        } catch {
            if (token !== generation.current || abort.signal.aborted) return;
            setError(stage === "verification" ? "The merged PDF could not be independently verified. No download was kept. Try different source PDFs." : "PDF merging could not complete within the browser runtime. Try fewer or smaller PDFs, or reload and try again.");
        } finally { if (token === generation.current) { operation.current = null; controller.current = null; setProcessing(false); } }
    }
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-text-muted">PDF processing stays in your browser. Your PDF is not uploaded for processing.</p>
        <section className={PANEL} aria-labelledby="merge-source-title">
            <h2 id="merge-source-title" className="font-semibold text-category-document">Source PDFs</h2>
            <label htmlFor="merge-source" className="block font-medium">Choose PDFs</label>
            <input id="merge-source" ref={fileInput} type="file" multiple accept="application/pdf,.pdf" onChange={select} className="block w-full min-w-0 rounded-lg border border-input-border bg-input-bg p-2" />
            <p className="text-sm text-text-muted">2–10 PDFs; 10 MiB per file, 25 MiB and 100 pages combined. You can add more files after choosing the first batch.</p>
            <ol aria-label="PDF merge order" className="space-y-3">{item.map((value, index) => <li key={value.id} className="min-w-0 space-y-2 rounded-lg border border-panel-border p-3">
                <p className="break-all">{index + 1}. {value.file.name}</p>
                <p className="text-sm text-text-muted">{value.metadata.inspection.pageCount} pages · {formatPdfBytes(value.file.size)}</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY} disabled={index === 0} aria-label={`Move up PDF ${index + 1}: ${value.file.name}`} onClick={() => move(value.id, "up")}>Move up</button>
                    <button type="button" className={SECONDARY} disabled={index === item.length - 1} aria-label={`Move down PDF ${index + 1}: ${value.file.name}`} onClick={() => move(value.id, "down")}>Move down</button>
                    <button type="button" className={SECONDARY} aria-label={`Remove PDF ${index + 1}: ${value.file.name}`} onClick={() => remove(value.id)}>Remove</button>
                </div>
            </li>)}</ol>
        </section>
        <form onSubmit={merge} className={PANEL}>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={item.length < 2 || selecting || processing} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">Merge PDF</button>
                <button type="button" className={SECONDARY} onClick={reset}>Reset</button>
            </div>
            <p className="text-sm text-text-muted">Static pages only. Metadata, bookmarks, forms and signatures may not be preserved.</p>
        </form>
        {(selecting || processing) && <p role="status">{selecting ? "Inspecting PDFs…" : "Merging and verifying PDF…"}</p>}
        {error && <p ref={alert} tabIndex={-1} role="alert" className="break-words rounded-lg border border-error-border bg-error-bg p-3 text-error-text">{error}</p>}
        {result && <section aria-labelledby="merge-result-title" className="min-w-0 space-y-3 rounded-xl border border-result-border bg-result-bg p-4">
            <h2 id="merge-result-title" ref={resultHeading} tabIndex={-1} className="font-semibold">Merged PDF ready</h2>
            <p role="status">{result.pageCount} pages · {formatPdfBytes(result.size)}</p>
            <a href={result.url} download={result.filename} className="inline-block min-h-11 rounded-lg bg-accent px-4 py-2 text-[var(--contrast)]">Download merged PDF</a>
        </section>}
    </div>;
}
