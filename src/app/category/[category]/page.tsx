import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getToolByCategory } from "@/module/tool/registry";
import { buildCategoryMetadata } from "@/lib/seo";
import { getToolCategoryDefinition, isToolCategory } from "@/module/tool/category";
import Link from "next/link";

interface CategoryPageProp {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProp): Promise<Metadata> {
    const { category } = await params;
    if (category === "everyday") permanentRedirect("/category/converter");
    if (!isToolCategory(category)) return {};
    const definition = getToolCategoryDefinition(category);
    return buildCategoryMetadata(category, definition.title, definition.description);
}

export default async function CategoryPage({ params }: CategoryPageProp) {
    const { category } = await params;
    if (category === "everyday") permanentRedirect("/category/converter");

    if (!isToolCategory(category)) {
        return notFound();
    }

    const definition = getToolCategoryDefinition(category);
    const toolList = getToolByCategory(category);
    const choiceList = definition.guidance.choice.flatMap((choice) => {
        const tool = toolList.find((one) => one.id === choice.toolId);
        return tool ? [{ name: tool.name, when: choice.when }] : [];
    });

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">{definition.title}</h1>
                <p>{definition.description}</p>
            </div>

            {toolList.length === 0 ? (
                <p>No tool available in this category yet.</p>
            ) : (
                <>
                    <section aria-labelledby="category-guidance-title" className="space-y-3 rounded-xl border border-border bg-surface p-4">
                        <h2 id="category-guidance-title" className="text-lg font-semibold text-[var(--text)]">Choosing a tool</h2>
                        <p>{definition.guidance.task}</p>
                        <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                            {choiceList.map((choice) => (
                                <li key={choice.name}><strong className="font-medium text-[var(--text)]">{choice.name}</strong>: {choice.when}</li>
                            ))}
                        </ul>
                        <p className="text-sm text-[var(--text-muted)]"><strong className="font-medium text-[var(--text)]">Keep in mind:</strong> {definition.guidance.limitation}</p>
                    </section>

                    <section aria-labelledby="category-tool-title" className="space-y-3">
                        <h2 id="category-tool-title" className="text-lg font-semibold text-[var(--text)]">Available tools</h2>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {toolList.map((tool) => (
                                <li key={tool.id} className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-[var(--accent)]">
                                    <Link className="block space-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]" href={`/tool/${tool.slug}`}>
                                        <h3 className="font-medium text-[var(--text)]">{tool.name}</h3>
                                        <p className="text-sm text-[var(--text-muted)]">{tool.description}</p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                </>
            )}
        </div>
    );
}
