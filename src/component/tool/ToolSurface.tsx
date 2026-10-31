import { useId, type ReactNode } from "react";

export type ToolSurfaceKind = "work" | "preview" | "result" | "feedback";
export type ToolSurfaceTone = "neutral" | "success" | "warning" | "error";

export interface ToolSurfaceProp {
    kind: ToolSurfaceKind;
    tone?: ToolSurfaceTone;
    title?: string;
    description?: string;
    children: ReactNode;
    className?: string;
    id?: string;
    /** Native accessible-name and live-region attributes only; used when a tool owns its own focusable heading. */
    "aria-labelledby"?: string;
    "aria-label"?: string;
    "aria-live"?: "polite" | "assertive" | "off";
    role?: "alert" | "status";
}

/** Class contract for the single shared surface family; forms that cannot be a section reuse it through this helper. */
export function toolSurfaceClassName(kind: ToolSurfaceKind, className?: string): string {
    const base = `tool-${kind} min-w-0`;
    return className ? `${base} ${className}` : base;
}

/**
 * Presentation-only section for actual tool work, preview, result and feedback.
 * It holds no state, reads no files and imports no registry; tools keep every control and message.
 */
export function ToolSurface({
    kind,
    tone = "neutral",
    title,
    description,
    children,
    className,
    id,
    role,
    "aria-labelledby": labelledBy,
    "aria-label": label,
    "aria-live": live,
}: ToolSurfaceProp) {
    const generated = useId();
    const titleId = `${id ?? generated}-title`;
    return (
        <section
            id={id}
            role={role}
            data-tone={kind === "feedback" || tone !== "neutral" ? tone : undefined}
            data-surface={kind === "preview" ? "preview-stage" : kind === "result" ? "result-stage" : undefined}
            aria-labelledby={title ? titleId : labelledBy}
            aria-label={title ? undefined : label}
            aria-live={live}
            className={toolSurfaceClassName(kind, className?.includes("space-y-") ? className : `space-y-3 ${className ?? ""}`.trim())}
        >
            {title && <h2 id={titleId} className="tool-heading">{title}</h2>}
            {description && <p className="text-sm text-text-muted">{description}</p>}
            {children}
        </section>
    );
}
