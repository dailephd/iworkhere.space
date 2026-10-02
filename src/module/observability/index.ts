import { log } from "@/module/log/logger";
import { track, type AnalyticEventName, type AnalyticEventProp } from "@/module/analytics";
import { claimError } from "./errorDedup";

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
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    log.error(message, {
        ...meta,
        stack,
        originalError: error,
    });

    if (trackAsEvent) {
        track(trackAsEvent.name, trackAsEvent.prop);
    }
}
