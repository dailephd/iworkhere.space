"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImageSourcePanel } from "@/component/tool/image/ImageSourcePanel";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { IMAGE_FILE_ENCODING, formatImageFileBytes, validateImageFileSize, type ImageFileDimension, type ImageFileFormat } from "./imageFile";
import { ImageFileError, inspectImageFile, readImageFileFormat } from "./imageFile.client";
import { DEFAULT_QUALITY, imageConverterDefaultOutput, imageConverterFilename, imageConverterOutputOptions,
    imageConverterSupportsQuality, validateImageConverterPair, validateImageConverterQuality } from "./imageConverter";
import { convertImage } from "./imageConverter.client";

type ImageConverterState = "idle" | "selected" | "processing" | "success" | "validation failure" | "processing failure";
interface ImageConverterSource extends ImageFileDimension { file: File; format: ImageFileFormat; url: string }
interface ImageConverterOutcome { outputBytes: number; format: ImageFileFormat; url: string; filename: string }
const SURFACE_CLASS = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";

export function ImageConverterTool({ toolId }: ToolComponentProp) {
    const [state, setState] = useState<ImageConverterState>("idle");
    const [source, setSource] = useState<ImageConverterSource | null>(null);
    const [outcome, setOutcome] = useState<ImageConverterOutcome | null>(null);
    const [output, setOutput] = useState<ImageFileFormat | null>(null);
    const [quality, setQuality] = useState(DEFAULT_QUALITY);
    const [error, setError] = useState("");
    const [selecting, setSelecting] = useState(false);
    const generation = useRef(0);
    const converting = useRef(false);
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
        converting.current = false;
        clearOutcome();
        if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
        sourceUrl.current = null;
        setSource(null);
        setOutput(null);
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
        const sizeError = validateImageFileSize(file.size);
        if (sizeError) { setError(sizeError); setState("validation failure"); return; }
        setSelecting(true);
        setState("processing");
        try {
            const format = await readImageFileFormat(file);
            if (token !== generation.current) return;
            const dimension = await inspectImageFile(file);
            if (token !== generation.current) return;
            const url = URL.createObjectURL(file);
            sourceUrl.current = url;
            setSource({ file, format, url, ...dimension });
            setOutput(imageConverterDefaultOutput(format));
            setState("selected");
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof ImageFileError ? failure.message : "An unexpected browser error occurred while reading this image. Reset the tool and try again.");
            setState("validation failure");
        } finally { if (token === generation.current) setSelecting(false); }
    }

    function clearConfiguredResult() {
        generation.current += 1;
        converting.current = false;
        clearOutcome();
        setError("");
        setState(source ? "selected" : "idle");
    }

    function changeOutput(value: ImageFileFormat) {
        clearConfiguredResult();
        setOutput(value);
    }

    function changeQuality(value: number) {
        clearConfiguredResult();
        setQuality(value);
    }

    async function convert(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || !output || selecting || converting.current) return;
        clearOutcome();
        setError("");
        const validationError = validateImageConverterPair(source.format, output) ||
            (imageConverterSupportsQuality(output) ? validateImageConverterQuality(quality) : null);
        if (validationError) { setError(validationError); setState("validation failure"); return; }
        const token = ++generation.current;
        converting.current = true;
        setState("processing");
        try {
            const blob = await convertImage(source.file, output, quality);
            if (token !== generation.current) return;
            const url = URL.createObjectURL(blob);
            resultUrl.current = url;
            setOutcome({ outputBytes: blob.size, format: output, url, filename: imageConverterFilename(source.file.name, output) });
            setState("success");
            trackEvent("tool_executed", { toolId, slug: "image-converter" });
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof ImageFileError ? failure.message : "An unexpected browser error occurred while converting this image. Reset the tool and try again.");
            setState("processing failure");
        } finally { if (token === generation.current) converting.current = false; }
    }

    const busy = state === "processing";
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-accent-secondary">Processed locally in your browser. Your image is not uploaded.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start">
        <div className="contents order-1 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
        <div className="order-1 min-w-0 lg:order-none">
        <ImageSourcePanel titleId="converter-source-title" inputRef={fileInput} onChange={selectFile} selecting={selecting} showPreview={false}
            source={source ? { name: source.file.name, width: source.width, height: source.height,
                formattedBytes: formatImageFileBytes(source.file.size), formatLabel: IMAGE_FILE_ENCODING[source.format].label, previewUrl: source.url } : null} />
        </div>
        <form onSubmit={convert} className={`order-3 ${SURFACE_CLASS} lg:order-none`} aria-labelledby="converter-controls-title" noValidate>
            <h2 id="converter-controls-title" className="font-semibold text-category-image">Conversion settings</h2>
            <div className="space-y-2"><label htmlFor="converter-output-format" className="block font-medium">Output format</label>
                <select id="converter-output-format" value={output ?? ""} disabled={!source || busy} onChange={event => changeOutput(event.target.value as ImageFileFormat)}
                    className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text">
                    {!source && <option value="">Choose an image first</option>}
                    {source && imageConverterOutputOptions(source.format).map(format => <option key={format} value={format}>{IMAGE_FILE_ENCODING[format].label}</option>)}
                </select>
            </div>
            {output && imageConverterSupportsQuality(output) && <>
                <label className="block space-y-2"><span className="block font-medium">Quality</span>
                    <input type="range" min="10" max="100" step="5" value={quality} onChange={event => changeQuality(Number(event.target.value))} disabled={busy} className="block w-full accent-accent" />
                </label>
                <p className="text-sm">Current quality: {quality}</p>
                <p className="text-sm text-text-muted">Lower quality may reduce visual fidelity.</p>
            </>}
            {output === "jpeg" && <p className="text-sm text-text-muted">Transparent pixels are placed on a white background for JPEG.</p>}
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={!source || busy} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">{busy && !selecting ? "Converting…" : "Convert image"}</button>
                <button type="button" onClick={reset} className="material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-4 py-2">Reset</button>
            </div>
            <p className="text-sm text-text-muted">The output keeps the original dimensions. Metadata preservation is not guaranteed.</p>
        </form>
        </div>
        <div className="contents order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
        <section aria-label="Image preview and result" data-surface={outcome?.url ? "result-stage" : "preview-stage"} className={`material-glass order-2 flex min-h-[300px] min-w-0 items-center justify-center overflow-hidden rounded-xl border ${outcome?.url ? "border-result-border bg-result-bg" : "border-preview-border bg-preview-bg"} p-3 sm:min-h-[380px] lg:min-h-[440px] lg:order-none lg:p-6`}>
            {outcome?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={outcome.url} alt="Converted image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
            ) : source ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.url} alt="Selected source image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
            ) : <p className="max-w-xs text-center text-sm text-text-muted">Choose an image to see its preview here. Your image stays in this browser.</p>}
        </section>

        {error && <div role="alert" className="order-5 rounded-xl border border-danger bg-danger-soft p-4 text-danger lg:order-none">{error}</div>}
        {outcome && source && <section className="material-raised order-4 min-w-0 space-y-4 rounded-xl border border-result-border bg-result-bg p-4 lg:order-none" aria-labelledby="converter-result-title" aria-live="polite">
            <h2 id="converter-result-title" className="font-semibold text-category-image">Converted image ready</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-text-muted">Source format</dt><dd>{IMAGE_FILE_ENCODING[source.format].label}</dd></div>
                <div><dt className="text-text-muted">Output format</dt><dd>{IMAGE_FILE_ENCODING[outcome.format].label}</dd></div>
                <div><dt className="text-text-muted">Source size</dt><dd>{formatImageFileBytes(source.file.size)} ({source.file.size} bytes)</dd></div>
                <div><dt className="text-text-muted">Output size</dt><dd>{formatImageFileBytes(outcome.outputBytes)} ({outcome.outputBytes} bytes)</dd></div>
                <div><dt className="text-text-muted">Source and output dimensions</dt><dd>{source.width} × {source.height} px</dd></div>
            </dl>
            <a href={outcome.url} download={outcome.filename} className="material-primary inline-block min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)]">Download converted image</a>
        </section>}
        </div>
        </div>
    </div>;
}
