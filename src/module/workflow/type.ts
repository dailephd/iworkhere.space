/* Frozen public contract for browser-local workflows. The runner function itself lives in runner.client.ts. */

export type WorkflowSlug =
    | "prepare-image-for-upload"
    | "heic-photos-to-pdf"
    | "assemble-pdf-packet"
    | "pdf-pages-for-slides";

export type WorkflowRequest =
    | {
        slug: "prepare-image-for-upload";
        source: File;
        targetFormat: "jpeg" | "png" | "webp";
        maxWidth: number;
        maxHeight: number;
        maxBytes: number;
    }
    | {
        slug: "heic-photos-to-pdf";
        sourcesInPageOrder: readonly File[];
        intermediateFormat: "jpeg" | "png";
        quality: number;
    }
    | {
        slug: "assemble-pdf-packet";
        sources: readonly { id: string; kind: "pdf" | "jpeg" | "png"; file: File }[];
        pageOrder: readonly { sourceId: string; pageNumber: number }[];
        tryLosslessCompression: boolean;
    }
    | {
        slug: "pdf-pages-for-slides";
        source: File;
        pageNumbersInOutputOrder: readonly number[];
        format: "png" | "jpeg";
        dpi: 72 | 150 | 300;
        jpegQuality: number;
        maxBytesPerImage?: number;
    };

export type WorkflowStageId =
    | "validate"
    | "inspect"
    | "convert"
    | "resize"
    | "compress"
    | "select-pages"
    | "assemble"
    | "render"
    | "verify"
    | "complete";

export type WorkflowStageState = "pending" | "running" | "passed" | "skipped" | "failed" | "cancelled";

export interface WorkflowProgress {
    stage: WorkflowStageId;
    state: WorkflowStageState;
    completed: number;
    total: number;
    description: string;
}

export interface WorkflowArtifact {
    name: string;
    mimeType: string;
    blob: Blob;
    sizeBytes: number;
    sourcePageNumber?: number;
    width?: number;
    height?: number;
}

export interface WorkflowCheck {
    name: string;
    expected: string | number;
    observed: string | number;
    passed: boolean;
}

export type WorkflowFailureCode =
    | "INVALID_INPUT"
    | "UNSUPPORTED_FORMAT"
    | "SOURCE_LIMIT"
    | "PAGE_LIMIT"
    | "RESOURCE_LIMIT"
    | "PROCESSING_FAILED"
    | "VERIFICATION_FAILED"
    | "UNMET_REQUIREMENT"
    | "CANCELLED";

export interface WorkflowFailure {
    code: WorkflowFailureCode;
    stage: WorkflowStageId;
    message: string;
    sourceId?: string;
    unmetChecks?: readonly WorkflowCheck[];
}

export type WorkflowRunResult =
    | {
        ok: true;
        slug: WorkflowSlug;
        outputs: readonly WorkflowArtifact[];
        checks: readonly WorkflowCheck[];
    }
    | {
        ok: false;
        slug: WorkflowSlug;
        failure: WorkflowFailure;
        outputs: readonly [];
    };

export interface WorkflowRunOption {
    signal: AbortSignal;
    onProgress?: (progress: WorkflowProgress) => void;
}
