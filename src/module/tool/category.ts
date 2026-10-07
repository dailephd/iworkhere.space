export interface ToolCategoryDefinition {
    id: string;
    title: string;
    description: string;
}

/*
 * Single runtime owner of canonical category identity.
 * Order is the canonical category order; the registry decides which categories
 * are populated.
 */
export const tool_category_definition_list = [
    {
        id: "document",
        title: "Document Tool",
        description: "Tool for working with PDFs and documents.",
    },
    {
        id: "text",
        title: "Text & Code Tool",
        description: "Format, transform, and analyze text and code.",
    },
    {
        id: "math",
        title: "Math & Calculator Tool",
        description: "Calculator and numerical utility.",
    },
    {
        id: "everyday",
        title: "Everyday Utility",
        description: "Simple utility for daily task.",
    },
    {
        id: "time",
        title: "Time & Date Tool",
        description: "Timezone, date, and calendar tool.",
    },
    {
        id: "image",
        title: "Image & Media Tool",
        description: "Convert, resize, and optimize image.",
    },
    {
        id: "developer",
        title: "Developer Tool",
        description: "Format, validate, transform, and inspect developer data.",
    },
] as const satisfies readonly ToolCategoryDefinition[];

export type ToolCategory = (typeof tool_category_definition_list)[number]["id"];

export function isToolCategory(value: string): value is ToolCategory {
    return tool_category_definition_list.some((definition) => definition.id === value);
}

export function getToolCategoryDefinition(category: ToolCategory): ToolCategoryDefinition {
    const definition = tool_category_definition_list.find((one) => one.id === category);
    if (!definition) {
        throw new Error(`Unknown tool category: ${category}`);
    }
    return definition;
}
