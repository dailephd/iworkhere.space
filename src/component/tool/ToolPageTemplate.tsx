import type { ToolDefinition } from "@/module/tool/type";
import type { ReactNode } from "react";
import type { ToolGuide } from "@/module/tool/guide";
import type { ToolBreadcrumb } from "@/module/tool/metadata";
import { AdSenseEligiblePage } from "@/component/common/AdSenseEligiblePage";
import type { ValueExample } from "@/module/tool/valueExamples";
import type { TaskGuideLink } from "@/component/content/TaskGuidePage";
import { ToolErrorBoundary } from "./ToolErrorBoundary";
import { ToolExamplePanel } from "./ToolExamplePanel";
import { PageHeader } from "@/component/common/PageHeader";
import { getToolCategoryLabel } from "@/module/tool/category";

interface ToolPageTemplateProp {
    tool: ToolDefinition;
    toolUi: ReactNode;
    breadcrumb: ToolBreadcrumb[];
    guide?: ToolGuide;
    example?: ValueExample;
    relatedTool: ToolDefinition[];
    taskGuideLink?: TaskGuideLink[];
}

export function ToolPageTemplate({
                                     tool,
                                     toolUi,
                                     breadcrumb,
                                     guide,
                                     example,
                                     relatedTool,
                                     taskGuideLink,
                                 }: ToolPageTemplateProp) {
    return (
        <ToolErrorBoundary key={tool.id} toolId={tool.id}>
            <AdSenseEligiblePage>
                <section className="min-w-0 space-y-6">
                    <PageHeader
                        title={tool.name}
                        description={tool.description}
                        breadcrumb={breadcrumb}
                        categoryId={tool.category}
                        categoryTitle={getToolCategoryLabel(tool.category)}
                    />
                    <div data-category={tool.category} data-tool-ui>{toolUi}</div>
                    {guide ? <section aria-label="Tool guide" className="min-w-0 space-y-6">
                        <section aria-labelledby="tool-how-to-use-title" data-tool-guide className="min-w-0 space-y-2 section-island rounded-xl border p-4 sm:p-6">
                            <h2 id="tool-how-to-use-title" className="text-xl font-semibold">How to use</h2>
                            <ol className="max-w-[75ch] list-decimal space-y-2 pl-5 text-text-muted">{guide.instruction.map(text => <li key={text}>{text}</li>)}</ol>
                        </section>
                        {example && <ToolExamplePanel example={example} />}
                        {guide.section.length > 0 && <section aria-labelledby="tool-reference-title" data-tool-reference className="min-w-0 space-y-4 section-island rounded-xl border p-4 sm:p-6">
                            <h2 id="tool-reference-title" className="text-xl font-semibold">Details and limits</h2>
                            {guide.section.map(section => <section key={section.heading} className="space-y-2">
                                <h3 className="text-lg font-semibold">{section.heading}</h3>
                                <p className="max-w-[75ch] text-text-muted">{section.text}</p>
                            </section>)}
                        </section>}
                        {relatedTool.length > 0 && <section aria-labelledby="tool-related-title" data-tool-related className="min-w-0 space-y-2 section-island rounded-xl border p-4 sm:p-6">
                            <h2 id="tool-related-title" className="text-xl font-semibold">Related tools</h2>
                            <ul className="flex flex-wrap gap-3">{relatedTool.map(related => <li key={related.id}>
                                <a href={related.seo.canonicalPath} className="inline-block rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 underline underline-offset-4">{related.name}</a>
                            </li>)}</ul>
                        </section>}
                    </section> : example && <ToolExamplePanel example={example} />}
                    {taskGuideLink && taskGuideLink.length > 0 && <section aria-labelledby="tool-task-guide-title" data-task-guide-link className="min-w-0 space-y-2 section-island rounded-xl border p-4 sm:p-6">
                        <h2 id="tool-task-guide-title" className="text-xl font-semibold">Use this tool in a workflow</h2>
                        <ul className="space-y-2">{taskGuideLink.map(link => <li key={link.href} className="min-w-0">
                            <a href={link.href} className="underline underline-offset-4">{link.title}</a>
                            <span className="block text-sm text-text-muted">{link.summary}</span>
                        </li>)}</ul>
                    </section>}
                </section>
            </AdSenseEligiblePage>
        </ToolErrorBoundary>
    );
}
