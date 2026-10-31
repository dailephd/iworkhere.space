"use client";

import { useCallback, useRef, useState } from "react";
import type { ToolComponentProp } from "../type";
import { ToolSurface } from "@/component/tool/ToolSurface";
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

    const buttonClass = "tool-action-secondary";
    const primaryClass = "tool-action-primary";

    return (
        <ToolSurface kind="work" aria-label="JSON formatter" className="flex flex-col gap-4 space-y-0">
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
                        className="tool-control h-64 resize-y font-mono text-sm"
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
                        className="tool-control h-64 resize-y font-mono text-sm"
                    />
                </div>
            </div>

            <div role="alert" className="min-h-0">
                {error && <p data-tone="error" className="tool-feedback text-sm">{error}</p>}
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
        </ToolSurface>
    );
}
