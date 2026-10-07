import type React from "react";
import type { ToolCategory } from "./category";

/* ---- Core identifiers ---- */

export type ToolId = string;
export type ToolSlug = string;

export type { ToolCategory };

/* ---- Capabilities ---- */

export type ToolCapability =
    | "client-only"
    | "offline"
    | "requires-network";

/* ---- SEO ---- */

export interface ToolSeo {
    title: string;
    description: string;
    canonicalPath: string;
}

/* ---- Tool definition ---- */

export interface ToolStatePolicy {
    persist?: "none" | "localstorage";
    shareableQuery?: boolean;
    defaultQuery?: Record<string, string>;
}

export interface ToolDefinition {
    id: ToolId;
    slug: ToolSlug;

    name: string;
    description: string;
    category: ToolCategory;

    seo: ToolSeo;
    capability: ToolCapability[];

    tag?: string[];
    popularity?: number;

    statePolicy?: ToolStatePolicy;

    Component: React.ComponentType<ToolComponentProp>;
}


/* ---- Tool runtime props ---- */

export interface ToolComponentProp {
    toolId: ToolId;
    query?: Record<string, string>;
    setQuery?: (next: Record<string, string>) => void;
}
