"use client";

import { useState } from "react";
import type { ToolComponentProp } from "../type";

export function SlugifyTool({ toolId }: ToolComponentProp) {
    const [value, setValue] = useState("");

    return (
        <div className="space-y-2">
            <label htmlFor="slugify-input" className="block text-sm font-medium text-[var(--text)]">
                Text
            </label>
            <input
                id="slugify-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter text"
                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            />
            <output>{slugify(value)}</output>
        </div>
    );
}

function slugify(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
