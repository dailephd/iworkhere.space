import Link from "next/link";
import { PageHeader } from "@/component/common/PageHeader";
import { buildPageMetadata } from "@/lib/seo";
import { getAllGuideNode } from "@/module/content/toolFinder";
import { ToolFinderClient } from "@/module/content/ToolFinderClient";
import type { GuideResolvedTarget } from "@/module/content/ToolFinderClient";
import { getToolByIdList } from "@/module/tool/metadata";
import { getOperationalWorkflow } from "@/module/workflow/registry";

const HUB_TITLE = "Find the Right Tool or Workflow";
const HUB_DESCRIPTION = "Answer one or two short questions to find the matching browser tool or working workflow on iworkhere. The guide only points you to a page; it never opens, uploads or processes a file.";

export const metadata = buildPageMetadata({ title: HUB_TITLE, description: HUB_DESCRIPTION, canonicalPath: "/guide" });

/* Resolves every recommendation through the tool and workflow registries. A target the registries cannot supply is a contract violation, never silently omitted. */
function resolveTarget(): GuideResolvedTarget[] {
    return getAllGuideNode().flatMap((node): GuideResolvedTarget[] => {
        if (node.kind !== "recommendation") return [];
        if (node.target.kind === "tool") {
            const [tool] = getToolByIdList([node.target.toolId]);
            if (!tool) throw new Error(`Guide node ${node.id} names an unregistered tool: ${node.target.toolId}`);
            return [{ nodeId: node.id, kind: "tool", label: tool.name, href: tool.seo.canonicalPath, rationale: node.rationale }];
        }
        const workflow = getOperationalWorkflow(node.target.workflowSlug);
        if (!workflow) throw new Error(`Guide node ${node.id} names a workflow that is not operational: ${node.target.workflowSlug}`);
        return [{ nodeId: node.id, kind: "workflow", label: workflow.title, href: workflow.canonicalPath, rationale: node.rationale }];
    });
}

export default function GuideHubPage() {
    return (
        <div className="min-w-0 space-y-6">
            <PageHeader title={HUB_TITLE} description="Pick what you want to do and the guide recommends one browser tool or working workflow, with a link to open it.">
                <p className="text-sm text-text-muted">This page makes no files and sends nothing anywhere. You choose your files on the tool or workflow page it points to.</p>
            </PageHeader>
            <ToolFinderClient node={getAllGuideNode()} resolvedTarget={resolveTarget()} />
            <p className="text-sm text-text-muted">
                Prefer to browse? See <Link href="/discover" className="underline underline-offset-4 hover:no-underline">all tools</Link> or the <Link href="/workflows" className="underline underline-offset-4 hover:no-underline">working workflows</Link>.
            </p>
        </div>
    );
}
