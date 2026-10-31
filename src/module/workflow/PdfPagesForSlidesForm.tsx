"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { MAX_OUTPUT_IMAGES_PER_OPERATION, MAX_SINGLE_PDF_BYTES, formatPdfBytes } from "@/module/tool/document/pdfFile";
import { parsePageSelection, type PageSelectionError } from "@/module/tool/document/pageSelection";
import type { WorkflowDraft, WorkflowFormProp } from "./WorkflowClient";

type SlideFormat = "png" | "jpeg";
type SlideDpi = 72 | 150 | 300;

/* Existing tokens only: the muted text token gives these field boundaries at least 3:1 in every appearance, including One Dark. */
const CONTROL_CLASS = "tool-control border-[var(--text-muted)]! aria-[invalid=true]:border-[var(--danger)]!";
const DEFAULT_QUALITY_PERCENT = "85";
const DEFAULT_JPEG_FRACTION = 0.85;
const EMPTY_FILE_HINT = "Choose a PDF to enable Export slide images.";
const EMPTY_PAGE_HINT = "Add at least one page to enable Export slide images.";

const PAGE_SELECTION_MESSAGE: Record<PageSelectionError["category"], string> = {
    empty: "Enter a page number, for example 3 or 2-4.",
    syntax: "Use page numbers and ranges such as 1 or 2-4, separated by commas.",
    range: "A range goes from a lower page to a higher page, and pages start at 1.",
    "page-count": "That page does not exist in the PDF.",
    "output-limit": `You can export at most ${MAX_OUTPUT_IMAGES_PER_OPERATION} pages at a time.`,
    option: "That page selection cannot be used.",
};

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

/** Returns the JPEG quality as a fraction from 0.50 to 1.00, or a message. */
function parseQualityPercent(text: string): { fraction: number } | { error: string } {
    const value = text.trim();
    if (!/^[0-9]+$/.test(value)) return { error: "JPEG quality is a whole percent from 50 to 100." };
    const percent = Number(value);
    if (percent < 50 || percent > 100) return { error: "JPEG quality is a whole percent from 50 to 100." };
    return { fraction: percent / 100 };
}

/** Returns an optional byte limit, or a message. An empty field means no limit. */
function parseByteLimit(text: string): { limit?: number } | { error: string } {
    const value = text.trim();
    if (value === "") return {};
    const message = "The size limit for each image is a positive whole number of bytes, or leave it empty.";
    if (!/^[0-9]+$/.test(value)) return { error: message };
    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit <= 0) return { error: message };
    return { limit };
}

export function PdfPagesForSlidesForm({ disabled, onEdit, onDraft }: WorkflowFormProp) {
    const [file, setFile] = useState<File | null>(null);
    const [page, setPage] = useState<number[]>([]);
    const [addPages, setAddPages] = useState("1");
    const [addError, setAddError] = useState("");
    const [format, setFormat] = useState<SlideFormat>("png");
    const [dpi, setDpi] = useState<SlideDpi>(150);
    const [qualityText, setQualityText] = useState(DEFAULT_QUALITY_PERCENT);
    const [byteText, setByteText] = useState("");

    const quality = useMemo(() => format === "jpeg" ? parseQualityPercent(qualityText) : { fraction: DEFAULT_JPEG_FRACTION }, [format, qualityText]);
    const byteLimit = useMemo(() => parseByteLimit(byteText), [byteText]);
    const sizeProblem = file && file.size > MAX_SINGLE_PDF_BYTES ? `This PDF is ${formatPdfBytes(file.size)}. The maximum is 10 MiB.` : "";
    const qualityError = "error" in quality ? quality.error : "";
    const byteError = "error" in byteLimit ? byteLimit.error : "";

    const draft = useMemo<WorkflowDraft>(() => {
        if (!file) return { request: null, hint: EMPTY_FILE_HINT };
        if (sizeProblem) return { request: null, hint: sizeProblem };
        if (page.length === 0) return { request: null, hint: EMPTY_PAGE_HINT };
        if ("error" in quality) return { request: null, hint: quality.error };
        if ("error" in byteLimit) return { request: null, hint: byteLimit.error };
        return {
            request: {
                slug: "pdf-pages-for-slides",
                source: file,
                pageNumbersInOutputOrder: page,
                format,
                dpi,
                jpegQuality: quality.fraction,
                ...(byteLimit.limit !== undefined ? { maxBytesPerImage: byteLimit.limit } : {}),
            },
            hint: "",
        };
    }, [file, page, format, dpi, quality, byteLimit, sizeProblem]);
    useEffect(() => onDraft(draft), [draft, onDraft]);

    function chooseFile(event: ChangeEvent<HTMLInputElement>) {
        onEdit();
        setFile(event.target.files?.[0] ?? null);
    }

    function addPage() {
        const parsed = parsePageSelection(addPages, { maxOutputCount: MAX_OUTPUT_IMAGES_PER_OPERATION });
        if (!parsed.ok) {
            setAddError(PAGE_SELECTION_MESSAGE[parsed.category]);
            return;
        }
        const repeated = parsed.page.filter(value => page.includes(value));
        if (repeated.length > 0) {
            setAddError(`Page ${repeated.join(", ")} ${repeated.length === 1 ? "is" : "are"} already in the list. Each page can be exported once.`);
            return;
        }
        if (page.length + parsed.page.length > MAX_OUTPUT_IMAGES_PER_OPERATION) {
            setAddError(`You can export at most ${MAX_OUTPUT_IMAGES_PER_OPERATION} pages at a time. You can add ${MAX_OUTPUT_IMAGES_PER_OPERATION - page.length} more.`);
            return;
        }
        onEdit();
        setAddError("");
        setPage(previous => [...previous, ...parsed.page]);
    }

    function move(index: number, delta: number) {
        onEdit();
        setPage(previous => moveItem(previous, index, index + delta));
    }

    function remove(index: number) {
        onEdit();
        setPage(previous => previous.filter((_, position) => position !== index));
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="slides-file" className="block font-medium">PDF file</label>
                <input id="slides-file" type="file" accept="application/pdf,.pdf" disabled={disabled} className={CONTROL_CLASS}
                    aria-describedby="slides-file-hint" onChange={chooseFile} />
                <p id="slides-file-hint" className="text-sm text-text-muted">One PDF, up to 10 MiB and 100 pages.</p>
                {file && <p data-workflow-source className="break-words text-sm text-text-muted">{file.name}: {formatPdfBytes(file.size)}</p>}
                {sizeProblem && <p role="alert" data-tone="error" className="tool-feedback text-sm">{sizeProblem}</p>}
            </div>

            <div className="space-y-2">
                <label htmlFor="slides-add-pages" className="block font-medium">Pages to add</label>
                <input id="slides-add-pages" type="text" value={addPages} disabled={disabled} className={CONTROL_CLASS}
                    aria-invalid={addError ? true : undefined} aria-describedby={addError ? "slides-add-error" : "slides-add-hint"}
                    onChange={event => { setAddPages(event.target.value); setAddError(""); }} />
                <p id="slides-add-hint" className="text-sm text-text-muted">For example 3 or 2-4. The images follow the order of the list below. Each page can be used once, up to {MAX_OUTPUT_IMAGES_PER_OPERATION} pages.</p>
                {addError && <p id="slides-add-error" role="alert" className="text-sm text-danger">{addError}</p>}
                <button type="button" className="tool-action-secondary" disabled={disabled} onClick={addPage}>Add page</button>
            </div>

            {page.length === 0 ? (
                <p data-workflow-empty className="text-sm text-text-muted">No pages yet.</p>
            ) : (
                <ol aria-label="Pages in output order" data-workflow-list className="space-y-2">
                    {page.map((value, index) => (
                        <li key={value} className="min-w-0 space-y-2 rounded border border-[var(--card-border)] p-2">
                            <p className="text-sm">Slide {index + 1}: PDF page {value}</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="tool-action-secondary" disabled={disabled || index === 0}
                                    aria-label={`Move slide ${index + 1}, page ${value}, up`} onClick={() => move(index, -1)}>Move up</button>
                                <button type="button" className="tool-action-secondary" disabled={disabled || index === page.length - 1}
                                    aria-label={`Move slide ${index + 1}, page ${value}, down`} onClick={() => move(index, 1)}>Move down</button>
                                <button type="button" className="tool-action-secondary" disabled={disabled}
                                    aria-label={`Remove slide ${index + 1}, page ${value}`} onClick={() => remove(index)}>Remove</button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            <div className="space-y-2">
                <label htmlFor="slides-format" className="block font-medium">Image format</label>
                <select id="slides-format" value={format} disabled={disabled} className={CONTROL_CLASS}
                    onChange={event => { onEdit(); setFormat(event.target.value as SlideFormat); }}>
                    <option value="png">PNG (lossless)</option>
                    <option value="jpeg">JPEG (smaller files)</option>
                </select>
            </div>

            <div className="space-y-2">
                <label htmlFor="slides-dpi" className="block font-medium">Resolution</label>
                <select id="slides-dpi" value={dpi} disabled={disabled} className={CONTROL_CLASS} aria-describedby="slides-dpi-hint"
                    onChange={event => { onEdit(); setDpi(Number(event.target.value) as SlideDpi); }}>
                    <option value={72}>72 DPI (screen size)</option>
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI (large)</option>
                </select>
                <p id="slides-dpi-hint" className="text-sm text-text-muted">Pages that would be larger than 4096 pixels on a side or 16 megapixels fail instead of being shrunk.</p>
            </div>

            {format === "jpeg" && (
                <div className="space-y-2">
                    <label htmlFor="slides-quality" className="block font-medium">JPEG quality (percent)</label>
                    <input id="slides-quality" type="text" inputMode="numeric" value={qualityText} disabled={disabled} className={CONTROL_CLASS}
                        aria-invalid={qualityError ? true : undefined} aria-describedby={qualityError ? "slides-quality-error" : "slides-quality-hint"}
                        onChange={event => { onEdit(); setQualityText(event.target.value); }} />
                    <p id="slides-quality-hint" className="text-sm text-text-muted">From 50 to 100. The starting value is 85.</p>
                    {qualityError && <p id="slides-quality-error" role="alert" className="text-sm text-danger">{qualityError}</p>}
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="slides-bytes" className="block font-medium">Largest allowed image (bytes, optional)</label>
                <input id="slides-bytes" type="text" inputMode="numeric" value={byteText} disabled={disabled} className={CONTROL_CLASS}
                    aria-invalid={byteError ? true : undefined} aria-describedby={byteError ? "slides-bytes-error" : "slides-bytes-hint"}
                    onChange={event => { onEdit(); setByteText(event.target.value); }} />
                <p id="slides-bytes-hint" className="text-sm text-text-muted">Whole bytes. If any image is larger, no images are offered and nothing is re-encoded at another setting.</p>
                {byteError && <p id="slides-bytes-error" role="alert" className="text-sm text-danger">{byteError}</p>}
            </div>
        </div>
    );
}
