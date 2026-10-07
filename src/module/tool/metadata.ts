import { tool_definition_list } from "./registry"
import type { ToolDefinition, ToolCategory, ToolSeo, ToolId } from "./type"
import { tool_category_definition_list } from "./category"

export interface ToolBreadcrumb {
    label: string
    href?: string
}

export function getToolByIdList(id: ToolId[]): ToolDefinition[] {
    const result: ToolDefinition[] = []
    for (const one of new Set(id)) {
        const tool = tool_definition_list.find(tool => tool.id === one)
        if (tool) result.push(tool)
    }
    return result
}

export function getToolBreadcrumb(tool: ToolDefinition): ToolBreadcrumb[] {
    return [
        { label: "Home", href: "/" },
        { label: tool.category[0].toUpperCase() + tool.category.slice(1), href: `/category/${tool.category}` },
        { label: tool.name },
    ]
}

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
    const populated = new Set<ToolCategory>()
    for (const t of tool_definition_list) {
        populated.add(t.category)
    }
    return tool_category_definition_list
        .map((definition) => definition.id)
        .filter((id) => populated.has(id))
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
