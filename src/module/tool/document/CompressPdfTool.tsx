"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { formatPdfBytes, pdfFileBasename } from "./pdfFile";
import { inspectPdfFile, type PdfFileInspection } from "./pdfFile.client";
import { compressPdf, compressPdfErrorMessage } from "./compressPdf.client";
interface CompressPdfSource extends PdfFileInspection { file: File }
interface CompressPdfResult { url: string; filename: string; size: number; savedBytes: number; percentage: number }
const PANEL = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";
const INPUT = "block w-full min-w-0 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text";
const SECONDARY = "material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2";

export function CompressPdfTool({ toolId }: ToolComponentProp) {
    const [source, setSource] = useState<CompressPdfSource | null>(null);
    const [result, setResult] = useState<CompressPdfResult | null>(null);
    const [noReduction, setNoReduction] = useState(false);
    const [selecting, setSelecting] = useState(false), [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const generation = useRef(0), controller = useRef<AbortController | null>(null), resultUrl = useRef<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null), alert = useRef<HTMLParagraphElement>(null), resultHeading = useRef<HTMLHeadingElement>(null);
    useEffect(() => () => { generation.current++; controller.current?.abort(); if (resultUrl.current) URL.revokeObjectURL(resultUrl.current); }, []);
    useEffect(() => { if (error) alert.current?.focus(); }, [error]);
    useEffect(() => { if (result || noReduction) resultHeading.current?.focus(); }, [result, noReduction]);
    function invalidate() {
        generation.current++; controller.current?.abort(); controller.current = null;
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null; setResult(null); setNoReduction(false); setError(""); setSelecting(false); setProcessing(false);
    }
    function reset() {
        invalidate(); setSource(null);
        if (fileInput.current) { fileInput.current.value = ""; fileInput.current.focus(); }
    }
    async function select(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]; event.target.value = "";
        invalidate(); setSource(null);
        if (!file) return;
        const token = generation.current, abort = new AbortController(); controller.current = abort; setSelecting(true);
        try {
            const inspection = await inspectPdfFile(file, abort.signal);
            if (token !== generation.current || abort.signal.aborted) return;
            setSource({ file, ...inspection });
        } catch (failure) { if (token === generation.current && !abort.signal.aborted) setError(compressPdfErrorMessage(failure)); }
        finally { if (token === generation.current) { controller.current = null; setSelecting(false); } }
    }
    async function compress(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || selecting || processing || controller.current) return;
        invalidate(); const token = generation.current, abort = new AbortController(); controller.current = abort; setProcessing(true);
        let created: string | null = null;
        try {
            const output = await compressPdf(source.bytes, abort.signal);
            if (token !== generation.current || abort.signal.aborted) return;
            if (output.status === "no-reduction") { setNoReduction(true); return; }
            const blob = new Blob([new Uint8Array(output.bytes)], { type: "application/pdf" });
            created = URL.createObjectURL(blob); resultUrl.current = created;
            setResult({ url: created, filename: `${pdfFileBasename(source.file.name)}-compressed.pdf`, size: blob.size, savedBytes: output.savedBytes, percentage: output.percentage });
            trackEvent("tool_executed", { toolId, slug: "compress-pdf" });
        } catch (failure) {
            if (created) URL.revokeObjectURL(created);
            if (token === generation.current && !abort.signal.aborted) setError(compressPdfErrorMessage(failure));
        } finally { if (token === generation.current) { controller.current = null; setProcessing(false); } }
    }
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-text-muted">Your PDF is processed locally in your browser. Document bytes are not uploaded for compression.</p>
        <section className={PANEL} aria-labelledby="compress-pdf-source-title">
            <h2 id="compress-pdf-source-title" className="font-semibold text-category-document">Source PDF</h2>
            <label htmlFor="compress-pdf-source" className="block font-medium">Choose PDF</label>
            <input id="compress-pdf-source" ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={select} className={INPUT} />
            <p className="text-sm text-text-muted">One PDF, at most 10 MiB and 100 pages. Encrypted PDFs are unsupported.</p>
            {source && <p className="break-all">{source.file.name} · {source.inspection.pageCount} pages · {formatPdfBytes(source.bytes.length)}</p>}
        </section>
        <form onSubmit={compress} className={PANEL} noValidate>
            <h2 className="font-semibold text-category-document">Lossless structural compression</h2>
            <p>Optimize PDF objects and streams without rasterizing pages or intentionally reducing image quality. Already optimized PDFs may not become smaller.</p>
            <div className="flex flex-wrap gap-3"><button type="submit" disabled={!source || selecting || processing} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">Compress PDF</button><button type="button" className={SECONDARY} onClick={reset}>Reset</button></div>
        </form>
        {(selecting || processing) && <p role="status">{selecting ? "Inspecting PDF…" : "Compressing and independently verifying PDF…"}</p>}
        {error && <p ref={alert} tabIndex={-1} role="alert" className="break-words rounded-lg border border-error-border bg-error-bg p-3 text-error-text">{error}</p>}
        {noReduction && <section aria-labelledby="compress-pdf-no-reduction" className={PANEL}>
            <h2 id="compress-pdf-no-reduction" ref={resultHeading} tabIndex={-1} className="font-semibold">NO REDUCTION ACHIEVED</h2>
            <p role="status">This PDF is already efficiently structured for this lossless compression method. The generated version was not smaller, so the original is kept.</p>
        </section>}
        {result && source && <section aria-labelledby="compress-pdf-result-title" className="min-w-0 space-y-3 rounded-xl border border-result-border bg-result-bg p-4">
            <h2 id="compress-pdf-result-title" ref={resultHeading} tabIndex={-1} className="font-semibold">Smaller PDF ready</h2>
            <p role="status">The smaller PDF passed independent page verification.</p>
            <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div><dt>Original size</dt><dd>{formatPdfBytes(source.bytes.length)}</dd></div>
                <div><dt>Compressed size</dt><dd>{formatPdfBytes(result.size)}</dd></div>
                <div><dt>Bytes saved</dt><dd>{result.savedBytes.toLocaleString()} bytes</dd></div>
                <div><dt>Percentage saved</dt><dd>{result.percentage.toFixed(2)}%</dd></div>
            </dl>
            <p className="break-all">{result.filename}</p>
            <a href={result.url} download={result.filename} className="inline-block min-h-11 rounded-lg bg-accent px-4 py-2 text-[var(--contrast)]">Download compressed PDF</a>
        </section>}
    </div>;
}
