"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { formatPdfBytes, MAX_PDF_PAGES, MAX_SPLIT_OUTPUT_GROUPS, PdfFileError } from "./pdfFile";
import { inspectPdfFile, type PdfFileInspection } from "./pdfFile.client";
import { parsePageSelection } from "./pageSelection";
import { splitPdfFilename } from "./splitPdf";
import { startSplitPdfOperation, type PdfLibSplitOperation } from "./pdfLib.client";
import { verifyPdfLibOutput } from "./pdfLibVerification.client";

interface SplitPdfSource extends PdfFileInspection { file: File }
interface SplitPdfGroup { id: string; expression: string }
interface SplitPdfResult { id: string; url: string; filename: string; pageCount: number; size: number }
const PANEL = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";
const SECONDARY = "material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 disabled:opacity-50";

export function SplitPdfTool({ toolId }: ToolComponentProp) {
    const [source, setSource] = useState<SplitPdfSource | null>(null);
    const [group, setGroup] = useState<SplitPdfGroup[]>([]);
    const [result, setResult] = useState<SplitPdfResult[]>([]);
    const [selecting, setSelecting] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const generation = useRef(0);
    const nextId = useRef(0);
    const controller = useRef<AbortController | null>(null);
    const operation = useRef<PdfLibSplitOperation | null>(null);
    const resultUrl = useRef<string[]>([]);
    const fileInput = useRef<HTMLInputElement>(null);
    const alert = useRef<HTMLParagraphElement>(null);
    const resultHeading = useRef<HTMLHeadingElement>(null);
    const focusGroup = useRef<string | null>(null);

    useEffect(() => () => {
        generation.current++;
        controller.current?.abort(); operation.current?.cancel();
        for (const url of resultUrl.current) URL.revokeObjectURL(url);
    }, []);
    useEffect(() => { if (error) alert.current?.focus(); }, [error]);
    useEffect(() => { if (result.length) resultHeading.current?.focus(); }, [result]);
    useEffect(() => {
        if (focusGroup.current) document.getElementById(focusGroup.current)?.focus();
        focusGroup.current = null;
    }, [group]);

    function invalidate() {
        generation.current++;
        controller.current?.abort(); controller.current = null;
        operation.current?.cancel(); operation.current = null;
        for (const url of resultUrl.current) URL.revokeObjectURL(url);
        resultUrl.current = [];
        setResult([]); setError(""); setSelecting(false); setProcessing(false);
    }
    function newGroup(): SplitPdfGroup { return { id: `split-group-${++nextId.current}`, expression: "" }; }
    function reset() {
        invalidate(); setSource(null); setGroup([]);
        if (fileInput.current) { fileInput.current.value = ""; fileInput.current.focus(); }
    }
    async function select(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        invalidate(); setSource(null); setGroup([]);
        if (!file) return;
        const token = generation.current;
        const abort = new AbortController(); controller.current = abort;
        setSelecting(true);
        try {
            const inspection = await inspectPdfFile(file, abort.signal);
            if (token !== generation.current) return;
            setSource({ file, ...inspection }); setGroup([newGroup()]);
        } catch (failure) {
            if (token !== generation.current || abort.signal.aborted) return;
            setError(failure instanceof PdfFileError ? failure.message : "PDF inspection failed. Choose another PDF or reload and try again.");
        } finally { if (token === generation.current) { setSelecting(false); controller.current = null; } }
    }
    function add() {
        if (!source || group.length >= MAX_SPLIT_OUTPUT_GROUPS) return;
        invalidate(); const addition = newGroup(); focusGroup.current = addition.id; setGroup([...group, addition]);
    }
    function remove(id: string) {
        if (group.length <= 1) return;
        invalidate();
        const index = group.findIndex(value => value.id === id);
        const remaining = group.filter(value => value.id !== id);
        focusGroup.current = remaining[Math.max(0, index - 1)].id;
        setGroup(remaining);
    }
    function edit(id: string, expression: string) { invalidate(); setGroup(group.map(value => value.id === id ? { ...value, expression } : value)); }
    const parsed = group.map(value => parsePageSelection(value.expression, { pageCount: source?.inspection.pageCount, maxOutputCount: MAX_PDF_PAGES }));
    const valid = !!source && group.length > 0 && group.length <= MAX_SPLIT_OUTPUT_GROUPS && parsed.every(value => value.ok);
    async function split(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || !valid || selecting || processing || operation.current) return;
        const selection = parsed.flatMap(value => value.ok ? [value.page] : []);
        invalidate();
        const token = generation.current;
        const abort = new AbortController(); controller.current = abort;
        setProcessing(true);
        let stage = "processing";
        const created: string[] = [];
        try {
            const work = startSplitPdfOperation(source.bytes, selection); operation.current = work;
            const output = await work.promise;
            if (token !== generation.current) return;
            operation.current = null; stage = "verification";
            if (output.length !== selection.length) throw new Error("Invalid output count");
            for (let index = 0; index < output.length; index++) {
                await verifyPdfLibOutput(output[index], selection[index].map(page => source.inspection.page[page - 1]), abort.signal);
                if (token !== generation.current) return;
            }
            const outcome = output.map((bytes, index) => {
                const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
                const url = URL.createObjectURL(blob); created.push(url);
                return { id: group[index].id, url, filename: splitPdfFilename(source.file.name, index + 1, selection[index]), pageCount: selection[index].length, size: blob.size };
            });
            resultUrl.current = created; setResult(outcome);
            trackEvent("tool_executed", { toolId, slug: "split-pdf" });
        } catch {
            for (const url of created) URL.revokeObjectURL(url);
            if (token !== generation.current || abort.signal.aborted) return;
            setError(stage === "verification" ? "The split PDFs could not all be independently verified. No downloads were kept. Try another source PDF." : "PDF splitting could not complete within the browser runtime. Try fewer groups or a smaller PDF, or reload and try again.");
        } finally { if (token === generation.current) { operation.current = null; controller.current = null; setProcessing(false); } }
    }
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-text-muted">PDF processing stays in your browser. Your PDF is not uploaded for processing.</p>
        <section className={PANEL} aria-labelledby="split-source-title">
            <h2 id="split-source-title" className="font-semibold text-category-document">Source PDF</h2>
            <label htmlFor="split-source" className="block font-medium">Choose PDF</label>
            <input id="split-source" ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={select} className="block w-full min-w-0 rounded-lg border border-input-border bg-input-bg p-2" />
            <p className="text-sm text-text-muted">One PDF, at most 10 MiB and 100 pages. Encrypted PDFs are unsupported.</p>
            {source && <p className="break-all">{source.file.name} · {source.inspection.pageCount} pages · {formatPdfBytes(source.file.size)}</p>}
        </section>
        <form onSubmit={split} className={PANEL} noValidate>
            <h2 className="font-semibold text-category-document">Output groups</h2>
            <p className="text-sm text-text-muted">Use pages such as 1-3 or 4,6. Requested order is kept; repeated pages within one group are included once. Groups may overlap.</p>
            {group.map((value, index) => <div key={value.id} className="min-w-0 space-y-2 rounded-lg border border-panel-border p-3">
                <label htmlFor={value.id} className="block font-medium">Pages for output group {index + 1}</label>
                <div className="flex min-w-0 flex-wrap gap-2">
                    <input id={value.id} value={value.expression} onChange={event => edit(value.id, event.target.value)} aria-invalid={!parsed[index].ok} aria-describedby={!parsed[index].ok ? `${value.id}-error` : undefined} className="min-w-0 flex-1 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text" />
                    <button type="button" disabled={group.length === 1} aria-label={`Remove output group ${index + 1}`} onClick={() => remove(value.id)} className={SECONDARY}>Remove group</button>
                </div>
                {!parsed[index].ok && <p id={`${value.id}-error`} role="alert" className="text-sm text-error-text">Enter valid pages from 1 to {source?.inspection.pageCount}, using ascending ranges or comma-separated pages.</p>}
            </div>)}
            <button type="button" onClick={add} disabled={!source || group.length >= MAX_SPLIT_OUTPUT_GROUPS} className={SECONDARY}>Add output group</button>
            <p className="text-sm text-text-muted">Up to 20 output groups. Downloads are individual PDFs.</p>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={!valid || selecting || processing} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">Split PDF</button>
                <button type="button" className={SECONDARY} onClick={reset}>Reset</button>
            </div>
        </form>
        {(selecting || processing) && <p role="status">{selecting ? "Inspecting PDF…" : "Splitting and verifying PDFs…"}</p>}
        {error && <p ref={alert} tabIndex={-1} role="alert" className="break-words rounded-lg border border-error-border bg-error-bg p-3 text-error-text">{error}</p>}
        {result.length > 0 && <section aria-labelledby="split-result-title" className="min-w-0 space-y-3 rounded-xl border border-result-border bg-result-bg p-4">
            <h2 id="split-result-title" ref={resultHeading} tabIndex={-1} className="font-semibold">Split PDFs ready</h2>
            <p role="status">{result.length} PDFs verified. Download each file individually.</p>
            <ol className="space-y-3">{result.map((value, index) => <li key={value.id} className="min-w-0 space-y-2">
                <p className="break-all">{value.filename}</p><p className="text-sm">{value.pageCount} pages · {formatPdfBytes(value.size)}</p>
                <a href={value.url} download={value.filename} className="inline-block min-h-11 rounded-lg bg-accent px-4 py-2 text-[var(--contrast)]">Download output group {index + 1}</a>
            </li>)}</ol>
        </section>}
    </div>;
}
