import type { WorkflowSlug, WorkflowStageId } from "./type";

export type WorkflowStatus = "operational" | "coming-soon";

export interface WorkflowDefinition {
    slug: WorkflowSlug;
    title: string;
    description: string;
    status: WorkflowStatus;
    stageList: readonly WorkflowStageId[];
    canonicalPath: string;
}

/** Single source of truth for workflow identity and status. It is distinct from the tool registry. */
export const workflow_definition_list: readonly WorkflowDefinition[] = [
    {
        slug: "prepare-image-for-upload",
        title: "Prepare an Image for Upload",
        description: "Convert, resize and compress one JPEG, PNG or WebP image in your browser until it meets the format, dimension and byte limits you set, then verify the result before you download it.",
        status: "operational",
        stageList: ["validate", "inspect", "convert", "resize", "compress", "verify", "complete"],
        canonicalPath: "/workflows/prepare-image-for-upload",
    },
    {
        slug: "heic-photos-to-pdf",
        title: "HEIC Photos to PDF",
        description: "Turn up to 20 HEIC photos into one PDF in the order you choose. Every photo is converted and checked in your browser, then you download a single verified PDF.",
        status: "operational",
        stageList: ["validate", "inspect", "convert", "assemble", "verify", "complete"],
        canonicalPath: "/workflows/heic-photos-to-pdf",
    },
    {
        slug: "assemble-pdf-packet",
        title: "Assemble a PDF Packet",
        description: "Combine chosen pages from PDFs and images into one PDF in the exact order you set, repeat pages where you need them, optionally compress it without quality loss, and verify the result before you download it.",
        status: "operational",
        stageList: ["validate", "inspect", "select-pages", "assemble", "compress", "verify", "complete"],
        canonicalPath: "/workflows/assemble-pdf-packet",
    },
    {
        slug: "pdf-pages-for-slides",
        title: "PDF Pages for Slides",
        description: "Export chosen PDF pages as PNG or JPEG slide images at 72, 150 or 300 DPI, in the order you set. Each image is measured against your settings before you download it.",
        status: "operational",
        stageList: ["validate", "inspect", "select-pages", "render", "verify", "complete"],
        canonicalPath: "/workflows/pdf-pages-for-slides",
    },
];

export function getAllWorkflow(): readonly WorkflowDefinition[] {
    return workflow_definition_list;
}

export function getWorkflow(slug: string): WorkflowDefinition | undefined {
    return workflow_definition_list.find(workflow => workflow.slug === slug);
}

/** Returns the workflow only when it can actually be run; inactive and unknown slugs yield undefined. */
export function getOperationalWorkflow(slug: string): WorkflowDefinition | undefined {
    const workflow = getWorkflow(slug);
    return workflow && workflow.status === "operational" ? workflow : undefined;
}

export function getAllOperationalWorkflow(): readonly WorkflowDefinition[] {
    return workflow_definition_list.filter(workflow => workflow.status === "operational");
}
