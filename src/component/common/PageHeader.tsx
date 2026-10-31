import type { ReactNode } from "react";

export interface PageHeaderBreadcrumb {
    label: string;
    href?: string;
}

export interface PageHeaderProp {
    title: string;
    description?: string;
    breadcrumb?: PageHeaderBreadcrumb[];
    /** Canonical category identity, resolved by the caller; selects the existing category role variables. */
    categoryId?: string;
    categoryTitle?: string;
    children?: ReactNode;
}

/** Generic page heading: breadcrumb, optional category cue, single H1 and introduction. No tool or registry lookup. */
export function PageHeader({ title, description, breadcrumb, categoryId, categoryTitle, children }: PageHeaderProp) {
    return (
        <header className="space-y-2" data-category={categoryId}>
            {breadcrumb && breadcrumb.length > 0 && (
                <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
                    <ol className="flex flex-wrap items-center gap-2">
                        {breadcrumb.map((item, index) => (
                            <li key={item.label} className="flex items-center gap-2">
                                {index > 0 && <span aria-hidden="true">/</span>}
                                {item.href ? <a href={item.href} className="rounded hover:text-text">{item.label}</a> : <span aria-current="page">{item.label}</span>}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}
            {categoryId && categoryTitle && (
                <p data-category-cue className="home-chip inline-block rounded-full px-3 py-1 text-xs font-medium" data-category={categoryId}>{categoryTitle}</p>
            )}
            <h1 className="text-3xl font-semibold text-text">{title}</h1>
            {description && <p className="text-text-muted">{description}</p>}
            {children}
        </header>
    );
}
