import { describe, expect, it } from "vitest"
import { getToolByCategory, getToolBySlug, tool_definition_list } from "./registry"
import { tool_category_definition_list } from "./category"

describe("registry invariants", () => {
    it("registers exactly the five implemented public document tools", () => {
        expect(getToolByCategory("document").map(tool => tool.id)).toEqual(["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf"])
        for (const slug of ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf"]) {
            expect(getToolBySlug(slug)).toMatchObject({ id: slug, slug, category: "document", capability: ["client-only", "offline"], statePolicy: { persist: "none", shareableQuery: false }, seo: { canonicalPath: `/tool/${slug}` } })
        }
    })
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
        const validCategories: string[] = tool_category_definition_list.map(definition => definition.id)
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

    it("registers the local offline Image Compressor and all four image tools", () => {
        const tool = getToolBySlug("image-compressor")
        expect(tool).toMatchObject({ id: "image-compressor", slug: "image-compressor", name: "Image Compressor", category: "image",
            seo: { title: "Image Compressor", canonicalPath: "/tool/image-compressor", description: "Compress JPEG, PNG, and WebP images locally in your browser." },
            capability: ["client-only", "offline"], tag: ["image", "compress", "utility"], statePolicy: { persist: "none", shareableQuery: false } })
        expect(getToolByCategory("image").map(entry => entry.slug)).toEqual(["image-resizer", "image-compressor", "image-converter", "heic-converter"])
        expect(tool_definition_list).toHaveLength(18)
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

    it("registers JSON Formatter / Validator with its exact local offline developer contract", () => {
        const tool = getToolBySlug("json-formatter")
        expect(tool).toMatchObject({
            id: "json-formatter", slug: "json-formatter", name: "JSON Formatter / Validator", category: "developer",
            description: "Format, minify, and validate strict JSON locally in your browser.",
            seo: { title: "JSON Formatter / Validator", description: "Format, minify, and validate strict JSON locally in your browser without uploading your data.", canonicalPath: "/tool/json-formatter" },
            capability: ["client-only", "offline"], tag: ["json", "developer", "format", "validate", "minify", "utility"],
            statePolicy: { persist: "none", shareableQuery: false },
        })
        expect(tool?.popularity).toBeUndefined()
        expect(getToolByCategory("developer").map(entry => entry.id)).toEqual(["json-formatter"])
    })

    it("registers Word / Character Counter with its exact local offline text contract", () => {
        const tool = getToolBySlug("word-character-counter")
        expect(tool).toMatchObject({
            id: "word-character-counter", slug: "word-character-counter", name: "Word / Character Counter", category: "text",
            description: "Count words, Unicode characters, characters excluding whitespace, and lines locally in your browser.",
            seo: { title: "Word / Character Counter", description: "Count words, Unicode characters, characters excluding whitespace, and lines locally in your browser.", canonicalPath: "/tool/word-character-counter" },
            capability: ["client-only", "offline"], tag: ["text", "word", "character", "counter", "utility"],
            statePolicy: { persist: "none", shareableQuery: false },
        })
        expect(tool?.popularity).toBeUndefined()
        expect(getToolByCategory("text").map(entry => entry.id)).toEqual(["slugify", "html-text-extractor", "word-character-counter"])
    })

    it("registers QR Code Generator with its exact local offline everyday contract", () => {
        const tool = getToolBySlug("qr-code-generator")
        expect(tool).toMatchObject({
            id: "qr-code-generator", slug: "qr-code-generator", name: "QR Code Generator", category: "everyday",
            description: "Generate a QR code from text or a URL locally in your browser.",
            seo: { title: "QR Code Generator", description: "Generate a QR code from text or a URL locally in your browser and download it as a PNG.", canonicalPath: "/tool/qr-code-generator" },
            capability: ["client-only", "offline"], tag: ["qr", "code", "generator", "url", "everyday", "utility"],
            statePolicy: { persist: "none", shareableQuery: false },
        })
        expect(tool?.popularity).toBeUndefined()
        expect(getToolByCategory("everyday").map(entry => entry.id)).toEqual(["length-converter", "weight-converter", "qr-code-generator"])
    })

    it("returns undefined for an unknown slug", () => {
        expect(getToolBySlug("unknown-tool")).toBeUndefined()
    })

    it("registers HEIC with its exact local offline contract", () => {
        expect(getToolBySlug("heic-converter")).toMatchObject({
            id: "heic-converter", slug: "heic-converter", name: "HEIC → JPG / PNG Converter", category: "image",
            description: "Convert HEIC and HEIF images to JPEG or PNG locally in your browser.",
            seo: { title: "HEIC to JPG / PNG Converter", description: "Convert HEIC and HEIF images to JPEG or PNG locally in your browser.", canonicalPath: "/tool/heic-converter" },
            capability: ["client-only", "offline"], tag: ["image", "converter", "heic", "heif", "jpg", "png"],
            statePolicy: { persist: "none", shareableQuery: false },
        })
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
