"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GUIDE_ROOT_NODE_ID, GuideChoice, GuideNode } from "@/module/content/toolFinder";

export interface GuideResolvedTarget {
    nodeId: string;
    kind: "tool" | "workflow";
    label: string;
    href: string;
    rationale: string;
}

export interface ToolFinderClientProp {
    node: readonly GuideNode[];
    resolvedTarget: readonly GuideResolvedTarget[];
}

const ROOT_NODE_ID: typeof GUIDE_ROOT_NODE_ID = "start";

/* Interactive decision finder. The path stack lives only in memory: no URL state, storage, network or file access. */
export function ToolFinderClient({ node, resolvedTarget }: ToolFinderClientProp) {
    const [path, setPath] = useState<string[]>([ROOT_NODE_ID]);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const userMoved = useRef(false);

    useEffect(() => {
        if (userMoved.current) headingRef.current?.focus();
    }, [path]);

    const activeId = path[path.length - 1];
    const active = node.find(one => one.id === activeId);
    const target = resolvedTarget.find(one => one.nodeId === activeId);

    function choose(option: GuideChoice) {
        if (!active || active.kind !== "question") return;
        const edge = active.choice.find(one => one.id === option.id && one.nextNodeId === option.nextNodeId);
        if (!edge || !node.some(one => one.id === edge.nextNodeId)) return;
        userMoved.current = true;
        setPath([...path, edge.nextNodeId]);
    }

    function back() {
        if (path.length < 2) return;
        userMoved.current = true;
        setPath(path.slice(0, -1));
    }

    function startOver() {
        userMoved.current = true;
        setPath([ROOT_NODE_ID]);
    }

    /* Labels of the choices already made, in order, so earlier answers stay visible. */
    const chosenLabel = path.slice(1).flatMap((nodeId, index) => {
        const parent = node.find(one => one.id === path[index]);
        const edge = parent && parent.kind === "question" ? parent.choice.find(one => one.nextNodeId === nodeId) : undefined;
        return edge ? [edge.label] : [];
    });

    const announcement = active && active.kind === "recommendation" && target ? `Recommendation: ${target.label}. ${target.rationale}` : "";

    return (
        <div data-guide-finder className="tool-work min-w-0 space-y-4">
            <div role="status" aria-live="polite" className="sr-only" data-guide-announcement>{announcement}</div>

            {chosenLabel.length > 0 && (
                <p className="text-sm text-text-muted" data-guide-chosen>You chose: {chosenLabel.join(" > ")}</p>
            )}

            {active && active.kind === "question" && (
                <section aria-labelledby="guide-node-heading" data-guide-node={active.id} className="space-y-3">
                    <h2 id="guide-node-heading" ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-xl font-semibold text-text">{active.prompt}</h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {active.choice.map(option => (
                            <li key={option.id} className="min-w-0">
                                <button type="button" data-guide-choice={option.id} onClick={() => choose(option)} className="tool-action-secondary h-full w-full justify-start! text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                                    {option.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {active && active.kind === "recommendation" && (
                <section aria-labelledby="guide-node-heading" data-guide-node={active.id} data-guide-recommendation className="tool-preview space-y-3">
                    {target ? (
                        <>
                            <h2 id="guide-node-heading" ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-xl font-semibold text-text">Recommended: {target.label}</h2>
                            <p className="text-text-muted">{target.rationale}</p>
                            <p>
                                <Link href={target.href} prefetch={false} data-guide-open className="tool-action-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">Open {target.label}</Link>
                            </p>
                        </>
                    ) : (
                        <h2 id="guide-node-heading" ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-xl font-semibold text-text">This recommendation is unavailable.</h2>
                    )}
                </section>
            )}

            {path.length > 1 && (
                <div className="flex flex-wrap gap-3">
                    <button type="button" data-guide-back onClick={back} className="tool-action-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">Back</button>
                    <button type="button" data-guide-restart onClick={startOver} className="tool-action-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">Start over</button>
                </div>
            )}
        </div>
    );
}
