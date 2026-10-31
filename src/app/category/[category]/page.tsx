import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getToolByCategory } from "@/module/tool/registry";
import { buildCategoryMetadata } from "@/lib/seo";
import { getToolCategoryDefinition, isToolCategory } from "@/module/tool/category";
import Link from "next/link";
import { HomeToolIcon, HomeWorkflowIcon } from "@/app/HomeToolIcon";
import { getOperationalWorkflow } from "@/module/workflow/registry";
import type { WorkflowSlug } from "@/module/workflow/type";

/* Which workflows each category page offers. Titles and addresses come from the workflow registry; other categories list none. */
const CATEGORY_GUIDE_SLUG: Record<string, WorkflowSlug[]> = {
    document: ["assemble-pdf-packet", "pdf-pages-for-slides"],
    image: ["prepare-image-for-upload", "heic-photos-to-pdf"],
};

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

    // A one-tool category shows its tool first; repeating the task sentence and a one-item choice list would restate the card.
    const isSingleTool = toolList.length === 1;

    const guideList = (CATEGORY_GUIDE_SLUG[category] ?? []).flatMap((slug) => {
        const workflow = getOperationalWorkflow(slug);
        return workflow ? [{ slug: workflow.slug, title: workflow.title, summary: workflow.description, href: workflow.canonicalPath }] : [];
    });

    return (
        <div className="space-y-6" data-category={category}>
            <div className="space-y-2 border-l-4 border-[var(--category-color)] pl-4">
                <h1 className="text-2xl font-semibold tracking-tight">{definition.title}</h1>
                <p>{definition.description}</p>
            </div>

            {toolList.length === 0 ? (
                <p>No tool available in this category yet.</p>
            ) : (
                <>

                    <section aria-labelledby="category-tool-title" data-category={category} className="ds-board">
                      <div className="ds-section space-y-3">
                        <h2 id="category-tool-title">Available tools</h2>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {toolList.map((tool) => (
                                <li key={tool.id} className="min-w-0">
                                    <Link className="ds-card home-card flex h-full items-start gap-3 rounded-xl border p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring" href={`/tool/${tool.slug}`}>
                                        <HomeToolIcon slug={tool.slug} />
                                        <div className="min-w-0">
                                            <h3>{tool.name}</h3>
                                            <p className="mt-1">{tool.description}</p>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                      </div>
                    </section>

                    <section aria-labelledby="category-guidance-title" className="ds-surface space-y-3 rounded-xl border p-4">
                        <h2 id="category-guidance-title" className="text-lg font-semibold text-[var(--text)]">{isSingleTool ? "Before you use it" : "Choosing a tool"}</h2>
                        {!isSingleTool && <>
                            <p>{definition.guidance.task}</p>
                            <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                                {choiceList.map((choice) => (
                                    <li key={choice.name}><strong className="font-medium text-[var(--text)]">{choice.name}</strong>: {choice.when}</li>
                                ))}
                            </ul>
                        </>}
                        <p className="text-sm text-[var(--text-muted)]"><strong className="font-medium text-[var(--text)]">Keep in mind:</strong> {definition.guidance.limitation}</p>
                    </section>

                    {guideList.length > 0 && (
                        <section aria-labelledby="category-workflow-title" data-category-guide data-category={category} className="ds-board">
                          <div className="ds-section space-y-3">
                            <h2 id="category-workflow-title">Automated workflows</h2>
                            <ul className="grid gap-3 sm:grid-cols-2">
                                {guideList.map((guide) => (
                                    <li key={guide.slug} className="min-w-0">
                                        <Link className="ds-card home-card flex h-full items-start gap-3 rounded-xl border p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring" href={guide.href}>
                                            <HomeWorkflowIcon />
                                            <div className="min-w-0">
                                                <h3>{guide.title}</h3>
                                                <p className="mt-1">{guide.summary}</p>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                          </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
