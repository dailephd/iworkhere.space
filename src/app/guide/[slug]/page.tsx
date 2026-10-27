import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getTaskGuide } from "@/module/content/taskGuide";
import { getToolByIdList } from "@/module/tool/metadata";
import { getValueExample } from "@/module/tool/valueExamples";
import type { ValueExampleAsset } from "@/module/tool/valueExamples";
import type { ToolDefinition } from "@/module/tool/type";
import { TaskGuidePage } from "@/component/content/TaskGuidePage";
import type { TaskGuideExampleView, TaskGuideLink } from "@/component/content/TaskGuidePage";

interface GuidePageProp {
    params: Promise<{ slug: string }>;
}

const MEDIA_TYPE_LABEL: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "image/heic": "HEIC",
};

const toToolLink = (tool: ToolDefinition): TaskGuideLink => ({ title: tool.name, href: tool.seo.canonicalPath, summary: tool.description });

function toAssetLink(asset: ValueExampleAsset) {
    const name = asset.url.slice(asset.url.lastIndexOf("/") + 1);
    const format = MEDIA_TYPE_LABEL[asset.mediaType] ?? asset.mediaType;
    const fact = [
        asset.pageCount === undefined ? undefined : `${asset.pageCount} ${asset.pageCount === 1 ? "page" : "pages"}`,
        asset.width !== undefined && asset.height !== undefined ? `${asset.width} × ${asset.height} px` : undefined,
        `${asset.bytes.toLocaleString("en-US")} bytes`,
    ].filter(Boolean).join(", ");
    return { title: `Download ${asset.role === "source" ? "source" : "result"} ${format}: ${name} (${fact})`, href: asset.url };
}

export async function generateMetadata({ params }: GuidePageProp): Promise<Metadata> {
    const { slug } = await params;
    const guide = getTaskGuide(slug);
    if (!guide) return {};
    return buildPageMetadata({ title: guide.title, description: guide.description, canonicalPath: `/guide/${guide.slug}` });
}

export default async function GuideDetailPage({ params }: GuidePageProp) {
    const { slug } = await params;
    const guide = getTaskGuide(slug);
    if (!guide) return notFound();

    const toolLinkOf = (toolId: string) => {
        const [tool] = getToolByIdList([toolId]);
        return tool ? toToolLink(tool) : undefined;
    };
    const example = guide.exampleToolId.flatMap((toolId): TaskGuideExampleView[] => {
        const value = getValueExample(toolId);
        const toolLink = toolLinkOf(toolId);
        if (!value || !toolLink) return [];
        return [{
            toolLink,
            task: value.task,
            outcome: value.outcome,
            limitation: value.limitation[0],
            sourceLink: value.source.map(toAssetLink),
            outputLink: value.output.map(toAssetLink),
        }];
    });

    return (
        <TaskGuidePage
            title={guide.title}
            description={guide.description}
            startingMaterial={guide.startingMaterial}
            expectedOutcome={guide.expectedOutcome}
            reviewedOn={guide.reviewedOn}
            step={guide.step.map(step => ({
                heading: step.heading,
                explanation: step.explanation,
                toolLink: step.toolId ? toolLinkOf(step.toolId) : undefined,
            }))}
            example={example}
            verification={guide.verification}
            limitation={guide.limitation}
            relatedToolLink={getToolByIdList(guide.relatedToolId).map(toToolLink)}
        />
    );
}
