import type { Metadata } from "next"

const SITE_NAME = "iworkhere.space"
export const SITE_URL = "https://iworkhere.space"

export interface IndexEnvironment {
    VERCEL_ENV?: string
    NODE_ENV?: string
}

export function isIndexable(environment: IndexEnvironment = process.env): boolean {
    if (environment.VERCEL_ENV) return environment.VERCEL_ENV === "production"
    return environment.NODE_ENV === "production"
}

export function canonicalUrl(path: string): string {
    return `${SITE_URL}${path.split(/[?#]/)[0]}`
}

interface SeoInput {
    title: string
    description: string
    canonicalPath: string
}

export function buildPageMetadata(seo: SeoInput): Metadata {
    const title = `${seo.title} — ${SITE_NAME}`
    const description = seo.description
    const canonical = canonicalUrl(seo.canonicalPath)

    return {
        title,
        description,
        robots: { index: isIndexable(), follow: isIndexable() },
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
        twitter: { card: "summary", title, description },
    }
}

export function buildToolMetadata(seo: SeoInput): Metadata {
    return buildPageMetadata(seo)
}

export function buildCategoryMetadata(
    slug: string,
    title: string,
    description: string,
): Metadata {
    return buildPageMetadata({ title, description, canonicalPath: `/category/${slug}` })
}
