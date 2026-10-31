import { describe, expect, it } from "vitest"
import { getToolCategoryLabel } from "@/module/tool/category"
import { getAllTool } from "@/module/tool/metadata"
import { searchToolItem, type ToolSearchMatchItem } from "./toolSearchMatch"

const registryItem: ToolSearchMatchItem[] = getAllTool().map((one) => ({
    slug: one.slug,
    name: one.name,
    description: one.description,
    category: one.category,
    categoryLabel: getToolCategoryLabel(one.category),
    tag: one.tag,
}))

function slugOf(query: string, tag?: string | null): string[] {
    return searchToolItem(registryItem, query, tag).map((one) => one.slug)
}

describe("searchToolItem", () => {
    it("keeps registry order for an empty or punctuation-only query", () => {
        const all = registryItem.map((one) => one.slug)
        expect(slugOf("")).toEqual(all)
        expect(slugOf("   ")).toEqual(all)
        expect(slugOf("?!")).toEqual(all)
    })

    it("ranks Image Resizer first for the natural query 'resize image'", () => {
        expect(slugOf("resize image")[0]).toBe("image-resizer")
        expect(slugOf("image resize")[0]).toBe("image-resizer")
        expect(slugOf("Resize Images")[0]).toBe("image-resizer")
    })

    it("favors the converter that matches the direction of the phrase", () => {
        expect(slugOf("pdf to image")[0]).toBe("pdf-to-image")
        expect(slugOf("images to pdf")[0]).toBe("images-to-pdf")
    })

    it("finds HEIC through the registered heif tag and unmatched terms yield nothing", () => {
        expect(slugOf("heif")).toContain("heic-converter")
        expect(slugOf("heif")[0]).toBe("heic-converter")
        expect(slugOf("zzzz")).toEqual([])
        expect(slugOf("resize pdf")).toEqual([])
    })

    it("normalizes case, accents, punctuation and the listed word forms", () => {
        expect(slugOf("RESIZER")[0]).toBe("image-resizer")
        expect(slugOf("résizer")[0]).toBe("image-resizer")
        expect(slugOf("compressing pdfs")[0]).toBe("compress-pdf")
        expect(slugOf("merging, PDF files")[0]).toBe("merge-pdf")
        expect(slugOf("word counter")[0]).toBe("word-character-counter")
    })

    it("requires every meaningful token to match the same tool, in any order", () => {
        expect(slugOf("pdf merge")).toContain("merge-pdf")
        expect(slugOf("merge pdf")).toEqual(slugOf("pdf merge"))
        const twoField = searchToolItem(
            [
                { slug: "alpha", name: "Alpha", description: "red", category: "x", categoryLabel: "X" },
                { slug: "beta", name: "Beta", description: "blue", category: "x", categoryLabel: "X" },
            ],
            "red blue",
        )
        expect(twoField).toEqual([])
    })

    it("ignores filler words unless the query is only filler", () => {
        expect(slugOf("how do I resize an image please")[0]).toBe("image-resizer")
        expect(slugOf("to")).toContain("pdf-to-image")
    })

    it("scores name and slug above tag, description and category", () => {
        const item: ToolSearchMatchItem[] = [
            { slug: "one", name: "One", description: "gizmo", category: "c", categoryLabel: "C" },
            { slug: "two", name: "Two", description: "x", category: "c", categoryLabel: "C", tag: ["gizmo"] },
            { slug: "gizmo", name: "Three", description: "x", category: "c", categoryLabel: "C" },
        ]
        expect(searchToolItem(item, "gizmo").map((one) => one.slug)).toEqual(["gizmo", "two", "one"])
    })

    it("adds a phrase bonus and keeps registry order for ties", () => {
        const item: ToolSearchMatchItem[] = [
            { slug: "a", name: "Photo Crop", description: "x", category: "c", categoryLabel: "C", tag: ["crop", "photo"] },
            { slug: "b", name: "Crop Photo", description: "x", category: "c", categoryLabel: "C", tag: ["crop", "photo"] },
            { slug: "c", name: "Crop Photo Two", description: "x", category: "c", categoryLabel: "C", tag: ["crop", "photo"] },
        ]
        expect(searchToolItem(item, "crop photo").map((one) => one.slug)).toEqual(["b", "c", "a"])
        expect(searchToolItem(item, "crop").map((one) => one.slug)).toEqual(["a", "b", "c"])
    })

    it("matches the canonical category label and the category id as search-only text", () => {
        expect(slugOf("developer")).toContain("json-formatter")
        expect(slugOf("converters")).toEqual(expect.arrayContaining(["length-converter", "weight-converter"]))
    })

    it("applies the tag filter alone and together with a query", () => {
        const tagged = slugOf("", "heif")
        expect(tagged).toEqual(["heic-converter"])
        expect(slugOf("convert", "heif")).toEqual(["heic-converter"])
        expect(slugOf("resize", "heif")).toEqual([])
        expect(slugOf("", "no-such-tag")).toEqual([])
    })

    it("never mutates its input", () => {
        const frozen = Object.freeze(registryItem.map((one) => Object.freeze({ ...one, tag: Object.freeze([...(one.tag ?? [])]) })))
        const before = frozen.map((one) => one.slug)
        searchToolItem(frozen, "pdf image", "pdf")
        expect(frozen.map((one) => one.slug)).toEqual(before)
    })
})
