"use client";

import { useState } from "react";
import type { ToolComponentProp } from "../type";

export function SlugifyTool({ toolId }: ToolComponentProp) {
    const [value, setValue] = useState("");

    return (
        <div>
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter text"
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
