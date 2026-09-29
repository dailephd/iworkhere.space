"use client";

import { useState, useCallback } from "react";
import type { ToolComponentProp } from "../type";
import { extractHtmlText } from "./extractHtmlText";
import { trackEvent, captureError } from "@/module/observability";

export function HtmlTextExtractorTool({ toolId }: ToolComponentProp) {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const slug = "html-text-extractor";

    const handleConvert = useCallback(() => {
        setError(null);
        setCopied(false);
        try {
            const result = extractHtmlText(input);
            setOutput(result);
            trackEvent("tool_executed", { toolId, slug });
        } catch (e) {
            captureError(e, { toolId, boundary: "HtmlTextExtractorTool.handleConvert" });
            setError("Failed to extract text. Please check your HTML input.");
        }
    }, [input, toolId]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(output);
            setCopied(true);
            trackEvent("tool_result_copied", { toolId, slug });
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            captureError(e, { toolId, boundary: "HtmlTextExtractorTool.handleCopy" });
            setError("Failed to copy to clipboard.");
        }
    }, [output, toolId]);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="html-input"
                        className="text-sm font-medium text-[var(--text)]"
                    >
                        HTML Input
                    </label>
                    <textarea
                        id="html-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Paste your HTML here..."
                        className="h-64 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border)] focus:outline-none"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="text-output"
                        className="text-sm font-medium text-[var(--text)]"
                    >
                        Extracted Text
                    </label>
                    <textarea
                        id="text-output"
                        value={output}
                        readOnly
                        placeholder="Extracted text will appear here..."
                        className="h-64 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                </div>
            </div>

            {error && (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleConvert}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--contrast)] hover:bg-[var(--accent-hover)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none"
                >
                    Convert
                </button>
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!output}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
        </div>
    );
}
