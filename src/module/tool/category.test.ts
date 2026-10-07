import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { getToolCategoryDefinition, isToolCategory, tool_category_definition_list } from "./category"
import { getAvailableCategory } from "./metadata"
import { tool_definition_list } from "./registry"

const categoryId = tool_category_definition_list.map((definition) => definition.id)

describe("canonical category definitions", () => {
    it("pins the canonical order with developer last", () => {
        expect(categoryId).toEqual(["document", "text", "math", "everyday", "time", "image", "developer"])
    })

    it("has unique ids and non-empty titles and descriptions", () => {
        expect(new Set(categoryId).size).toBe(categoryId.length)
        for (const definition of tool_category_definition_list) {
            expect(definition.title.trim()).not.toBe("")
            expect(definition.description.trim()).not.toBe("")
        }
    })

    it("keeps the exact public titles and descriptions of the six pre-v0.4 categories", () => {
        const legacy = {
            document: ["Document Tool", "Tool for working with PDFs and documents."],
            image: ["Image & Media Tool", "Convert, resize, and optimize image."],
            text: ["Text & Code Tool", "Format, transform, and analyze text and code."],
            math: ["Math & Calculator Tool", "Calculator and numerical utility."],
            time: ["Time & Date Tool", "Timezone, date, and calendar tool."],
            everyday: ["Everyday Utility", "Simple utility for daily task."],
        } as const
        for (const [id, [title, description]] of Object.entries(legacy)) {
            expect(getToolCategoryDefinition(id as keyof typeof legacy)).toEqual({ id, title, description })
        }
    })

    it("defines developer", () => {
        expect(getToolCategoryDefinition("developer")).toEqual({
            id: "developer",
            title: "Developer Tool",
            description: "Format, validate, transform, and inspect developer data.",
        })
    })

    it("validates only canonical ids", () => {
        expect(isToolCategory("developer")).toBe(true)
        for (const id of categoryId) expect(isToolCategory(id)).toBe(true)
        for (const value of ["", "Developer", "unknown", "toString", "__proto__", "document "]) {
            expect(isToolCategory(value)).toBe(false)
        }
    })
})

describe("category population stays registry-derived", () => {
    it("registers only canonical categories", () => {
        for (const tool of tool_definition_list) expect(isToolCategory(tool.category)).toBe(true)
    })

    it("returns populated categories in canonical order", () => {
        expect(getAvailableCategory()).toEqual(["document", "text", "math", "everyday", "time", "image", "developer"])
    })

    it("omits a canonical category that has no registered tool", () => {
        const index = tool_definition_list.findIndex((tool) => tool.category === "developer")
        const [removed] = tool_definition_list.splice(index, 1)
        try {
            expect(getAvailableCategory()).toEqual(["document", "text", "math", "everyday", "time", "image"])
            expect(getAvailableCategory()).not.toContain("developer")
        } finally {
            tool_definition_list.splice(index, 0, removed)
        }
        expect(getAvailableCategory()).toContain("developer")
    })
})

describe("single category identity owner", () => {
    function sourceFile(directory: string): string[] {
        return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
            const path = join(directory, entry.name)
            if (entry.isDirectory()) return sourceFile(path)
            return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
        })
    }

    it("leaves no route-local category list or title/description switch under src", () => {
        const forbidden = ["VALID_" + "CATEGORY", "formatCategory" + "Title", "category" + "Description"]
        for (const path of sourceFile(join(process.cwd(), "src"))) {
            const text = readFileSync(path, "utf8")
            for (const name of forbidden) expect(text, `${path} still defines ${name}`).not.toContain(name)
        }
    })

    it("keeps ToolCategory derived rather than a hand-written union in type.ts", () => {
        const text = readFileSync(join(process.cwd(), "src/module/tool/type.ts"), "utf8")
        expect(text).not.toMatch(/"everyday"/)
        expect(text).toContain('from "./category"')
    })
})
