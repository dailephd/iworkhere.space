import { describe, it, expect } from "vitest"
import { buildToolMetadata, buildCategoryMetadata } from "./seo"

describe("buildToolMetadata", () => {
    const seo = {
        title: "Slugify Text",
        description: "Free slug generator",
        canonicalPath: "/tool/slugify",
    }

    it("generates title with site name suffix", () => {
        const result = buildToolMetadata(seo)
        expect(result.title).toBe("Slugify Text — iworkhere.space")
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
        expect(result.title).toBe("Calculator — iworkhere.space")
        expect(result.alternates?.canonical).toBe(
            "https://iworkhere.space/tool/calculator",
        )
    })
})

describe("buildCategoryMetadata", () => {
    it("generates title with category name and site suffix", () => {
        const result = buildCategoryMetadata("text", "Text Tool", "Format and transform text.")
        expect(result.title).toBe("Text Tool — iworkhere.space")
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
