import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolByCategory } from "@/module/tool/registry";
import { buildCategoryMetadata } from "@/lib/seo";
import { getToolCategoryDefinition, isToolCategory } from "@/module/tool/category";
import Link from "next/link";

interface CategoryPageProp {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProp): Promise<Metadata> {
    const { category } = await params;
    if (!isToolCategory(category)) return {};
    const definition = getToolCategoryDefinition(category);
    return buildCategoryMetadata(category, definition.title, definition.description);
}

export default async function CategoryPage({ params }: CategoryPageProp) {
    const { category } = await params;

    if (!isToolCategory(category)) {
        return notFound();
    }

    const definition = getToolCategoryDefinition(category);
    const toolList = getToolByCategory(category);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">{definition.title}</h1>
                <p>{definition.description}</p>
            </div>

            {toolList.length === 0 ? (
                <p>No tool available in this category yet.</p>
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                    {toolList.map((tool) => (
                        <li key={tool.id} className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-[var(--accent)]">
                            <Link className="block space-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]" href={`/tool/${tool.slug}`}>
                                <h2 className="font-medium text-[var(--text)]">{tool.name}</h2>
                                <p className="text-sm text-[var(--text-muted)]">{tool.description}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
