"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { MAX_AGGREGATE_PAGES, MAX_AGGREGATE_PDF_BYTES, MAX_IMAGES, MAX_INPUT_PDFS, formatPdfBytes } from "@/module/tool/document/pdfFile";
import { parsePageSelection, type PageSelectionError } from "@/module/tool/document/pageSelection";
import type { WorkflowDraft, WorkflowFormProp } from "./WorkflowClient";

type PacketKind = "pdf" | "jpeg" | "png";

interface SourceItem {
    id: string;
    kind: PacketKind;
    file: File;
}

interface PageEntry {
    key: number;
    sourceId: string;
    pageNumber: number;
}

/* Existing tokens only: the muted text token gives these field boundaries at least 3:1 in every appearance, including One Dark. */
const CONTROL_CLASS = "tool-control border-[var(--text-muted)]! aria-[invalid=true]:border-[var(--danger)]!";
const KIND_LABEL: Record<PacketKind, string> = { pdf: "PDF", jpeg: "JPEG", png: "PNG" };
const EMPTY_SOURCE_HINT = "Add at least one PDF or image to enable Assemble packet.";
const EMPTY_PAGE_HINT = "Add at least one page to the packet to enable Assemble packet.";

const PAGE_SELECTION_MESSAGE: Record<PageSelectionError["category"], string> = {
    empty: "Enter a page number, for example 3 or 2-4.",
    syntax: "Use page numbers and ranges such as 1 or 2-4, separated by commas.",
    range: "A range goes from a lower page to a higher page, and pages start at 1.",
    "page-count": "That page does not exist in the source.",
    "output-limit": `A packet can have at most ${MAX_AGGREGATE_PAGES} pages.`,
    option: "That page selection cannot be used.",
};

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

/** The form only labels the kind from the browser's file type or extension. The runner verifies the real bytes. */
function kindOf(file: File): PacketKind | null {
    const name = file.name.toLowerCase();
    if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (file.type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpeg";
    if (file.type === "image/png" || name.endsWith(".png")) return "png";
    return null;
}

function sourceProblem(source: readonly SourceItem[]): string {
    const pdfCount = source.filter(entry => entry.kind === "pdf").length;
    if (pdfCount > MAX_INPUT_PDFS) return `A packet can use at most ${MAX_INPUT_PDFS} PDFs. Remove ${pdfCount - MAX_INPUT_PDFS}.`;
    const imageCount = source.length - pdfCount;
    if (imageCount > MAX_IMAGES) return `A packet can use at most ${MAX_IMAGES} images. Remove ${imageCount - MAX_IMAGES}.`;
    const total = source.reduce((sum, entry) => sum + entry.file.size, 0);
    if (total > MAX_AGGREGATE_PDF_BYTES) return `The sources total ${formatPdfBytes(total)}. All sources together can be at most 25 MiB.`;
    return "";
}

export function PdfPacketForm({ disabled, onEdit, onDraft }: WorkflowFormProp) {
    const [source, setSource] = useState<SourceItem[]>([]);
    const [entry, setEntry] = useState<PageEntry[]>([]);
    const [addSourceId, setAddSourceId] = useState("");
    const [addPages, setAddPages] = useState("1");
    const [addError, setAddError] = useState("");
    const [fileNotice, setFileNotice] = useState("");
    const [compress, setCompress] = useState(false);
    const nextSource = useRef(1);
    const nextEntry = useRef(1);

    const problem = sourceProblem(source);
    const draft = useMemo<WorkflowDraft>(() => {
        if (source.length === 0) return { request: null, hint: EMPTY_SOURCE_HINT };
        if (problem) return { request: null, hint: problem };
        if (entry.length === 0) return { request: null, hint: EMPTY_PAGE_HINT };
        return {
            request: {
                slug: "assemble-pdf-packet",
                sources: source.map(({ id, kind, file }) => ({ id, kind, file })),
                pageOrder: entry.map(({ sourceId, pageNumber }) => ({ sourceId, pageNumber })),
                tryLosslessCompression: compress,
            },
            hint: "",
        };
    }, [source, entry, problem, compress]);
    useEffect(() => onDraft(draft), [draft, onDraft]);

    const selected = source.find(item => item.id === addSourceId) ?? source[0];
    const sourceNumber = (id: string) => source.findIndex(item => item.id === id) + 1;

    function addSources(event: ChangeEvent<HTMLInputElement>) {
        const chosen = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (chosen.length === 0) return;
        onEdit();
        const accepted: SourceItem[] = [];
        const rejected: string[] = [];
        for (const file of chosen) {
            const kind = kindOf(file);
            if (kind) accepted.push({ id: `source-${nextSource.current++}`, kind, file });
            else rejected.push(file.name);
        }
        setFileNotice(rejected.length > 0 ? `Not added (only PDF, JPEG and PNG files can be used): ${rejected.join(", ")}` : "");
        setSource(previous => [...previous, ...accepted]);
        if (accepted.length > 0 && !addSourceId) setAddSourceId(accepted[0].id);
    }

    function removeSource(id: string) {
        onEdit();
        setSource(previous => previous.filter(item => item.id !== id));
        setEntry(previous => previous.filter(item => item.sourceId !== id));
        if (addSourceId === id) setAddSourceId("");
    }

    function addEntry() {
        if (!selected) return;
        const parsed = selected.kind === "pdf"
            ? parsePageSelection(addPages, { maxOutputCount: MAX_AGGREGATE_PAGES })
            : { ok: true as const, page: [1] };
        if (!parsed.ok) {
            setAddError(PAGE_SELECTION_MESSAGE[parsed.category]);
            return;
        }
        if (entry.length + parsed.page.length > MAX_AGGREGATE_PAGES) {
            setAddError(`A packet can have at most ${MAX_AGGREGATE_PAGES} pages. You can add ${MAX_AGGREGATE_PAGES - entry.length} more.`);
            return;
        }
        onEdit();
        setAddError("");
        setEntry(previous => [...previous, ...parsed.page.map(pageNumber => ({ key: nextEntry.current++, sourceId: selected.id, pageNumber }))]);
    }

    function moveEntry(index: number, delta: number) {
        onEdit();
        setEntry(previous => moveItem(previous, index, index + delta));
    }

    function removeEntry(index: number) {
        onEdit();
        setEntry(previous => previous.filter((_, position) => position !== index));
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="packet-files" className="block font-medium">PDFs and images (JPEG or PNG)</label>
                <input id="packet-files" type="file" multiple accept="application/pdf,.pdf,image/jpeg,image/png" disabled={disabled} className={CONTROL_CLASS}
                    aria-describedby="packet-files-hint" onChange={addSources} />
                <p id="packet-files-hint" className="text-sm text-text-muted">Up to {MAX_INPUT_PDFS} PDFs and {MAX_IMAGES} images, 25 MiB in total. Add the files first, then list the pages you want.</p>
                {fileNotice && <p role="alert" data-tone="error" className="tool-feedback text-sm">{fileNotice}</p>}
                {problem && <p role="alert" data-tone="error" className="tool-feedback text-sm">{problem}</p>}
            </div>

            {source.length === 0 ? (
                <p data-workflow-empty className="text-sm text-text-muted">No files yet.</p>
            ) : (
                <ul aria-label="Source files" data-workflow-source-list className="space-y-2">
                    {source.map((item, index) => (
                        <li key={item.id} className="min-w-0 space-y-2 rounded border border-[var(--card-border)] p-2">
                            <p className="break-words text-sm">Source {index + 1}: {item.file.name} ({KIND_LABEL[item.kind]}, {formatPdfBytes(item.file.size)})</p>
                            <button type="button" className="tool-action-secondary" disabled={disabled}
                                aria-label={`Remove source ${index + 1}, ${item.file.name}`} onClick={() => removeSource(item.id)}>Remove file</button>
                        </li>
                    ))}
                </ul>
            )}

            {source.length > 0 && (
                <div className="space-y-2">
                    <label htmlFor="packet-add-source" className="block font-medium">Add pages from</label>
                    <select id="packet-add-source" value={selected?.id ?? ""} disabled={disabled} className={CONTROL_CLASS}
                        onChange={event => { setAddSourceId(event.target.value); setAddError(""); }}>
                        {source.map((item, index) => (
                            <option key={item.id} value={item.id}>Source {index + 1}: {item.file.name} ({KIND_LABEL[item.kind]})</option>
                        ))}
                    </select>
                    {selected?.kind === "pdf" ? (
                        <>
                            <label htmlFor="packet-add-pages" className="block font-medium">Pages to add</label>
                            <input id="packet-add-pages" type="text" value={addPages} disabled={disabled} className={CONTROL_CLASS}
                                aria-invalid={addError ? true : undefined} aria-describedby={addError ? "packet-add-error" : "packet-add-hint"}
                                onChange={event => { setAddPages(event.target.value); setAddError(""); }} />
                            <p id="packet-add-hint" className="text-sm text-text-muted">For example 1 or 2-4, or 1, 3, 5. You can add the same page again later to repeat it.</p>
                        </>
                    ) : (
                        <p className="text-sm text-text-muted">An image is one page, so page 1 is added.</p>
                    )}
                    {addError && <p id="packet-add-error" role="alert" className="text-sm text-danger">{addError}</p>}
                    <button type="button" className="tool-action-secondary" disabled={disabled} onClick={addEntry}>Add page</button>
                </div>
            )}

            {entry.length > 0 && (
                <ol aria-label="Packet pages in order" data-workflow-list className="space-y-2">
                    {entry.map((item, index) => (
                        <li key={item.key} className="min-w-0 space-y-2 rounded border border-[var(--card-border)] p-2">
                            <p className="break-words text-sm">Packet page {index + 1}: source {sourceNumber(item.sourceId)}, page {item.pageNumber}</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="tool-action-secondary" disabled={disabled || index === 0}
                                    aria-label={`Move packet page ${index + 1} up`} onClick={() => moveEntry(index, -1)}>Move up</button>
                                <button type="button" className="tool-action-secondary" disabled={disabled || index === entry.length - 1}
                                    aria-label={`Move packet page ${index + 1} down`} onClick={() => moveEntry(index, 1)}>Move down</button>
                                <button type="button" className="tool-action-secondary" disabled={disabled}
                                    aria-label={`Remove packet page ${index + 1}`} onClick={() => removeEntry(index)}>Remove</button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            <div className="flex min-w-0 items-start gap-2">
                <input id="packet-compress" type="checkbox" checked={compress} disabled={disabled} className="mt-1 size-5"
                    aria-describedby="packet-compress-hint" onChange={event => { onEdit(); setCompress(event.target.checked); }} />
                <div className="min-w-0">
                    <label htmlFor="packet-compress" className="block font-medium">Try lossless compression</label>
                    <p id="packet-compress-hint" className="text-sm text-text-muted">Rewrites the PDF structure without changing page content. It only applies to packets up to 10 MiB and may not make the file smaller.</p>
                </div>
            </div>
        </div>
    );
}
