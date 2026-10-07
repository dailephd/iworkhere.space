"use client";

import { useCallback, useRef, useState } from "react";
import type { ToolComponentProp } from "../type";
import { transformJson, type JsonFormatError, type JsonFormatMode } from "./jsonFormat";
import { trackEvent, captureError } from "@/module/observability";

const slug = "json-formatter";

function describeError(error: JsonFormatError): string {
    if (error.code === "input-too-large" || error.code === "output-too-large") {
        return error.message;
    }
    return `${error.message} Line ${error.line}, column ${error.column}.`;
}

export function JsonFormatterTool({ toolId }: ToolComponentProp) {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleInputChange = useCallback((value: string) => {
        setInput(value);
        setOutput("");
        setError(null);
        setCopied(false);
    }, []);

    const handleTransform = useCallback((mode: JsonFormatMode) => {
        setCopied(false);
        const result = transformJson(input, mode);
        if (!result.ok) {
            setOutput("");
            setError(describeError(result.error));
            return;
        }
        setError(null);
        setOutput(result.output);
        trackEvent("tool_executed", { toolId, slug });
    }, [input, toolId]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(output);
            setError(null);
            setCopied(true);
            trackEvent("tool_result_copied", { toolId, slug });
        } catch (e) {
            captureError(e, { toolId, boundary: "JsonFormatterTool.handleCopy" });
            setCopied(false);
            setError("Failed to copy to clipboard.");
        }
    }, [output, toolId]);

    const handleReset = useCallback(() => {
        setInput("");
        setOutput("");
        setError(null);
        setCopied(false);
        inputRef.current?.focus();
    }, []);

    const buttonClass = "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
    const primaryClass = "rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--contrast)] hover:bg-[var(--accent-hover)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none";

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <label htmlFor="json-input" className="text-sm font-medium text-[var(--text)]">
                        JSON input
                    </label>
                    <textarea
                        id="json-input"
                        ref={inputRef}
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder="Paste strict JSON here..."
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="off"
                        aria-invalid={error ? true : undefined}
                        className="h-64 w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border)] focus:outline-none"
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <label htmlFor="json-output" className="text-sm font-medium text-[var(--text)]">
                        JSON output
                    </label>
                    <textarea
                        id="json-output"
                        value={output}
                        readOnly
                        placeholder="Formatted or minified JSON will appear here..."
                        spellCheck={false}
                        className="h-64 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                </div>
            </div>

            <div role="alert" className="min-h-0">
                {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            </div>

            <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => handleTransform("format")} className={primaryClass}>
                    Format JSON
                </button>
                <button type="button" onClick={() => handleTransform("minify")} className={buttonClass}>
                    Minify JSON
                </button>
                <button type="button" onClick={handleCopy} disabled={!output} className={buttonClass}>
                    {copied ? "Copied!" : "Copy result"}
                </button>
                <button type="button" onClick={handleReset} className={buttonClass}>
                    Reset
                </button>
            </div>
        </div>
    );
}
