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

const SURFACE_CLASS = "min-w-0 space-y-4 rounded-xl border border-border bg-surface p-4";
const INPUT_CLASS = "w-full min-w-0 rounded-lg border border-border bg-surface-alt px-3 py-2 text-text";

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
            setError(failure instanceof ImageResizerError ? failure.message : "This image could not be read. Select another image and try again.");
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
            setError(failure instanceof ImageResizerError ? failure.message : "The image could not be resized. Try again or select another image.");
            setState("processing failure");
        } finally {
            if (token === generation.current) resizing.current = false;
        }
    }

    const busy = state === "processing";
    return (
        <div className="min-w-0 space-y-4">
            <p className="text-sm text-text-muted">Processed locally in your browser. Your image is not uploaded.</p>
            <ImageSourcePanel titleId="resizer-source-title" inputRef={fileInput} onChange={selectFile} selecting={selecting}
            source={source ? { name: source.file.name, width: source.width, height: source.height,
                formattedBytes: formatImageResizerBytes(source.file.size), formatLabel: IMAGE_RESIZER_ENCODING[source.format].label, previewUrl: source.url } : null} />
            <form onSubmit={resize} noValidate className={SURFACE_CLASS} aria-labelledby="resizer-dimension-title">
                <h2 id="resizer-dimension-title" className="font-semibold">Resize dimensions</h2>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="space-y-2"><span className="block font-medium">Width</span>
                        <input type="number" min="1" step="1" value={width} onChange={event => changeWidth(event.target.value)} disabled={!source || busy} className={INPUT_CLASS} />
                    </label>
                    <label className="space-y-2"><span className="block font-medium">Height</span>
                        <input type="number" min="1" step="1" value={height} onChange={event => changeHeight(event.target.value)} disabled={!source || busy} className={INPUT_CLASS} />
                    </label>
                </div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={locked} onChange={event => setLocked(event.target.checked)} disabled={!source || busy} />Preserve aspect ratio</label>
                <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={!source || busy} className="rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">{busy && !selecting ? "Resizing…" : "Resize image"}</button>
                    <button type="button" onClick={reset} className="rounded-lg border border-border bg-surface-alt px-4 py-2">Reset</button>
                </div>
                <p className="text-sm text-text-muted">The output keeps the original image format. Metadata preservation is not guaranteed.</p>
            </form>
            {error && <div role="alert" className="rounded-xl border border-danger bg-surface p-4 text-danger">{error}</div>}
            {result && source && <section className={SURFACE_CLASS} aria-labelledby="resizer-result-title" aria-live="polite">
                <h2 id="resizer-result-title" className="font-semibold">Resized image ready</h2>
                <p className="text-sm">Output: {result.width} × {result.height} px · {formatImageResizerBytes(result.blob.size)} · {IMAGE_RESIZER_ENCODING[source.format].label}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.url} alt="Resized image preview" className="block h-auto max-h-64 max-w-full rounded-lg object-contain" />
                <a href={result.url} download={result.filename} className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)]">Download resized image</a>
            </section>}
        </div>
    );
}
