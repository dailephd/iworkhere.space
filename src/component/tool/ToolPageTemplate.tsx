import type { ToolDefinition } from "@/module/tool/type";
import type { ReactNode } from "react";
import type { ToolGuide } from "@/module/tool/guide";
import type { ToolBreadcrumb } from "@/module/tool/metadata";

interface ToolPageTemplateProp {
    tool: ToolDefinition;
    toolUi: ReactNode;
    breadcrumb: ToolBreadcrumb[];
    guide?: ToolGuide;
    relatedTool: ToolDefinition[];
}

export function ToolPageTemplate({
                                     tool,
                                     toolUi,
                                     breadcrumb,
                                     guide,
                                     relatedTool,
                                 }: ToolPageTemplateProp) {
    const relatedCategory =
        relatedTool.length > 0 && relatedTool.every((related) => related.category === relatedTool[0].category)
            ? relatedTool[0].category
            : undefined;
    const relatedHeading = relatedCategory ? `Related ${relatedCategory} tools` : "Related tools";

    return (
        <section className="min-w-0 space-y-6">
            <header className="space-y-2">
                <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
                    <ol className="flex flex-wrap items-center gap-2">
                        {breadcrumb.map((item, index) => <li key={item.label} className="flex items-center gap-2">
                            {index > 0 && <span aria-hidden="true">/</span>}
                            {item.href ? <a href={item.href} className="rounded hover:text-text">{item.label}</a> : <span aria-current="page">{item.label}</span>}
                        </li>)}
                    </ol>
                </nav>
                <h1 className="text-3xl font-semibold text-text">{tool.name}</h1>
                <p className="text-text-muted">{tool.description}</p>
            </header>
            <div>{toolUi}</div>
            {guide && <section aria-label="Tool guide" className="min-w-0 space-y-5 rounded-xl border border-panel-border bg-panel-bg p-4 sm:p-6">
                <section className="space-y-2">
                    <h2 className="text-xl font-semibold">How to use</h2>
                    <ol className="list-decimal space-y-2 pl-5 text-text-muted">{guide.instruction.map(text => <li key={text}>{text}</li>)}</ol>
                </section>
                {guide.section.map(section => <section key={section.heading} className="space-y-2">
                    <h2 className="text-xl font-semibold">{section.heading}</h2>
                    <p className="text-text-muted">{section.text}</p>
                </section>)}
                <section className="space-y-2">
                    <h2 className="text-xl font-semibold">{relatedHeading}</h2>
                    <ul className="flex flex-wrap gap-3">{relatedTool.map(related => <li key={related.id}>
                        <a href={related.seo.canonicalPath} className="inline-block rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 underline underline-offset-4">{related.name}</a>
                    </li>)}</ul>
                </section>
            </section>}
        </section>
    );
}
