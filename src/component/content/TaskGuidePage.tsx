import { PageHeader } from "@/component/common/PageHeader";

export interface TaskGuideLink {
    title: string;
    href: string;
    summary: string;
}

export interface TaskGuideStepView {
    heading: string;
    explanation: string;
    toolLink?: TaskGuideLink;
}

export interface TaskGuideExampleView {
    toolLink: TaskGuideLink;
    task: string;
    outcome: string;
    limitation: string;
    sourceLink: { title: string; href: string }[];
    outputLink: { title: string; href: string }[];
}

export interface TaskGuidePageProp {
    title: string;
    description: string;
    startingMaterial: string;
    expectedOutcome: string;
    reviewedOn: string;
    step: TaskGuideStepView[];
    example: TaskGuideExampleView[];
    verification: string[];
    limitation: string[];
    relatedToolLink: TaskGuideLink[];
}

const LINK_CLASS = "inline-block rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring";
const PANEL_CLASS = "ds-surface min-w-0 space-y-3 rounded-xl border p-4 sm:p-6";

function FileLinkList({ heading, link }: { heading: string; link: { title: string; href: string }[] }) {
    return (
        <div className="min-w-0 space-y-2">
            <h4 className="font-semibold">{heading}</h4>
            <ul className="space-y-2">{link.map(item => <li key={item.href} className="min-w-0">
                <a href={item.href} download className={`${LINK_CLASS} break-words`}>{item.title}</a>
            </li>)}</ul>
        </div>
    );
}

/**
 * Presentation-only Server Component. Every value arrives display-ready from the guide route, which resolves
 * tool names, addresses and sample facts from their owners. Nothing here processes, fetches or downloads a file.
 */
export function TaskGuidePage({ title, description, startingMaterial, expectedOutcome, reviewedOn, step, example, verification, limitation, relatedToolLink }: TaskGuidePageProp) {
    return (
        <article className="min-w-0 space-y-6">
            <PageHeader title={title} description={description}>
                <dl className={`${PANEL_CLASS} grid gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]`}>
                    <dt className="font-medium text-text">Start with</dt>
                    <dd className="text-text-muted">{startingMaterial}</dd>
                    <dt className="font-medium text-text">You end with</dt>
                    <dd className="text-text-muted">{expectedOutcome}</dd>
                    <dt className="font-medium text-text">Content checked</dt>
                    <dd className="text-text-muted"><time dateTime={reviewedOn}>{reviewedOn}</time></dd>
                </dl>
                <p className="text-sm text-text-muted">Each tool works on its own in your browser. A file you download from one tool is not passed to the next: you select it again yourself.</p>
            </PageHeader>

            <section aria-labelledby="guide-step-title" className="min-w-0 space-y-3">
                <h2 id="guide-step-title" className="text-xl font-semibold">Steps</h2>
                <ol className="list-decimal space-y-4 pl-5">{step.map(item => <li key={item.heading} className="min-w-0 space-y-1">
                    <h3 className="font-semibold text-text">{item.heading}</h3>
                    <p className="text-text-muted">{item.explanation}</p>
                    {item.toolLink && <p><a href={item.toolLink.href} className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">Open {item.toolLink.title}</a><span className="text-sm text-text-muted"> — {item.toolLink.summary}</span></p>}
                </li>)}</ol>
            </section>

            <section aria-labelledby="guide-example-title" className="min-w-0 space-y-4">
                <h2 id="guide-example-title" className="text-xl font-semibold">Worked examples</h2>
                <p className="text-text-muted">These are measured demonstrations of single steps, with files you can download. They are separate runs and are not one combined result.</p>
                {example.map(item => <section key={item.toolLink.href} className={PANEL_CLASS}>
                    <h3 className="text-lg font-semibold"><a href={item.toolLink.href} className="underline underline-offset-4">{item.toolLink.title}</a></h3>
                    <p className="text-text">{item.task}</p>
                    <p className="text-text-muted">{item.outcome}</p>
                    <p className="text-sm text-text-muted"><strong className="font-medium text-text">Keep in mind:</strong> {item.limitation}</p>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <FileLinkList heading="Sample files to start from" link={item.sourceLink} />
                        <FileLinkList heading="Results from this sample" link={item.outputLink} />
                    </div>
                </section>)}
            </section>

            <section aria-labelledby="guide-verify-title" className="min-w-0 space-y-2">
                <h2 id="guide-verify-title" className="text-xl font-semibold">How to check the result yourself</h2>
                <ul className="list-disc space-y-1 pl-5 text-text-muted">{verification.map(text => <li key={text}>{text}</li>)}</ul>
            </section>

            <section aria-labelledby="guide-limit-title" className="min-w-0 space-y-2">
                <h2 id="guide-limit-title" className="text-xl font-semibold">Limits to know</h2>
                <ul className="list-disc space-y-1 pl-5 text-text-muted">{limitation.map(text => <li key={text}>{text}</li>)}</ul>
            </section>

            <section aria-labelledby="guide-related-title" className="min-w-0 space-y-2">
                <h2 id="guide-related-title" className="text-xl font-semibold">Tools used in this guide</h2>
                <ul className="flex flex-wrap gap-3">{relatedToolLink.map(item => <li key={item.href}>
                    <a href={item.href} className={LINK_CLASS}>{item.title}</a>
                </li>)}</ul>
            </section>
        </article>
    );
}
