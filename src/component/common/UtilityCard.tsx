import { useId } from "react"
import Link from "next/link"

export interface UtilityCardProps {
    href: string
    title: string
    description: string
    /** Selects the existing category role variables through data-category; no category knowledge lives here. */
    categoryId: string
    categoryTitle: string
}

/**
 * Presentation-only whole-card link. The entire card is one anchor, so the title and description are never nested links.
 * The caller supplies every value; this component imports no registry, category definition or route data.
 */
export function UtilityCard({ href, title, description, categoryId, categoryTitle }: UtilityCardProps) {
    const id = useId()
    const titleId = `${id}-title`
    const descriptionId = `${id}-description`
    return (
        <Link
            href={href}
            data-category={categoryId}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="catalog-card home-card flex h-full min-h-11 flex-col gap-1 rounded-xl border border-card-border bg-card-bg p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
            <span className="text-xs font-medium text-[var(--board-ink,var(--category-color))]">{categoryTitle}</span>
            <h3 id={titleId} className="font-semibold text-text">{title}</h3>
            <p id={descriptionId} className="text-sm text-text-muted">{description}</p>
        </Link>
    )
}
