import type { ReactNode } from "react";

export interface SectionIslandProp {
    headingId: string;
    heading: string;
    description?: string;
    children: ReactNode;
}

export function SectionIsland({ headingId, heading, description, children }: SectionIslandProp) {
    return <section aria-labelledby={headingId} data-surface="section-island" className="section-island min-w-0 space-y-3 rounded-xl border p-4 sm:p-5">
        <h2 id={headingId} className="text-xl font-semibold text-text">{heading}</h2>
        {description && <p className="text-sm text-text-muted">{description}</p>}
        {children}
    </section>;
}
