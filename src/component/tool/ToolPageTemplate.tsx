import type { ToolDefinition } from "@/module/tool/type";
import type { ReactNode } from "react";

export function ToolPageTemplate({
                                     tool,
                                     toolUi,
                                 }: {
    tool: ToolDefinition;
    toolUi: ReactNode;
}) {
    return (
        <section className="page-stack">
            <header>
                <span className="metadata-label capitalize">{tool.category}</span>
                <h1 className="page-title mt-3">{tool.name}</h1>
                <p className="page-summary">{tool.description}</p>
            </header>
            <div className="tool-workspace">{toolUi}</div>
        </section>
    );
}
