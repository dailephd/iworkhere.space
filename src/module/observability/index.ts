import { log } from "@/module/log/logger";
import { track, type AnalyticEventName, type AnalyticEventProp } from "@/module/analytics";
import { claimError } from "./errorDedup";
import { diagnosticContext, serializeDiagnosticError } from "./diagnostic";

/**
 * Tracks a product event (delegates to analytics).
 */
export function trackEvent<E extends AnalyticEventName>(event: E, prop: AnalyticEventProp[E]): void {
    track(event, prop);
}

/**
 * Logs a system event (delegates to logger).
 */
export function logEvent(message: string, meta?: Record<string, unknown>): void {
    log.info(message, meta);
}

/**
 * Captures an error, logs it, and optionally tracks an analytics event.
 */
export function captureError<E extends AnalyticEventName>(error: Error | unknown, meta?: Record<string, unknown>, trackAsEvent?: { name: E, prop: AnalyticEventProp[E] }): void {
    if (!claimError(error)) return;
    try {
        const diagnosticError = serializeDiagnosticError(error);
        log.error(diagnosticError.message, { ...diagnosticContext(meta), diagnosticError });
    } catch { /* Error handling cannot throw through a failed provider. */ }

    if (trackAsEvent) {
        track(trackAsEvent.name, trackAsEvent.prop);
    }
}
