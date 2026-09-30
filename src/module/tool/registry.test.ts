import { describe, expect, it } from "vitest"
import { getToolByCategory, getToolBySlug, tool_definition_list } from "./registry"

describe("registry invariants", () => {
    it("registers the local-only Image Resizer and resolves its image category", () => {
        const tool = getToolBySlug("image-resizer")
        expect(tool).toMatchObject({
            id: "image-resizer", slug: "image-resizer", name: "Image Resizer", category: "image",
            seo: { title: "Image Resizer", canonicalPath: "/tool/image-resizer" },
            capability: ["client-only", "offline"], tag: ["image", "resize", "utility"],
            statePolicy: { persist: "none", shareableQuery: false },
        })
        expect(tool?.Component).toBeDefined()
        expect(getToolByCategory("image")).toContain(tool)
    })
    it("all tools have unique ids", () => {
        const ids = tool_definition_list.map(t => t.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
    })

    it("all tools have unique slugs", () => {
        const slugs = tool_definition_list.map(t => t.slug)
        const uniqueSlugs = new Set(slugs)
        expect(uniqueSlugs.size).toBe(slugs.length)
    })

    it("all tools have valid categories", () => {
        const validCategories = ["document", "image", "text", "math", "time", "everyday"]
        for (const tool of tool_definition_list) {
            expect(validCategories).toContain(tool.category)
        }
    })

    it("all tools have required metadata", () => {
        for (const tool of tool_definition_list) {
            expect(tool.id).toBeDefined()
            expect(tool.slug).toBeDefined()
            expect(tool.name).toBeDefined()
            expect(tool.description).toBeDefined()
            expect(tool.seo).toBeDefined()
            expect(tool.seo.title).toBeDefined()
            expect(tool.seo.description).toBeDefined()
            expect(tool.seo.canonicalPath).toBeDefined()
            expect(tool.capability).toBeDefined()
            expect(tool.Component).toBeDefined()
        }
    })

    it("tags are lowercase and alphanumeric-ish", () => {
        for (const tool of tool_definition_list) {
            if (tool.tag) {
                for (const tag of tool.tag) {
                    expect(tag).toBe(tag.toLowerCase())
                    expect(tag).toMatch(/^[a-z0-9-]+$/)
                }
            }
        }
    })

    it("popularity is a non-negative number if present", () => {
        for (const tool of tool_definition_list) {
            if (tool.popularity !== undefined) {
                expect(typeof tool.popularity).toBe("number")
                expect(tool.popularity).toBeGreaterThanOrEqual(0)
            }
        }
    })

    it("includes the time arithmetic tool for discovery and routing", () => {
        const tool = tool_definition_list.find((entry) => entry.slug === "time-arithmetic")

        expect(tool).toBeDefined()
        expect(tool?.id).toBe("time-arithmetic")
        expect(tool?.category).toBe("time")
        expect(tool?.seo.canonicalPath).toBe("/tool/time-arithmetic")
        expect(tool?.statePolicy).toEqual({
            persist: "none",
            shareableQuery: false,
        })
        expect(tool?.Component).toBeDefined()
    })

    it("resolves the time arithmetic tool by slug", () => {
        const tool = getToolBySlug("time-arithmetic")

        expect(tool?.id).toBe("time-arithmetic")
        expect(tool?.name).toBe("Time Arithmetic")
    })

    it("registers the local offline Image Compressor and all three image tools", () => {
        const tool = getToolBySlug("image-compressor")
        expect(tool).toMatchObject({ id: "image-compressor", slug: "image-compressor", name: "Image Compressor", category: "image",
            seo: { title: "Image Compressor", canonicalPath: "/tool/image-compressor", description: "Compress JPEG, PNG, and WebP images locally in your browser." },
            capability: ["client-only", "offline"], tag: ["image", "compress", "utility"], statePolicy: { persist: "none", shareableQuery: false } })
        expect(getToolByCategory("image").map(entry => entry.slug)).toEqual(["image-resizer", "image-compressor", "image-converter"])
        expect(tool_definition_list).toHaveLength(9)
    })

    it("registers Converter with its exact offline contract", () => {
        expect(getToolBySlug("image-converter")).toMatchObject({
            id: "image-converter", slug: "image-converter", name: "JPG / PNG / WebP Converter", category: "image",
            description: "Convert JPEG, PNG, and WebP images locally in your browser.",
            seo: { title: "JPG / PNG / WebP Converter", description: "Convert JPEG, PNG, and WebP images locally in your browser.", canonicalPath: "/tool/image-converter" },
            capability: ["client-only", "offline"], tag: ["image", "converter", "jpg", "png", "webp"],
            statePolicy: { persist: "none", shareableQuery: false },
        })
        expect(getToolBySlug("image-converter")?.popularity).toBeUndefined()
    })

    it("returns undefined for an unknown slug", () => {
        expect(getToolBySlug("unknown-tool")).toBeUndefined()
    })

    it("includes the time arithmetic tool in the time category", () => {
        const tools = getToolByCategory("time")

        expect(tools.some((tool) => tool.slug === "time-arithmetic")).toBe(true)
    })

    it("returns only time-category tools for the time category query", () => {
        const tools = getToolByCategory("time")

        expect(tools.length).toBeGreaterThan(0)
        expect(tools.every((tool) => tool.category === "time")).toBe(true)
    })
})
