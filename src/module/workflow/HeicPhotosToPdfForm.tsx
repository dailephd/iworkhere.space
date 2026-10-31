"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { MAX_AGGREGATE_IMAGE_BYTES, MAX_IMAGES, formatPdfBytes } from "@/module/tool/document/pdfFile";
import { MAX_SOURCE_BYTES } from "@/module/tool/image/imageFile";
import type { WorkflowDraft, WorkflowFormProp } from "./WorkflowClient";

interface PhotoItem {
    key: number;
    file: File;
}

type IntermediateFormat = "jpeg" | "png";

/* Existing tokens only: the muted text token gives these field boundaries at least 3:1 in every appearance, including One Dark. */
const CONTROL_CLASS = "tool-control border-[var(--text-muted)]! aria-[invalid=true]:border-[var(--danger)]!";
const DEFAULT_QUALITY = 90;
const EMPTY_HINT = "Add at least one HEIC photo to enable Create PDF.";

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

/** Returns a message for the first problem with the photo list, or an empty string. */
function listProblem(item: readonly PhotoItem[]): string {
    for (const [index, entry] of item.entries()) {
        if (entry.file.size === 0) return `Photo ${index + 1} is empty. Remove it and choose a non-empty photo.`;
        if (entry.file.size > MAX_SOURCE_BYTES) return `Photo ${index + 1} is ${formatPdfBytes(entry.file.size)}. Each photo can be at most 25 MiB. Remove it.`;
    }
    const total = item.reduce((sum, entry) => sum + entry.file.size, 0);
    if (total > MAX_AGGREGATE_IMAGE_BYTES) return `The photos total ${formatPdfBytes(total)}. All photos together can be at most 25 MiB. Remove some photos.`;
    return "";
}

export function HeicPhotosToPdfForm({ disabled, onEdit, onDraft }: WorkflowFormProp) {
    const [item, setItem] = useState<PhotoItem[]>([]);
    const [format, setFormat] = useState<IntermediateFormat>("jpeg");
    const [quality, setQuality] = useState(DEFAULT_QUALITY);
    const [addNotice, setAddNotice] = useState("");
    const nextKey = useRef(1);

    const problem = listProblem(item);
    const draft = useMemo<WorkflowDraft>(() => {
        if (item.length === 0) return { request: null, hint: EMPTY_HINT };
        if (problem) return { request: null, hint: problem };
        return {
            request: { slug: "heic-photos-to-pdf", sourcesInPageOrder: item.map(entry => entry.file), intermediateFormat: format, quality },
            hint: "",
        };
    }, [item, problem, format, quality]);
    useEffect(() => onDraft(draft), [draft, onDraft]);

    function addPhoto(event: ChangeEvent<HTMLInputElement>) {
        const chosen = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (chosen.length === 0) return;
        onEdit();
        const room = Math.max(0, MAX_IMAGES - item.length);
        const accepted = chosen.slice(0, room);
        const skipped = chosen.length - accepted.length;
        setAddNotice(skipped > 0 ? `You can use at most ${MAX_IMAGES} photos. ${skipped} ${skipped === 1 ? "photo was" : "photos were"} not added.` : "");
        setItem(previous => [...previous, ...accepted.map(file => ({ key: nextKey.current++, file }))]);
    }

    function move(index: number, delta: number) {
        onEdit();
        setItem(previous => moveItem(previous, index, index + delta));
    }

    function remove(index: number) {
        onEdit();
        setAddNotice("");
        setItem(previous => previous.filter((_, position) => position !== index));
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="heic-photos" className="block font-medium">HEIC or HEIF photos (up to {MAX_IMAGES})</label>
                <input id="heic-photos" type="file" multiple accept=".heic,.heif,image/heic,image/heif" disabled={disabled} className={CONTROL_CLASS}
                    aria-describedby="heic-photos-hint" onChange={addPhoto} />
                <p id="heic-photos-hint" className="text-sm text-text-muted">You can choose photos in several batches. The list below is the page order: the first photo becomes page 1.</p>
                {addNotice && <p role="alert" data-tone="error" className="tool-feedback text-sm">{addNotice}</p>}
                {problem && <p role="alert" data-tone="error" className="tool-feedback text-sm">{problem}</p>}
            </div>

            {item.length === 0 ? (
                <p data-workflow-empty className="text-sm text-text-muted">No photos yet.</p>
            ) : (
                <ol aria-label="Photos in page order" data-workflow-list className="space-y-2">
                    {item.map((entry, index) => (
                        <li key={entry.key} className="min-w-0 space-y-2 rounded border border-[var(--card-border)] p-2">
                            <p className="break-words text-sm">Page {index + 1}: {entry.file.name} ({formatPdfBytes(entry.file.size)})</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="tool-action-secondary" disabled={disabled || index === 0}
                                    aria-label={`Move photo ${index + 1}, ${entry.file.name}, up`} onClick={() => move(index, -1)}>Move up</button>
                                <button type="button" className="tool-action-secondary" disabled={disabled || index === item.length - 1}
                                    aria-label={`Move photo ${index + 1}, ${entry.file.name}, down`} onClick={() => move(index, 1)}>Move down</button>
                                <button type="button" className="tool-action-secondary" disabled={disabled}
                                    aria-label={`Remove photo ${index + 1}, ${entry.file.name}`} onClick={() => remove(index)}>Remove</button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            <div className="space-y-2">
                <label htmlFor="heic-format" className="block font-medium">Image format inside the PDF</label>
                <select id="heic-format" value={format} disabled={disabled} className={CONTROL_CLASS}
                    onChange={event => { onEdit(); setFormat(event.target.value as IntermediateFormat); }}>
                    <option value="jpeg">JPEG (smaller file)</option>
                    <option value="png">PNG (lossless)</option>
                </select>
            </div>

            {format === "jpeg" ? (
                <div className="space-y-2">
                    <label htmlFor="heic-quality" className="block font-medium">JPEG quality: {quality}%</label>
                    <input id="heic-quality" type="range" min={10} max={100} step={5} value={quality} disabled={disabled} className="w-full"
                        aria-describedby="heic-quality-hint" onChange={event => { onEdit(); setQuality(Number(event.target.value)); }} />
                    <p id="heic-quality-hint" className="text-sm text-text-muted">From 10% to 100% in steps of 5. Higher quality gives a larger PDF.</p>
                </div>
            ) : (
                <p className="text-sm text-text-muted">PNG is lossless, so there is no quality setting. The PDF can be much larger.</p>
            )}
        </div>
    );
}
