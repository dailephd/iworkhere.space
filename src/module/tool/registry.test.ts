import { describe, expect, it } from "vitest"
import { getToolByCategory, getToolBySlug, tool_definition_list } from "./registry"

describe("registry invariants", () => {
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
