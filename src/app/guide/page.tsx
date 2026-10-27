import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { getAllTaskGuide } from "@/module/content/taskGuide";
import { getToolByIdList } from "@/module/tool/metadata";

const HUB_TITLE = "Practical File Workflows";
const HUB_DESCRIPTION = "Four step-by-step workflows that combine PDF and image tools in your browser: assemble a PDF packet, prepare an image for an upload, turn HEIC photos into a PDF, and make slide-ready page images.";

export const metadata = buildPageMetadata({ title: HUB_TITLE, description: HUB_DESCRIPTION, canonicalPath: "/guide" });

export default function GuideHubPage() {
    const guideList = getAllTaskGuide();

    return (
        <div className="min-w-0 space-y-6">
            <header className="space-y-2">
                <h1 className="text-3xl font-semibold text-text">{HUB_TITLE}</h1>
                <p className="text-text-muted">Some jobs need more than one tool. Each workflow below starts from a kind of file you have, names the result you can expect and the main limit, and links to the tools it uses.</p>
                <p className="text-sm text-text-muted">The tools run separately in your browser. Whatever one tool produces, you download and then select again in the next tool. Nothing is passed along for you, and these pages create no files.</p>
            </header>
            <ul className="grid gap-4 sm:grid-cols-2">
                {guideList.map(guide => {
                    const toolList = getToolByIdList(guide.step.flatMap(step => step.toolId ? [step.toolId] : []));
                    return (
                        <li key={guide.slug} data-guide={guide.slug} className="min-w-0 space-y-3 rounded-xl border border-card-border bg-card-bg p-4">
                            <h2 className="text-xl font-semibold text-text">
                                <Link href={`/guide/${guide.slug}`} className="underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">{guide.title}</Link>
                            </h2>
                            <dl className="space-y-2 text-sm">
                                <div><dt className="font-medium text-text">Start with</dt><dd className="text-text-muted">{guide.startingMaterial}</dd></div>
                                <div><dt className="font-medium text-text">You end with</dt><dd className="text-text-muted">{guide.expectedOutcome}</dd></div>
                                <div><dt className="font-medium text-text">Main limit</dt><dd className="text-text-muted">{guide.limitation[0]}</dd></div>
                            </dl>
                            <p className="text-sm text-text-muted">Tools:{" "}
                                {toolList.map((tool, index) => <span key={tool.id}>{index > 0 && ", "}<Link href={tool.seo.canonicalPath} className="underline underline-offset-4">{tool.name}</Link></span>)}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
