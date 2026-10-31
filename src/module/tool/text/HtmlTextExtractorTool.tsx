"use client";

import { useState, useCallback } from "react";
import type { ToolComponentProp } from "../type";
import { ToolSurface } from "@/component/tool/ToolSurface";
import { extractHtmlText } from "./extractHtmlText";
import { trackEvent, captureError } from "@/module/observability";

export function HtmlTextExtractorTool({ toolId }: ToolComponentProp) {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const slug = "html-text-extractor";

    const handleConvert = useCallback(() => {
        setError(null);
        setNotice(null);
        setCopied(false);
        if (input.trim().length === 0) {
            setOutput("");
            setError("Enter HTML to extract text.");
            return;
        }
        try {
            const result = extractHtmlText(input);
            setOutput(result);
            if (result.length === 0) setNotice("No visible text was found in this HTML.");
            trackEvent("tool_executed", { toolId, slug });
        } catch (e) {
            captureError(e, { toolId, boundary: "HtmlTextExtractorTool.handleConvert" });
            setError("Could not extract text. Check the HTML and try again.");
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
        <ToolSurface kind="work" aria-label="HTML text extractor" className="flex flex-col gap-4 space-y-0">
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
                        className="tool-control h-64 resize-y font-mono text-sm"
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
                        className="tool-control h-64 resize-y font-mono text-sm"
                    />
                </div>
            </div>

            {error && (
                <p role="alert" data-tone="error" className="tool-feedback text-sm">{error}</p>
            )}
            {notice && (
                <p role="status" data-tone="warning" className="tool-feedback text-sm">{notice}</p>
            )}

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleConvert}
                    className="tool-action-primary"
                >
                    Convert
                </button>
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!output}
                    className="tool-action-secondary"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
        </ToolSurface>
    );
}
