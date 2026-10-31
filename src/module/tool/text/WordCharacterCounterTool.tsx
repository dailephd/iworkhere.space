"use client";

import { useMemo, useRef, useState } from "react";
import { measureText } from "./textMetric";
import { ToolSurface } from "@/component/tool/ToolSurface";

const UNAVAILABLE = "—";

export function WordCharacterCounterTool() {
    const [text, setText] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const result = useMemo(() => measureText(text), [text]);

    const metric = result.ok ? result.metric : null;
    const display = (value: number | undefined): string => (value === undefined ? UNAVAILABLE : String(value));

    const handleReset = () => {
        setText("");
        inputRef.current?.focus();
    };

    const metricList: Array<{ label: string; value: number | undefined }> = [
        { label: "Words", value: metric?.wordCount },
        { label: "Characters", value: metric?.characterCount },
        { label: "Characters excluding whitespace", value: metric?.characterWithoutWhitespaceCount },
        { label: "Lines", value: metric?.lineCount },
    ];

    return (
        <ToolSurface kind="work" aria-label="Word and character counter" className="flex flex-col gap-4 space-y-0">
            <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="counter-input" className="text-sm font-medium text-[var(--text)]">
                    Text
                </label>
                <textarea
                    id="counter-input"
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type or paste text here..."
                    spellCheck={false}
                    aria-invalid={result.ok ? undefined : true}
                    className="tool-control h-64 resize-y text-sm"
                />
            </div>

            <div role="alert" className="min-h-0">
                {!result.ok && <p data-tone="error" className="tool-feedback text-sm">{result.error.message}</p>}
            </div>

            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {metricList.map((item) => (
                    <div key={item.label} className="tool-result min-w-0 p-3">
                        <dt className="text-sm text-[var(--text-muted)]">{item.label}</dt>
                        <dd className="text-2xl font-semibold text-[var(--text)]">{display(item.value)}</dd>
                    </div>
                ))}
            </dl>

            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handleReset}
                    className="tool-action-secondary"
                >
                    Reset
                </button>
            </div>
        </ToolSurface>
    );
}
