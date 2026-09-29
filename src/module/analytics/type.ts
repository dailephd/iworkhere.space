export type AnalyticEventName =
    | "tool_opened"
    | "tool_executed"
    | "tool_result_copied"
    | "tool_mode_changed"

export interface AnalyticEventProp {
    tool_opened: { toolId: string; slug: string }
    tool_executed: { toolId: string; slug: string }
    tool_result_copied: { toolId: string; slug: string }
    tool_mode_changed: { toolId: string; slug: string; mode: string }
}

export interface AnalyticProvider {
    track<E extends AnalyticEventName>(event: E, prop: AnalyticEventProp[E]): void
    identify(id: string): void
    enable(): void
    disable(): void
}
