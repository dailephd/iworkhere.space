import type { ToolId } from "@/module/tool/type";
import { claimMetricError } from "./errorDedup";
import type { FailureCategory } from "./metric";
import { currentMetricContext, observabilityEnabled, sendMetric } from "./transport.client";

export interface ErrorMetricContext {
    failureCategory: FailureCategory;
    toolId?: ToolId;
}

/** The error is used only for object-identity deduplication, never serialization. */
export function reportClientErrorMetric(error: unknown, context: ErrorMetricContext): void {
    try {
        if (!observabilityEnabled() || !claimMetricError(error)) return;
        sendMetric({
            type: "client-error",
            ...currentMetricContext(),
            failureCategory: context.failureCategory,
            ...(context.toolId === undefined ? {} : { toolId: context.toolId }),
        });
    } catch { /* Measurement cannot affect the page or technical logging. */ }
}
