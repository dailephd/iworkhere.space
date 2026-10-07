"use client";

import { useMemo, useRef, useState } from "react";
import { measureText } from "./textMetric";

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
        <div className="flex flex-col gap-4">
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
                    className="h-64 w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border)] focus:outline-none"
                />
            </div>

            <div role="alert" className="min-h-0">
                {!result.ok && <p className="text-sm text-[var(--danger)]">{result.error.message}</p>}
            </div>

            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {metricList.map((item) => (
                    <div key={item.label} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <dt className="text-sm text-[var(--text-muted)]">{item.label}</dt>
                        <dd className="text-2xl font-semibold text-[var(--text)]">{display(item.value)}</dd>
                    </div>
                ))}
            </dl>

            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:outline-none"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
