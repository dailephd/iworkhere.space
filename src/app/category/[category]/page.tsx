import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolByCategory } from "@/module/tool/registry";
import { buildCategoryMetadata } from "@/lib/seo";
import type { ToolCategory } from "@/module/tool/type";
import Link from "next/link";

const VALID_CATEGORY: ToolCategory[] = [
    "document",
    "image",
    "text",
    "math",
    "time",
    "everyday",
];

interface CategoryPageProp {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProp): Promise<Metadata> {
    const { category } = await params;
    if (!VALID_CATEGORY.includes(category as ToolCategory)) return {};
    return buildCategoryMetadata(
        category,
        formatCategoryTitle(category as ToolCategory),
        categoryDescription(category as ToolCategory),
    );
}

export default async function CategoryPage({ params }: CategoryPageProp) {
    const { category } = await params;
    const typed = category as ToolCategory;

    if (!VALID_CATEGORY.includes(typed)) {
        return notFound();
    }

    const toolList = getToolByCategory(typed);

    return (
        <div className="page-stack">
            <header>
                <h1 className="page-title">{formatCategoryTitle(typed)}</h1>
                <p className="page-summary">{categoryDescription(typed)}</p>
            </header>

            {toolList.length === 0 ? (
                <p className="empty-state" role="status">No tool available in this category yet.</p>
            ) : (
                <ul className="tool-grid">
                    {toolList.map((tool) => (
                        <li key={tool.id} className="tool-card">
                            <Link className="tool-card-control" href={`/tool/${tool.slug}`}>
                                <span className="metadata-label capitalize">{tool.category}</span>
                                <h2 className="tool-card-title">{tool.name}</h2>
                                <p className="tool-card-summary">{tool.description}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ---------- helpers ---------- */

function formatCategoryTitle(category: ToolCategory): string {
    switch (category) {
        case "document":
            return "Document Tool";
        case "image":
            return "Image & Media Tool";
        case "text":
            return "Text & Code Tool";
        case "math":
            return "Math & Calculator Tool";
        case "time":
            return "Time & Date Tool";
        case "everyday":
            return "Everyday Utility";
        default:
            return category;
    }
}

function categoryDescription(category: ToolCategory): string {
    switch (category) {
        case "document":
            return "Tool for working with PDFs and documents.";
        case "image":
            return "Convert, resize, and optimize image.";
        case "text":
            return "Format, transform, and analyze text and code.";
        case "math":
            return "Calculator and numerical utility.";
        case "time":
            return "Timezone, date, and calendar tool.";
        case "everyday":
            return "Simple utility for daily task.";
        default:
            return "";
    }
}
