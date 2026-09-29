import { tool_definition_list } from "./registry"
import type { ToolDefinition, ToolCategory, ToolSeo } from "./type"

export function getAllTool(): ToolDefinition[] {
    return tool_definition_list
}

export function getToolSeoBySlug(slug: string): ToolSeo | undefined {
    const tool = tool_definition_list.find((t) => t.slug === slug)
    return tool?.seo
}

export function getAllToolSeo(): ToolSeo[] {
    return tool_definition_list.map((t) => t.seo)
}

export function getAvailableCategory(): ToolCategory[] {
    const set = new Set<ToolCategory>()
    for (const t of tool_definition_list) {
        set.add(t.category)
    }
    return Array.from(set)
}

export function getToolCount(): number {
    return tool_definition_list.length
}

export function getAllTag(): string[] {
    const set = new Set<string>()
    for (const t of tool_definition_list) {
        if (t.tag) {
            for (const tag of t.tag) {
                set.add(tag)
            }
        }
    }
    return Array.from(set).sort()
}

export function getToolByTag(tag: string): ToolDefinition[] {
    return tool_definition_list.filter((t) => t.tag?.includes(tag))
}

export function getToolByPopularity(): ToolDefinition[] {
    return [...tool_definition_list].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
}
