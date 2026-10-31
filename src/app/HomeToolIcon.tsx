import type { ReactNode } from "react"

/*
 * Presentation-only line icons for the homepage catalog, keyed by the canonical tool slug.
 * No tool name, description or category lives here, and the registry carries no icon metadata.
 * A slug without an entry gets the generic tile, so a newly registered tool never renders without an icon.
 */
const ICON_SHAPE: Record<string, ReactNode> = {
    // stacked pages
    "merge-pdf": <><rect x="8" y="3" width="12" height="14" rx="2" /><path d="M16 21H7a3 3 0 0 1-3-3V8" /><path d="M12 8h4M12 12h4" /></>,
    // separated pages
    "split-pdf": <><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /><path d="M6 9h1M17 9h1M6 13h1M17 13h1" /></>,
    // image inside a document
    "images-to-pdf": <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5" /><circle cx="10" cy="13" r="1.2" /><path d="M8 19l4-4 3 3 2-2 2 3" /></>,
    // document yielding a picture
    "pdf-to-image": <><path d="M3 4h7l3 3v9H3z" /><path d="M10 4v3h3" /><path d="M14 18h6M17 15l3 3-3 3" /><rect x="15" y="4" width="6" height="8" rx="1" /></>,
    // inward compression arrows
    "compress-pdf": <><path d="M12 3v6M9 6.5l3 3 3-3" /><path d="M12 21v-6M9 17.5l3-3 3 3" /><path d="M4 12h16" /></>,
    // chain link
    "slugify": <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 10 18.7l1-1" /></>,
    // markup with text lines
    "html-text-extractor": <><path d="M8 5L3 10l5 5M16 5l5 5-5 5" /><path d="M7 19h10M9 22h6" /></>,
    // text lines with count marks
    "word-character-counter": <><path d="M3 6h18M3 11h11M3 16h18" /><path d="M17 9v4M20 9v4M16 20h5" /></>,
    // numeric keypad
    "calculator": <><rect x="5" y="3" width="14" height="18" rx="2" /><rect x="8" y="6" width="8" height="3" rx="0.5" /><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" /></>,
    // ruler
    "length-converter": <><rect x="2" y="8" width="20" height="8" rx="1.5" /><path d="M6 8v3M10 8v4M14 8v3M18 8v4" /></>,
    // weighing scale
    "weight-converter": <><path d="M12 4v16M7 20h10M5 7h14" /><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></>,
    // clock
    "time-arithmetic": <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    // resize handles
    "image-resizer": <><rect x="5" y="5" width="14" height="14" /><path d="M3 3h4v4H3zM17 3h4v4h-4zM3 17h4v4H3zM17 17h4v4h-4z" /></>,
    // image with compression arrows
    "image-compressor": <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M6 6l4 4M10 7v3H7M18 18l-4-4M14 17v-3h3" /></>,
    // bidirectional format arrows
    "image-converter": <><path d="M4 8h14M15 5l3 3-3 3" /><path d="M20 16H6M9 13l-3 3 3 3" /></>,
    // image file
    "heic-converter": <><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5" /><circle cx="10" cy="12" r="1.2" /><path d="M7 19l4-4 3 3 2-2 1 1" /></>,
    // curly braces
    "json-formatter": <><path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3" /><path d="M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3" /></>,
    // QR matrix
    "qr-code-generator": <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM19 14h2M14 20h2M19 19v2M17 17h2" /></>,
}

const FALLBACK_SHAPE: ReactNode = <rect x="4" y="4" width="16" height="16" rx="3" />

export interface HomeToolIconProp {
    slug: string
}

export function HomeToolIcon({ slug }: HomeToolIconProp) {
    const shape = ICON_SHAPE[slug]
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            data-tool-icon={shape ? slug : "fallback"}
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="home-card-icon shrink-0"
        >
            {shape ?? FALLBACK_SHAPE}
        </svg>
    )
}

/* Decorative multi-step workflow glyph (stacked pages with a forward arrow) shared by the guide cards. */
export function HomeWorkflowIcon() {
    return (
        <svg aria-hidden="true" focusable="false" data-workflow-icon viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="home-card-icon shrink-0">
            <rect x="3" y="4" width="9" height="12" rx="1.5" />
            <path d="M7 20h7a2 2 0 0 0 2-2V9" />
            <path d="M15 5h6M18 2l3 3-3 3" />
        </svg>
    )
}
