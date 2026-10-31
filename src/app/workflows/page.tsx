import Link from "next/link"
import { buildPageMetadata } from "@/lib/seo"
import { getAllWorkflow } from "@/module/workflow/registry"

export const metadata = buildPageMetadata({
    title: "Workflows",
    description: "Automated browser workflows for iworkhere.space. Prepare an image for upload, turn HEIC photos into one PDF, assemble a PDF packet or export PDF pages as slide images. Files are processed in your browser and never uploaded.",
    canonicalPath: "/workflows",
})

/* Server composition only: workflow identity and status come from the workflow registry; nothing here processes files. */
export default function WorkflowsPage() {
    const workflowList = getAllWorkflow()
    const operational = workflowList.filter(workflow => workflow.status === "operational")
    const comingSoon = workflowList.filter(workflow => workflow.status !== "operational")

    return (
        <div className="space-y-8">
            <section className="space-y-2">
                <h1 className="text-2xl font-semibold text-[var(--text)]">Workflows</h1>
                <p data-workflows-status className="text-[var(--text-muted)]">
                    {operational.length === 1 ? "One workflow is" : `${operational.length} workflows are`} available now and run entirely in your browser.
                    {comingSoon.length > 0 ? ` The other ${comingSoon.length} are being developed and cannot be run yet.` : ""}
                </p>
            </section>

            <section aria-labelledby="workflows-available-title" className="ds-board">
                <div className="ds-section space-y-3">
                    <h2 id="workflows-available-title">Available now</h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {operational.map((workflow) => (
                            <li key={workflow.slug} data-available-workflow={workflow.slug} className="flex">
                                <Link href={workflow.canonicalPath} className="ds-card home-card group block w-full rounded-xl border p-4 focus-visible:outline-none">
                                    <h3 className="underline-offset-4 group-hover:underline">{workflow.title}</h3>
                                    <p>{workflow.description}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {comingSoon.length > 0 && (
                <section aria-labelledby="workflows-planned-title" className="ds-board">
                    <div className="ds-section space-y-3">
                        <h2 id="workflows-planned-title">Coming soon</h2>
                        <p>These workflows are not available yet.</p>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {comingSoon.map((workflow) => (
                                <li key={workflow.slug} data-planned-workflow={workflow.slug} className="ds-card home-card rounded-xl border p-4">
                                    <h3>{workflow.title}</h3>
                                    <p>Coming soon</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            <section aria-labelledby="workflows-alternative-title" className="space-y-2">
                <h2 id="workflows-alternative-title" className="text-xl font-semibold text-[var(--text)]">What works today</h2>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                    <li><Link href="/discover" className="underline underline-offset-4 hover:no-underline">Browse all individual tools</Link>, each of which runs in your browser on its own.</li>
                    <li><Link href="/guide" className="underline underline-offset-4 hover:no-underline">Find the right tool or workflow</Link>, a short question-by-question finder that points to one tool or one of the available workflows.</li>
                </ul>
            </section>
        </div>
    )
}
