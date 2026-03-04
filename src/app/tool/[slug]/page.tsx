import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/module/tool/registry";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPageTemplate } from "@/component/tool/ToolPageTemplate";
import { ToolClientFrame } from "@/component/tool/ToolClientFrame";

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

    return (
        <ToolPageTemplate
            tool={tool}
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
