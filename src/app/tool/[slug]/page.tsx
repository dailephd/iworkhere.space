import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/module/tool/registry";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPageTemplate } from "@/component/tool/ToolPageTemplate";
import { ToolClientFrame } from "@/component/tool/ToolClientFrame";
import { getToolGuide } from "@/module/tool/guide";
import { getValueExample } from "@/module/tool/valueExamples";
import { getToolBreadcrumb, getToolByIdList } from "@/module/tool/metadata";
import { getTaskGuideForTool } from "@/module/content/taskGuide";

interface ToolPageProp {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ToolPageProp): Promise<Metadata> {
    const { slug } = await params;
    const tool = getToolBySlug(slug);
    if (!tool) return {};
    return buildToolMetadata(tool.seo);
}

export default async function ToolPage({ params }: ToolPageProp) {
    const { slug } = await params;
    const tool = getToolBySlug(slug);
    if (!tool) return notFound();
    const guide = getToolGuide(tool.id);

    return (
        <ToolPageTemplate
            tool={tool}
            guide={guide}
            example={getValueExample(tool.id)}
            breadcrumb={getToolBreadcrumb(tool)}
            relatedTool={getToolByIdList(guide?.relatedToolId ?? [])}
            taskGuideLink={getTaskGuideForTool(tool.id).map(taskGuide => ({ title: taskGuide.title, href: `/guide/${taskGuide.slug}`, summary: taskGuide.expectedOutcome }))}
            toolUi={
                <ToolClientFrame
                    toolId={tool.id}
                    ToolComponent={tool.Component}
                    defaultQuery={tool.statePolicy?.defaultQuery}
                />
            }
        />
    );
}
