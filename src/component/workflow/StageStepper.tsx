export type StageStepperState = "pending" | "running" | "passed" | "skipped" | "failed" | "cancelled";

export interface StageStepperItem {
    id: string;
    label: string;
    state: StageStepperState;
    description: string;
}

export interface StageStepperProp {
    stageList: readonly StageStepperItem[];
    label?: string;
}

const STATE_LABEL: Record<StageStepperState, string> = {
    pending: "Pending",
    running: "In progress",
    passed: "Passed",
    skipped: "Skipped",
    failed: "Failed",
    cancelled: "Cancelled",
};

const STATE_MARK: Record<StageStepperState, string> = {
    pending: "-",
    running: "...",
    passed: "OK",
    skipped: "Skip",
    failed: "X",
    cancelled: "Stop",
};

/**
 * Display-only ordered stage list. It receives typed items, runs nothing, and decides nothing:
 * the state text is always spelled out so meaning never depends on color alone.
 */
export function StageStepper({ stageList, label = "Workflow stages" }: StageStepperProp) {
    return (
        <ol aria-label={label} className="stage-stepper min-w-0 space-y-2">
            {stageList.map((item, index) => (
                <li
                    key={item.id}
                    data-stage={item.id}
                    data-state={item.state}
                    aria-current={item.state === "running" ? "step" : undefined}
                    className="stage-stepper-item flex min-w-0 items-start gap-3 rounded-lg border border-border bg-surface p-3 data-[state=running]:border-[var(--accent)] data-[state=passed]:border-[var(--success)] data-[state=failed]:border-[var(--danger)] data-[state=cancelled]:border-[var(--warning)]"
                >
                    <span aria-hidden="true" className="stage-stepper-mark inline-flex min-w-10 shrink-0 justify-center rounded-md border border-border px-2 py-0.5 text-xs font-semibold">
                        {STATE_MARK[item.state]}
                    </span>
                    <span className="min-w-0 space-y-0.5">
                        <span className="block font-medium text-text">
                            {index + 1}. {item.label}
                            <span className="ml-2 text-sm font-normal text-text-muted">{STATE_LABEL[item.state]}</span>
                        </span>
                        <span className="block break-words text-sm text-text-muted">{item.description}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
}
