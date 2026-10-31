import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getOperationalWorkflow } from "@/module/workflow/registry";

interface GuidePageProp {
    params: Promise<{ slug: string }>;
}

/* The four former manual guides are superseded by the working workflows with the same slug.
   Redirect only when the workflow is operational; every other slug is a 404. The authored manual data stays in module/content/taskGuide. */
const LEGACY_GUIDE_SLUG = [
    "prepare-image-for-upload",
    "heic-photos-to-pdf",
    "assemble-pdf-packet",
    "pdf-pages-for-slides",
] as const;

function resolveWorkflowPath(slug: string): string | undefined {
    if (!LEGACY_GUIDE_SLUG.some(legacy => legacy === slug)) return undefined;
    return getOperationalWorkflow(slug)?.canonicalPath;
}

/* Metadata runs before the page; redirecting here means no obsolete self-canonical document is ever produced. */
export async function generateMetadata({ params }: GuidePageProp): Promise<Metadata> {
    const { slug } = await params;
    const path = resolveWorkflowPath(slug);
    if (path) permanentRedirect(path);
    return {};
}

export default async function GuideDetailPage({ params }: GuidePageProp) {
    const { slug } = await params;
    const path = resolveWorkflowPath(slug);
    if (!path) return notFound();
    permanentRedirect(path);
}
