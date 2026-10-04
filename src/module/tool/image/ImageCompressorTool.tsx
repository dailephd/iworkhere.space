"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImageSourcePanel } from "@/component/tool/image/ImageSourcePanel";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { DEFAULT_QUALITY, imageCompressorFilename, imageCompressorSavings, validateImageCompressorQuality,
    type ImageCompressorSavings } from "./imageCompressor";
import { IMAGE_FILE_ENCODING as IMAGE_COMPRESSOR_ENCODING, formatImageFileBytes as formatImageCompressorBytes,
    validateImageFileSize as validateImageCompressorSize, type ImageFileDimension as ImageCompressorDimension,
    type ImageFileFormat as ImageCompressorFormat } from "./imageFile";
import { ImageFileError as ImageCompressorError, inspectImageFile as inspectImageCompressor, readImageFileFormat as readImageCompressorFormat } from "./imageFile.client";
import { compressImage } from "./imageCompressor.client";

type ImageCompressorState = "idle" | "selected" | "processing" | "success" | "validation failure" | "processing failure";
interface ImageCompressorSource extends ImageCompressorDimension { file: File; format: ImageCompressorFormat; url: string }
interface ImageCompressorOutcome extends ImageCompressorSavings { outputBytes: number; url: string | null; filename: string }
const SURFACE_CLASS = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";

export function ImageCompressorTool({ toolId }: ToolComponentProp) {
    const [state, setState] = useState<ImageCompressorState>("idle");
    const [source, setSource] = useState<ImageCompressorSource | null>(null);
    const [outcome, setOutcome] = useState<ImageCompressorOutcome | null>(null);
    const [quality, setQuality] = useState(DEFAULT_QUALITY);
    const [error, setError] = useState("");
    const [selecting, setSelecting] = useState(false);
    const generation = useRef(0);
    const compressing = useRef(false);
    const sourceUrl = useRef<string | null>(null);
    const resultUrl = useRef<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => () => {
        generation.current += 1;
        if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        sourceUrl.current = null;
        resultUrl.current = null;
    }, []);

    function clearOutcome() {
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null;
        setOutcome(null);
    }

    function clearSelection() {
        generation.current += 1;
        compressing.current = false;
        clearOutcome();
        if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
        sourceUrl.current = null;
        setSource(null);
        setQuality(DEFAULT_QUALITY);
        setError("");
        setSelecting(false);
        setState("idle");
    }

    function reset() {
        clearSelection();
        if (fileInput.current) fileInput.current.value = "";
    }

    async function selectFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        clearSelection();
        if (!file) return;
        const token = generation.current;
        const sizeError = validateImageCompressorSize(file.size);
        if (sizeError) { setError(sizeError); setState("validation failure"); return; }
        setSelecting(true);
        setState("processing");
        try {
            const format = await readImageCompressorFormat(file);
            if (token !== generation.current) return;
            const dimension = await inspectImageCompressor(file);
            if (token !== generation.current) return;
            const url = URL.createObjectURL(file);
            sourceUrl.current = url;
            setSource({ file, format, url, ...dimension });
            setState("selected");
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof ImageCompressorError ? failure.message : "An unexpected browser error occurred while reading this image. Reset the tool and try again.");
            setState("validation failure");
        } finally { if (token === generation.current) setSelecting(false); }
    }

    function changeQuality(value: number) {
        clearOutcome();
        setQuality(value);
        setError("");
        setState(source ? "selected" : "idle");
    }

    async function compress(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || selecting || compressing.current) return;
        clearOutcome();
        setError("");
        const qualityError = source.format === "png" ? null : validateImageCompressorQuality(quality);
        if (qualityError) { setError(qualityError); setState("validation failure"); return; }
        const token = ++generation.current;
        compressing.current = true;
        setState("processing");
        try {
            const blob = await compressImage(source.file, source.format, quality);
            if (token !== generation.current) return;
            const savings = imageCompressorSavings(source.file.size, blob.size);
            const url = savings.reduced ? URL.createObjectURL(blob) : null;
            resultUrl.current = url;
            setOutcome({ ...savings, outputBytes: blob.size, url, filename: imageCompressorFilename(source.file.name, source.format) });
            setState("success");
            trackEvent("tool_executed", { toolId, slug: "image-compressor" });
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof ImageCompressorError ? failure.message : "An unexpected browser error occurred while compressing this image. Reset the tool and try again.");
            setState("processing failure");
        } finally { if (token === generation.current) compressing.current = false; }
    }

    const busy = state === "processing";
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-accent-secondary">Processed locally in your browser. Your image is not uploaded.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start">
        <div className="contents order-1 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
        <div className="order-1 min-w-0 lg:order-none">
        <ImageSourcePanel titleId="compressor-source-title" inputRef={fileInput} onChange={selectFile} selecting={selecting} showPreview={false}
            source={source ? { name: source.file.name, width: source.width, height: source.height,
                formattedBytes: formatImageCompressorBytes(source.file.size), formatLabel: IMAGE_COMPRESSOR_ENCODING[source.format].label, previewUrl: source.url } : null} />
        </div>
        <form onSubmit={compress} className={`order-3 ${SURFACE_CLASS} lg:order-none`} aria-labelledby="compressor-controls-title" noValidate>
            <h2 id="compressor-controls-title" className="font-semibold text-category-image">Compression settings</h2>
            {source && source.format !== "png" && <>
                <label className="block space-y-2"><span className="block font-medium">Quality</span>
                    <input type="range" min="10" max="100" step="5" value={quality} onChange={event => changeQuality(Number(event.target.value))} disabled={busy} className="block w-full accent-accent" />
                </label>
                <p className="text-sm">Current quality: {quality}</p>
                <p className="text-sm text-text-muted">Lower quality usually reduces file size, but may reduce visual fidelity.</p>
            </>}
            {source?.format === "png" && <p className="text-sm text-text-muted">PNG uses lossless browser re-encoding. Some PNG files may not become smaller.</p>}
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={!source || busy} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">{busy && !selecting ? "Compressing…" : "Compress image"}</button>
                <button type="button" onClick={reset} className="material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-4 py-2">Reset</button>
            </div>
            <p className="text-sm text-text-muted">The output keeps the original image format and dimensions. Metadata preservation is not guaranteed.</p>
        </form>
        </div>
        <div className="contents order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
        <section aria-label="Image preview and result" data-surface={outcome?.url ? "result-stage" : "preview-stage"} className={`material-glass order-2 flex min-h-[300px] min-w-0 items-center justify-center overflow-hidden rounded-xl border ${outcome?.url ? "border-result-border bg-result-bg" : "border-preview-border bg-preview-bg"} p-3 sm:min-h-[380px] lg:min-h-[440px] lg:order-none lg:p-6`}>
            {outcome?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={outcome.url} alt="Compressed image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
            ) : source ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.url} alt="Selected source image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
            ) : <p className="max-w-xs text-center text-sm text-text-muted">Choose an image to see its preview here. Your image stays in this browser.</p>}
        </section>

        {error && <div role="alert" className="order-5 rounded-xl border border-danger bg-danger-soft p-4 text-danger lg:order-none">{error}</div>}
        {outcome && source && <section className="material-raised order-4 min-w-0 space-y-4 rounded-xl border border-result-border bg-result-bg p-4 lg:order-none" aria-labelledby="compressor-result-title" aria-live="polite">
            <h2 id="compressor-result-title" className="font-semibold text-category-image">{outcome.reduced ? "Compressed image ready" : "No smaller file produced"}</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-text-muted">Source size</dt><dd>{formatImageCompressorBytes(source.file.size)} ({source.file.size} bytes)</dd></div>
                <div><dt className="text-text-muted">{outcome.reduced ? "Compressed size" : "Candidate encoded size"}</dt><dd>{formatImageCompressorBytes(outcome.outputBytes)} ({outcome.outputBytes} bytes)</dd></div>
                <div><dt className="text-text-muted">Source and output dimensions</dt><dd>{source.width} × {source.height} px</dd></div>
                <div><dt className="text-text-muted">Format</dt><dd>{IMAGE_COMPRESSOR_ENCODING[source.format].label}</dd></div>
                {outcome.reduced && <div><dt className="text-text-muted">Savings</dt><dd>{outcome.bytesSaved} bytes saved ({outcome.percentSaved.toFixed(1)}% reduction)</dd></div>}
            </dl>
            {!outcome.reduced && <p>This browser and these settings did not produce a smaller file. {source.format === "png" ? "Native lossless PNG re-encoding cannot reduce every PNG." : "Try lowering Quality."}</p>}
            {outcome.reduced && outcome.url && <>
                <a href={outcome.url} download={outcome.filename} className="material-primary inline-block min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)]">Download compressed image</a>
            </>}
        </section>}
        </div>
        </div>
    </div>;
}
