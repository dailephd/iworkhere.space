import { describe, it, expect } from "vitest"
import { buildBrowserTitle, buildToolMetadata, buildCategoryMetadata, buildPageMetadata, canonicalUrl, isIndexable } from "./seo"

describe("buildToolMetadata", () => {
    const seo = {
        title: "Slugify Text",
        description: "Free slug generator",
        canonicalPath: "/tool/slugify",
    }

    it("appends the browser suffix once and keeps the descriptive social title", () => {
        const result = buildToolMetadata(seo)
        expect(result.title).toBe("Slugify Text - iworkhere")
        expect(result.openGraph).toMatchObject({ title: "Slugify Text — iworkhere.space" })
        expect(result.twitter).toMatchObject({ title: "Slugify Text — iworkhere.space" })
    })

    it("passes description through", () => {
        const result = buildToolMetadata(seo)
        expect(result.description).toBe("Free slug generator")
    })

    it("generates canonical URL", () => {
        const result = buildToolMetadata(seo)
        expect(result.alternates?.canonical).toBe(
            "https://iworkhere.space/tool/slugify",
        )
    })

    it("generates openGraph metadata", () => {
        const result = buildToolMetadata(seo)
        const og = result.openGraph as Record<string, unknown>
        expect(og).toBeDefined()
        expect(og.title).toBe("Slugify Text — iworkhere.space")
        expect(og.description).toBe("Free slug generator")
        expect(og.url).toBe("https://iworkhere.space/tool/slugify")
        expect(og.siteName).toBe("iworkhere.space")
        expect(og.type).toBe("website")
    })

    it("handles different seo input", () => {
        const other = {
            title: "Calculator",
            description: "Free calculator for quick math.",
            canonicalPath: "/tool/calculator",
        }
        const result = buildToolMetadata(other)
        expect(result.title).toBe("Calculator - iworkhere")
        expect(result.alternates?.canonical).toBe(
            "https://iworkhere.space/tool/calculator",
        )
    })
})

describe("indexability and public metadata", () => {
    it.each([
        [{ VERCEL_ENV: "production", NODE_ENV: "production" }, true],
        [{ VERCEL_ENV: "preview", NODE_ENV: "production" }, false],
        [{ VERCEL_ENV: "development", NODE_ENV: "production" }, false],
        [{ VERCEL_ENV: "unknown", NODE_ENV: "production" }, false],
        [{ NODE_ENV: "production" }, true],
        [{ NODE_ENV: "development" }, false],
        [{}, false],
    ])("uses a conservative environment boundary for %j", (environment, expected) => {
        expect(isIndexable(environment)).toBe(expected)
    })

    it.each(["/", "/discover", "/tool/image-resizer", "/tool/calculator", "/category/image"])("builds canonical and social fields for %s", canonicalPath => {
        const result = buildPageMetadata({ title: "Page", description: "Visible purpose", canonicalPath })
        const canonical = `https://iworkhere.space${canonicalPath}`
        expect(result.alternates?.canonical).toBe(canonical)
        expect(result.openGraph).toMatchObject({ title: "Page — iworkhere.space", description: "Visible purpose", url: canonical })
        expect(result.twitter).toMatchObject({ card: "summary", title: "Page — iworkhere.space", description: "Visible purpose" })
    })

    it("removes shared query and hash state from canonical identity", () => {
        expect(canonicalUrl("/tool/calculator?a=10&b=2#result")).toBe("https://iworkhere.space/tool/calculator")
    })
})

describe("buildBrowserTitle", () => {
    it("appends exactly one suffix to an unbranded title", () => {
        expect(buildBrowserTitle("Merge PDF Files Online")).toBe("Merge PDF Files Online - iworkhere")
        expect(buildBrowserTitle("Page Not Found")).toBe("Page Not Found - iworkhere")
    })

    it("applies the suffix to page metadata without branding the social titles twice", () => {
        const result = buildPageMetadata({ title: "All Tools", description: "d", canonicalPath: "/discover" })
        expect(result.title).toBe("All Tools - iworkhere")
        expect((result.title as string).match(/iworkhere/g)).toHaveLength(1)
        expect(result.openGraph).toMatchObject({ title: "All Tools — iworkhere.space" })
    })
})

describe("buildCategoryMetadata", () => {
    it("appends the browser suffix once for category pages", () => {
        const result = buildCategoryMetadata("text", "Text Tool", "Format and transform text.")
        expect(result.title).toBe("Text Tool - iworkhere")
    })

    it("passes description through", () => {
        const result = buildCategoryMetadata("text", "Text Tool", "Format and transform text.")
        expect(result.description).toBe("Format and transform text.")
    })

    it("generates canonical URL from slug", () => {
        const result = buildCategoryMetadata("math", "Math Tool", "Calculator and more.")
        expect(result.alternates?.canonical).toBe(
            "https://iworkhere.space/category/math",
        )
    })

    it("generates openGraph metadata", () => {
        const result = buildCategoryMetadata("time", "Time Tool", "Timezone utility.")
        const og = result.openGraph as Record<string, unknown>
        expect(og).toBeDefined()
        expect(og.title).toBe("Time Tool — iworkhere.space")
        expect(og.description).toBe("Timezone utility.")
        expect(og.url).toBe("https://iworkhere.space/category/time")
        expect(og.siteName).toBe("iworkhere.space")
        expect(og.type).toBe("website")
    })
})
