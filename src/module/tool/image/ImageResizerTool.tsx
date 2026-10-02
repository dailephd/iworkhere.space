"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImageSourcePanel } from "@/component/tool/image/ImageSourcePanel";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { heightFromWidth, widthFromHeight, imageResizerFilename, validateImageResizerDimension } from "./imageResizer";
import { formatImageFileBytes as formatImageResizerBytes, IMAGE_FILE_ENCODING as IMAGE_RESIZER_ENCODING,
    validateImageFileSize as validateImageResizerSize, type ImageFileDimension as ImageResizerDimension,
    type ImageFileFormat as ImageResizerFormat } from "./imageFile";
import { ImageFileError as ImageResizerError, inspectImageFile as inspectImageResizer, readImageFileFormat as readImageResizerFormat } from "./imageFile.client";
import { resizeImage } from "./imageResizer.client";

type ImageResizerState = "idle" | "selected" | "processing" | "success" | "validation failure" | "processing failure";

interface ImageResizerSource extends ImageResizerDimension {
    file: File;
    format: ImageResizerFormat;
    url: string;
}

interface ImageResizerResult extends ImageResizerDimension {
    blob: Blob;
    url: string;
    filename: string;
}

const SURFACE_CLASS = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";
const INPUT_CLASS = "w-full min-w-0 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text";

export function ImageResizerTool({ toolId }: ToolComponentProp) {
    const [state, setState] = useState<ImageResizerState>("idle");
    const [source, setSource] = useState<ImageResizerSource | null>(null);
    const [result, setResult] = useState<ImageResizerResult | null>(null);
    const [width, setWidth] = useState("");
    const [height, setHeight] = useState("");
    const [locked, setLocked] = useState(true);
    const [error, setError] = useState("");
    const [selecting, setSelecting] = useState(false);
    const generation = useRef(0);
    const resizing = useRef(false);
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

    function clearResult() {
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null;
        setResult(null);
    }

    function clearSelection() {
        generation.current += 1;
        resizing.current = false;
        clearResult();
        if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
        sourceUrl.current = null;
        setSource(null);
        setWidth("");
        setHeight("");
        setLocked(true);
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
        const sizeError = validateImageResizerSize(file.size);
        if (sizeError) { setError(sizeError); setState("validation failure"); return; }
        setSelecting(true);
        setState("processing");
        try {
            const format = await readImageResizerFormat(file);
            if (token !== generation.current) return;
            const dimension = await inspectImageResizer(file);
            if (token !== generation.current) return;
            const url = URL.createObjectURL(file);
            sourceUrl.current = url;
            setSource({ file, format, url, ...dimension });
            setWidth(String(dimension.width));
            setHeight(String(dimension.height));
            setState("selected");
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof ImageResizerError ? failure.message : "An unexpected browser error occurred while reading this image. Reset the tool and try again.");
            setState("validation failure");
        } finally {
            if (token === generation.current) setSelecting(false);
        }
    }

    function changeWidth(value: string) {
        setWidth(value);
        const number = Number(value);
        if (locked && source && Number.isFinite(number) && number > 0) setHeight(String(heightFromWidth(number, source)));
    }

    function changeHeight(value: string) {
        setHeight(value);
        const number = Number(value);
        if (locked && source && Number.isFinite(number) && number > 0) setWidth(String(widthFromHeight(number, source)));
    }

    async function resize(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || selecting || resizing.current) return;
        clearResult();
        setError("");
        const dimension = { width: Number(width), height: Number(height) };
        const dimensionError = validateImageResizerDimension(dimension);
        if (dimensionError) { setError(dimensionError); setState("validation failure"); return; }
        const token = ++generation.current;
        resizing.current = true;
        setState("processing");
        try {
            const blob = await resizeImage(source.file, source.format, dimension);
            if (token !== generation.current) return;
            const url = URL.createObjectURL(blob);
            resultUrl.current = url;
            setResult({ blob, url, ...dimension, filename: imageResizerFilename(source.file.name, dimension, source.format) });
            setState("success");
            trackEvent("tool_executed", { toolId, slug: "image-resizer" });
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof ImageResizerError ? failure.message : "An unexpected browser error occurred while resizing this image. Reset the tool and try again.");
            setState("processing failure");
        } finally {
            if (token === generation.current) resizing.current = false;
        }
    }

    const busy = state === "processing";
    return (
        <div className="min-w-0 space-y-4">
            <p className="text-sm text-accent-secondary">Processed locally in your browser. Your image is not uploaded.</p>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start">
                <div className="contents order-1 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
                <div className="order-1 min-w-0 lg:order-none">
                    <ImageSourcePanel titleId="resizer-source-title" inputRef={fileInput} onChange={selectFile} selecting={selecting} showPreview={false}
                    source={source ? { name: source.file.name, width: source.width, height: source.height,
                        formattedBytes: formatImageResizerBytes(source.file.size), formatLabel: IMAGE_RESIZER_ENCODING[source.format].label, previewUrl: source.url } : null} />
                </div>
                <form onSubmit={resize} noValidate className={`order-3 ${SURFACE_CLASS} lg:order-none`} aria-labelledby="resizer-dimension-title">
                    <h2 id="resizer-dimension-title" className="font-semibold text-category-image">Resize dimensions</h2>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <label className="space-y-2"><span className="block font-medium">Width</span>
                            <input type="number" min="1" step="1" value={width} onChange={event => changeWidth(event.target.value)} disabled={!source || busy} className={INPUT_CLASS} />
                        </label>
                        <label className="space-y-2"><span className="block font-medium">Height</span>
                            <input type="number" min="1" step="1" value={height} onChange={event => changeHeight(event.target.value)} disabled={!source || busy} className={INPUT_CLASS} />
                        </label>
                    </div>
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-accent" checked={locked} onChange={event => setLocked(event.target.checked)} disabled={!source || busy} />Preserve aspect ratio</label>
                    <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={!source || busy} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">{busy && !selecting ? "Resizing…" : "Resize image"}</button>
                        <button type="button" onClick={reset} className="material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-4 py-2">Reset</button>
                    </div>
                    <p className="text-sm text-text-muted">The output keeps the original image format. Metadata preservation is not guaranteed.</p>
                </form>
                </div>
                <div className="contents order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
                <section aria-label="Image preview and result" data-surface={result ? "result-stage" : "preview-stage"} className={`material-glass order-2 flex min-h-[300px] min-w-0 items-center justify-center overflow-hidden rounded-xl border ${result ? "border-result-border bg-result-bg" : "border-preview-border bg-preview-bg"} p-3 sm:min-h-[380px] lg:min-h-[440px] lg:order-none lg:p-6`}>
                    {result ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={result.url} alt="Resized image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
                    ) : source ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={source.url} alt="Selected source image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
                    ) : (
                        <p className="max-w-xs text-center text-sm text-text-muted">Choose an image to see its preview here. Your image stays in this browser.</p>
                    )}
                    {busy && <p role="status" className="sr-only">{selecting ? "Reading image…" : "Resizing image…"}</p>}
                </section>
                {result && source && <section data-surface="result-stage" className={`material-glass order-5 min-w-0 space-y-4 rounded-xl border border-result-border bg-result-bg p-4 lg:order-none`} aria-labelledby="resizer-result-title" aria-live="polite">
                    <h2 id="resizer-result-title" className="font-semibold text-success">Resized image ready</h2>
                    <p className="text-sm">Output: {result.width} × {result.height} px · {formatImageResizerBytes(result.blob.size)} · {IMAGE_RESIZER_ENCODING[source.format].label}</p>
                    <a href={result.url} download={result.filename} className="material-primary inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)]">Download resized image</a>
                </section>}
                </div>
                {error && <div role="alert" className="order-4 rounded-xl border border-danger bg-danger-soft p-4 text-danger lg:col-span-2">{error}</div>}
            </div>
        </div>
    );
}
