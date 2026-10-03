"use client";

import type { ChangeEventHandler, RefObject } from "react";

export interface ImageSourcePresentation {
    name: string;
    width: number;
    height: number;
    formattedBytes: string;
    formatLabel: string;
    previewUrl: string;
}

export interface ImageSourcePanelProp {
    titleId: string;
    inputRef: RefObject<HTMLInputElement | null>;
    onChange: ChangeEventHandler<HTMLInputElement>;
    selecting: boolean;
    source: ImageSourcePresentation | null;
    showPreview?: boolean;
}

export function ImageSourcePanel({ titleId, inputRef, onChange, selecting, source, showPreview = true }: ImageSourcePanelProp) {
    return <section className="min-w-0 space-y-4 rounded-xl border border-card-border bg-card-bg p-4" aria-labelledby={titleId}>
        <h2 id={titleId} className="font-semibold">Source image</h2>
        <label className="block space-y-2"><span className="block font-medium">Choose image</span>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange}
                className="w-full min-w-0 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text file:mr-2 file:rounded file:border-0 file:bg-surface file:px-2 file:py-1 file:text-text" />
        </label>
        <p className="text-sm text-text-muted">JPEG, PNG or WebP. Up to 25 MiB and 30 megapixels.</p>
        {selecting && <p role="status">Reading image…</p>}
        {source && <>
            <p className="break-all text-sm">{source.name}</p>
            <p className="text-sm">Source: {source.width} × {source.height} px · {source.formattedBytes} · {source.formatLabel}</p>
            {/* Native img consumes a local Blob URL without an optimization request. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {showPreview && <img src={source.previewUrl} alt="Selected source image preview" className="block h-auto max-h-64 max-w-full rounded-lg object-contain" />}
        </>}
    </section>;
}
