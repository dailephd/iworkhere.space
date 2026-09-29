import type { Metadata } from "next"

const SITE_NAME = "iworkhere.space"
const SITE_URL = "https://iworkhere.space"

interface SeoInput {
    title: string
    description: string
    canonicalPath: string
}

export function buildToolMetadata(seo: SeoInput): Metadata {
    const title = `${seo.title} — ${SITE_NAME}`
    const description = seo.description
    const canonical = `${SITE_URL}${seo.canonicalPath}`

    return {
        title,
        description,
        alternates: {
            canonical,
        },
        openGraph: {
            title,
            description,
            url: canonical,
            siteName: SITE_NAME,
            type: "website",
        },
    }
}

export function buildCategoryMetadata(
    slug: string,
    title: string,
    description: string,
): Metadata {
    const fullTitle = `${title} — ${SITE_NAME}`
    const canonical = `${SITE_URL}/category/${slug}`

    return {
        title: fullTitle,
        description,
        alternates: {
            canonical,
        },
        openGraph: {
            title: fullTitle,
            description,
            url: canonical,
            siteName: SITE_NAME,
            type: "website",
        },
    }
}
