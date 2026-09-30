import { describe, it, expect } from "vitest"
import {
    getAllTool,
    getToolSeoBySlug,
    getAllToolSeo,
    getAvailableCategory,
    getToolCount,
    getAllTag,
    getToolByTag,
    getToolByPopularity,
} from "./metadata"
import { tool_definition_list } from "./registry"

describe("tool metadata index", () => {
    it("derives Image Resizer SEO and the populated image category from the registry", () => {
        expect(getToolSeoBySlug("image-resizer")).toEqual({
            title: "Image Resizer",
            description: "Resize JPEG, PNG, and WebP images locally in your browser.",
            canonicalPath: "/tool/image-resizer",
        })
        expect(getAvailableCategory()).toContain("image")
    })
    describe("getAllTool", () => {
        it("returns all tools from registry", () => {
            const result = getAllTool()
            expect(result).toBe(tool_definition_list)
            expect(result.length).toBe(tool_definition_list.length)
        })

        it("returns an array", () => {
            expect(Array.isArray(getAllTool())).toBe(true)
        })
    })

    describe("getToolSeoBySlug", () => {
        it("returns seo for existing slug", () => {
            const seo = getToolSeoBySlug("slugify")
            expect(seo).toBeDefined()
            expect(seo?.title).toBe("Slugify Text")
            expect(seo?.canonicalPath).toBe("/tool/slugify")
        })

        it("returns seo for calculator slug", () => {
            const seo = getToolSeoBySlug("calculator")
            expect(seo).toBeDefined()
            expect(seo?.title).toBe("Calculator")
        })

        it("returns undefined for nonexistent slug", () => {
            expect(getToolSeoBySlug("nonexistent")).toBeUndefined()
        })

        it("returns undefined for empty string", () => {
            expect(getToolSeoBySlug("")).toBeUndefined()
        })
    })

    describe("getAllToolSeo", () => {
        it("returns seo data for every tool", () => {
            const result = getAllToolSeo()
            expect(result.length).toBe(tool_definition_list.length)
        })

        it("each seo entry has required fields", () => {
            const result = getAllToolSeo()
            for (const seo of result) {
                expect(seo).toHaveProperty("title")
                expect(seo).toHaveProperty("description")
                expect(seo).toHaveProperty("canonicalPath")
                expect(typeof seo.title).toBe("string")
                expect(typeof seo.description).toBe("string")
                expect(typeof seo.canonicalPath).toBe("string")
            }
        })
    })

    describe("getAvailableCategory", () => {
        it("returns an array of unique categories", () => {
            const result = getAvailableCategory()
            expect(Array.isArray(result)).toBe(true)
            const unique = new Set(result)
            expect(unique.size).toBe(result.length)
        })

        it("includes categories present in registry", () => {
            const result = getAvailableCategory()
            const registryCategory = new Set(
                tool_definition_list.map((t) => t.category),
            )
            for (const cat of registryCategory) {
                expect(result).toContain(cat)
            }
        })

        it("does not include categories absent from registry", () => {
            const result = getAvailableCategory()
            const registryCategory = new Set(
                tool_definition_list.map((t) => t.category),
            )
            for (const cat of result) {
                expect(registryCategory.has(cat)).toBe(true)
            }
        })
    })

    describe("getToolCount", () => {
        it("returns the correct count", () => {
            expect(getToolCount()).toBe(tool_definition_list.length)
        })

        it("returns a positive number", () => {
            expect(getToolCount()).toBeGreaterThan(0)
        })
    })

    describe("getAllTag", () => {
        it("returns sorted unique tags", () => {
            const result = getAllTag()
            const expected = Array.from(
                new Set(tool_definition_list.flatMap((t) => t.tag ?? [])),
            ).sort()
            expect(result).toEqual(expected)
        })
    })

    describe("getToolByTag", () => {
        it("returns tools containing the tag", () => {
            const allTags = getAllTag()
            if (allTags.length > 0) {
                const tag = allTags[0]
                const result = getToolByTag(tag)
                expect(result.every((t) => t.tag?.includes(tag))).toBe(true)
                expect(result.length).toBeGreaterThan(0)
            }
        })

        it("returns empty array for unknown tag", () => {
            expect(getToolByTag("unknown-tag-xyz")).toEqual([])
        })
    })

    describe("getToolByPopularity", () => {
        it("returns tools sorted by popularity descending", () => {
            const result = getToolByPopularity()
            expect(result.length).toBe(tool_definition_list.length)
            for (let i = 0; i < result.length - 1; i++) {
                expect(result[i].popularity ?? 0).toBeGreaterThanOrEqual(
                    result[i + 1].popularity ?? 0,
                )
            }
        })
    })
})
