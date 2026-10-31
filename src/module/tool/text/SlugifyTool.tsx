"use client";

import { useState } from "react";
import type { ToolComponentProp } from "../type";
import { ToolSurface } from "@/component/tool/ToolSurface";

export function SlugifyTool({ toolId }: ToolComponentProp) {
    const [value, setValue] = useState("");
    const slug = slugify(value);

    return (
        <ToolSurface kind="work" aria-label="Slugify text">
            <label htmlFor="slugify-input" className="block text-sm font-medium text-[var(--text)]">
                Text
            </label>
            <input
                id="slugify-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter text"
                className="tool-control"
            />
            {slug && <div className="space-y-1">
                <p id="slugify-result-label" className="block text-sm font-medium text-[var(--text)]">Generated slug</p>
                <output htmlFor="slugify-input" aria-labelledby="slugify-result-label" className="tool-result block break-all">{slug}</output>
            </div>}
            {value && !slug && <p role="status" className="tool-feedback text-sm">No slug was generated. Slugify keeps only ASCII letters and numbers, so try input that includes some.</p>}
        </ToolSurface>
    );
}

function slugify(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
