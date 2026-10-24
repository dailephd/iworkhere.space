import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { getToolCategoryDefinition, getToolCategoryLabel, isToolCategory, tool_category_definition_list } from "./category"
import { getAvailableCategory } from "./metadata"
import { tool_definition_list } from "./registry"

const categoryId = tool_category_definition_list.map((definition) => definition.id)

describe("canonical category definitions", () => {
    it("pins the canonical order with developer last", () => {
        expect(categoryId).toEqual(["document", "text", "math", "converter", "time", "image", "developer"])
    })

    it("has unique ids and non-empty titles and descriptions", () => {
        expect(new Set(categoryId).size).toBe(categoryId.length)
        for (const definition of tool_category_definition_list) {
            expect(definition.title.trim()).not.toBe("")
            expect(definition.description.trim()).not.toBe("")
        }
    })

    it("uses natural public titles and descriptions for the Document, Image and Math categories", () => {
        const legacy = {
            document: ["PDF Tools", "Merge, split, convert and compress PDF files in your browser."],
            image: ["Image Tools", "Resize, compress and convert images in your browser."],
            math: ["Math Tools", "Evaluate arithmetic expressions with a calculator."],
        } as const
        for (const [id, [title, description]] of Object.entries(legacy)) {
            expect(getToolCategoryDefinition(id as keyof typeof legacy)).toMatchObject({ id, title, description })
        }
    })

    it("names Text and Time without claiming code, time zone or calendar features", () => {
        // v0.4.3: "text and code" (no code tool in Text) and "Timezone, date, and calendar" (the only Time tool adds and subtracts HH:MM) were false.
        expect(getToolCategoryDefinition("text")).toMatchObject({ id: "text", title: "Text Tools", description: "Create URL slugs, extract text from HTML, and count words and characters." })
        expect(getToolCategoryDefinition("time")).toMatchObject({ id: "time", title: "Time Tools", description: "Add and subtract durations written as HH:MM." })
        for (const id of ["text", "time"] as const) {
            expect(getToolCategoryDefinition(id).description).not.toMatch(/timezone|calendar|\bcode\b/i)
        }
    })

    it("defines developer", () => {
        expect(getToolCategoryDefinition("developer")).toMatchObject({
            id: "developer",
            title: "Developer Tools",
            description: "Format and validate JSON, and generate QR codes.",
        })
    })

    it("validates only canonical ids", () => {
        expect(isToolCategory("developer")).toBe(true)
        for (const id of categoryId) expect(isToolCategory(id)).toBe(true)
        for (const value of ["", "everyday", "Converter", "Developer", "unknown", "toString", "__proto__", "document "]) {
            expect(isToolCategory(value)).toBe(false)
        }
    })
})

describe("category population stays registry-derived", () => {
    it("registers only canonical categories", () => {
        for (const tool of tool_definition_list) expect(isToolCategory(tool.category)).toBe(true)
    })

    it("returns populated categories in canonical order", () => {
        expect(getAvailableCategory()).toEqual(["document", "text", "math", "converter", "time", "image", "developer"])
    })

    it("omits a canonical category that has no registered tool", () => {
        const original = [...tool_definition_list]
        const remaining = original.filter(tool => tool.category !== "developer")
        tool_definition_list.splice(0, tool_definition_list.length, ...remaining)
        try {
            expect(getAvailableCategory()).toEqual(["document", "text", "math", "converter", "time", "image"])
            expect(getAvailableCategory()).not.toContain("developer")
        } finally {
            tool_definition_list.splice(0, tool_definition_list.length, ...original)
        }
        expect(getAvailableCategory()).toContain("developer")
    })
})

describe("category guidance", () => {
    const guidance = tool_category_definition_list.map((definition) => ({ id: definition.id, ...definition.guidance }))

    it("gives every populated category a task, at least one tool choice and a limitation", () => {
        expect(guidance.map((one) => one.id)).toEqual(getAvailableCategory())
        for (const one of guidance) {
            expect(one.task.trim().length, `${one.id} task`).toBeGreaterThan(40)
            expect(one.limitation.trim().length, `${one.id} limitation`).toBeGreaterThan(40)
            expect(one.choice.length, `${one.id} choice`).toBeGreaterThan(0)
            for (const choice of one.choice) expect(choice.when.trim().length, `${one.id}/${choice.toolId}`).toBeGreaterThan(10)
        }
    })

    it("is distinct per category rather than one paragraph with names substituted", () => {
        for (const field of ["task", "limitation"] as const) {
            expect(new Set(guidance.map((one) => one[field])).size, field).toBe(guidance.length)
        }
        const when = guidance.flatMap((one) => one.choice.map((choice) => choice.when))
        expect(new Set(when).size).toBe(when.length)
    })

    it("resolves every choice to a registered tool of the same category and covers every registered tool once", () => {
        for (const one of guidance) {
            const registered = tool_definition_list.filter((tool) => tool.category === one.id).map((tool) => tool.id)
            expect(one.choice.map((choice) => choice.toolId).sort(), one.id).toEqual([...registered].sort())
        }
    })

    it("does not advertise capabilities that no registered tool provides", () => {
        for (const one of guidance) {
            expect(one.task, `${one.id} task`).not.toMatch(/currency|translat|time ?zone|calendar|world clock|debug|compile|\bOCR\b|\bOffice\b|\bsign(?:ing|ature)?\b/i)
        }
    })

    it("states the honest limits of the one-tool Math and Time categories", () => {
        expect(getToolCategoryDefinition("math").guidance.limitation).toMatch(/arbitrary-precision/)
        expect(getToolCategoryDefinition("time").guidance.limitation).toMatch(/does not convert time zones/)
        expect(getToolCategoryDefinition("time").guidance.limitation).toMatch(/below 00:00/)
    })

    it("keeps the Document, Image and Converter boundaries the batch requires", () => {
        expect(getToolCategoryDefinition("document").guidance.limitation).toMatch(/do not get smaller/)
        expect(getToolCategoryDefinition("document").guidance.limitation).toMatch(/not full PDF editors/)
        expect(getToolCategoryDefinition("image").guidance.limitation).toMatch(/does not recover detail/)
        expect(getToolCategoryDefinition("converter").guidance.limitation).toMatch(/no currency, volume, area or temperature/)
        expect(getToolCategoryDefinition("developer").guidance.limitation).toMatch(/do not run, debug or compile code/)
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

it("migrates the public converter title and labels without accepting the historical id", () => {
    expect(getToolCategoryDefinition("converter")).toMatchObject({ id: "converter", title: "Converters", description: "Convert length and weight between units." });
    expect(getToolCategoryLabel("converter")).toBe("Converters");
    expect(getToolCategoryLabel("developer")).toBe("Developer");
    expect(isToolCategory("everyday")).toBe(false);
});

it("uses plural, natural category headings and describes only supported capabilities", () => {
    for (const definition of tool_category_definition_list) {
        expect(definition.title, definition.id).not.toMatch(/\bTool\b(?!s)/)
        expect(definition.title, definition.id).not.toContain("&")
        expect(`${definition.description} ${definition.guidance.task}`, definition.id).not.toMatch(/time ?zone|calendar|\bdates?\b|media/i)
    }
})
