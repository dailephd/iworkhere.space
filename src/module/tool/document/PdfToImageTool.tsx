"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { formatPdfBytes, MAX_OUTPUT_IMAGES_PER_OPERATION } from "./pdfFile";
import { inspectPdfFile, type PdfFileInspection } from "./pdfFile.client";
import { parsePageSelection } from "./pageSelection";
import { convertPdfToImages } from "./pdfToImage.client";
import { pdfToImageErrorMessage, pdfToImageFilename, validPdfToImageOption, type PdfImageDpi, type PdfImageFormat, type PdfToImageOutput } from "./pdfToImage";
interface PdfToImageSource extends PdfFileInspection { file: File }
interface PdfToImageResult extends Omit<PdfToImageOutput, "blob"> { url: string; filename: string; size: number }
const PANEL = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";
const INPUT = "block w-full min-w-0 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text";
const SECONDARY = "material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2";

export function PdfToImageTool({ toolId }: ToolComponentProp) {
    const [source, setSource] = useState<PdfToImageSource | null>(null);
    const [expression, setExpression] = useState("");
    const [format, setFormat] = useState<PdfImageFormat>("png");
    const [dpi, setDpi] = useState<PdfImageDpi>(150);
    const [quality, setQuality] = useState("0.85");
    const [result, setResult] = useState<PdfToImageResult[]>([]);
    const [selecting, setSelecting] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const generation = useRef(0), controller = useRef<AbortController | null>(null);
    const resultUrl = useRef<string[]>([]);
    const fileInput = useRef<HTMLInputElement>(null), alert = useRef<HTMLParagraphElement>(null), resultHeading = useRef<HTMLHeadingElement>(null);
    useEffect(() => () => { generation.current++; controller.current?.abort(); for (const url of resultUrl.current) URL.revokeObjectURL(url); }, []);
    useEffect(() => { if (error) alert.current?.focus(); }, [error]);
    useEffect(() => { if (result.length) resultHeading.current?.focus(); }, [result]);
    function invalidate() {
        generation.current++; controller.current?.abort(); controller.current = null;
        for (const url of resultUrl.current) URL.revokeObjectURL(url);
        resultUrl.current = []; setResult([]); setError(""); setSelecting(false); setProcessing(false);
    }
    function reset() {
        invalidate(); setSource(null); setExpression(""); setFormat("png"); setDpi(150); setQuality("0.85");
        if (fileInput.current) { fileInput.current.value = ""; fileInput.current.focus(); }
    }
    async function select(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]; event.target.value = "";
        invalidate(); setSource(null); setExpression("");
        if (!file) return;
        const token = generation.current, abort = new AbortController(); controller.current = abort; setSelecting(true);
        try {
            const inspection = await inspectPdfFile(file, abort.signal);
            if (token !== generation.current) return;
            setSource({ file, ...inspection }); setExpression("1");
        } catch (failure) { if (token === generation.current && !abort.signal.aborted) setError(pdfToImageErrorMessage(failure)); }
        finally { if (token === generation.current) { controller.current = null; setSelecting(false); } }
    }
    function changeExpression(value: string) { invalidate(); setExpression(value); }
    function changeFormat(value: PdfImageFormat) { if (value !== format) invalidate(); setFormat(value); }
    function changeDpi(value: PdfImageDpi) { if (value !== dpi) invalidate(); setDpi(value); }
    function changeQuality(value: string) { if (format === "jpeg" && value !== quality) invalidate(); setQuality(value); }
    const parsed = parsePageSelection(expression, { pageCount: source?.inspection.pageCount, maxOutputCount: MAX_OUTPUT_IMAGES_PER_OPERATION });
    const option = { format, dpi, quality: Number(quality) };
    const valid = !!source && parsed.ok && validPdfToImageOption(option);
    async function convert(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || !valid || !parsed.ok || selecting || processing || controller.current) return;
        invalidate(); const token = generation.current, abort = new AbortController(); controller.current = abort; setProcessing(true);
        const created: string[] = [];
        try {
            const output = await convertPdfToImages(source.bytes, parsed.page, option, abort.signal);
            if (token !== generation.current || abort.signal.aborted) return;
            const outcome = output.map(value => {
                const url = URL.createObjectURL(value.blob); created.push(url);
                return { pageNumber: value.pageNumber, format: value.format, width: value.width, height: value.height, size: value.blob.size, url, filename: pdfToImageFilename(source.file.name, value.pageNumber, value.format) };
            });
            resultUrl.current = created; setResult(outcome); trackEvent("tool_executed", { toolId, slug: "pdf-to-image" });
        } catch (failure) {
            for (const url of created) URL.revokeObjectURL(url);
            if (token === generation.current && !abort.signal.aborted) setError(pdfToImageErrorMessage(failure));
        } finally { if (token === generation.current) { controller.current = null; setProcessing(false); } }
    }
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-text-muted">Your PDF is processed locally in your browser. Page images are not uploaded.</p>
        <section className={PANEL} aria-labelledby="pdf-image-source-title">
            <h2 id="pdf-image-source-title" className="font-semibold text-category-document">Source PDF</h2>
            <label htmlFor="pdf-image-source" className="block font-medium">Choose PDF</label>
            <input id="pdf-image-source" ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={select} className={INPUT} />
            <p className="text-sm text-text-muted">One PDF, at most 10 MiB and 100 pages. Encrypted PDFs are unsupported.</p>
            {source && <p className="break-all">{source.file.name} · {source.inspection.pageCount} pages · {formatPdfBytes(source.file.size)}</p>}
        </section>
        <form onSubmit={convert} className={PANEL} noValidate>
            <h2 className="font-semibold text-category-document">Page image settings</h2>
            <label htmlFor="pdf-image-pages" className="block font-medium">Pages to convert</label>
            <input id="pdf-image-pages" value={expression} disabled={!source} onChange={event => changeExpression(event.target.value)} aria-invalid={!!source && !parsed.ok} aria-describedby="pdf-image-page-help" className={INPUT} />
            <p id="pdf-image-page-help" role={source && !parsed.ok ? "alert" : undefined} className={`text-sm ${source && !parsed.ok ? "text-error-text" : "text-text-muted"}`}>
                {source && !parsed.ok ? `Enter valid pages from 1 to ${source.inspection.pageCount}, with at most 20 outputs.` : "Use 1-3 or 3,1. Requested order is kept; repeated pages are included once. Up to 20 outputs."}
            </p>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2"><label htmlFor="pdf-image-format" className="block font-medium">Output format</label>
                    <select id="pdf-image-format" value={format} disabled={!source} onChange={event => changeFormat(event.target.value as PdfImageFormat)} className={INPUT}><option value="png">PNG</option><option value="jpeg">JPG</option></select></div>
                <div className="min-w-0 space-y-2"><label htmlFor="pdf-image-dpi" className="block font-medium">Resolution (DPI)</label>
                    <select id="pdf-image-dpi" value={dpi} disabled={!source} onChange={event => changeDpi(Number(event.target.value) as PdfImageDpi)} className={INPUT}>{[72, 150, 300].map(value => <option key={value} value={value}>{value} DPI</option>)}</select></div>
            </div>
            {format === "jpeg" && <div className="space-y-2"><label htmlFor="pdf-image-quality" className="block font-medium">JPEG quality</label>
                <input id="pdf-image-quality" type="number" min="0.50" max="1.00" step="0.05" value={quality} disabled={!source} onChange={event => changeQuality(event.target.value)} aria-invalid={!validPdfToImageOption(option)} aria-describedby="pdf-image-quality-help" className={INPUT} />
                <p id="pdf-image-quality-help" role={!validPdfToImageOption(option) ? "alert" : undefined} className="text-sm text-text-muted">Choose quality from 0.50 to 1.00; lower quality may reduce detail. JPEG renders against white.</p></div>}
            <p className="text-sm text-text-muted">Maximum 4096 pixels per side and 16 MP per image. Choose a lower DPI if a selected page is too large.</p>
            <div className="flex flex-wrap gap-3"><button type="submit" disabled={!valid || selecting || processing} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">Convert pages</button><button type="button" className={SECONDARY} onClick={reset}>Reset</button></div>
        </form>
        {(selecting || processing) && <p role="status">{selecting ? "Inspecting PDF…" : "Rendering and verifying page images…"}</p>}
        {error && <p ref={alert} tabIndex={-1} role="alert" className="break-words rounded-lg border border-error-border bg-error-bg p-3 text-error-text">{error}</p>}
        {result.length > 0 && <section aria-labelledby="pdf-image-result-title" className="min-w-0 space-y-3 rounded-xl border border-result-border bg-result-bg p-4">
            <h2 id="pdf-image-result-title" ref={resultHeading} tabIndex={-1} className="font-semibold">Page images ready</h2>
            <p role="status">{result.length} images verified. Download each image individually.</p>
            <ol className="space-y-4">{result.map(value => <li key={value.pageNumber} className="min-w-0 space-y-2"><p className="break-all">{value.filename}</p><p>Page {value.pageNumber} · {value.format === "jpeg" ? "JPG" : "PNG"} · {value.width} × {value.height} px · {formatPdfBytes(value.size)}</p><a href={value.url} download={value.filename} className="inline-block min-h-11 rounded-lg bg-accent px-4 py-2 text-[var(--contrast)]">Download page {value.pageNumber}</a></li>)}</ol>
        </section>}
    </div>;
}
