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
        <section>
            <h1>{tool.name}</h1>
            <p>{tool.description}</p>
            <div>{toolUi}</div>
        </section>
    );
}
