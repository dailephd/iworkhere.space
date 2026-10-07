"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent, captureError } from "@/module/observability";

const slug = "qr-code-generator";
const PNG_ERROR = "Could not prepare the QR code PNG.";
const GENERATE_ERROR = "Could not generate the QR code.";
const PREVIEW_SIZE = 512;
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

// The PNG is encoded synchronously: canvas.toBlob() is scheduled on browser idle periods and can
// take seconds to call back when the page's main thread stays busy, which delayed the preview.
function encodePng(canvas: HTMLCanvasElement): Blob | null {
    try {
        const dataUrl = canvas.toDataURL("image/png");
        if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return null;
        const binary = atob(dataUrl.slice(PNG_DATA_URL_PREFIX.length));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: "image/png" });
    } catch {
        return null;
    }
}

// qrCode.ts (and its uqr encoder) is loaded through a dynamic import so the encoder stays out of
// the client code every other route loads; it is requested only when this component renders.
let qrCodeModulePromise: Promise<typeof import("./qrCode")> | undefined;

function loadQrCodeModule() {
    qrCodeModulePromise ??= import("./qrCode").catch((error: unknown) => {
        qrCodeModulePromise = undefined;
        throw error;
    });
    return qrCodeModulePromise;
}

export function QrCodeGeneratorTool({ toolId }: ToolComponentProp) {
    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const generation = useRef(0);
    const currentUrl = useRef<string | null>(null);

    const discardResult = useCallback(() => {
        generation.current += 1;
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = null;
        setDownloadUrl(null);
        setError(null);
    }, []);

    useEffect(() => () => {
        generation.current += 1;
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = null;
    }, []);

    // Warm the local encoder chunk once the QR tool is on screen; a failure here is retried on Generate.
    useEffect(() => {
        loadQrCodeModule().catch(() => undefined);
    }, []);

    const handleInputChange = useCallback((value: string) => {
        discardResult();
        setInput(value);
    }, [discardResult]);

    const handleGenerate = useCallback(async () => {
        if (input.length === 0) return;
        discardResult();
        const ticket = generation.current;

        let qrCode: typeof import("./qrCode");
        try {
            qrCode = await loadQrCodeModule();
        } catch (e) {
            if (ticket !== generation.current) return;
            captureError(e, { toolId, boundary: "QrCodeGeneratorTool.loadQrCodeModule" });
            setError(GENERATE_ERROR);
            return;
        }
        if (ticket !== generation.current) return;

        const result = qrCode.generateQrRaster(input);
        if (!result.ok) {
            setError(result.error.message);
            return;
        }

        const { raster } = result;
        const canvas = document.createElement("canvas");
        canvas.width = raster.width;
        canvas.height = raster.height;
        const context = canvas.getContext("2d");
        if (!context) {
            setError(PNG_ERROR);
            return;
        }
        const image = context.createImageData(raster.width, raster.height);
        image.data.set(raster.data);
        context.putImageData(image, 0, 0);

        const blob = encodePng(canvas);
        if (!blob) {
            setError(PNG_ERROR);
            return;
        }
        const url = URL.createObjectURL(blob);
        currentUrl.current = url;
        setDownloadUrl(url);
        trackEvent("tool_executed", { toolId, slug });
    }, [input, toolId, discardResult]);

    const handleReset = useCallback(() => {
        discardResult();
        setInput("");
        inputRef.current?.focus();
    }, [discardResult]);

    const buttonClass = "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
    const primaryClass = "rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--contrast)] hover:bg-[var(--accent-hover)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="qr-input" className="text-sm font-medium text-[var(--text)]">
                    Text or URL
                </label>
                <textarea
                    id="qr-input"
                    ref={inputRef}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Type text or paste a URL here..."
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    aria-invalid={error ? true : undefined}
                    className="h-40 w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border)] focus:outline-none"
                />
            </div>

            <div role="alert" className="min-h-0">
                {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            </div>

            <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleGenerate} disabled={input.length === 0} className={primaryClass}>
                    Generate QR code
                </button>
                {downloadUrl && (
                    <a href={downloadUrl} download="qr-code.png" className={buttonClass}>
                        Download PNG
                    </a>
                )}
                <button type="button" onClick={handleReset} className={buttonClass}>
                    Reset
                </button>
            </div>

            {downloadUrl && (
                <div className="flex justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL; next/image cannot optimize it */}
                    <img
                        src={downloadUrl}
                        alt="Generated QR code preview"
                        width={PREVIEW_SIZE}
                        height={PREVIEW_SIZE}
                        className="h-auto w-full max-w-xs"
                    />
                </div>
            )}
        </div>
    );
}
