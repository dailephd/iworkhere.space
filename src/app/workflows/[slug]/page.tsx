import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/component/common/PageHeader";
import { buildPageMetadata } from "@/lib/seo";
import { getAllOperationalWorkflow, getOperationalWorkflow } from "@/module/workflow/registry";
import { WorkflowClient } from "@/module/workflow/WorkflowClient";

interface WorkflowPageProp {
    params: Promise<{ slug: string }>;
}

/* Only operational workflows have a detail route; unknown and coming-soon slugs resolve to 404. */
export const dynamicParams = false;

export function generateStaticParams() {
    return getAllOperationalWorkflow().map(workflow => ({ slug: workflow.slug }));
}

export async function generateMetadata({ params }: WorkflowPageProp): Promise<Metadata> {
    const { slug } = await params;
    const workflow = getOperationalWorkflow(slug);
    if (!workflow) return {};
    return buildPageMetadata({ title: workflow.title, description: workflow.description, canonicalPath: workflow.canonicalPath });
}

export default async function WorkflowDetailPage({ params }: WorkflowPageProp) {
    const { slug } = await params;
    const workflow = getOperationalWorkflow(slug);
    if (!workflow) return notFound();

    return (
        <div className="space-y-6">
            <PageHeader
                title={workflow.title}
                description={workflow.description}
                breadcrumb={[{ label: "Workflows", href: "/workflows" }, { label: workflow.title }]}
            />
            <WorkflowClient slug={workflow.slug} />
            <p className="text-sm text-text-muted">
                Not what you need?{" "}
                <Link href="/guide" className="underline underline-offset-4 hover:no-underline">Find another tool or workflow</Link>.
            </p>
        </div>
    );
}
